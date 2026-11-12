#!/usr/bin/env bash
# ops/restore.sh <env> [--at <time>] [--onto-live]
# Restores c-storage's records from the copy in the bucket, on the box, with the box's own role.
# By default it writes a NEW file beside the live one (restored-<stamp>.db on the records disk) and
# touches nothing live. --at <time> (RFC 3339, such as 2026-11-12T10:00:00Z) restores the records as
# they stood at that moment; without it, the newest copy. --onto-live then stops c-storage, moves the
# live file and its companions aside (names ending .aside-<stamp>, never deleted), puts the restored
# file on the live path and starts c-storage again. On an environment that may hold real data the
# default alone runs; --onto-live is refused there.
# Needs keys on the box and a copy in the bucket (a release made them). The runbook: ops/README.md,
# "Restoring the records".
# Expected length: about a minute, plus the tunnel.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

usage() {
  echo "usage: ops/restore.sh <env> [--at <time>] [--onto-live]" >&2
  exit 2
}
[ $# -ge 1 ] || usage
ENVNAME=$1
shift
AT=-
ONTO_LIVE=0
while [ $# -gt 0 ]; do
  case $1 in
    --onto-live)
      ONTO_LIVE=1
      shift
      ;;
    --at)
      [ $# -ge 2 ] || usage
      AT=$2
      shift 2
      ;;
    *) usage ;;
  esac
done
# The time goes to the box as one word, so it is nothing but an RFC 3339 time.
if [ "$AT" != - ] && ! [[ "$AT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(Z|[+-][0-9]{2}:[0-9]{2})$ ]]; then usage; fi
STEPS=4

log_start restore "$ENVNAME"
mkwork
real_ok "$ENVNAME" "by default it writes a new file beside the live one and touches nothing live"
if [ "$REAL" = 1 ] && [ "$ONTO_LIVE" = 1 ]; then
  die "--onto-live is refused on $ENVNAME, which may hold real data: restore to the new file, look at it, and swap it in by hand from the runbook"
fi
main_synced

step "the tunnel to $ENVNAME's box"
box_open "$ENVNAME" || die "the box does not answer through the endpoint"
echo "box: $BOX_ID"

step "the box's disk and memory, read first"
box_floor

step "restoring ($([ "$AT" = - ] && echo 'the newest copy' || echo "as of $AT"), $([ "$ONTO_LIVE" = 1 ] && echo 'onto the live file' || echo 'to a new file'))"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
got=$(box_restore "$AT" "$ONTO_LIVE" "$stamp") || die "the restore failed on the box (nothing live was touched before the file was written)"
echo "$got"
if [ "$ONTO_LIVE" = 1 ]; then
  expect "c-storage answers /health after the swap" answering=yes "$(grep -x 'answering=yes' <<<"$got" || echo no)"
  echo "the old file is kept beside the live one, named c-storage.db.aside-$stamp"
else
  swap="ops/restore.sh $ENVNAME"
  if [ "$AT" != - ]; then swap="$swap --at $AT"; fi
  echo "the live file is untouched; to swap a fresh restore in: $swap --onto-live"
fi

step "the verdict"
verdict
