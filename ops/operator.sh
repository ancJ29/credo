#!/usr/bin/env bash
# ops/operator.sh <env> [--replace] [<name>]
# Makes the operator on <env> (the name `operator` when none is given) and shows their one-time join
# link, `<app address>/operator/join#<token>`, on this terminal once, never in the log: the link is
# written past the log to the terminal, then searched for in the log at the end. The operator opens it
# and makes their first passkey. With --replace the operator is given a new-passkey link instead, the
# way back from lost passkeys: using it replaces every passkey they held and ends their sessions. It
# writes through a tunnel, with the BFF's own service and the product's own functions
# (scripts/src/ridge.ts), so the records are what the sign-in reads.
# The human's alone: it refuses to run in GitHub's job or without a terminal.
# Needs layer four made and the first app deploy done (ops/app.sh makes the BFF's service and its keys).
# Run from a worktree whose ops/ is origin/main's, with pnpm install done. Expected length: a minute.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -ge 1 ] && [ $# -le 3 ] || {
  echo "usage: ops/operator.sh <env> [--replace] [<name>]" >&2
  exit 2
}
ENVNAME=$1
shift
STEPS=4
# Neither the local stack's port (3181), the check's (3191), the tunnel's (3192) nor the deploy's (3193).
LOCAL_PORT=${OPERATOR_LOCAL_PORT:-3194}

[ "${GITHUB_ACTIONS:-}" != true ] || die "the operator's link is shown on a terminal, never in a job's log: run this by hand"

log_start operator "$ENVNAME"
mkwork

step "main, and the terminal"
main_synced
# fd 3 is the terminal (log_start keeps it past the log). The ridge command's own fd 3 is a file
# in the scratch folder, for this run alone, so the script can mask the link before it shows it.
# OPS_TEST_NO_TTY is ops/test.sh's alone, on a machine that cannot open a pseudo-terminal: it lets the
# link land on fd 3 whatever fd 3 is, which is the caller's own stdout.
[ -t 3 ] || [ "${OPS_TEST_NO_TTY:-}" = 1 ] || die "needs a terminal to show the link on"
command -v node >/dev/null || die "needs node on PATH, with pnpm install done"

step "layer four, and the BFF's keys"
stack_load "$ENVNAME"
[ -n "$STACK_JSON" ] || die "stack $ENVNAME does not exist"
app_load || die "$ENVNAME's stack holds no layer four yet: ops/stack.sh env $ENVNAME first"
refuse_taken_port "$LOCAL_PORT" "free it, or set OPERATOR_LOCAL_PORT"
box_open "$ENVNAME" "$LOCAL_PORT" || die "the box does not answer through the endpoint, or 127.0.0.1:$LOCAL_PORT could not be bound"
read_keys
box test -e /etc/c-storage/bff.env || die "the box holds no bff.env: the first app deploy makes the BFF's service (ops/app.sh $ENVNAME)"
bff_env_read

step "the operator and their link"
: >"$WORK/shown"
# The link names the app's address (the function's APP_ORIGIN, which app.sh sets from it), so the passkey is
# bound to the name the operator opens.
INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT \
  APP_ORIGIN=${APP_ADDRESS%/} ridge_cli operator "$@" 3>"$WORK/shown" || die "the operator could not be written"
shown=$(cat "$WORK/shown")
link=$(sed -n 's/^.* link //p' <<<"$shown")
[ -n "$link" ] || die "the operator was written but no link came back: run it again with --replace"
mask "$link"
mask "${link##*#}"
rm -f "$WORK/shown"

step "the link, on this terminal alone"
printf '%s\n' "$shown" >&3
echo "shown once on the terminal; it is in no log (searched for at the end of this run)"
