#!/usr/bin/env bash
# ops/keys.sh <env> front-door|internal|admin|service
# Replaces one of the four keys by a new one made here, in the order that keeps calls answered as long as
# the key allows, then reads the old value back refused and the new one accepted
# (docs/plans/2026-11-11-front-door-keys.md, "How each part is decided"). The new key is made here from the
# kernel, masked first, and travels on pipes and 0600 files: no command line, log or terminal holds it.
#   front-door  the back end takes the old key and the new; a change set (ops/stack.sh, FRONT_DOOR_KEY_FILE)
#               sends the new to the distribution, refused when it changes anything else, and the stack's
#               update and then the distribution's own deploy are waited for; then the back end takes the new
#               alone. No call is refused meanwhile.
#   internal    new keys.env on the box, the store restarted and answering, then the function's copy set.
#               Calls fail from the restart to the function's update; the seconds are printed.
#   admin       new keys.env on the box, the store restarted. The back end never holds this key; calls fail
#               only for the seconds the store takes to restart.
#   service     the new bff.env waits beside the old one, the store's rekey replaces the BFF's key, the new
#               file is put in place, then the function's copy is set. Calls fail from the rekey to the
#               function's update; the seconds are printed. A second cost of the same act: the back end derives
#               its sign-in waits' record names and its operator challenges' signing key from the service key,
#               so replacing it restarts every sign-in wait (each name has five fresh tries) and voids every
#               open operator challenge (a 5-minute token; an operator mid-sign-in signs in again).
# Run by the human, from a worktree at main with pnpm install done, in a terminal holding an AWS session. Never
# by CI. Expected length: under a minute for internal, admin and service; the distribution's deploy (about 5
# minutes) for front-door. A run that stops after the first change says what it left (a STOPPED line) and what
# mends it; running it again replaces the key once more. No push to main while a key run runs: its deploy would
# set the old key on the function after this run set the new one.
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

# STOP_STATE: what a stop leaves once the first change is made, and what mends it; empty before the first change
# and after the last. lib.sh's on_exit prints it through cleanup_extra, whatever ended the run.
STOP_STATE=''
cleanup_extra() {
  [ -z "$STOP_STATE" ] || echo "STOPPED: $STOP_STATE"
}

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
# The service key too, for the other three kinds: a service run that stopped half way (the store rekeyed, the box's
# file not yet moved) is found here, before a second run changes anything. The service run itself is the mend.
if [ "$WHICH" != service ]; then
  [ "$(store_status "$LOCAL_PORT" GET /api/records/"$SERVICE_CODE"/keys-check-no-such-record - "x-internal-access-key: $INTERNAL_KEY" "x-access-key: $SERVICE_ACCESS_KEY")" = 404 ] ||
    die "the store refuses the service key the box's bff.env holds: nothing was changed; an earlier service run probably stopped half way (look for /etc/c-storage/bff.env.new on the box and move it over bff.env), or run ops/keys.sh $ENVNAME service again"
fi
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
    STOP_STATE="the box's keys file holds the new internal key and the function the old, so the back end's calls are refused until the function has the new one: make sure the store runs on the box (journalctl -u c-storage), then run ops/app.sh $ENVNAME, which sets the function's copy from the box's file"
    ok "the box's keys file holds the new internal key"
    restart_store "$NEW"
    OLD=$INTERNAL_KEY
    INTERNAL_KEY=$NEW
    bff_settings_set "$FRONT_DOOR_KEY"
    STOP_STATE=''
    ok "the function's copy is the new key"
    refused_for "$first"
    ;;
  admin)
    printf 'INTERNAL_ACCESS_KEY=%s\nX_SUPER_ADMIN_KEY=%s\n' "$INTERNAL_KEY" "$NEW" | box_secret_write /etc/c-storage/keys.env
    STOP_STATE="the box's keys file holds the new super-admin key and the store may not have restarted with it: restart it on the box (sudo systemctl restart c-storage; journalctl -u c-storage) and read it answer; the back end never holds this key, so no call of the app is refused for that"
    ok "the box's keys file holds the new super-admin key"
    restart_store "$INTERNAL_KEY"
    STOP_STATE=''
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
    STOP_STATE="the store holds the new service key while the box's bff.env and the function hold the old, so the back end's calls are refused: on the box run sudo mv -f /etc/c-storage/bff.env.new /etc/c-storage/bff.env, then run ops/app.sh $ENVNAME, which sets the function's copy from that file"
    ok "the store holds the new service key"
    box 'sudo mv -f /etc/c-storage/bff.env.new /etc/c-storage/bff.env'
    STOP_STATE="the store and the box's bff.env hold the new service key and the function the old, so the back end's calls are refused: run ops/app.sh $ENVNAME, which sets the function's copy from the box's file"
    ok "the box's bff.env is the new one"
    OLD=$SERVICE_ACCESS_KEY
    SERVICE_ACCESS_KEY=$NEW
    bff_settings_set "$FRONT_DOOR_KEY"
    STOP_STATE=''
    ok "the function's copy is the new key"
    refused_for "$first"
    ;;
  front-door)
    OLD=$FRONT_DOOR_KEY
    # The back end takes both keys first, so a call is answered with either while the distribution changes.
    bff_settings_set "$OLD,$NEW"
    STOP_STATE="the function takes both door keys, which answers every call, and the distribution sends the old or the new: run this again, or ops/app.sh $ENVNAME, which sets the distribution's key alone"
    ok "the function takes the old door key and the new"
    keyfile=$WORK/front-door.key
    (
      umask 077
      printf '%s\n' "$NEW" >"$keyfile"
    )
    # A refusal or a failure here leaves the function with both keys, which answers every call; run this
    # again, or ops/app.sh, which sets the distribution's key alone.
    # Its lines go to the terminal and to its own log (it prints the app's address, which this log must not
    # hold: this run masked it), not to this log.
    echo "the stack's key run follows on the terminal, and in its own log in logs/"
    FRONT_DOOR_KEY_FILE=$keyfile bash "$OPS_DIR/stack.sh" env "$ENVNAME" >&3 2>&3 ||
      die "the stack's key run did not finish: the function still takes both keys; read the lines above, then run this again"
    rm -f "$keyfile"
    front_door_key_read "$DISTRIBUTION_ID"
    [ "$FRONT_DOOR_KEY" = "$NEW" ] || die "the distribution still sends a key other than the new one: the function still takes both keys; run this again"
    ok "the distribution sends the new key"
    # The stack's update returns when CloudFormation does, which is not read to mean every edge sends the new
    # key; the distribution's own deploy is waited for, so the new key alone is taken only once it is everywhere.
    echo "waiting until the distribution is deployed (minutes)"
    aws cloudfront wait distribution-deployed --id "$DISTRIBUTION_ID" ||
      die "the distribution is not deployed yet or the wait failed: the function still takes both keys; run this again"
    ok "the distribution is deployed"
    bff_settings_set "$NEW"
    STOP_STATE=''
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
    ;;
esac
# Every kind ends on the app's address, as a person reaches it: the back end answering through the door with the
# keys it holds now (a client that does not exist: 404, so it reached the store). The store reads above do not
# show the function's copy at work; a deploy that ran meanwhile and set an old key would show here as a 403 or 5xx.
EDGE_BASE=$APP_ADDRESS
edge GET /api/config -H 'x-client-code: keys-check-no-such-client'
expect "  and the app's address, through the door, answers a call with no key of its own" 404 "$EDGE_STATUS"

step "the log holds no key"
echo "the end of the run searches this log for the old and the new key"
verdict
echo "replaced the $WHICH key"
if [ "$WHICH" = service ]; then
  echo "it also restarted every sign-in wait (each name has five fresh tries) and voided every open operator challenge (an operator mid-sign-in signs in again): both are derived from the service key"
fi
