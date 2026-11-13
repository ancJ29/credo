#!/usr/bin/env bash
# ops/release.sh <env> [<sha>]
# Ships c-storage's arm64 binary from main to <env>'s box over the Instance Connect tunnel, runs it
# under systemd, and reads /health until it names the commit shipped. The deploy job runs it, and
# so can the human while GitHub Actions is down.
#   By hand: builds <sha> (main's tip when none) in a throwaway worktree, after c-storage's whole
#   gate; a sha main lacks is refused. Run from a worktree whose ops/ is origin/main's.
#   In the job: RELEASE_BINARY names the binary `make box` built from the commit the job runs on.
#   ridge never moves backwards: when <env> already runs a commit that has this one as a strict
#   ancestor, the log ends "superseded: <env> runs <sha>", the exit is 0, and nothing changed. The
#   deploy job's gates finish in any order, so an older push can arrive after a newer one. In the job a
#   superseded run also writes superseded=true to GITHUB_OUTPUT, and the job's later steps skip.
#   Litestream rides the release as c-storage does: the pinned arm64 archive (ops/litestream.pin), fetched
#   from its release and refused unless its SHA-256 is the pin's, or the deploy job's, already fetched and
#   checked the same way, named by LITESTREAM_ARCHIVE. The records disk is mounted on the box before
#   c-storage restarts: a blank one is formatted once, a file already on the system disk is moved onto it
#   once (the old one kept), and a blank disk whose box path in the copy's bucket holds a copy is refused,
#   since a fresh start would copy an empty file over the real one (restore it: the runbook).
#   The activity log rides the same release as a second half, after c-storage's is installed, restarted and
#   named by its /health, never before it: a failure in the log's half (no binary named in the job, a
#   checksum that differs, a unit that will not start) ends the run red naming that half and leaves
#   c-storage released and running as it is. The log's binary comes from `make check` and `make dist` in
#   services/audit-backbone by hand, or RELEASE_AUDIT_BINARY in the job; its write key is made once on the box
#   (/etc/audit-backbone/keys.env, root-only) and never rewritten.
# Needs `make box` in services/c-storage (the plan's step 6): it writes dist/c-storage stamped with the commit.
# Expected length: about 4 minutes by hand (the gate and the build), under a minute in the job.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -ge 1 ] && [ $# -le 2 ] || {
  echo "usage: ops/release.sh <env> [<sha>]" >&2
  exit 2
}
ENVNAME=$1
STEPS=10

log_start release "$ENVNAME"
mkwork
real_ok "$ENVNAME" "it ships main's commits alone, never backwards, above the box's floor"

cleanup_extra() {
  git -C "$REPO_DIR" worktree remove --force "$WORK/src" >/dev/null 2>&1 || true
}

step "the commit, which main must hold"
main_synced
if [ -n "${RELEASE_BINARY:-}" ]; then
  [ -f "$RELEASE_BINARY" ] || die "RELEASE_BINARY $RELEASE_BINARY does not exist"
  sha=$(git -C "$REPO_DIR" rev-parse HEAD)
else
  sha=$(git -C "$REPO_DIR" rev-parse --verify -q "${2:-origin/main}^{commit}") || die "'${2:-origin/main}' is not a commit"
fi
git -C "$REPO_DIR" merge-base --is-ancestor "$sha" origin/main || die "$sha is not a commit of main: only main is released"
echo "commit: $sha"

if [ -n "${RELEASE_BINARY:-}" ]; then
  binary=$RELEASE_BINARY
  src=$REPO_DIR
else
  echo "building $sha in a throwaway worktree: c-storage's gate, then make box"
  git -C "$REPO_DIR" worktree add -q --detach "$WORK/src" "$sha"
  src=$WORK/src
  make -C "$src/services/c-storage" check
  make -C "$src/services/c-storage" box
  binary=$src/services/c-storage/dist/c-storage
fi
[ -f "$binary" ] || die "no binary at $binary"
unit=$src/ops/c-storage.service
[ -f "$unit" ] || die "$sha holds no ops/c-storage.service"
BOX_PORT=$(unit_port "$unit")
want_sum=$(shasum -a 256 "$binary" | cut -d' ' -f1)
echo "binary: $(wc -c <"$binary" | tr -d ' ') bytes, sha256 $want_sum"

step "the tunnel to $ENVNAME's box"
box_open "$ENVNAME" || die "the box does not answer through the endpoint"
echo "box: $BOX_ID"
# Read before anything is sent: a superseded release changes nothing on the box.
if superseded "$ENVNAME" "$sha" box curl -fsS -m 5 "http://$BOX_LISTEN_ADDR:$BOX_PORT/health"; then
  echo "nothing sent: $sha is behind what $ENVNAME runs"
  # The deploy job reads this: the newer commit's own deploy shipped its BFF and UI, so the job ends green here.
  if [ -n "${GITHUB_OUTPUT:-}" ]; then echo superseded=true >>"$GITHUB_OUTPUT"; fi
  exit 0
fi

step "the box's disk, memory and swap, read first"
box_floor

step "the binary and the unit, sent"
# Litestream's archive is checked against the pin before a byte of it is sent (a superseded release has
# fetched nothing).
[ -f "$src/ops/litestream.yml" ] || die "$sha holds no ops/litestream.yml"
litestream_bin=$WORK/litestream.bin
litestream_binary "$litestream_bin"
litestream_sum=$(shasum -a 256 "$litestream_bin" | cut -d' ' -f1)
echo "litestream: $LITESTREAM_VERSION, binary sha256 $litestream_sum, from the pinned archive"
# Nothing here changes what runs: the binary waits beside the old one as c-storage.new and the unit
# in /opt/c-storage, until the install in the restart step.
box 'sudo install -d -m 0755 /opt/c-storage /etc/c-storage'
box 'sudo tee /opt/c-storage/c-storage.new >/dev/null' <"$binary"
got_sum=$(box 'sudo sha256sum /opt/c-storage/c-storage.new' | cut -d' ' -f1)
[ "$got_sum" = "$want_sum" ] || die "the binary arrived as $got_sum, sent as $want_sum"
box 'sudo tee /opt/c-storage/c-storage.service.new >/dev/null' <"$unit"
# The address the unit binds: the stack's, written each release (it is no secret and never moves
# while the box lives), and installed beside the unit.
printf 'LISTEN_ADDR=%s\n' "$BOX_LISTEN_ADDR" | box 'sudo tee /opt/c-storage/listen.env.new >/dev/null'
# Litestream, its configuration and the copy's address: the bucket and the disk are the stack's outputs.
RECORDS_VOLUME=$(out RecordsVolumeId)
COPY_BUCKET=$(out CopyBucketName)
[ -n "$RECORDS_VOLUME" ] && [ -n "$COPY_BUCKET" ] || die "stack $ENVNAME names no records disk or copy bucket (RecordsVolumeId, CopyBucketName): run ops/stack.sh env $ENVNAME first"
box 'sudo tee /opt/c-storage/litestream.new >/dev/null' <"$litestream_bin"
got_sum=$(box 'sudo sha256sum /opt/c-storage/litestream.new' | cut -d' ' -f1)
[ "$got_sum" = "$litestream_sum" ] || die "litestream arrived as $got_sum, sent as $litestream_sum"
box 'sudo tee /opt/c-storage/litestream.yml.new >/dev/null' <"$src/ops/litestream.yml"
# The address carries the bucket's region (?region=): Litestream takes its region from this query or its own
# region key, never from AWS_REGION, and with none it asks us-east-1 where the bucket is, which the box's role
# may not do and the box cannot reach. ops/lib.sh's box_restore reads the same address from the same file.
printf 'COPY_URL=s3://%s/%s?region=%s\nAWS_REGION=%s\n' "$COPY_BUCKET" "$COPY_PATH" "$CREDO_REGION" "$CREDO_REGION" | box 'sudo tee /opt/c-storage/copy.env.new >/dev/null'
ok "sent, checksums match"
keys_before=$(keys_sum)

step "the keys, made once"
# 32 random bytes each, from the kernel, written root-only; a release never rewrites the file.
box sudo bash -s <<'REMOTE'
set -euo pipefail
f=/etc/c-storage/keys.env
if [ -e "$f" ]; then
  echo "keys: present, left as they are"
else
  umask 077
  key() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
  tmp=$(mktemp /etc/c-storage/.keys.XXXXXX)
  printf 'INTERNAL_ACCESS_KEY=%s\nX_SUPER_ADMIN_KEY=%s\n' "$(key)" "$(key)" >"$tmp"
  chown root:root "$tmp"
  chmod 0600 "$tmp"
  mv "$tmp" "$f"
  echo "keys: made"
fi
stat -c 'keys file: mode %a, owner %U' "$f"
REMOTE

# The keys, read now to search this log for them at the end, before the restart or any journal line.
read_keys
step "the records disk, mounted"
# A blank disk is formatted once; a file on the system disk moves onto it once, c-storage stopped, the
# old one kept beside it; a blank disk with a copy waiting in the bucket stops here (exit 4).
RECORDS_RC=0
box sudo bash -s -- "$RECORDS_VOLUME" "$COPY_BUCKET" "$RECORDS_MOUNT" "$CREDO_REGION" "$COPY_PATH" <<'REMOTE' || RECORDS_RC=$?
set -euo pipefail
vol=${1//-/} bucket=$2 mnt=$3 region=$4 cpath=$5
dev=/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_$vol
[ -e "$dev" ] || { echo "the records disk $vol is not attached to this box" >&2; exit 3; }
# copy_held: succeeds when the bucket holds anything under this box's path. A listing that fails ends the step
# (exit 1), never reads as "no copy".
copy_held() {
  local have
  have=$(AWS_DEFAULT_REGION=$region aws s3api list-objects-v2 --bucket "$bucket" --prefix "$cpath/" --max-keys 1 --query KeyCount --output text) ||
    { echo "the copy's bucket could not be listed" >&2; exit 1; }
  [ "$have" != 0 ]
}
refuse_held() {
  echo "the records disk holds no c-storage.db, and s3://$bucket/$cpath/ already holds a copy: restoring it is ops/restore.sh --onto-blank, a fresh start would copy an empty file over it" >&2
  exit 4
}
install -d -m 0700 /var/lib/private "$mnt"
if mountpoint -q "$mnt"; then
  if [ ! -e "$mnt/c-storage.db" ] && copy_held; then refuse_held; fi
  echo "records disk: already mounted"
  exit 0
fi
if [ -z "$(blkid -o value -s TYPE "$dev" || true)" ]; then
  if copy_held; then refuse_held; fi
  mkfs.xfs -q "$dev"
  echo "records disk: formatted"
fi
uuid=$(blkid -o value -s UUID "$dev")
grep -q "^UUID=$uuid $mnt " /etc/fstab || { { grep -v " $mnt " /etc/fstab || true; echo "UUID=$uuid $mnt xfs defaults,nofail 0 2"; } >/etc/fstab.new && mv /etc/fstab.new /etc/fstab; }
systemctl daemon-reload
old=$mnt/c-storage.db
tmp=/run/records-new
if [ -f "$old" ]; then
  mkdir -p "$tmp"
  mount "$dev" "$tmp"
  if [ -e "$tmp/c-storage.db" ]; then
    echo "records disk: holds a file already, the one on the system disk is left"
  else
    systemctl stop c-storage || true
    cp -p "$old" "$tmp/c-storage.db"
    for ext in -wal -shm; do if [ -e "$old$ext" ]; then cp -p "$old$ext" "$tmp/c-storage.db$ext"; fi; done
    [ "$(sha256sum <"$old" | cut -d' ' -f1)" = "$(sha256sum <"$tmp/c-storage.db" | cut -d' ' -f1)" ] || { echo "the file arrived changed on the records disk" >&2; umount "$tmp"; exit 5; }
    mv "$old" "$old.moved"
    for ext in -wal -shm; do if [ -e "$old$ext" ]; then mv "$old$ext" "$old$ext.moved"; fi; done
    echo "records disk: the file moved onto it once, the old one kept as c-storage.db.moved"
  fi
  umount "$tmp"
fi
mount "$mnt"
if [ ! -e "$mnt/c-storage.db" ] && copy_held; then refuse_held; fi
echo "records disk: mounted at $mnt"
REMOTE
case $RECORDS_RC in
  0) ;;
  4) die "the records disk holds no c-storage.db and the bucket holds a copy of this box's records: nothing was started. Run ops/restore.sh $ENVNAME --onto-blank (it formats a blank disk, mounts it and restores onto it before c-storage ever starts), then release again" ;;
  *) die "the records disk could not be mounted (exit $RECORDS_RC): c-storage was not restarted" ;;
esac
box "mountpoint -q $RECORDS_MOUNT" || die "the records disk is not mounted at $RECORDS_MOUNT: c-storage is not restarted"

step "installed, and c-storage restarted"
# The renames come last, one after another, in one command: a failure before it leaves the box
# running what it ran. A rename in one directory is atomic. From here a failure leaves the new
# binary on disk (the way back is the plan's: a revert pushed to main).
box 'sudo chmod 0755 /opt/c-storage/c-storage.new &&
  sudo mv -f /opt/c-storage/listen.env.new /etc/c-storage/listen.env &&
  sudo mv -f /opt/c-storage/copy.env.new /etc/c-storage/copy.env &&
  sudo chmod 0755 /opt/c-storage/litestream.new &&
  sudo mv -f /opt/c-storage/litestream.yml.new /opt/c-storage/litestream.yml &&
  sudo mv -f /opt/c-storage/litestream.new /opt/c-storage/litestream &&
  sudo mv -f /opt/c-storage/c-storage.service.new /etc/systemd/system/c-storage.service &&
  sudo mv -f /opt/c-storage/c-storage.new /opt/c-storage/c-storage &&
  sudo systemctl daemon-reload && sudo systemctl enable c-storage 2>/dev/null && sudo systemctl restart c-storage'
box 'systemctl is-active c-storage'

step "/health names the commit"
if ! wait_build "$sha" 30 box curl -fsS -m 5 "http://$BOX_LISTEN_ADDR:$BOX_PORT/health"; then
  box 'sudo journalctl -u c-storage -n 20 --no-pager' || true
  die "release of $sha failed: the new binary is installed, c-storage did not name it"
fi
keys_unchanged "$keys_before" "$(keys_sum)"
echo "c-storage $sha is released and healthy"

# --- the activity log's half. Everything above is c-storage's and is done: nothing below can stop or undo
# it. audit_die names which half stopped, so the log reads the same to the person and to the job. ---
audit_die() { die "c-storage $sha is released and runs; the activity log's half stopped, and c-storage is as it was: $*"; }

step "the activity log: its binary, unit and key, sent"
audit_unit=$src/ops/audit-backbone.service
[ -f "$audit_unit" ] || audit_die "$sha holds no ops/audit-backbone.service"
AUDIT_PORT=$(unit_port "$audit_unit")
if [ -n "${RELEASE_AUDIT_BINARY:-}" ]; then
  audit_binary=$RELEASE_AUDIT_BINARY
  [ -f "$audit_binary" ] || audit_die "RELEASE_AUDIT_BINARY $audit_binary does not exist"
elif [ -n "${RELEASE_BINARY:-}" ]; then
  audit_die "the job names no RELEASE_AUDIT_BINARY: the log's binary must be built from the commit the job runs on"
else
  echo "building $sha's activity log: its gate, then make dist"
  make -C "$src/services/audit-backbone" check || audit_die "the activity log's gate failed"
  make -C "$src/services/audit-backbone" dist BUILD_COMMIT="$sha" || audit_die "the activity log's build failed"
  audit_binary=$src/services/audit-backbone/dist/credo-audit-backbone
fi
[ -f "$audit_binary" ] || audit_die "no activity log binary at $audit_binary"
want_audit_sum=$(shasum -a 256 "$audit_binary" | cut -d' ' -f1)
echo "activity log: $(wc -c <"$audit_binary" | tr -d ' ') bytes, sha256 $want_audit_sum"
# Nothing here changes what runs: the binary, the unit and the address wait in /opt/audit-backbone as .new
# files until the install below.
box 'sudo install -d -m 0755 /opt/audit-backbone /etc/audit-backbone' || audit_die "the log's folders could not be made"
box 'sudo tee /opt/audit-backbone/credo-audit-backbone.new >/dev/null' <"$audit_binary" || audit_die "the log's binary could not be sent"
got_audit_sum=$(box 'sudo sha256sum /opt/audit-backbone/credo-audit-backbone.new' | cut -d' ' -f1) || audit_die "the log's binary could not be read back"
[ "$got_audit_sum" = "$want_audit_sum" ] || audit_die "the log's binary arrived as $got_audit_sum, sent as $want_audit_sum"
box 'sudo tee /opt/audit-backbone/audit-backbone.service.new >/dev/null' <"$audit_unit" || audit_die "the log's unit could not be sent"
printf 'LISTEN_ADDR=%s\n' "$BOX_LISTEN_ADDR" | box 'sudo tee /opt/audit-backbone/listen.env.new >/dev/null' || audit_die "the log's address could not be sent"
# 32 random bytes from the kernel, written root-only; a release never rewrites the file.
box sudo bash -s <<'REMOTE' || audit_die "the log's key could not be made"
set -euo pipefail
f=/etc/audit-backbone/keys.env
if [ -e "$f" ]; then
  echo "activity log key: present, left as it is"
else
  umask 077
  tmp=$(mktemp /etc/audit-backbone/.keys.XXXXXX)
  printf 'ACTIVITY_WRITE_KEY=%s\n' "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" >"$tmp"
  chown root:root "$tmp"
  chmod 0600 "$tmp"
  mv "$tmp" "$f"
  echo "activity log key: made"
fi
stat -c 'activity log key file: mode %a, owner %U' "$f"
REMOTE
audit_key=$(box sudo cat /etc/audit-backbone/keys.env) || audit_die "the log's key could not be read to be masked"
mask "$(sed -n 's/^ACTIVITY_WRITE_KEY=//p' <<<"$audit_key")"

step "the activity log: installed, started, and /health names the commit"
# The renames come last, in one command; the unit's rename is the last file, so a failure before it leaves
# the log unnamed to systemd. c-storage's unit is not in this command.
box 'sudo chmod 0755 /opt/audit-backbone/credo-audit-backbone.new &&
  sudo mv -f /opt/audit-backbone/listen.env.new /etc/audit-backbone/listen.env &&
  sudo mv -f /opt/audit-backbone/credo-audit-backbone.new /opt/audit-backbone/credo-audit-backbone &&
  sudo mv -f /opt/audit-backbone/audit-backbone.service.new /etc/systemd/system/audit-backbone.service &&
  sudo systemctl daemon-reload && sudo systemctl enable audit-backbone 2>/dev/null && sudo systemctl restart audit-backbone' ||
  audit_die "the log could not be installed or started"
box 'systemctl is-active audit-backbone' || audit_die "the log is not active"
if ! wait_build "$sha" 30 box curl -fsS -m 5 "http://$BOX_LISTEN_ADDR:$AUDIT_PORT/health"; then
  box 'sudo journalctl -u audit-backbone -n 20 --no-pager' || true
  audit_die "the log is installed, and did not name $sha"
fi
echo "released $sha"
