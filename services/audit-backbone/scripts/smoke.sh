#!/usr/bin/env bash
# Start the real binary against a throwaway database and walk every route.
#
# What it is for: the properties that only exist once the process is assembled —
# a gate in front of each whole mux, /health before both, a token minted on one
# port reading on the other, and a write that is durable by the time it answers.
# The unit tests hold the same rules against the handlers; this holds them
# against a socket.
set -euo pipefail

cd "$(dirname "$0")/.."

KEY="smoke-write-$RANDOM"
COMMIT="smoke-$RANDOM$RANDOM"
PORT="${PORT:-3390}"
OPEN_PORT="${OPEN_PORT:-3391}"
DIR="$(mktemp -d "${TMPDIR:-/tmp}/audit-smoke.XXXXXX")"
trap 'kill -9 "${PID:-}" 2>/dev/null || true; rm -rf "$DIR"' EXIT

# The artifact's own recipe, for this machine: the flags that ship are the flags
# tested. A built binary, not `go run`, whose child keeps the port after a kill.
make -s dist DIST_OS="$(go env GOHOSTOS)" DIST_ARCH="$(go env GOHOSTARCH)" \
  DIST_DIR="$DIR" BUILD_COMMIT="$COMMIT" >/dev/null
PORT="$PORT" OPEN_PORT="$OPEN_PORT" DB_PATH="$DIR/data/activities.db" \
  ACTIVITY_WRITE_KEY="$KEY" LOG_LEVEL=warn "$DIR/credo-audit-backbone" &
PID=$!

for _ in $(seq 1 50); do
  curl -sf -o /dev/null "http://127.0.0.1:${PORT}/health" && break
  sleep 0.2
done

fail=0
check() { # name expected actual
  if [[ "$2" == "$3" ]]; then echo "  ok   $1"; else echo "  FAIL $1: got $3, want $2"; fail=1; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

KEYED="http://127.0.0.1:${PORT}"
OPEN="http://127.0.0.1:${OPEN_PORT}"
ACT="$KEYED/api/activities"
READ="$OPEN/api/activities"
MINT="$KEYED/api/read-tokens"
WRITE=(-H "x-internal-access-key: $KEY")
JSON=(-H 'content-type: application/json')
HEALTH="{\"status\":\"OK\",\"buildVersion\":\"$COMMIT\"}"
token_for() { # clientId → a read token minted with the key
  curl -s -X POST "$MINT" "${WRITE[@]}" "${JSON[@]}" -d "{\"clientId\":\"$1\"}" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

echo "== /health: two fields, the commit built, on both ports, without a key"
check "keyed /health" "$HEALTH" "$(curl -s "$KEYED/health")"
check "open /health"  "$HEALTH" "$(curl -s "$OPEN/health")"

echo "== the key is not optional"
check "append without a key"      401 "$(code -X POST "$ACT" "${JSON[@]}" -d '{"activities":[]}')"
check "append with a wrong key"   401 "$(code -X POST "$ACT" -H 'x-internal-access-key: nope' "${JSON[@]}" -d '{"activities":[]}')"
check "mint without a key"        401 "$(code -X POST "$MINT" "${JSON[@]}" -d '{"clientId":"acme"}')"
TOKEN="$(token_for acme)"
check "mint with the key"         1 "$([[ -n "$TOKEN" ]] && echo 1 || echo 0)"
READS=(-H "authorization: Bearer $TOKEN")
# Without a credential every path is 401 on both ports, so a status code maps
# nothing; WITH one a 404 is the honest answer.
for path in /healthz /version /status /api/nothing-here; do
  check "GET $path unkeyed"   401 "$(code "$KEYED$path")"
  check "GET $path keyed"     404 "$(code "$KEYED$path" "${WRITE[@]}")"
  check "GET $path untokened" 401 "$(code "$OPEN$path")"
  check "GET $path tokened"   404 "$(code "$OPEN$path" "${READS[@]}")"
done

echo "== the open listener reads only with a token"
check "actor feed without a token" 401 "$(code "$READ/by-actor/emp-1")"
check "target feed without a token" 401 "$(code "$READ/by-target/so-1")"
check "the key is no token"        401 "$(code "$READ/by-actor/emp-1" "${WRITE[@]}" -H "authorization: Bearer $KEY")"
check "a forged token"             401 "$(code "$READ/by-actor/emp-1" -H "authorization: Bearer ${TOKEN%.*}.$(printf 'A%.0s' $(seq 1 43))")"
check "the token is no key"        401 "$(code -X POST "$ACT" -H "x-internal-access-key: $TOKEN" "${JSON[@]}" -d '{"activities":[]}')"
check "actor feed with its token"  200 "$(code "$READ/by-actor/emp-1" "${READS[@]}")"
check "target feed with its token" 200 "$(code "$READ/by-target/so-1" "${READS[@]}")"
check "append unreachable openly"  404 "$(code -X POST "$OPEN/api/activities" "${WRITE[@]}" "${READS[@]}" "${JSON[@]}" -d '{"activities":[]}')"
check "mint unreachable openly"    404 "$(code -X POST "$OPEN/api/read-tokens" "${WRITE[@]}" "${READS[@]}" "${JSON[@]}" -d '{"clientId":"acme"}')"
check "keyed port has no reader"   404 "$(code "$ACT/by-actor/emp-1" "${WRITE[@]}")"
# 404, not 405: a 405 confirms that the path exists.
check "a wrong verb is a 404"      404 "$(code -X PUT "$READ/by-actor/emp-1" "${READS[@]}")"

echo "== CORS on the open port, and only there"
header() { curl -s -D - -o /dev/null "${@:2}" | tr -d '\r' | awk -F': ' -v h="$1" 'tolower($1)==h{print $2}'; }
preflight=(-X OPTIONS -H 'origin: https://acme.example' -H 'access-control-request-method: GET')
check "open preflight, no token"  204 "$(code "${preflight[@]}" "$READ/by-actor/emp-1")"
check "open allows any origin"    "*" "$(header access-control-allow-origin "${preflight[@]}" "$READ/by-actor/emp-1")"
check "and the token's header"    authorization "$(header access-control-allow-headers "${preflight[@]}" "$READ/by-actor/emp-1")"
check "a 401 is readable"         "*" "$(header access-control-allow-origin "$READ/by-actor/emp-1")"
check "keyed has no CORS"         "" "$(header access-control-allow-origin "${preflight[@]}" "$ACT")"

echo "== append, then read with the token"
created="$(curl -s -X POST "$ACT" "${WRITE[@]}" "${JSON[@]}" \
  -d '{"activities":[{"clientId":"acme","actorId":"emp-1","action":"created","targetId":"so-1"},
                     {"clientId":"acme","actorId":"emp-1","action":"signed in"}]}')"
check "append returned two ids" 2 "$(printf '%s' "$created" | grep -o '"[0-9A-HJKMNP-TV-Z]\{26\}"' | wc -l | tr -d ' ')"
count() { curl -s "$@" | grep -o '"action":' | wc -l | tr -d ' '; }
check "the actor feed has both"  2 "$(count "$READ/by-actor/emp-1" "${READS[@]}")"
# The partial index: the targetless entry must not appear here.
check "the target feed has one"  1 "$(count "$READ/by-target/so-1" "${READS[@]}")"
check "another tenant sees none" 0 "$(count "$READ/by-actor/emp-1" -H "authorization: Bearer $(token_for other)")"
# The tenant is the token's: a clientId in the query names nothing.
check "the query names no tenant" 2 "$(count "$READ/by-actor/emp-1?clientId=other" "${READS[@]}")"

cursor="$(curl -s "$READ/by-actor/emp-1?limit=1" "${READS[@]}" | grep -o '"nextCursor":"[^"]*"' | cut -d'"' -f4)"
check "a cursor was issued" 1 "$([[ -n "$cursor" ]] && echo 1 || echo 0)"
check "the other feed refuses it" 400 "$(code "$READ/by-target/so-1?cursor=$cursor" "${READS[@]}")"

echo "== a 201 means committed, not queued"
kill -9 "$PID"; wait "$PID" 2>/dev/null || true
check "rows survived a hard kill" 2 "$(sqlite3 "$DIR/data/activities.db" 'SELECT count(*) FROM activities;')"

# The coverage gate leaves cmd/server out; these are the paths main.go keeps.
echo "== the entry point: a dead process at start-up, a clean one at SIGTERM"
exit_of() { # env assignments → the binary's exit status; its log in exit.log
  env "$@" LOG_LEVEL=warn "$DIR/credo-audit-backbone" >"$DIR/exit.log" 2>&1 && echo 0 || echo $?
}
check "a bad configuration exits 1" 1 \
  "$(exit_of PORT="$PORT" OPEN_PORT="$PORT" DB_PATH="$DIR/other.db" ACTIVITY_WRITE_KEY="$KEY")"
PORT="$PORT" OPEN_PORT="$OPEN_PORT" DB_PATH="$DIR/data/activities.db" \
  ACTIVITY_WRITE_KEY="$KEY" LOG_LEVEL=warn "$DIR/credo-audit-backbone" >"$DIR/server.log" &
PID=$!
for _ in $(seq 1 50); do
  curl -sf -o /dev/null "$KEYED/health" && break
  sleep 0.2
done
check "a held port exits 1" 1 \
  "$(exit_of PORT="$PORT" OPEN_PORT="$OPEN_PORT" DB_PATH="$DIR/other.db" ACTIVITY_WRITE_KEY="$KEY")"
check "and logs why"       1 "$(grep -c '"level":"ERROR"' "$DIR/exit.log")"
kill -TERM "$PID"
stopped=0; wait "$PID" || stopped=$?
check "SIGTERM exits 0" 0 "$stopped"
# At warn, the start-up and stop lines (info) must not appear.
check "LOG_LEVEL reaches the log" 0 "$(grep -c '"level":"INFO"' "$DIR/server.log")"

echo
if [[ "$fail" == 0 ]]; then echo "smoke: all checks passed"; else echo "smoke: FAILURES"; fi
exit "$fail"
