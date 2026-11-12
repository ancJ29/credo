#!/usr/bin/env bash
# ops/remake.sh ridge
# Brings ridge back from main after ops/destroy.sh ridge: the stack, the release, the app and the
# check, each the script that already exists, in the order of the 11-11 remake; then it turns on the
# workflows that reach ridge and reads them back active. Ridge alone: any other name is refused before
# any call. Ridge is then empty: no operator and no demo copy. The closing gives the next command,
# ops/operator.sh ridge, which stays its own command (its link works once and is shown on a terminal).
# Each child writes its own log and prints to the terminal; this log holds this script's lines only:
# each step's start, its exit, and the name of its log. A red at a step stops the run there and the
# workflows stay off. Every step can be run again, so after a stop the remedy is to run this again.
# One case: when the box never answered (ops/stack.sh dies with "the box never answered through the
# endpoint"), the run again is an update, and it reaches the step that writes GitHub's secret.
# An address lane's settings (CREDO_DOMAIN, CREDO_CERTIFICATE_ARN) are read by ops/stack.sh from your
# environment and passed through unchanged. No --plan: on a creation there is nothing to remove, and
# stack.sh's own guard still refuses any removal or replacement.
# Needs the three things it checks first: gh logged in, the Bruno CLI (check.sh's version), and
# pnpm install done. Run from a worktree whose ops/ is origin/main's, in a terminal holding an AWS
# session. Expected length: about 15 minutes (the stack about 5, the release and the app 3 to 7,
# the check about 3).
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -eq 1 ] || {
  echo "usage: ops/remake.sh ridge" >&2
  exit 2
}
ENVNAME=$1
WANT_BRUNO=4.2.0

log_start remake "$ENVNAME"
refuse_real "$ENVNAME" "remake.sh remakes ridge alone: any other environment may hold a real company's records"
main_synced

command -v gh >/dev/null 2>&1 || die "gh is not installed"
gh auth status >/dev/null 2>&1 || die "gh is not logged in: gh auth login"
have=$(bru_clean --version 2>/dev/null) || have=none
[ "$have" = "$WANT_BRUNO" ] || die "needs Bruno CLI $WANT_BRUNO, found $have: npm install -g --ignore-scripts @usebruno/cli@$WANT_BRUNO"
[ -d "$REPO_DIR/scripts/node_modules" ] || [ -n "${RIDGE_SCRIPTS_DIR:-}" ] || die "needs pnpm install done, for the check's client"
WF_FILES=$(workflows_of "$ENVNAME")
[ -n "$WF_FILES" ] || die "no workflow file in $REPO_DIR/.github/workflows names environment: $ENVNAME"
REPO=$(repository)
[ -n "$REPO" ] || die "the origin remote names no repository"
LOG_DIR=$(dirname "$LOG")
N_STEPS=5
N=0

# child_log <script>: the newest log that script wrote for this environment
child_log() {
  # shellcheck disable=SC2012 # the names are ours: date, script, environment
  ls -t "$LOG_DIR"/*-"$1"-"$ENVNAME".log 2>/dev/null | head -n 1 || true
}

# run_step <script> <args...>: the child, its output on the terminal (fd 3), its exit read, its log named
run_step() {
  local script=$1 rc=0 clog
  shift
  N=$((N + 1))
  echo "-- step $N/$N_STEPS: ops/$script $* starts $(date '+%H:%M:%S')"
  bash "$OPS_DIR/$script" "$@" >&3 2>&3 </dev/null || rc=$?
  clog=$(child_log "${script%.sh}")
  echo "-- step $N/$N_STEPS: ops/$script ended with exit $rc; its log: $(basename "${clog:-none}")"
  if [ "$rc" != 0 ]; then
    echo "== stopped at step $N/$N_STEPS, ops/$script (exit $rc). No later step ran and the workflows stay off. Read its log, then run ops/remake.sh $ENVNAME again."
    exit 1
  fi
}

run_step stack.sh env "$ENVNAME"
run_step release.sh "$ENVNAME"
run_step app.sh "$ENVNAME"
run_step check.sh "$ENVNAME"

N=$((N + 1))
echo "-- step $N/$N_STEPS: the workflows that reach $ENVNAME go on"
for base in $WF_FILES; do
  gh workflow enable "$base" --repo "$REPO"
done
STATES=$(gh workflow list --all --repo "$REPO" --limit 100 --json path,state)
for base in $WF_FILES; do
  st=$(jq -r --arg p ".github/workflows/$base" '.[] | select(.path == $p) | .state' <<<"$STATES")
  if [ "$st" = active ]; then ok "$base reads back active"; else red "$base reads back '${st:-not listed}', not active"; fi
done
if [ -n "$REDS" ]; then
  echo "== stopped at step $N/$N_STEPS, the workflows: $(printf '%s' "$REDS" | tr '\n' ' ')"
  exit 1
fi

echo "== ridge is remade from main and checked. It is empty: it holds no operator and no demo copy."
echo "   Your next step, the operator's one-time link, which you open at the new address to make your passkey:"
echo "        cd $REPO_DIR && bash $OPS_DIR/operator.sh $ENVNAME"
echo "   The app's address may be a new one: anything that holds the old address (links, Bruno environment files, bookmarks, a DNS record) is repointed by hand."
verdict
