#!/usr/bin/env bash
# The gate's tests: one run under -race, held at 100 % coverage
# (QA rule 8). A statement no test runs fails the gate, named by file and line;
# nobody reads a report.
set -euo pipefail

cd "$(dirname "$0")/.."

module="$(go list -m)"

# elsewhere: the one file left out is the entry point, which no in-process test
# can start. It keeps only the wiring and three outcomes: a bad configuration
# exits 1, a port already taken exits 1 (Run's error), and SIGTERM exits 0 with
# "stopped" logged. The CI e2e job (scripts/e2e.sh, .github/workflows/c-storage.yml)
# starts the binary and holds all three, and the happy path through /health.
measured="$(go list ./... | grep -vx "$module/cmd/server")"

# A package without a test file of its own is measured through -coverpkg; asked
# to test one under coverage, go fails here with `no such tool "covdata"`.
tested="$(go list -f '{{if or .TestGoFiles .XTestGoFiles}}{{.ImportPath}}{{end}}' ./...)"

profile="$(mktemp "${TMPDIR:-/tmp}/c-storage-cover.XXXXXX")"
trap 'rm -f "$profile"' EXIT

# Each binary's own percentage is of every package measured, so it says
# nothing; the verdict is the merge below. -count=1 because a cached result is
# keyed on what its package imports, while its profile carries every measured
# package: an edit elsewhere replays stale line numbers as uncovered.
# shellcheck disable=SC2086 # package lists split on whitespace, as go list wrote them
go test -race -count=1 -timeout 3m -coverpkg="$(echo $measured | tr ' ' ,)" -coverprofile="$profile" $tested |
  sed -E 's/[[:space:]]+coverage: .*//'

# The file list comes from go list, never from the profile: a file no test
# binary loaded has no line in the profile at all. A file that declares no
# function has none either, so only a file with one is expected there.
files=""
# shellcheck disable=SC2086
for pair in $(go list -f '{{$p := .ImportPath}}{{$d := .Dir}}{{range .GoFiles}}{{$p}}/{{.}}={{$d}}/{{.}} {{end}}' $measured); do
  if grep -q '^func ' "${pair#*=}"; then files+="${pair%%=*} "; fi
done

# Each test binary writes its own copy of every block, so a block counts as run
# when any copy has a count above zero. Go counts statements, not branches:
# `a || b` is one statement, run when `a` is.
uncovered="$(awk -v module="$module/" -v files="$files" '
  NR == 1 { next }
  {
    split($1, at, ":"); seen[at[1]] = 1
    block[$1] = 1
    if ($3 > 0) run[$1] = 1
  }
  END {
    for (b in block) if (!(b in run)) {
      split(b, at, ":"); split(at[2], span, ",")
      split(span[1], from, "."); split(span[2], to, ".")
      file = substr(at[1], length(module) + 1)
      print file ":" from[1] (to[1] != from[1] ? "-" to[1] : "")
    }
    n = split(files, list, " ")
    for (i = 1; i <= n; i++) if (!(list[i] in seen))
      print substr(list[i], length(module) + 1) ": no test loads it"
  }' "$profile" | sort -t: -k1,1 -k2,2n)"

if [[ -n "$uncovered" ]]; then
  echo "coverage: these lines run in production and no test runs them —"
  echo "test the caller's path or the risk that reaches each, or delete it:"
  printf '%s\n' "$uncovered" | sed 's/^/  /'
  exit 1
fi
echo "coverage: 100 % of statements outside cmd/server"
