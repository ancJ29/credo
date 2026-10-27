#!/usr/bin/env bash
# The end-to-end check: the server built for this machine, started on a fresh
# database, the Bruno collection run against it. The Go tests hold every rule in
# process; this holds the assembled process, over a real socket. Exits non-zero
# if the server never answers /health or any request or assertion fails.
set -euo pipefail

cd "$(dirname "$0")/.."

for tool in curl go; do
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

go build -o "$DIR/server" ./cmd/server

PORT="$PORT" DB_PATH="$DIR/data/c-storage.db" \
  INTERNAL_ACCESS_KEY="$(var internalAccessKey)" X_SUPER_ADMIN_KEY="$(var superAdminKey)" \
  "$DIR/server" >"$DIR/server.log" 2>&1 &
PID=$!

# A server that died, or another one already on the port, must not read as up.
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

cd bruno
bru run --env local
