#!/usr/bin/env bash
# Start the server locally against a SQLite database under .local/, for Bruno.
#
# Idempotent: running it twice does not start a second process.
# Stop it with scripts/dev-down.sh.
#
#   ./scripts/dev-up.sh            # start (keeps any existing database)
#   ./scripts/dev-up.sh --fresh    # start from an empty database
#   ./scripts/dev-up.sh --logs     # start, then follow the log
set -euo pipefail

cd "$(dirname "$0")/.."

LOCAL_DIR=".local"
DATA_DIR="${LOCAL_DIR}/data"
LOG_FILE="${LOCAL_DIR}/server.log"
PID_FILE="${LOCAL_DIR}/server.pid"

# Fixed, not random: bruno/environments/local.yml carries the same values, so a
# fresh clone can send a request without editing anything. A development key
# for a loopback port, not a secret.
PORT="${PORT:-3190}"
OPEN_PORT="${OPEN_PORT:-3191}"
ACTIVITY_WRITE_KEY="${ACTIVITY_WRITE_KEY:-dev-activity-write-key}"

fresh=0
follow=0
for arg in "$@"; do
  case "$arg" in
    --fresh) fresh=1 ;;
    --logs)  follow=1 ;;
    *) echo "unknown option: $arg"; exit 2 ;;
  esac
done

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "already running (pid $(cat "$PID_FILE")) — ./scripts/dev-down.sh first, or use --logs"
  [[ "$follow" == 1 ]] && exec tail -f "$LOG_FILE"
  exit 0
fi

mkdir -p "$DATA_DIR"

if [[ "$fresh" == 1 ]]; then
  # The WAL and shm files go too: left beside a deleted database, they bring
  # yesterday's rows back into a "fresh" start.
  rm -f "$DATA_DIR"/*.db "$DATA_DIR"/*.db-wal "$DATA_DIR"/*.db-shm
  echo "cleared $DATA_DIR"
fi

# The built binary, not `go run`: `go run` is a parent whose child keeps the
# port after the parent is killed, so the next dev-up would talk to the old one.
make -s dist DIST_OS="$(go env GOHOSTOS)" DIST_ARCH="$(go env GOHOSTARCH)" \
  DIST_DIR="$LOCAL_DIR" BUILD_COMMIT=dev >/dev/null

PORT="$PORT" OPEN_PORT="$OPEN_PORT" DB_PATH="$DATA_DIR/activities.db" \
ACTIVITY_WRITE_KEY="$ACTIVITY_WRITE_KEY" LOG_LEVEL="${LOG_LEVEL:-info}" \
  "$LOCAL_DIR/credo-audit-backbone" >>"$LOG_FILE" 2>&1 &

pid=$!
echo "$pid" > "$PID_FILE"

ready=0
for _ in $(seq 1 50); do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "server exited during start-up — last lines of $LOG_FILE:"
    tail -5 "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
  fi
  if curl -sf -o /dev/null "http://127.0.0.1:${OPEN_PORT}/health"; then ready=1; break; fi
  sleep 0.2
done

if [[ "$ready" != 1 ]]; then
  echo "server did not become ready — see $LOG_FILE"
  exit 1
fi

cat <<INFO
audit-backbone is up (pid $pid)

  keyed  http://127.0.0.1:${PORT}   the writer and the read-token mint, behind the key
  open   http://127.0.0.1:${OPEN_PORT}   the two feeds, behind a read token

  data   ${DATA_DIR}/activities.db
  log    ${LOG_FILE}

Bruno: bru run --env local   (from bruno/)
Stop:  ./scripts/dev-down.sh
INFO

[[ "$follow" == 1 ]] && exec tail -f "$LOG_FILE"
exit 0
