#!/usr/bin/env bash
# The ops job's two guards, run with no AWS: the change-set filter on two recorded change sets,
# and the release's check of /health against a local server stamped with another commit.
# Expected length: under 15 seconds.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

fail=0
check() { # name wanted got
  if [ "$2" = "$3" ]; then echo "  ok   $1"; else echo "  FAIL $1: wanted '$2', got '$3'"; fail=1; fi
}

echo "== the change-set filter (stack.sh refuses what it names)"
filter() { # change set, then the ids taken on purpose as JSON
  jq -r --argjson take "$2" -f "$OPS_DIR/unsafe-changes.jq" "$OPS_DIR/testdata/$1"
}
check "a change set that adds and modifies in place passes" "" "$(filter changeset-adds.json '[]')"
check "a replaced box and a removed group are both named" \
  "Box (AWS::EC2::Instance): Modify, replacement True
OldGroup (AWS::EC2::SecurityGroup): Remove, replacement none" \
  "$(filter changeset-replaces.json '[]')"
check "a replacement named on purpose is taken, the removal still refused" \
  "OldGroup (AWS::EC2::SecurityGroup): Remove, replacement none" \
  "$(filter changeset-replaces.json '["Box"]')"

echo "== the check of /health (release.sh and check.sh wait on it)"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/credo-ops-test.XXXXXX")
PID=''
trap '[ -z "$PID" ] || kill "$PID" 2>/dev/null || true; rm -rf "$WORK"' EXIT

cat >"$WORK/stub.py" <<'PY'
import http.server, json, sys

# Answers /health as c-storage does: its status, and the commit it was stamped with (none: dev).
build = sys.argv[2]

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"status": "OK", "buildVersion": build}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass

http.server.HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
PY

serve() { # <stamp>: a server stamped with it, on a free port
  local port
  port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
  python3 "$WORK/stub.py" "$port" "$1" &
  PID=$!
  URL="http://127.0.0.1:$port/health"
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    curl -fsS "$URL" >/dev/null 2>&1 && return 0
    sleep 0.25
  done
  echo "the stand-in server never answered" >&2
  exit 1
}
stop() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  PID=''
}

want=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
other=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

serve "$other"
rc=0
wait_build "$want" 2 curl -fsS "$URL" >"$WORK/out" || rc=$?
check "a server stamped with another commit fails the check" 1 "$rc"
check "  and the answer names what it read" 1 "$(grep -c "$other" "$WORK/out")"
stop

serve dev
rc=0
wait_build "$want" 2 curl -fsS "$URL" >/dev/null || rc=$?
check "an unstamped server (dev) fails the check" 1 "$rc"
stop

serve "$want"
rc=0
wait_build "$want" 2 curl -fsS "$URL" >/dev/null || rc=$?
check "a server stamped with the commit passes" 0 "$rc"
stop

[ "$fail" = 0 ] || { echo "ops/test.sh: FAILURES"; exit 1; }
echo "ops/test.sh: all checks passed"
