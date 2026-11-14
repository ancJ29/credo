#!/usr/bin/env bash
# ops/company-restore.sh ridge <code>
# Puts one demo copy on ridge back to the moment of the continuous copy's newest save, alone: the box's file is
# restored to a NEW file beside the live one (box_restore, as ops/restore.sh does), served by a second c-storage
# on the box's loopback for this run only, and scripts/src/ridge.ts's copy-company copies the named copy's
# records from it onto the live store, removing what the restored file lacks. Its neighbour (another demo copy)
# is never written by the copy: the drill proves it by a record written into each copy after the restore, the
# named one's gone after the copy and the neighbour's kept, and the compare at 0. The drill's records and the
# restored file are removed at the end, whatever the end. The demo copies only (scripts/src/demo/mapping.ts):
# a client's own stack is never reached by this.
#   In order: ridge alone, a demo copy's code, main and this commit (no connection); the stack and the tunnel;
#   the box's disk, memory and swap, and /health naming a commit of main; the restore; the second c-storage and
#   its forward; then the drill. Nothing is written before they have passed.
# Until the first write a stop is a refusal, "== refused: <why>" and exit 2; from the write on, "error:" and
# exit 1. By hand, from a terminal, in a worktree at main with pnpm install done.
# Expected length: about two minutes, plus the tunnel.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -eq 2 ] || {
  echo "usage: ops/company-restore.sh ridge <code>" >&2
  exit 2
}
ENVNAME=$1
CODE=$2
STEPS=8
# Neither the local stack's port (3181), the check's (3191), the tunnel's (3192), the deploy's (3193), the
# operator's (3194), the seed's (3195), the root password's (3196) nor the demo remake's (3197).
LIVE_PORT=${COMPANY_RESTORE_LIVE_PORT:-3198}
RESTORED_PORT=${COMPANY_RESTORE_RESTORED_PORT:-3199}
# The second c-storage's port on the box's loopback, and the most seconds it may live: it ends by itself.
# (ops/test.sh sets it to the local forward's own port, so that the forward is a no-op beside its stand-in box.)
BOX_RESTORED_PORT=${COMPANY_RESTORE_BOX_PORT:-3182}
SERVE_SECONDS=900

# A stop before the first write is a refusal (walk/run.sh's form), lib.sh's guards included.
WRITTEN=0
die() {
  if [ "$WRITTEN" = 1 ]; then
    echo "error: $*" >&2
    exit 1
  fi
  echo "== refused: $*"
  exit 2
}

RESTORED_FILE=''
NEIGHBOUR=''
# live_cli <ridge_cli arguments...>: a command of the product's own on the live ridge, through the tunnel
LIVE_READY=0
live_cli() {
  INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LIVE_PORT \
    ridge_cli "$@"
}
# drill_clear <code>: 0 when that copy holds no drill record any more; 1 when it may still hold one (the record
# could not be read or removed). A copy the record is already gone from needs no removal.
drill_clear() {
  local had
  had=$(live_cli drill-record has "$1" 2>/dev/null) || return 1
  if [ "$had" = no ]; then return 0; fi
  live_cli drill-record remove "$1" >/dev/null 2>&1
}
# The clock time by which the second c-storage has ended by itself, once it is started; empty before.
SERVE_ENDS=''
# The line every 30 seconds while the copy's whole-company walks run: a silent wait cannot be told from a freeze.
HEARTBEAT_PID=''
heartbeat() { # <clock time to give up by>
  while :; do
    for _ in $(seq 1 30); do sleep 1; done
    echo "still copying ($(date '+%H:%M:%S')); the second c-storage ends by itself by $1"
  done
}
# cleanup_extra: whatever the end, the second c-storage is ended and the restored file removed, and the
# drill's records are taken out of both copies. Both go through the one connection; when it is gone the call
# fails, and a WARN line names what was left and how to clear it (ops/check.sh's form), the run's verdict kept.
cleanup_extra() {
  local left=''
  if [ -n "$HEARTBEAT_PID" ]; then kill "$HEARTBEAT_PID" 2>/dev/null || true; fi
  if [ "$WRITTEN" = 1 ] && [ "$LIVE_READY" = 1 ]; then
    if ! drill_clear "$CODE"; then left="$left $CODE"; fi
    if [ -n "$NEIGHBOUR" ] && ! drill_clear "$NEIGHBOUR"; then left="$left $NEIGHBOUR"; fi
  fi
  if [ -n "$left" ]; then
    echo "WARN a drill record may be left in:$left (the key drill-restore under the copy's prefix); the same run again, to its end, takes them out"
  fi
  if [ -n "$RESTORED_FILE" ] && ! box_stop_restored "$RESTORED_FILE"; then
    echo "WARN the restored file $RESTORED_FILE (a whole copy of every company's records), its -wal and -shm, and /run/c-storage-restored.pid may be left on the box, and the second c-storage may still run${SERVE_ENDS:+ (it ends by itself by $SERVE_ENDS)}: on the box, sudo rm -f those three files and the pid file after it has ended"
  fi
}

log_start company-restore "$ENVNAME"
mkwork

step "ridge alone, a demo copy, main, and this commit"
refuse_real "$ENVNAME" "company-restore.sh holds ridge's demo copies alone: a client's own stack is the console's"
checked=$(ridge_cli copy-company --check "$CODE") || die "$CODE is refused (the line above): nothing was changed"
echo "$checked"
NEIGHBOUR=$(sed -n 's/^checked: .* is a demo copy, \([^ ]*\) is its neighbour for the drill$/\1/p' <<<"$checked")
[ -n "$NEIGHBOUR" ] || die "no neighbour copy was named for the drill"
main_synced
sha=$(git -C "$REPO_DIR" rev-parse HEAD)
git -C "$REPO_DIR" merge-base --is-ancestor "$sha" origin/main || die "$sha is not a commit of main: only main's code is run on ridge"
git -C "$REPO_DIR" diff --quiet HEAD || die "this tree differs from $sha: the copy would run code /health cannot name"
command -v node >/dev/null || die "needs node on PATH, with pnpm install done"
[ -d "$REPO_DIR/scripts/node_modules" ] || [ -n "${RIDGE_SCRIPTS_DIR:-}" ] || die "needs pnpm install done, for the copy's code"
echo "commit: $sha"

step "the stack, and the tunnel"
stack_load "$ENVNAME"
[ -n "$STACK_JSON" ] || die "stack $ENVNAME does not exist"
app_load || die "$ENVNAME's stack holds no layer four yet: ops/stack.sh env $ENVNAME first"
refuse_taken_port "$LIVE_PORT" "free it, or set COMPANY_RESTORE_LIVE_PORT"
refuse_taken_port "$RESTORED_PORT" "free it, or set COMPANY_RESTORE_RESTORED_PORT"
box_open "$ENVNAME" "$LIVE_PORT" || die "the box does not answer through the endpoint, or 127.0.0.1:$LIVE_PORT could not be bound"

step "the box's disk, memory and swap, and /health naming a commit of main"
box_floor
health_main_read "$LIVE_PORT"
[ -z "$HEALTH_PROBLEM" ] || die "$HEALTH_PROBLEM: nothing was written"
ok "/health names $HEALTH_BUILD, a commit of main"
read_keys
box test -e /etc/c-storage/bff.env || die "the box holds no bff.env: the first app deploy makes the BFF's service (ops/app.sh $ENVNAME)"
bff_env_read
LIVE_READY=1
for c in "$CODE" "$NEIGHBOUR"; do
  live_cli drill-record has "$c" >/dev/null || die "$c is not on $ENVNAME: nothing was changed"
done

step "the box's file restored to a new file"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
# The name is known before the restore writes (box_restore names its file from the stamp), so a stop inside it
# still removes the file.
RESTORED_FILE=$RECORDS_MOUNT/restored-c$stamp.db
got=$(box_restore - 0 "c$stamp") || die "the restore failed on the box; it touched nothing live"
[ "$(sed -n 's/^restored=//p' <<<"$got")" = "$RESTORED_FILE" ] || die "the restore named another file than $RESTORED_FILE"
echo "restored: $RESTORED_FILE"

step "a second c-storage on the restored file, for this run alone"
SERVE_ENDS=$(clock $(($(date +%s) + SERVE_SECONDS + 60)))
box_serve_restored "$RESTORED_FILE" "$BOX_RESTORED_PORT" "$SERVE_SECONDS" || die "the second c-storage did not start"
box_forward "$RESTORED_PORT" "$BOX_RESTORED_PORT" || die "the second forward could not be opened"
curl -fsS -m 5 -o /dev/null "http://127.0.0.1:$RESTORED_PORT/health" || die "the second c-storage does not answer through its forward"
ok "the restored file answers on 127.0.0.1:$RESTORED_PORT"
drill() { live_cli drill-record "$1" "$2"; }

step "a record written into the named copy and its neighbour, after the restore"
WRITTEN=1
drill put "$CODE"
drill put "$NEIGHBOUR"
expect "the named copy holds its drill record" yes "$(drill has "$CODE")"

step "the named copy copied back from the restored file"
copy_ends=$(clock $(($(date +%s) + SERVE_SECONDS)))
echo "the copy's three whole-company walks over the tunnel may take up to $((SERVE_SECONDS / 60)) minutes (the second c-storage ends by itself then), until $copy_ends; a line follows every 30 seconds"
heartbeat "$copy_ends" &
HEARTBEAT_PID=$!
rc=0
FROM_C_STORAGE_URL=http://127.0.0.1:$RESTORED_PORT FROM_INTERNAL_ACCESS_KEY=$INTERNAL_KEY FROM_SERVICE_CODE=$SERVICE_CODE FROM_SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY \
  live_cli copy-company "$CODE" || rc=$?
kill "$HEARTBEAT_PID" 2>/dev/null || true
HEARTBEAT_PID=''
[ "$rc" = 0 ] || die "the copy stopped (the lines above say where; the same run again goes on from the compare)"

step "the verdict"
expect "the named copy's drill record is gone" no "$(drill has "$CODE")"
expect "the neighbour's drill record is kept" yes "$(drill has "$NEIGHBOUR")"
drill remove "$NEIGHBOUR"
expect "the neighbour's drill record is removed" no "$(drill has "$NEIGHBOUR")"
verdict
