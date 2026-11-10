#!/usr/bin/env bash
# Stop the local server started by scripts/dev-up.sh.
#
#   ./scripts/dev-down.sh           # stop, keep the database
#   ./scripts/dev-down.sh --purge   # stop and delete the local database
set -euo pipefail

cd "$(dirname "$0")/.."

LOCAL_DIR=".local"
DATA_DIR="${LOCAL_DIR}/data"
PID_FILE="${LOCAL_DIR}/server.pid"
PORT="${PORT:-3190}"
OPEN_PORT="${OPEN_PORT:-3191}"

purge=0
for arg in "$@"; do
  case "$arg" in
    --purge) purge=1 ;;
    *) echo "unknown option: $arg"; exit 2 ;;
  esac
done

stopped=0
if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    # SIGTERM, not SIGKILL: the server stops accepting, lets in-flight writes
    # commit, and only then takes the writer away. Killing it outright is what
    # scripts/smoke.sh does on purpose, to prove a 201 was already durable —
    # that is a test, not a way to stop a server you are using.
    kill -TERM "$pid"
    for _ in $(seq 1 50); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.1
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "pid $pid ignored SIGTERM; sending SIGKILL"
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "stopped (pid $pid)"
    stopped=1
  fi
  rm -f "$PID_FILE"
fi

# A process started some other way still holds the port, and the next dev-up
# would silently talk to it.
for port in "$PORT" "$OPEN_PORT"; do
  leftover="$(lsof -ti :"$port" 2>/dev/null || true)"
  if [[ -n "$leftover" ]]; then
    echo "port $port still held by pid(s) $leftover — killing"
    echo "$leftover" | xargs kill -9 2>/dev/null || true
    stopped=1
  fi
done

[[ "$stopped" == 0 ]] && echo "nothing was running"

if [[ "$purge" == 1 ]]; then
  rm -f "$DATA_DIR"/*.db "$DATA_DIR"/*.db-wal "$DATA_DIR"/*.db-shm
  echo "purged $DATA_DIR"
fi
exit 0
