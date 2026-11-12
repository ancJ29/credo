#!/usr/bin/env bash
# ops/demo-remake.sh ridge [--go-on]
# Remakes the six demo copies on ridge in one run: each copy deleted to zero records, made again under its
# partner's password, and filled with 21 days ending yesterday (the node half is scripts/src/ridge.ts:
# ridge_cli remake, then ridge_cli seed --round until no copy is behind). One password a partner (p1, p2,
# then yours), each typed here twice, never shown, never logged and never kept; each is checked against
# that partner's codes before anything is touched, then each copy's sign-in is read back by the node half.
#   In order: ridge alone, a terminal, main and this commit; the passwords typed twice and checked (no
#   connection); the six copies listed and the words "remake ridge" typed back; the stack and the tunnel;
#   the box's disk, memory and swap, and /health naming a commit of main that is this one (or an earlier one
#   that differs in no deployed path), with the BFF's function; then the remake, then the fill in rounds.
#   Nothing is written before they have passed. Each password reaches node on a pipe from bash's builtin
#   printf: never argv, the environment, a here-string or a file.
# The fill goes in rounds because a tunnel lasts the endpoint's hour and 21 days are about 157 minutes at
# 7.5 minutes a day: each round is a new tunnel and a new read of /health, 5 days a copy at most (about 38
# minutes), and a line every 30 seconds while it runs. A tunnel that drops ends the run red; --go-on then
# runs the rounds that are left from the ledger, asks nothing and deletes nothing.
# Until the first delete a stop is a refusal, "== refused: <why>" and exit 2; from the delete on, "error:"
# and exit 1: the same run again, or --go-on once the copies are made. By hand, from a terminal, in a
# worktree at main with pnpm install done; not during the seed's run, nor with a session open on a copy
# you mean to keep. Expected length: about 2.6 hours (up to 4), plus the typing.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

usage() {
  echo "usage: ops/demo-remake.sh ridge [--go-on]" >&2
  exit 2
}
[ $# -ge 1 ] && [ $# -le 2 ] || usage
ENVNAME=$1
GO_ON=0
if [ $# -eq 2 ]; then
  [ "$2" = --go-on ] || usage
  GO_ON=1
fi
STEPS=6
# Neither the local stack's port (3181), the check's (3191), the tunnel's (3192), the deploy's (3193), the
# operator's (3194), the seed's (3195) nor the root password's (3196).
LOCAL_PORT=${DEMO_REMAKE_LOCAL_PORT:-3197}
# The seconds between the lines a round prints while it runs; the tests shorten it, the run does not.
TICK=${DEMO_REMAKE_TICK:-30}
# The wait the notice names: 21 days in 5 rounds of about 38 minutes, the remake and the reads beside them.
WAIT_MIN=160
MAX_ROUNDS=8

# A stop before the first delete is a refusal (walk/run.sh's form), lib.sh's guards included: they call
# die, which is this one from here on.
WRITTEN=0
die() {
  if [ "$WRITTEN" = 1 ]; then
    echo "error: $*" >&2
    exit 1
  fi
  # on stderr, as lib.sh's die writes: a refusal inside a command substitution is then shown, not captured
  echo "== refused: $*" >&2
  exit 2
}

# The passwords, one a partner, in the order of the mapping. An exported PASSWORD from the caller would keep
# its export flag; these are plain variables of this shell.
PARTNERS=()
COPIES=()
PWS=()
ROUND_PID=''
# NEXT: what to run when the run stops while a round opens its tunnel (empty outside that), printed as the run ends
NEXT=''

# mapping_read: PARTNERS (each label once) and COPIES ("<label> <code>"), from the mapping.
mapping_read() {
  local out line label p seen
  out=$(cd "${RIDGE_SCRIPTS_DIR:-$REPO_DIR/scripts}" && clean node --import tsx -e "import('./src/demo/mapping.ts').then((m) => console.log(m.allCopies().map((c) => c.partner + ' ' + c.code).join('\n')))") ||
    die "the mapping of the demo copies could not be read"
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    COPIES+=("$line")
    label=${line%% *}
    seen=0
    for p in ${PARTNERS[@]+"${PARTNERS[@]}"}; do
      if [ "$p" = "$label" ]; then seen=1; fi
    done
    if [ "$seen" = 0 ]; then PARTNERS+=("$label"); fi
  done <<<"$out"
  [ ${#COPIES[@]} -gt 0 ] || die "the mapping names no demo copy"
}

# type_password <partner>: that partner's password, typed twice at the terminal and not shown. The prompts go
# to the terminal past the log (fd 3); the password goes nowhere but PWS.
type_password() {
  local pw again
  # bash 3.2 keeps the export flag of a caller's variable of the same name on a local: drop it here
  declare +x pw again
  printf 'Password for %s (not shown): ' "$1" >&3
  IFS= read -rs pw || die "no password was typed"
  printf '\n' >&3
  printf 'Again: ' >&3
  IFS= read -rs again || die "no password was typed"
  printf '\n' >&3
  [ "$pw" = "$again" ] || die "the two typings of $1 differ: nothing was changed"
  PWS+=("$pw")
}

# passwords_pipe: one line a partner, the label, a space and the password, on a pipe from a builtin
passwords_pipe() {
  local i
  for i in "${!PARTNERS[@]}"; do
    printf '%s %s\n' "${PARTNERS[$i]}" "${PWS[$i]}"
  done
}

# search_extra: the end-of-run search for each password. The rule: the builtin printf on a pipe, grep -f
# reading the pattern from it; never argv, a here-string or a file.
search_extra() {
  local i=0
  # indexed, so no variable holding a password is ever a loop variable another shell exported (bash 3.2)
  while [ "$i" -lt "${#PWS[@]}" ]; do
    if [ -n "${PWS[$i]}" ] && printf '%s\n' "${PWS[$i]}" | grep -qF -f /dev/stdin -- "$LOG"; then
      final "RED  a password is in this log: redact it in this log, and run again with other passwords"
      return 1
    fi
    i=$((i + 1))
  done
}

# kill_tree <pid>: the process and everything it started, children first
kill_tree() {
  # pgrep ends non-zero when there is no child (and where it cannot read the process list): never a stop
  { pgrep -P "$1" 2>/dev/null || true; } | while IFS= read -r child; do kill_tree "$child"; done
  kill "$1" 2>/dev/null || true
}

# cleanup_extra: a round still running when the run ends is ended with it
cleanup_extra() {
  if [ -n "$ROUND_PID" ]; then kill_tree "$ROUND_PID"; fi
  if [ -n "$NEXT" ]; then echo "$NEXT" >&2; fi
}

# clock_after <minutes> → HH:MM that many minutes from now, read by date here
clock_after() {
  clock $(($(date +%s) + $1 * 60))
}

# tunnel_up: the open connection answers
tunnel_up() {
  ssh -S "$WORK/cm" -O check -o LogLevel=ERROR "$BOX_USER@$BOX_ID" >/dev/null 2>&1
}

# open_tunnel: a new tunnel, then the box's floor, /health and the BFF's function naming this commit (seed.sh's
# rule), then the keys, for the next node call.
open_tunnel() {
  local body running deploy_paths paths path held fn_commit
  box_close
  refuse_taken_port "$LOCAL_PORT" "free it, or set DEMO_REMAKE_LOCAL_PORT"
  box_open "$ENVNAME" "$LOCAL_PORT" || die "the box does not answer through the endpoint, or 127.0.0.1:$LOCAL_PORT could not be bound"
  box_floor
  body=$(curl -fsS -m 5 "http://127.0.0.1:$LOCAL_PORT/health" || true)
  running=$(build_of "$body")
  [ -n "$running" ] && [ "$running" != dev ] || die "/health names no commit (answered: ${body:-nothing})"
  if [ "$running" != "$sha" ]; then
    # A push that touches none of ci.yml's paths deploys nothing, so ridge may still run the commit before it.
    deploy_paths=()
    paths=$(push_paths "$REPO_DIR/.github/workflows/ci.yml") || exit 1
    while IFS= read -r path; do deploy_paths+=("$path"); done <<<"$paths"
    held=no
    if git -C "$REPO_DIR" merge-base --is-ancestor "$running" "$sha" 2>/dev/null &&
      git -C "$REPO_DIR" diff --quiet "$running" "$sha" -- "${deploy_paths[@]}"; then
      held=yes
    fi
    [ "$held" = yes ] || die "/health names $running, not $sha; ridge must run this commit, or an earlier one that differs from it in no path ci.yml deploys on"
  fi
  fn_commit=$(aws lambda get-function-configuration --function-name "$BFF_NAME" --query Description --output text)
  [ "$fn_commit" = "$running" ] || die "the BFF's function names ${fn_commit:-no commit}, /health $running; the deploy did not finish"
  ok "/health names $running, and so does the BFF's function"
  read_keys
  box test -e /etc/c-storage/bff.env || die "the box holds no bff.env: the first app deploy makes the BFF's service (ops/app.sh $ENVNAME)"
  bff_env_read
}

# round_run: one round of the fill on the open tunnel, its output in $WORK/round.out, a line every TICK seconds
# while it runs; a tunnel that is no longer up ends the round and the run.
round_run() {
  local sec=0 rc=0
  : >"$WORK/round.out"
  INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT \
    ridge_cli seed --round >"$WORK/round.out" 2>&1 &
  ROUND_PID=$!
  while kill -0 "$ROUND_PID" 2>/dev/null; do
    sleep 1 >/dev/null 2>&1 &
    wait $!
    sec=$((sec + 1))
    if [ $((sec % TICK)) = 0 ]; then
      if ! tunnel_up; then
        cleanup_extra
        ROUND_PID=''
        # what the round printed before the drop, so the log says which day it stood at
        cat "$WORK/round.out"
        die "the tunnel dropped (the endpoint's hour, a reboot of the box, or the network) $sec seconds into the round: the copies are made, run ops/demo-remake.sh $ENVNAME --go-on to finish the fill"
      fi
      echo "   the round runs, ${sec}s, the tunnel is up ($(clock_after 0))"
    fi
  done
  wait "$ROUND_PID" || rc=$?
  ROUND_PID=''
  cat "$WORK/round.out"
  [ "$rc" = 0 ] || die "a round of the fill stopped (the lines above): run ops/demo-remake.sh $ENVNAME --go-on to finish it, unless they say a copy is not remade: then run ops/demo-remake.sh $ENVNAME again whole, without --go-on"
}

log_start demo-remake "$ENVNAME"
mkwork

step "ridge alone, a terminal, main, and this commit"
refuse_real "$ENVNAME" "demo-remake.sh holds ridge's demo copies alone: a client's own stack is the console's, and it is never deleted here"
[ "${GITHUB_ACTIONS:-}" != true ] || die "the passwords are typed on a terminal and the run is hours long, never in a job: run this by hand"
# fd 3 is the terminal (log_start keeps it past the log). OPS_TEST_NO_TTY is ops/test.sh's alone, on a
# machine that cannot open a pseudo-terminal: the typing then comes from a pipe.
if [ "$GO_ON" = 0 ]; then
  { [ -t 0 ] && [ -t 3 ]; } || [ "${OPS_TEST_NO_TTY:-}" = 1 ] || die "needs a terminal to type the passwords on"
fi
main_synced
sha=$(git -C "$REPO_DIR" rev-parse HEAD)
git -C "$REPO_DIR" merge-base --is-ancestor "$sha" origin/main || die "$sha is not a commit of main: only main's code is run on ridge"
# The run executes the code in this tree, so this tree must be the commit /health is asked to name.
git -C "$REPO_DIR" diff --quiet HEAD || die "this tree differs from $sha: the run would execute code /health cannot name"
command -v node >/dev/null || die "needs node on PATH, with pnpm install done"
[ -d "$REPO_DIR/scripts/node_modules" ] || [ -n "${RIDGE_SCRIPTS_DIR:-}" ] || die "needs pnpm install done, for the run's code"
echo "commit: $sha"
mapping_read

step "the passwords, the copies, and the word"
if [ "$GO_ON" = 1 ]; then
  echo "--go-on: nothing is asked and nothing is deleted; only the rounds of the fill that are left"
else
  for p in "${PARTNERS[@]}"; do type_password "$p"; done
  passwords_pipe | ridge_cli remake --check || die "a password or a partner is refused (the line above): nothing was changed"
  echo "These ${#COPIES[@]} demo copies on $ENVNAME are deleted to zero records, made again and filled:"
  for line in "${COPIES[@]}"; do echo "   $line"; done
  printf 'Type "remake ridge" to go on, anything else stops with nothing deleted: ' >&3
  reply=''
  IFS= read -r reply || true
  [ "$reply" = "remake ridge" ] || die "the reply was not \"remake ridge\": nothing was deleted"
fi

step "the stack, and the tunnel"
stack_load "$ENVNAME"
[ -n "$STACK_JSON" ] || die "stack $ENVNAME does not exist"
app_load || die "$ENVNAME's stack holds no layer four yet: ops/stack.sh env $ENVNAME first"
open_tunnel

step "the remake"
if [ "$GO_ON" = 1 ]; then
  echo "--go-on: no copy is deleted or made"
else
  WRITTEN=1
  passwords_pipe | INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT \
    ridge_cli remake || die "the remake stopped (the lines above name the copy and why): the same run again ends in the same state"
fi

step "the fill, in rounds"
WRITTEN=1
echo "the fill may wait about $WAIT_MIN minutes, until about $(clock_after "$WAIT_MIN"), and the AWS session must hold until then; a line every ${TICK} seconds shows it is alive"
round=0
while :; do
  round=$((round + 1))
  [ "$round" -le "$MAX_ROUNDS" ] || die "$MAX_ROUNDS rounds and the copies are still behind: read the lines above"
  echo "round $round"
  # The first tunnel is the remake's; --go-on has made none since, so its first round uses the one opened above.
  if [ "$round" -gt 1 ] || [ "$GO_ON" = 0 ]; then
    NEXT="the copies are made: fix that, then run ops/demo-remake.sh $ENVNAME --go-on"
    open_tunnel
    NEXT=''
  fi
  round_run
  grep -q '^seed: STILL BEHIND' "$WORK/round.out" || break
done
# The closing line only when the last round found every copy on the service (the round itself refuses a copy
# not remade; this is the second look, on the summary it printed).
grep -q '^seed: .*, 0 not on this service, ' "$WORK/round.out" || die "the last round did not find every copy on the service (the lines above): run ops/demo-remake.sh $ENVNAME again whole, without --go-on"
echo "the ${#COPIES[@]} demo copies on $ENVNAME are remade, each with its partner's password, 21 days filled up to yesterday"
