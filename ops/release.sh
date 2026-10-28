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
#   deploy job's gates finish in any order, so an older push can arrive after a newer one.
# Needs `make box` in c-storage (the plan's step 6): it writes dist/c-storage stamped with the commit.
# Expected length: about 4 minutes by hand (the gate and the build), under a minute in the job.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -ge 1 ] && [ $# -le 2 ] || {
  echo "usage: ops/release.sh <env> [<sha>]" >&2
  exit 2
}
ENVNAME=$1
STEPS=7

log_start release "$ENVNAME"
mkwork

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
  make -C "$src/c-storage" check
  make -C "$src/c-storage" box
  binary=$src/c-storage/dist/c-storage
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
  exit 0
fi

step "the box's disk, memory and swap, read first"
box_floor

step "the binary and the unit, sent"
# Nothing here changes what runs: the binary waits beside the old one as c-storage.new and the unit
# in /opt/c-storage, until the install in the restart step.
box 'sudo install -d -m 0755 /opt/c-storage /etc/c-storage'
box 'sudo tee /opt/c-storage/c-storage.new >/dev/null' <"$binary"
got_sum=$(box 'sudo sha256sum /opt/c-storage/c-storage.new' | cut -d' ' -f1)
[ "$got_sum" = "$want_sum" ] || die "the binary arrived as $got_sum, sent as $want_sum"
box 'sudo tee /opt/c-storage/c-storage.service.new >/dev/null' <"$unit"
ok "sent, checksum matches"
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
step "installed, and c-storage restarted"
# The renames come last, one after another, in one command: a failure before it leaves the box
# running what it ran. A rename in one directory is atomic. From here a failure leaves the new
# binary on disk (the way back is the plan's: a revert pushed to main).
box 'sudo chmod 0755 /opt/c-storage/c-storage.new &&
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
echo "released $sha"
