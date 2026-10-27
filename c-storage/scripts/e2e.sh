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

# The HTML report a reviewer opens without reading code: in the credo root's
# logs/ (ignored by git) unless E2E_REPORT says where, as CI does. The root is
# the folder holding the bare repo, whichever worktree this is.
if [[ -z "${E2E_REPORT:-}" ]]; then
  common="$(git rev-parse --path-format=absolute --git-common-dir)"
  E2E_REPORT="$(dirname "$common")/logs/c-storage-e2e-report.html"
fi
mkdir -p "$(dirname "$E2E_REPORT")"

DIR="$(mktemp -d "${TMPDIR:-/tmp}/c-storage-e2e.XXXXXX")"
PID=""
trap '[[ -z "$PID" ]] || kill "$PID" 2>/dev/null || true; rm -rf "$DIR"' EXIT

# The flags the box's artifact ships with (Makefile's GO_BUILD), for this machine.
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "$DIR/server" ./cmd/server

fail=0
check() { # name expected actual
  if [[ "$2" == "$3" ]]; then echo "  ok   $1"; else echo "  FAIL $1: got $3, want $2"; fail=1; fi
}
# exit_of <VAR=value>...: the binary's exit status with exactly those variables,
# so one inherited from the caller cannot fill a missing one; its output in exit.log.
exit_of() {
  env -i PATH="$PATH" "$@" "$DIR/server" >"$DIR/exit.log" 2>&1 && echo 0 || echo $?
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
  if curl -sf -m 2 -o /dev/null "$BASE/health"; then up=1; break; fi
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
# The repository and its artifacts are public: the report carries no key. The
# three headers are skipped, and the bodies, since a register request's body
# holds an access key. After the run the written file is searched for every key.
(cd bruno && bru run --env local --reporter-json "$DIR/report.json" --reporter-html "$E2E_REPORT" \
  --reporter-skip-request-body \
  --reporter-skip-headers x-internal-access-key x-access-key x-super-admin-key) || ran=$?
check "bru run exits 0" 0 "$ran"
# bru exits 0 for a file it cannot parse (a skipped result) and for a run that
# reaches no request, so every request must be in the report, passed, with a
# test result; the summary's passed requests must equal the request files.
proved=0
node -e '
const [file, want] = [process.argv[1], Number(process.argv[2])];
const runs = JSON.parse(require("fs").readFileSync(file, "utf8"));
let results = [], passed = 0;
for (const run of runs) { results = results.concat(run.results); passed += run.summary.passedRequests; }
let bad = 0;
for (const r of results) {
  const tests = (r.testResults || []).length + (r.assertionResults || []).length;
  if (r.status !== "pass" || tests === 0) {
    bad++;
    console.error("e2e: " + r.path + ": status " + r.status + ", " + tests + " tests" + (r.error ? ", " + r.error : ""));
  }
}
if (results.length !== want || passed !== want || bad > 0) {
  console.error("e2e: " + want + " request files, " + results.length + " results, " + passed + " passed, " + bad + " not passing");
  process.exit(1);
}' "$DIR/report.json" "$requests" || proved=1
check "every request ran, passed and asserted ($requests)" 0 "$proved"

# The report embeds its data as base64 JSON, so the search decodes it first; one
# whose data it cannot find fails, rather than pass for want of text to search.
leaked=0
node -e '
const text = require("fs").readFileSync(process.argv[1], "utf8");
const m = text.match(/decodeBase64\(\x27([A-Za-z0-9+\/=]+)\x27\)/);
if (!m) { console.error("e2e: the report holds no data this script can read"); process.exit(1); }
const data = Buffer.from(m[1], "base64").toString("utf8");
let bad = 0;
for (const key of process.argv.slice(2)) {
  if (text.includes(key) || data.includes(key)) { console.error("e2e: the report holds a key value"); bad = 1; }
}
process.exit(bad);' "$E2E_REPORT" "$(var internalAccessKey)" "$(var superAdminKey)" "$(var accessKey)" || leaked=1
check "the report holds no key" 0 "$leaked"

# The coverage gate leaves cmd/server out as elsewhere (scripts/cover.sh): these
# are the outcomes main.go keeps.
echo "== the entry point: a dead process at start-up, a clean one at SIGTERM"
check "a missing variable exits 1" 1 \
  "$(exit_of PORT="$PORT" DB_PATH="$DIR/other.db" INTERNAL_ACCESS_KEY=x)"
check "  and logs why" 1 "$(grep -c 'invalid configuration' "$DIR/exit.log")"
check "a port already taken exits 1" 1 \
  "$(exit_of PORT="$PORT" DB_PATH="$DIR/second.db" "${KEYS[@]}")"
check "  and logs why" 1 "$(grep -c 'bind the listener' "$DIR/exit.log")"
kill -TERM "$PID"
for _ in $(seq 1 100); do
  kill -0 "$PID" 2>/dev/null || break
  sleep 0.2
done
if kill -0 "$PID" 2>/dev/null; then
  echo "e2e: the server did not stop within 20 s of SIGTERM" >&2
  exit 1
fi
stopped=0
wait "$PID" || stopped=$?
PID=""
check "SIGTERM exits 0" 0 "$stopped"
check "  and logs it" 1 "$(grep -c '"msg":"stopped"' "$DIR/server.log")"

[[ "$fail" == 0 ]] || { echo "e2e: FAILURES"; exit 1; }
echo "e2e: all checks passed; the report is $E2E_REPORT"
