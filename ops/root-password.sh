#!/usr/bin/env bash
# ops/root-password.sh ridge <code>…
# Gives the root of each named demo copy on ridge a new password: typed here twice, never shown, never
# logged and never kept. Every session of that root ends at its next click (the product's own write of
# a password mints a new generation, scripts/src/root-password.ts by ridge_cli root-password), nothing
# else of the copy changes, and each root is read back by a real sign-in, then signed out. The six
# demo copies only (scripts/src/demo/mapping.ts); a client's own stack is the console's, never this.
#   In order: ridge alone, main and this commit, a terminal, at least one code; the password typed
#   twice and checked against the product's rule and the codes against the mapping (no connection);
#   the stack and the tunnel; the box's disk, memory and swap, and /health naming a commit of main;
#   then each root. Nothing is written before they have passed. The password reaches node on a pipe from
#   bash's builtin printf: never argv, the environment, a here-string or a file.
# Until the first write a stop is a refusal, "== refused: <why>" and exit 2; from the write on, "error:"
# and exit 1, and the lines above name the roots set and the roots not reached (which keep their
# password; the same run again ends in the same state). By hand, from a terminal, in a worktree at
# main with pnpm install done; not during the seed's run (docs/plans/2026-11-02-ridge-root-password.md).
# Expected length: about a minute, plus the typing.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -ge 1 ] || {
  echo "usage: ops/root-password.sh ridge <code>…" >&2
  exit 2
}
ENVNAME=$1
shift
CODES=("$@")
STEPS=5
# Neither the local stack's port (3181), the check's (3191), the tunnel's (3192), the deploy's
# (3193), the operator's (3194) nor the seed's (3195).
LOCAL_PORT=${ROOT_PASSWORD_LOCAL_PORT:-3196}

# A stop before the first write is a refusal (walk/run.sh's form), lib.sh's guards included: they call
# die, which is this one from here on.
WRITTEN=0
die() {
  if [ "$WRITTEN" = 1 ]; then
    echo "error: $*" >&2
    exit 1
  fi
  echo "== refused: $*"
  exit 2
}

# An exported PASSWORD from the caller would keep its export flag and reach every child's environment.
unset PASSWORD
PASSWORD=''
# type_password: the new password, typed twice at the terminal and not shown. The prompts go to the
# terminal past the log (fd 3); the password goes nowhere but the variable, and search_extra (lib.sh's
# on_exit) searches the log for it at the end. It is not mask()ed: that puts it on grep's argv and in a
# here-string, which bash 3.2 writes to a file; a job, where ::add-mask:: would matter, is refused.
type_password() {
  local again
  printf 'New password (not shown): ' >&3
  IFS= read -rs PASSWORD || die "no password was typed"
  printf '\n' >&3
  printf 'Again: ' >&3
  IFS= read -rs again || die "no password was typed"
  printf '\n' >&3
  [ "$PASSWORD" = "$again" ] || die "the two typings differ: nothing was changed"
}

# search_extra: the end-of-run search for the password. The rule: the builtin printf on a pipe, grep -f
# reading the pattern from it; never argv, a here-string or a file.
search_extra() {
  [ -n "$PASSWORD" ] || return 0
  if printf '%s\n' "$PASSWORD" | grep -qF -f /dev/stdin -- "$LOG"; then
    final "RED  the new password is in this log: redact it in this log, and run again with another password"
    return 1
  fi
}

log_start root-password "$ENVNAME"
mkwork

step "ridge alone, a terminal, main, and this commit"
refuse_real "$ENVNAME" "root-password.sh holds ridge's demo copies alone: a client's own stack is the console's (docs/plans/2026-11-01-console-root-password.md)"
[ "${GITHUB_ACTIONS:-}" != true ] || die "the password is typed on a terminal, never in a job: run this by hand"
# fd 3 is the terminal (log_start keeps it past the log). OPS_TEST_NO_TTY is ops/test.sh's alone, on a
# machine that cannot open a pseudo-terminal: the two typings then come from a pipe.
{ [ -t 0 ] && [ -t 3 ]; } || [ "${OPS_TEST_NO_TTY:-}" = 1 ] || die "needs a terminal to type the password on"
[ ${#CODES[@]} -ge 1 ] || die "name at least one demo copy's code: ops/root-password.sh ridge <code>…"
main_synced
sha=$(git -C "$REPO_DIR" rev-parse HEAD)
git -C "$REPO_DIR" merge-base --is-ancestor "$sha" origin/main || die "$sha is not a commit of main: only main's code is run on ridge"
# The write runs the code in this tree, so this tree must be the commit /health is asked to name.
git -C "$REPO_DIR" diff --quiet HEAD || die "this tree differs from $sha: the write would run code /health cannot name"
command -v node >/dev/null || die "needs node on PATH, with pnpm install done"
[ -d "$REPO_DIR/scripts/node_modules" ] || [ -n "${RIDGE_SCRIPTS_DIR:-}" ] || die "needs pnpm install done, for the write's code"
echo "commit: $sha"

step "the password, typed twice, and the codes"
type_password
printf '%s\n' "$PASSWORD" | ridge_cli root-password --check "${CODES[@]}" || die "the password or a code is refused (the line above): nothing was changed"

step "the stack, and the tunnel"
stack_load "$ENVNAME"
[ -n "$STACK_JSON" ] || die "stack $ENVNAME does not exist"
app_load || die "$ENVNAME's stack holds no layer four yet: ops/stack.sh env $ENVNAME first"
refuse_taken_port "$LOCAL_PORT" "free it, or set ROOT_PASSWORD_LOCAL_PORT"
box_open "$ENVNAME" "$LOCAL_PORT" || die "the box does not answer through the endpoint, or 127.0.0.1:$LOCAL_PORT could not be bound"

step "the box's disk, memory and swap, and /health naming a commit of main"
box_floor
health_main_read "$LOCAL_PORT"
[ -z "$HEALTH_PROBLEM" ] || die "$HEALTH_PROBLEM: nothing was written"
ok "/health names $HEALTH_BUILD, a commit of main"

step "each root"
read_keys
box test -e /etc/c-storage/bff.env || die "the box holds no bff.env: the first app deploy makes the BFF's service (ops/app.sh $ENVNAME)"
bff_env_read
rc=0
printf '%s\n' "$PASSWORD" | INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT \
  ridge_cli root-password "${CODES[@]}" || rc=$?
# Status 2 is node's refusal, read before any write; any other failure may be after one.
if [ "$rc" != 0 ]; then
  if [ "$rc" != 2 ]; then WRITTEN=1; fi
  die "the run stopped (the lines above name the roots set and the roots not reached)"
fi
echo "set on ${#CODES[@]} root(s); every session of them ended"
