#!/usr/bin/env bash
# ops/demo-remake.sh ridge [--go-on]
# Remakes the six demo copies on ridge in one run: made under each partner's password and filled with 21 days
# ending yesterday on a store of this Mac's own, then each copy in turn deleted on ridge to zero records,
# copied whole and only then made reachable again (the node half is scripts/src/ridge.ts: ridge_cli remake).
# One password a partner (p1, p2, then yours), each typed here twice, never shown, never logged and never
# kept; each is checked against that partner's codes before anything is touched.
#   In order: ridge alone, a terminal, main and this commit; the passwords typed twice and checked (no
#   connection); the six copies listed and the words "remake ridge" typed back; the stack and the tunnel;
#   the box's disk, memory and swap, and /health naming a commit of main that is this one (or an earlier one
#   that differs in no deployed path), with the BFF's function; then the remake on that one tunnel, a line
#   every 30 seconds while it runs. Nothing is written before they have passed. Each password reaches node
#   on a pipe from bash's builtin printf: never argv, the environment, a here-string or a file.
# The store on this Mac lives in the credo root's .demo-remake-store for the run, and is kept when the run
# stops after its fill: --go-on starts it again and copies again only what differs on ridge, asking nothing.
# A run that ends green removes it.
# Until the first delete a stop is a refusal, "== refused: <why>" and exit 2 (a store on this Mac that does
# not start, or a fill that stops there, included); from the delete on, "error:" and exit 1: --go-on, or the
# same run again whole. By hand, from a terminal, in a worktree at main with pnpm install done and Go on
# PATH; not during the seed's run, nor with a session open on a copy you mean to keep. Expected length:
# about 10 minutes, up to 15, plus the typing.
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
STEPS=4
# Neither the local stack's port (3181), the check's (3191), the tunnel's (3192), the deploy's (3193), the
# operator's (3194), the seed's (3195) nor the root password's (3196).
LOCAL_PORT=${DEMO_REMAKE_LOCAL_PORT:-3197}
# The seconds between the lines the remake prints while it runs; the tests shorten it, the run does not.
TICK=${DEMO_REMAKE_TICK:-30}
# The wait the notice names: the bound every run on this Mac is held to (docs/plans/2026-11-13-long-runs.md).
WAIT_MIN=15
# The folder of the store on this Mac, in the credo root (the folder that holds .bare), as lib.sh's log_start
# derives it: the run and its --go-on name the same one.
STORE_DIR=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")/.demo-remake-store

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
REMAKE_PID=''

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

# cleanup_extra: a remake still running when the run ends is ended with it
cleanup_extra() {
  if [ -n "$REMAKE_PID" ]; then kill_tree "$REMAKE_PID"; fi
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

# remake_run: the remake on the open tunnel, its lines straight to the log, a line every TICK seconds while it
# runs; a tunnel that is no longer up ends it and the run. The node half's 2 is a refusal before any delete.
remake_run() {
  local sec=0 rc=0
  WRITTEN=1
  if [ "$GO_ON" = 1 ]; then
    INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT REMAKE_STORE_DIR=$STORE_DIR \
      ridge_cli remake --go-on </dev/null &
  else
    passwords_pipe | INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT REMAKE_STORE_DIR=$STORE_DIR \
      ridge_cli remake &
  fi
  REMAKE_PID=$!
  while kill -0 "$REMAKE_PID" 2>/dev/null; do
    sleep 1 >/dev/null 2>&1 &
    wait $!
    sec=$((sec + 1))
    if [ $((sec % TICK)) = 0 ]; then
      if ! tunnel_up; then
        cleanup_extra
        REMAKE_PID=''
        die "the tunnel dropped (the endpoint's hour, a reboot of the box, or the network) $sec seconds into the remake: run ops/demo-remake.sh $ENVNAME --go-on to copy again what differs"
      fi
      echo "   the remake runs, ${sec}s, the tunnel is up ($(clock_after 0))"
    fi
  done
  wait "$REMAKE_PID" || rc=$?
  REMAKE_PID=''
  if [ "$rc" = 2 ]; then
    WRITTEN=0
    die "the remake was refused before any delete (the line above): nothing was deleted"
  fi
  [ "$rc" = 0 ] || die "the remake stopped (the lines above name the copy and why): run ops/demo-remake.sh $ENVNAME --go-on to copy again what differs, or the same run again whole"
}

log_start demo-remake "$ENVNAME"
mkwork

step "ridge alone, a terminal, main, and this commit"
refuse_real "$ENVNAME" "demo-remake.sh holds ridge's demo copies alone: a client's own stack is the console's, and it is never deleted here"
[ "${GITHUB_ACTIONS:-}" != true ] || die "the passwords are typed on a terminal, never in a job: run this by hand"
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
  echo "--go-on: nothing is asked; the copy goes on from the store the stopped run filled, copying only what differs"
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

step "the remake: filled on this Mac, then each copy deleted on $ENVNAME and copied whole"
echo "the remake may take up to about $WAIT_MIN minutes, until about $(clock_after "$WAIT_MIN"); a line every ${TICK} seconds shows it is alive"
remake_run
echo "the ${#COPIES[@]} demo copies on $ENVNAME are remade, each with its partner's password, 21 days filled up to yesterday"
