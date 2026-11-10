#!/usr/bin/env bash
# One package's gate: the five steps, each run whatever the one before it did, one log, one exit line.
# USAGE: bash ops/gate.sh <pkg>      (shared, or @credo/shared)
# WHAT IT RUNS: typecheck and test of the package (its own scripts, so the coverage flags and the
#   100 % thresholds are the package's); eslint, prettier and knip over the whole tree, because their
#   configs are repo-wide (knip.json is one workspace map).
# LOG: <credo root>/logs/<date>-<time>-gate-<pkg>.log, ending == exit <code> from ops/lib.sh.
# Exit: 0 green, 1 any step red. Not covered: c-storage's own gate, `make check` in services/c-storage/.
# THE LOCK: one whole run at a time on this machine, <credo root>/.gate-lock (GATE_LOCK names another, for a
#   test), taken once the one-minute load is under GATE_LOAD_MAX (8) in one wait loop that logs each wait with the
#   owner; gives up with exit 1 after GATE_WAIT_MAX seconds (1800), never taking a lock it did not make or
#   clearing one: the refusal names the owner, says whether its pid is alive and prints the one rm -rf that clears
#   it. It also waits while a full run (ops/full-run.sh) holds <credo root>/.full-run-lock (GATE_RUN_LOCK names
#   another), because walk/run.sh stops its lanes and ends red when the gate lock appears mid-run. A bare
#   walk/run.sh takes no lock of its own, so the gate cannot wait for one. An unreadable load refuses. Released from the EXIT hook, logged with its time. Under CI there is none, and the
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
  WORKSPACE=${GATE_WORKSPACE:-$REPO_DIR/pnpm-workspace.yaml}
  dirs=$(sed -n 's/^  - //p' "$WORKSPACE" 2>/dev/null)
  label=all
fi

STEPS=5
root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
LOCK=${GATE_LOCK:-$root/.gate-lock}
RUN_LOCK=${GATE_RUN_LOCK:-$root/.full-run-lock}
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

# lock_owner_pid <owner text>: the pid in a lock's owner file ("pid=123 ..." the gate's, "pid 123 started ..." the full run's)
lock_owner_pid() { printf '%s' "$1" | sed -n 's/^pid[= ]\([0-9][0-9]*\).*/\1/p'; }

# pid_state <pid>: whether that process is alive. Sets PID_KIND (alive, dead or unknown) and PID_SAY, in words
# (ps lists nothing here, so kill -0 is asked). Called directly, never in $(...), so the variables survive.
pid_state() {
  local err
  if [ -z "$1" ]; then
    PID_KIND=unknown PID_SAY="its pid could not be read"
  elif err=$(kill -0 "$1" 2>&1); then
    PID_KIND=alive PID_SAY="pid $1 is still alive"
  elif printf '%s' "$err" | grep -q 'No such process'; then
    PID_KIND=dead PID_SAY="pid $1 is not alive"
  else
    PID_KIND=unknown PID_SAY="pid $1 could not be checked (${err:-kill -0 failed})"
  fi
}

# give_up <lock held at the last look, or empty>: the refusal after GATE_WAIT_MAX. It never clears a lock. With one in
# the way it names the owner and says whether the owner is alive. The clearing rm -rf is printed only when the owner
# is not alive or cannot be checked: a live owner (a full run takes 6 to 35 minutes, longer than the wait) is waited
# for, since clearing its lock would let a second run start beside it.
give_up() {
  local held=$1 owner pid
  if [ -z "$held" ]; then
    die "gave up after ${WAIT_MAX}s: the last look found the one-minute load not under $LOAD_MAX; no lock was taken"
  fi
  owner=$(cat "$held/owner" 2>/dev/null)
  pid=$(lock_owner_pid "$owner")
  pid_state "$pid"
  if [ "$PID_KIND" = alive ]; then
    die "gave up after ${WAIT_MAX}s waiting for the lock $held (owner: ${owner:-unknown}; $PID_SAY). Nothing was run. That run is still going: wait for it and run the gate again, and clear nothing -- removing a live run's lock would let a second one start beside it"
  fi
  die "gave up after ${WAIT_MAX}s waiting for the lock $held (owner: ${owner:-unknown}; $PID_SAY). Nothing was run. If that run is over (a run killed hard leaves its lock behind), clear it with: rm -rf '$held' -- this script never clears a lock itself"
}

# take_lock: waits for the load under the ceiling, no full run's lock and the gate lock free, in one loop, and takes it.
take_lock() {
  local start load owner held=''
  start=$(date +%s)
  while :; do
    load=$(load_now)
    [[ $load =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "the Mac's load could not be read from uptime (got '${load}'): not taking the lock"
    held=''
    if ! awk -v l="$load" -v m="$LOAD_MAX" 'BEGIN { exit !(l < m) }'; then
      echo "waiting: one-minute load $load is not under $LOAD_MAX ($(date '+%H:%M:%S'))"
    elif [ -e "$RUN_LOCK" ]; then
      held=$RUN_LOCK
      owner=$(cat "$RUN_LOCK/owner" 2>/dev/null)
      echo "waiting: a full run holds $RUN_LOCK: ${owner:-owner unknown} (the gate lock would stop its walks) ($(date '+%H:%M:%S'))"
    elif mkdir "$LOCK" 2>/dev/null; then
      HELD=yes
      printf 'pid=%s log=%s started=%s\n' "$$" "$LOG" "$(date '+%Y-%m-%d %H:%M:%S')" >"$LOCK/owner"
      export GATE_HOLDER=$$
      echo "lock $LOCK taken $(date '+%H:%M:%S') at load $load"
      return 0
    else
      held=$LOCK
      owner=$(cat "$LOCK/owner" 2>/dev/null)
      echo "waiting: lock $LOCK is held by: ${owner:-owner unknown} ($(date '+%H:%M:%S'))"
    fi
    if [ $(($(date +%s) - start)) -ge "$WAIT_MAX" ]; then
      give_up "$held"
    fi
    sleep "$POLL"
  done
}

log_start gate "$label"
cd "$REPO_DIR" || die "cannot enter $REPO_DIR"
if [ "$label" = all ] && [ -z "$dirs" ]; then
  die "no package could be read from ${WORKSPACE} (missing, unreadable, or no '  - <dir>' lines): refusing, since a gate over no packages would run no typecheck and no test and still say green"
fi

if [ -n "${CI:-}" ]; then
  echo "lock: skipped, CI is set (the runner is its own machine); load wait: skipped"
elif [ -n "${GATE_HOLDER:-}" ] && grep -q "^pid=$GATE_HOLDER " "$LOCK/owner" 2>/dev/null; then
  echo "lock: not taken, held by the calling gate (pid $GATE_HOLDER)"
else
  take_lock
fi

results=''
# has_script <dir> <script>: whether that package's package.json defines it. Exit 0: it does. Exit 64: it does not, a
# plain "no". Anything else (an unparseable package.json 2, node missing from PATH 127, node dying) is a failure to
# ask, never a "no": run_each turns it into a red, not a skip.
has_script() {
  node -e 'try { const s = require(process.argv[1]).scripts; process.exit(s && s[process.argv[2]] ? 0 : 64) } catch (e) { console.error(String(e)); process.exit(2) }' "$REPO_DIR/$1/package.json" "$2"
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
# never a silent one and never a red. A package whose scripts cannot be asked (an unparseable package.json, no node) is a
# red, never a skip (see has_script). The summary shows a step that ran nowhere as "skip" and one that skipped some
# packages as "<code>+<n>skipped", so a skip never reads as a pass.
run_each() {
  local script=$1 d rc hs worst=0 ran=0 skipped=0 mark
  step "$script"
  for d in $dirs; do
    [ -f "$REPO_DIR/$d/package.json" ] || die "no package $d"
    has_script "$d" "$script"
    hs=$?
    if [ "$hs" != 0 ] && [ "$hs" != 64 ]; then
      ran=$((ran + 1))
      red "$script @credo/$d: could not read its scripts from package.json (node exit $hs), so it was not run"
      worst=1
    elif [ "$hs" = 0 ]; then
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
echo "not covered: c-storage's own gate, make check in services/c-storage/"
verdict
