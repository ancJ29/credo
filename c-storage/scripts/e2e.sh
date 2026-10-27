#!/usr/bin/env bash
# The end-to-end check: the server built for this machine, started on a fresh
# database, the Bruno collection run against it. The Go tests hold every rule in
# process; this holds the assembled process, over a real socket. Exits non-zero
# if the server never answers /health or any request or assertion fails.
set -euo pipefail

cd "$(dirname "$0")/.."

for tool in curl go node; do
  command -v "$tool" >/dev/null || { echo "e2e: needs $tool on PATH" >&2; exit 2; }
done
# One CLI version reads the collection, so a pass means the same thing on any
# machine.
WANT=4.2.0
have="$(bru --version 2>/dev/null)" || have="none"
if [[ "$have" != "$WANT" ]]; then
  echo "e2e: needs Bruno CLI $WANT on PATH, found $have:" >&2
  echo "  npm install -g @usebruno/cli@$WANT" >&2
  exit 2
fi

# var <name>: a variable of bruno/environments/local.yml, the development keys'
# one home.
var() {
  awk -v want="$1" '
    $1 == "-" && $2 == "name:" { name = $3 }
    $1 == "value:" && name == want { sub(/^[^:]*:[[:space:]]*/, ""); gsub(/^"|"$/, ""); print; exit }
  ' bruno/environments/local.yml
}
BASE="$(var baseUrl)"
PORT="${BASE##*:}"

DIR="$(mktemp -d "${TMPDIR:-/tmp}/c-storage-e2e.XXXXXX")"
PID=""
trap '[[ -z "$PID" ]] || kill "$PID" 2>/dev/null || true; rm -rf "$DIR"' EXIT

# The flags the box's artifact ships with (Makefile's GO_BUILD), for this machine.
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$DIR/server" ./cmd/server

fail=0
check() { # name expected actual
  if [[ "$2" == "$3" ]]; then echo "  ok   $1"; else echo "  FAIL $1: got $3, want $2"; fail=1; fi
}
exit_of() { # env arguments → the binary's exit status; its output in exit.log
  env "$@" "$DIR/server" >"$DIR/exit.log" 2>&1 && echo 0 || echo $?
}
KEYS=(INTERNAL_ACCESS_KEY="$(var internalAccessKey)" X_SUPER_ADMIN_KEY="$(var superAdminKey)")

# A stranger already answering on the port would pass for the server below.
if curl -s -o /dev/null -m 2 "$BASE/health"; then
  echo "e2e: something already answers $BASE/health; free port $PORT first" >&2
  exit 1
fi

env PORT="$PORT" DB_PATH="$DIR/data/c-storage.db" "${KEYS[@]}" "$DIR/server" >"$DIR/server.log" 2>&1 &
PID=$!

up=0
for _ in $(seq 1 50); do
  kill -0 "$PID" 2>/dev/null || break
  if curl -sf -o /dev/null "$BASE/health"; then up=1; break; fi
  sleep 0.2
done
if [[ "$up" != 1 ]]; then
  echo "e2e: the server never answered $BASE/health:" >&2
  cat "$DIR/server.log" >&2
  exit 1
fi

echo "== the collection, whole, against a fresh database"
requests="$(find bruno -name '*.yml' ! -name folder.yml ! -name opencollection.yml ! -path '*/environments/*' | wc -l | tr -d ' ')"
ran=0
(cd bruno && bru run --env local --reporter-json "$DIR/report.json") || ran=$?
check "bru run exits 0" 0 "$ran"
# A run that reaches no request exits 0 too, so the count is the proof.
results="$(node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log(r.reduce((n, run) => n + run.results.length, 0));' "$DIR/report.json")"
if [[ "$results" != "$requests" ]]; then
  echo "e2e: the run reached $results requests, but bruno/ holds $requests request files" >&2
  exit 1
fi
check "every request ran ($requests)" "$requests" "$results"

# The coverage gate leaves cmd/server out as elsewhere (scripts/cover.sh): these
# are the exits main.go keeps.
echo "== the entry point: a dead process at start-up, a clean one at SIGTERM"
check "a missing variable exits 1" 1 \
  "$(exit_of PORT="$PORT" DB_PATH="$DIR/other.db" INTERNAL_ACCESS_KEY=x)"
check "  and logs why" 1 "$(grep -c 'invalid configuration' "$DIR/exit.log")"
kill -TERM "$PID"
stopped=0
wait "$PID" || stopped=$?
PID=""
check "SIGTERM exits 0" 0 "$stopped"
check "  and logs it" 1 "$(grep -c '"msg":"stopped"' "$DIR/server.log")"

[[ "$fail" == 0 ]] || { echo "e2e: FAILURES"; exit 1; }
echo "e2e: all checks passed"
