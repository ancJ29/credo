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

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "usage: bash ops/gate.sh <pkg>" >&2
  exit 2
fi
pkg=${1#@credo/}
name=@credo/$pkg

STEPS=5
log_start gate "$pkg"
cd "$REPO_DIR" || die "cannot enter $REPO_DIR"

results=''
# run_step <label> <command...>: runs it, saves its status at once (no pipe), names it
run_step() {
  local label=$1 rc
  shift
  step "$label"
  "$@"
  rc=$?
  results="${results}${results:+ }${label} ${rc}"
  if [ "$rc" = 0 ]; then ok "$label exit 0"; else red "$label exit $rc"; fi
}

run_step typecheck pnpm --filter "$name" run typecheck
run_step eslint pnpm exec eslint .
run_step prettier pnpm exec prettier --check .
run_step test pnpm --filter "$name" run test
run_step knip pnpm exec knip

echo "== steps: $results"
echo "not covered: c-storage's own gate, make check in c-storage/"
verdict
