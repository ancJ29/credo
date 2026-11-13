#!/usr/bin/env bash
# ops/keys.sh <env> front-door|internal|admin|service
# Replaces one of the four keys by a new one made here, in the order that keeps calls answered as long as
# the key allows, then reads the old value back refused and the new one accepted
# (docs/plans/2026-11-11-front-door-keys.md, "How each part is decided"). The new key is made here from the
# kernel, masked first, and travels on pipes and 0600 files: no command line, log or terminal holds it.
#   front-door  the back end takes the old key and the new; a change set (ops/stack.sh, FRONT_DOOR_KEY_FILE)
#               sends the new to the distribution, refused when it changes anything else, and the stack's
#               update waits until the distribution is deployed; then the back end takes the new alone.
#               No call is refused meanwhile.
#   internal    new keys.env on the box, the store restarted and answering, then the function's copy set.
#               Calls fail from the restart to the function's update; the seconds are printed.
#   admin       new keys.env on the box, the store restarted. The back end never holds this key; calls fail
#               only for the seconds the store takes to restart.
#   service     the new bff.env waits beside the old one, the store's rekey replaces the BFF's key, the new
#               file is put in place, then the function's copy is set. Calls fail from the rekey to the
#               function's update; the seconds are printed.
# Run by the human, from a worktree at main with pnpm install done, in a terminal holding an AWS session. Never
# by CI. Expected length: under a minute for internal, admin and service; the distribution's deploy (about 5
# minutes) for front-door. A run that stops after the first change says what was changed; running it again
# replaces the key once more.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -eq 2 ] || {
  echo "usage: ops/keys.sh <env> front-door|internal|admin|service" >&2
  exit 2
}
ENVNAME=$1
WHICH=$2
case "$WHICH" in
  front-door | internal | admin | service) ;;
  *)
    echo "usage: ops/keys.sh <env> front-door|internal|admin|service" >&2
    exit 2
    ;;
esac
STEPS=6
# Neither the local stack's port (3181), the check's (3191), the tunnel's (3192), the deploy's (3193),
# the operator's (3194), the seed's (3195), the root password's (3196) nor the demo remake's (3197).
LOCAL_PORT=${KEYS_LOCAL_PORT:-3198}

log_start keys "$ENVNAME"
mkwork
real_ok "$ENVNAME" "it replaces one key and reads the old value back refused, and changes nothing else"

step "a person's terminal, and main's code"
[ "${GITHUB_ACTIONS:-}" != true ] || die "keys.sh is run by a person at a terminal, never by a job: the deploy role holds no right to change a stack or the box's keys"
main_synced

step "the stack, and the tunnel"
stack_load "$ENVNAME"
[ -n "$STACK_JSON" ] || die "stack $ENVNAME does not exist"
app_load || die "$ENVNAME's stack holds no layer four yet: ops/stack.sh env $ENVNAME first"
[ -n "$DISTRIBUTION_ID" ] || die "the stack names no distribution (its DistributionId output is missing): ops/stack.sh env $ENVNAME first"
refuse_taken_port "$LOCAL_PORT" "free it, or set KEYS_LOCAL_PORT"
box_open "$ENVNAME" "$LOCAL_PORT" || die "the box does not answer through the endpoint, or 127.0.0.1:$LOCAL_PORT could not be bound"
echo "box: $BOX_ID"

step "the keys now, read first: nothing is changed before the store accepts them"
read_keys
box test -e /etc/c-storage/bff.env || die "the box holds no bff.env: the first app deploy makes the BFF's service (ops/app.sh $ENVNAME)"
bff_env_read
front_door_key_read "$DISTRIBUTION_ID"
[ "$(store_status "$LOCAL_PORT" GET /api/status - "x-internal-access-key: $INTERNAL_KEY")" = 200 ] ||
  die "the store refuses the internal key the box's file holds: nothing was changed"
ok "the store accepts the keys the box holds"

# wait_store <internal key>: until the store answers its status with the key, 40 tries a second apart
wait_store() {
  local i
  for i in $(seq 1 40); do
    [ "$(store_status "$LOCAL_PORT" GET /api/status - "x-internal-access-key: $1")" = 200 ] && return 0
    sleep 1
  done
  die "the store does not answer with the new key after 40 seconds: the box's keys file holds the new key, the function still the old; read the journal on the box, then run this again"
}

# restart_store <internal key>: the store restarted, then answering with the key, the seconds it took printed
restart_store() {
  local t0 t1
  t0=$(date +%s)
  box 'sudo systemctl restart c-storage'
  wait_store "$1"
  t1=$(date +%s)
  echo "the store was down for about $((t1 - t0)) seconds"
}

# refused_for <epoch seconds at the first change>: the seconds calls were refused, as measured
refused_for() {
  echo "calls were refused for about $(($(date +%s) - $1)) seconds (from the first change to the function's update)"
}

NEW=$(new_key)
mask "$NEW"

step "the $WHICH key is replaced"
case "$WHICH" in
  internal)
    printf 'INTERNAL_ACCESS_KEY=%s\nX_SUPER_ADMIN_KEY=%s\n' "$NEW" "$ADMIN_KEY" | box_secret_write /etc/c-storage/keys.env
    first=$(date +%s)
    ok "the box's keys file holds the new internal key"
    restart_store "$NEW"
    OLD=$INTERNAL_KEY
    INTERNAL_KEY=$NEW
    bff_settings_set "$FRONT_DOOR_KEY"
    ok "the function's copy is the new key"
    refused_for "$first"
    ;;
  admin)
    printf 'INTERNAL_ACCESS_KEY=%s\nX_SUPER_ADMIN_KEY=%s\n' "$INTERNAL_KEY" "$NEW" | box_secret_write /etc/c-storage/keys.env
    ok "the box's keys file holds the new super-admin key"
    restart_store "$INTERNAL_KEY"
    OLD=$ADMIN_KEY
    ADMIN_KEY=$NEW
    ;;
  service)
    # The new file waits beside the old one first, so a rekey that succeeds can never leave a key nobody holds.
    printf 'SERVICE_CODE=%s\nSERVICE_ACCESS_KEY=%s\n' "$SERVICE_CODE" "$NEW" | box_secret_write /etc/c-storage/bff.env.new
    ok "the box holds the new bff.env beside the old one"
    first=$(date +%s)
    if ! printf '%s\n' "$NEW" | INTERNAL_ACCESS_KEY=$INTERNAL_KEY X_SUPER_ADMIN_KEY=$ADMIN_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY \
      C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT ridge_cli rekey; then
      box 'sudo rm -f /etc/c-storage/bff.env.new' || true
      die "the store did not replace the BFF's service key; the new file was removed and nothing was changed"
    fi
    ok "the store holds the new service key"
    box 'sudo mv -f /etc/c-storage/bff.env.new /etc/c-storage/bff.env'
    ok "the box's bff.env is the new one"
    OLD=$SERVICE_ACCESS_KEY
    SERVICE_ACCESS_KEY=$NEW
    bff_settings_set "$FRONT_DOOR_KEY"
    ok "the function's copy is the new key"
    refused_for "$first"
    ;;
  front-door)
    OLD=$FRONT_DOOR_KEY
    # The back end takes both keys first, so a call is answered with either while the distribution changes.
    bff_settings_set "$OLD,$NEW"
    ok "the function takes the old door key and the new"
    keyfile=$WORK/front-door.key
    (
      umask 077
      printf '%s\n' "$NEW" >"$keyfile"
    )
    # The stack's update waits until the distribution is deployed. A refusal or a failure here leaves the
    # function with both keys, which answers every call; run this again, or ops/app.sh, which sets the
    # distribution's key alone.
    # Its lines go to the terminal and to its own log (it prints the app's address, which this log must not
    # hold: this run masked it), not to this log.
    echo "the stack's key run follows on the terminal, and in its own log in logs/"
    FRONT_DOOR_KEY_FILE=$keyfile bash "$OPS_DIR/stack.sh" env "$ENVNAME" >&3 2>&3 ||
      die "the stack's key run did not finish: the function still takes both keys; read the lines above, then run this again"
    rm -f "$keyfile"
    front_door_key_read "$DISTRIBUTION_ID"
    [ "$FRONT_DOOR_KEY" = "$NEW" ] || die "the distribution still sends a key other than the new one: the function still takes both keys; run this again"
    ok "the distribution sends the new key"
    bff_settings_set "$NEW"
    ok "the function takes the new key alone"
    echo "no call was refused: the function took both keys until the distribution sent the new"
    ;;
esac

step "the old key read back refused, the new one accepted"
case "$WHICH" in
  internal)
    expect "the store refuses the old internal key" 401 "$(store_status "$LOCAL_PORT" GET /api/status - "x-internal-access-key: $OLD")"
    expect "  and accepts the new" 200 "$(store_status "$LOCAL_PORT" GET /api/status - "x-internal-access-key: $NEW")"
    ;;
  admin)
    # A rekey of a code that is not registered writes nothing: 401 is the key refused, 404 the key accepted.
    body='{"code":"keys-check-no-such-service","accessKey":"not-a-key"}'
    expect "the store refuses the old super-admin key" 401 "$(store_status "$LOCAL_PORT" POST /api/services/rekey "$body" "x-internal-access-key: $INTERNAL_KEY" "x-super-admin-key: $OLD")"
    expect "  and accepts the new (a service that does not exist: 404, nothing written)" 404 "$(store_status "$LOCAL_PORT" POST /api/services/rekey "$body" "x-internal-access-key: $INTERNAL_KEY" "x-super-admin-key: $NEW")"
    ;;
  service)
    expect "the store refuses the old service key" 403 "$(store_status "$LOCAL_PORT" GET /api/records/"$SERVICE_CODE"/keys-check-no-such-record - "x-internal-access-key: $INTERNAL_KEY" "x-access-key: $OLD")"
    expect "  and accepts the new (a record that does not exist: 404)" 404 "$(store_status "$LOCAL_PORT" GET /api/records/"$SERVICE_CODE"/keys-check-no-such-record - "x-internal-access-key: $INTERNAL_KEY" "x-access-key: $NEW")"
    ;;
  front-door)
    # The API's own address and the app's, as the check reads them; the keys go in a 0600 file for curl.
    hdr=$WORK/door.headers
    (
      umask 077
      printf 'x-front-door-key: %s\n' "$OLD" >"$hdr"
    )
    EDGE_BASE=$API_ADDRESS
    edge GET /api/config -H 'x-client-code: keys-check-no-such-client' -H "@$hdr"
    expect "the API's own address refuses the old door key" 403 "$EDGE_STATUS"
    (
      umask 077
      printf 'x-front-door-key: %s\n' "$NEW" >"$hdr"
    )
    edge GET /api/config -H 'x-client-code: keys-check-no-such-client' -H "@$hdr"
    expect "  and answers a call with the new one (a client that does not exist: 404)" 404 "$EDGE_STATUS"
    rm -f "$hdr"
    EDGE_BASE=$APP_ADDRESS
    edge GET /api/config -H 'x-client-code: keys-check-no-such-client'
    expect "  and the app's address, through the door, answers a call with no key of its own" 404 "$EDGE_STATUS"
    ;;
esac

step "the log holds no key"
echo "the end of the run searches this log for the old and the new key"
verdict
echo "replaced the $WHICH key"
