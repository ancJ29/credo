#!/usr/bin/env bash
# ops/drill.sh <env>
# The human's drill, run once on a new box and again when the unit, the templates or the box change:
#   row 13: c-storage is killed (SIGKILL) and must answer again within 10 s, as a new process;
#   row 14: a code is registered, the box is rebooted cleanly, and c-storage must be back by itself
#   on the same build, the code answering 409 (the data outlived the reboot).
# It breaks the known state a green deploy left, so run ops/check.sh <env> after it.
# Needs /health's buildVersion (the plan's step 6) and keys on the box (a release made them).
# Expected length: about 5 minutes (the reboot and the tunnel's return take most of it).
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -eq 1 ] || {
  echo "usage: ops/drill.sh <env>" >&2
  exit 2
}
ENVNAME=$1
STEPS=7

log_start drill "$ENVNAME"
mkwork

health() { box curl -fsS -m 5 "http://127.0.0.1:$BOX_PORT/health"; }

# register <code> → the HTTP status of registering it. The keys never leave the box: they go from
# its file into curl's config on stdin, not onto a command line.
register() {
  box sudo bash -s -- "$BOX_PORT" "$1" <<'REMOTE'
set -euo pipefail
. /etc/c-storage/keys.env
printf 'header = "X-Internal-Access-Key: %s"\nheader = "X-Super-Admin-Key: %s"\n' \
  "$INTERNAL_ACCESS_KEY" "$X_SUPER_ADMIN_KEY" |
  curl -sS -m 5 -o /dev/null -w '%{http_code}' -K - -H 'Content-Type: application/json' \
    -d "{\"code\":\"$2\",\"accessKey\":\"drill-access-key\"}" "http://127.0.0.1:$1/api/services/register"
REMOTE
}

step "the tunnel to $ENVNAME's box"
box_open "$ENVNAME" || die "the box does not answer through the endpoint"
echo "box: $BOX_ID"

step "the box's disk and memory, read first"
box_floor

step "the build running, and the process"
build=$(build_of "$(health)")
[ -n "$build" ] && [ "$build" != dev ] || die "/health names no commit: release first"
echo "build: $build"
pid_before=$(box systemctl show -p MainPID --value c-storage)
echo "main pid: $pid_before"

step "kill c-storage; it must answer again within 10 s"
box 'sudo systemctl kill -s SIGKILL c-storage'
up=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  pid_now=$(box systemctl show -p MainPID --value c-storage || echo 0)
  if [ "$pid_now" != 0 ] && [ "$pid_now" != "$pid_before" ] && health >/dev/null 2>&1; then
    up=1
    break
  fi
done
expect "row 13: c-storage answers again, as a new process, within 10 s" yes "$([ "$up" = 1 ] && echo yes || echo no)"

step "register a code"
code="drill-$(date -u +%Y%m%dT%H%M%SZ)"
expect "registering $code" 201 "$(register "$code")"
boot_before=$(box cat /proc/sys/kernel/random/boot_id)

step "reboot the box, cleanly, and wait for the tunnel"
box 'sudo systemctl reboot' || true
box_close
sleep 20
back=0
for _ in $(seq 1 18); do
  if box_open "$ENVNAME" 2>/dev/null; then
    back=1
    break
  fi
  echo "the box is not back yet; trying again in 10 s"
  sleep 10
done
[ "$back" = 1 ] || die "the box did not come back through the endpoint in about 4 minutes"
echo "back at $(elapsed)"

step "after the reboot"
expect "the box rebooted (its boot id changed)" yes "$([ "$(box cat /proc/sys/kernel/random/boot_id)" != "$boot_before" ] && echo yes || echo no)"
wait_build "$build" 60 health || red "row 14: c-storage did not come back on the same build $build"
expect "row 14: the code registered before the reboot answers 409" 409 "$(register "$code")"
read_keys
echo "next: ops/check.sh $ENVNAME"

verdict
