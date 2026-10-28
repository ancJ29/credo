#!/usr/bin/env bash
# ops/tunnel.sh <env>
# Holds http://127.0.0.1:3192 open to <env>'s c-storage from this machine, in the caller's own AWS
# session, until Ctrl-C or the endpoint's hour, so Bruno or curl can read it. Says ready only once
# /health through it names a commit of main; then writes <env>'s keys and a fresh service's into one
# Bruno environment, c-storage/bruno/environments/<env>-tunnel.yml, removed when the tunnel ends.
# Needs the caller's AWS session. Run from a worktree whose ops/ is origin/main's.
# Why it is shaped so: docs/plans/2026-10-28-ridge-tunnel.md.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -eq 1 ] || {
  echo "usage: ops/tunnel.sh <env>" >&2
  exit 2
}
ENVNAME=$1
STEPS=4
# Fixed, with no override: the port is the lock against a second run. Neither the local stack's
# (3181) nor the check's (3191), so ops/check.sh runs beside an open tunnel.
TUNNEL_PORT=3192
KEYS_FILE=$REPO_DIR/c-storage/bruno/environments/$ENVNAME-tunnel.yml
CHECK_EVERY=5

# clock <epoch seconds> → HH:MM local time (GNU date, then BSD's)
clock() { date -d "@$1" +%H:%M 2>/dev/null || date -r "$1" +%H:%M; }

log_start tunnel "$ENVNAME"

# Ridge alone until the guard that refuses a client's stack exists (ridge's plan, "Left behind"): a
# client's stack reachable from the same AWS session would put its admin keys on this disk and point
# the collection, which writes test records, at real data.
step "main and the port"
[ "$ENVNAME" = ridge ] ||
  die "tunnel.sh holds ridge alone for now: another stack's admin keys would land on this disk, and the collection would write test records into it"
refuse_taken_port "$TUNNEL_PORT" "an earlier tunnel is still open: ops/README.md, 'The tunnel', names how to end it"
require_ignored "$KEYS_FILE"
main_synced

step "the tunnel to $ENVNAME's box"
box_open "$ENVNAME" "$TUNNEL_PORT" ||
  die "the box does not answer through the endpoint, or 127.0.0.1:$TUNNEL_PORT could not be bound (taken since it was checked)"
opened=$(date +%s)

step "/health names a commit of main"
health_main_read "$TUNNEL_PORT"
[ -z "$HEALTH_PROBLEM" ] || die "$HEALTH_PROBLEM"
ok "/health names $HEALTH_BUILD, a commit of main"

# Nothing is written before /health has passed. A fresh service code and access key each run: the
# collection's first request registers the service, and a second run under the same code would
# answer 409. The keys file is removed by on_exit, and only if this run wrote it.
step "the Bruno environment"
read_keys
service_code="tunnel-$(date -u +%Y%m%dT%H%M%SZ)"
access_key=$(random_hex)
mask "$access_key"
if [ -e "$KEYS_FILE" ]; then echo "note: replacing a keys file an earlier run left"; fi
bruno_env_write "$KEYS_FILE" "$TUNNEL_PORT" "$service_code" "$access_key"

echo "ready: http://127.0.0.1:$TUNNEL_PORT is $ENVNAME's c-storage, until Ctrl-C or $(clock $((opened + 3600))) (the endpoint's hour)"
echo "  Bruno: open the collection c-storage/bruno, pick the environment $ENVNAME-tunnel"
echo "  curl:  curl http://127.0.0.1:$TUNNEL_PORT/health; the keys are in ${KEYS_FILE#"$REPO_DIR"/}"
echo "  this run's service: $service_code, registered by the collection's first request"

tunnel_hold "$CHECK_EVERY"
