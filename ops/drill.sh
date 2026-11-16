#!/usr/bin/env bash
# ops/drill.sh <env> [--box <name>]
# The human's drill, run once on a new box and again when the unit, the templates or the box change:
#   row 13: c-storage is killed (SIGKILL) and must answer again within 10 s, as a new process; the unit's
#   main process is Litestream, c-storage its child, so both must come back new;
#   row 14: a code is registered, the box is rebooted cleanly, and c-storage must be back by itself
#   on the same build, the code answering 409 (the data outlived the reboot);
#   row 17: the copy in the bucket holds that code, and a restore to a moment before it does not.
# It breaks the known state a green deploy left, so run ops/check.sh <env> after it.
# Needs /health's buildVersion (the plan's step 6) and keys on the box (a release made them).
# Expected length: about 5 minutes (the reboot and the tunnel's return take most of it).
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

usage() {
  echo "usage: ops/drill.sh <env> [--box <name>]" >&2
  exit 2
}
[ $# -eq 1 ] || { [ $# -eq 3 ] && [ "$2" = --box ]; } || usage
ENVNAME=$1
# The home box, or one added: the drill breaks one box alone.
BOX_WANTED=${3:-home}
STEPS=8

log_start drill "$ENVNAME$([ "$BOX_WANTED" = home ] || echo "-$BOX_WANTED")"
mkwork
refuse_real "$ENVNAME" "drill.sh holds the environments that keep invented data alone (ridge): it kills the store and reboots the box, and another environment may hold a real company's records"
main_synced

health() { box curl -fsS -m 5 "http://$BOX_LISTEN_ADDR:$BOX_PORT/health"; }

# register <code> → the HTTP status of registering it. The keys never leave the box: they go from
# its file into curl's config on stdin, not onto a command line.
register() {
  box sudo bash -s -- "$BOX_PORT" "$1" "$BOX_LISTEN_ADDR" <<'REMOTE'
set -euo pipefail
. /etc/c-storage/keys.env
printf 'header = "X-Internal-Access-Key: %s"\nheader = "X-Super-Admin-Key: %s"\n' \
  "$INTERNAL_ACCESS_KEY" "$X_SUPER_ADMIN_KEY" |
  curl -sS -m 5 -o /dev/null -w '%{http_code}' -K - -H 'Content-Type: application/json' \
    -d "{\"code\":\"$2\",\"accessKey\":\"drill-access-key\"}" "http://$3:$1/api/services/register"
REMOTE
}

step "the tunnel to $ENVNAME's box"
box_open "$ENVNAME" "" "$BOX_WANTED" || die "the box does not answer through the endpoint"
echo "box: $BOX_ID"

step "the box's disk and memory, read first"
box_floor

step "the build running, and the process"
build=$(build_of "$(health)")
[ -n "$build" ] && [ "$build" != dev ] || die "/health names no commit: release first"
echo "build: $build"
# The unit's MainPID is Litestream's (it runs c-storage as its child, replicate -exec), so c-storage's own
# process is the main one's child.
pid_before=$(box systemctl show -p MainPID --value c-storage)
child_before=$(box pgrep -P "$pid_before" || echo 0)
echo "main pid (litestream): $pid_before, c-storage pid: $child_before"

step "kill c-storage; it must answer again within 10 s"
box 'sudo systemctl kill -s SIGKILL c-storage'
up=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  pid_now=$(box systemctl show -p MainPID --value c-storage || echo 0)
  child_now=$(box pgrep -P "$pid_now" || echo 0)
  if [ "$pid_now" != 0 ] && [ "$pid_now" != "$pid_before" ] && [ "$child_now" != 0 ] && [ "$child_now" != "$child_before" ] && health >/dev/null 2>&1; then
    up=1
    break
  fi
done
expect "row 13: c-storage answers again, as a new process under a new Litestream, within 10 s" yes "$([ "$up" = 1 ] && echo yes || echo no)"

step "register a code"
code="drill-$(date -u +%Y%m%dT%H%M%SZ)"
# The moment before the code, by the box's clock (the copy's times are the box's), two seconds clear of it.
before=$(box date -u +%Y-%m-%dT%H:%M:%SZ)
sleep 2
expect "registering $code" 201 "$(register "$code")"
boot_before=$(box cat /proc/sys/kernel/random/boot_id)

step "reboot the box, cleanly, and wait for the tunnel"
box 'sudo systemctl reboot' || true
box_close
sleep 20
back=0
for _ in $(seq 1 18); do
  if box_open "$ENVNAME" "" "$BOX_WANTED" 2>/dev/null; then
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

step "row 17: the copy holds the code, and a restore to a moment before it does not"
# Litestream copies each second; the code was registered before the reboot, so the copy had long to take it.
latest=$(box_restore - 0 "d$(date -u +%Y%m%dT%H%M%SZ)" | sed -n 's/^restored=//p')
[ -n "$latest" ] || die "the restore of the newest copy named no file"
expect "row 17: a restore of the newest copy holds the code $code" yes "$(box sudo grep -qaF "$code" "$latest" && echo yes || echo no)"
earlier=$(box_restore "$before" 0 "e$(date -u +%Y%m%dT%H%M%SZ)" | sed -n 's/^restored=//p')
[ -n "$earlier" ] || die "the restore to $before named no file"
expect "row 17: a restore to $before, before the code, does not" no "$(box sudo grep -qaF "$code" "$earlier" && echo yes || echo no)"
# The drill's own two files, made by it and read by it alone; the live file and the copy are not touched.
box sudo rm -f "$latest" "$earlier"
echo "next: ops/check.sh $ENVNAME"

verdict
