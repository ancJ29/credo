#!/usr/bin/env bash
# One package's gate: the five steps, each run whatever the one before it did, one log, one exit line.
# USAGE: bash ops/gate.sh <pkg>      (shared, or @credo/shared)
# WHAT IT RUNS: typecheck and test of the package (its own scripts, so the coverage flags and the
#   100 % thresholds are the package's); eslint, prettier and knip over the whole tree, because their
#   configs are repo-wide (knip.json is one workspace map).
# LOG: <credo root>/logs/<date>-<time>-gate-<pkg>.log, ending == exit <code> from ops/lib.sh.
# Exit: 0 green, 1 any step red. Not covered: c-storage's own gate, `make check` in c-storage/.
# THE LOCK: one whole run at a time on this machine, <credo root>/.gate-lock (GATE_LOCK names another, for a
#   test), taken once the one-minute load is under GATE_LOAD_MAX (8) in one wait loop that logs each wait with the
#   owner; gives up with exit 1 after GATE_WAIT_MAX seconds (1800), never taking a lock it did not make. An
#   unreadable load refuses. Released from the EXIT hook, logged with its time. Under CI there is none, and the
#   log says so. A call made by a gate that holds the lock (GATE_HOLDER is its pid) does not take it again.
set -uo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

if [ $# -gt 1 ]; then
  echo "usage: bash ops/gate.sh [<pkg>]   (no package: every package)" >&2
  exit 2
fi

# The packages: the one named, or every one pnpm-workspace.yaml lists.
if [ $# -eq 1 ]; then
  [ -n "$1" ] || die "usage: bash ops/gate.sh [<pkg>]"
  dirs=${1#@credo/}
  label=$dirs
else
  dirs=$(sed -n 's/^  - //p' "$REPO_DIR/pnpm-workspace.yaml")
  label=all
fi

STEPS=5
root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
LOCK=${GATE_LOCK:-$root/.gate-lock}
LOAD_MAX=${GATE_LOAD_MAX:-8}
WAIT_MAX=${GATE_WAIT_MAX:-1800}
POLL=${GATE_POLL:-10}
HELD=no

# load_now: the one-minute load, from uptime (macOS "load averages: 1.88 ...", Ubuntu "load average: 1.88, ...")
load_now() { uptime | sed -n 's/.*load averages*: *\([0-9][0-9.,]*\).*/\1/p' | tr ',' '.'; }

# cleanup_extra: lib.sh's on_exit calls it on every way out. Removes the lock only if this run made it.
cleanup_extra() {
  if [ "$HELD" = yes ]; then
    rm -f "$LOCK/owner"
    rmdir "$LOCK"
    HELD=no
    if [ -d "$LOCK" ]; then
      echo "lock $LOCK released $(date '+%H:%M:%S') but still present: lock free at the end: NO"
    else
      echo "lock $LOCK released $(date '+%H:%M:%S'): lock free at the end: yes"
    fi
  fi
}

# take_lock: waits for the load under the ceiling and the lock free, in one loop, and takes it.
take_lock() {
  local start load owner
  start=$(date +%s)
  while :; do
    load=$(load_now)
    [[ $load =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "the Mac's load could not be read from uptime (got '${load}'): not taking the lock"
    if ! awk -v l="$load" -v m="$LOAD_MAX" 'BEGIN { exit !(l < m) }'; then
      echo "waiting: one-minute load $load is not under $LOAD_MAX ($(date '+%H:%M:%S'))"
    elif mkdir "$LOCK" 2>/dev/null; then
      HELD=yes
      printf 'pid=%s log=%s started=%s\n' "$$" "$LOG" "$(date '+%Y-%m-%d %H:%M:%S')" >"$LOCK/owner"
      export GATE_HOLDER=$$
      echo "lock $LOCK taken $(date '+%H:%M:%S') at load $load"
      return 0
    else
      owner=$(cat "$LOCK/owner" 2>/dev/null)
      echo "waiting: lock $LOCK is held by: ${owner:-owner unknown} ($(date '+%H:%M:%S'))"
    fi
    if [ $(($(date +%s) - start)) -ge "$WAIT_MAX" ]; then
      die "gave up after ${WAIT_MAX}s waiting for the load and the lock; the lock is not ours and is left as it is"
    fi
    sleep "$POLL"
  done
}

log_start gate "$label"
cd "$REPO_DIR" || die "cannot enter $REPO_DIR"

if [ -n "${CI:-}" ]; then
  echo "lock: skipped, CI is set (the runner is its own machine); load wait: skipped"
elif [ -n "${GATE_HOLDER:-}" ] && grep -q "^pid=$GATE_HOLDER " "$LOCK/owner" 2>/dev/null; then
  echo "lock: not taken, held by the calling gate (pid $GATE_HOLDER)"
else
  take_lock
fi

results=''
# has_script <dir> <script>: whether that package's package.json defines it
has_script() {
  node -e 'const s = require(process.argv[1]).scripts; process.exit(s && s[process.argv[2]] ? 0 : 1)' "$REPO_DIR/$1/package.json" "$2"
}

# note <label> <rc>: keeps a step's status and names it
note() {
  results="${results}${results:+ }$1 $2"
  if [ "$2" = 0 ]; then ok "$1 exit 0"; else red "$1 exit $2"; fi
}

# run_step <label> <command...>: a repo-wide step; runs it, saves its status at once (no pipe)
run_step() {
  local label=$1 rc
  shift
  step "$label"
  "$@"
  rc=$?
  note "$label" "$rc"
}

# run_each <script>: that script of each selected package that has one, each run whatever the one
# before did (the loop is --no-bail and names every package); a package without it is a named skip,
# never a silent one and never a red. The summary shows a step that ran nowhere as "skip" and one
# that skipped some packages as "<code>+<n>skipped", so a skip never reads as a pass.
run_each() {
  local script=$1 d rc worst=0 ran=0 skipped=0 mark
  step "$script"
  for d in $dirs; do
    [ -f "$REPO_DIR/$d/package.json" ] || die "no package $d"
    if has_script "$d" "$script"; then
      ran=$((ran + 1))
      pnpm --filter "@credo/$d" run "$script"
      rc=$?
      if [ "$rc" = 0 ]; then ok "$script @credo/$d exit 0"; else red "$script @credo/$d exit $rc"; worst=$rc; fi
    else
      skipped=$((skipped + 1))
      echo "skipped: @credo/$d has no $script script"
    fi
  done
  mark=$worst
  if [ "$ran" = 0 ]; then
    mark=skip
  elif [ "$skipped" != 0 ]; then
    mark="${worst}+${skipped}skipped"
  fi
  results="${results}${results:+ }${script} ${mark}"
}

run_each typecheck
run_step eslint pnpm exec eslint .
run_step prettier pnpm exec prettier --check .
run_each test
run_step knip pnpm exec knip

echo "== steps: $results"
echo "not covered: c-storage's own gate, make check in c-storage/"
verdict
