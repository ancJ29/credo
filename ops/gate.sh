#!/usr/bin/env bash
# One package's gate: the five steps, each run whatever the one before it did, one log, one exit line.
# USAGE: bash ops/gate.sh <pkg>      (shared, or @credo/shared)
# WHAT IT RUNS: typecheck and test of the package (its own scripts, so the coverage flags and the
#   100 % thresholds are the package's); eslint, prettier and knip over the whole tree, because their
#   configs are repo-wide (knip.json is one workspace map).
# LOG: <credo root>/logs/<date>-<time>-gate-<pkg>.log, ending == exit <code> from ops/lib.sh.
# Exit: 0 green, 1 any step red. Not covered: c-storage's own gate, `make check` in c-storage/.
# Step 1 of docs/plans/2026-11-09-one-gate-command.md: no lock, no load wait yet.
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
log_start gate "$label"
cd "$REPO_DIR" || die "cannot enter $REPO_DIR"

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
