#!/usr/bin/env bash
# ops/check.sh <env> [--reads-only]
# Reads <env> from AWS and from the box, runs c-storage's Bruno collection through the tunnel and,
# once the stack holds layer four, reads the BFF's function and the UI's bucket and walks a fresh
# client through the app's address as a partner would (docs/plans/2026-10-28-ridge-app.md#layer-four).
# Green is every read below passing; the log ends on == green, or names each red.
# On an environment that may hold real data (not listed in lib.sh's INVENTED_ENVS), and on any with
# --reads-only, the check only reads: it copies no key off the box, writes no Bruno file, runs no
# collection (so needs no Bruno) and makes and sweeps no client; it keeps every AWS read, the box's
# facts, /health, the records' copy, layer four's reads and the six reads through the app's address that need no client.
# The copy: c-storage's /api/status, read on the box (its key never leaves it), against the newest object the
# bucket holds under the box's path (lib.sh's copy_problems names what is red).
# Runs after each release in the deploy job, and by hand.
# Needs services/c-storage/bruno/ (the collection), Bruno CLI 4.2.0 (`npm install -g --ignore-scripts @usebruno/cli@4.2.0`) and
# node, which reads its report, and /health's buildVersion (the plan's step 6). With layer four also
# pnpm install done, for the client it makes through the operator's own create function.
# Run from a worktree whose ops/ is origin/main's.
# Expected length: about 2 minutes.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -eq 1 ] || { [ $# -eq 2 ] && [ "$2" = --reads-only ]; } || {
  echo "usage: ops/check.sh <env> [--reads-only]" >&2
  exit 2
}
ENVNAME=$1
READS_ONLY=0
[ $# -eq 1 ] || READS_ONLY=1
STEPS=8
# Never the local stack's port (3181): a c-storage on this machine must not answer for the box.
LOCAL_PORT=${CHECK_LOCAL_PORT:-3191}
BRUNO_DIR=$REPO_DIR/services/c-storage/bruno
WANT_BRUNO=4.2.0

log_start check "$ENVNAME"
mkwork
real_ok "$ENVNAME" "it only reads there: no key off the box, no collection, no client made"
# The mode: a real environment is always read-only (real_ok set REAL); --reads-only gives ridge the same run.
if [ "${REAL:-0}" = 1 ]; then READS_ONLY=1; fi

# The client the check makes (set before it is made) is deleted here, which runs on every end of the
# run, green, red or died, while the tunnel is still open. A failed delete is reported and does not
# turn a green check red.
CHECK_TENANT=''
cleanup_extra() {
  if [ "$READS_ONLY" = 0 ]; then rm -f "$BRUNO_DIR/environments/$ENVNAME.yml"; fi
  if [ -n "$CHECK_TENANT" ]; then
    local gone
    if gone=$(INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT \
      ridge_cli untenant "$CHECK_TENANT" 2>&1); then
      echo "ok   $gone"
    else
      echo "WARN the check's client $CHECK_TENANT was not deleted (delete it in the console): $gone"
    fi
  fi
}

step "the tools and the collection"
main_synced
if [ "$READS_ONLY" = 1 ]; then
  echo "skipped: reads only, so no collection and no Bruno"
else
  command -v node >/dev/null || die "needs node on PATH, to read Bruno's report"
  [ -d "$BRUNO_DIR" ] || die "no services/c-storage/bruno: the collection arrives with main (the plan's step 5)"
  have=$(bru_clean --version 2>/dev/null) || have=none
  [ "$have" = "$WANT_BRUNO" ] || die "needs Bruno CLI $WANT_BRUNO, found $have: npm install -g --ignore-scripts @usebruno/cli@$WANT_BRUNO"
  # The keys go into this file, so git must ignore it.
  require_ignored "services/c-storage/bruno/environments/$ENVNAME.yml"
fi
refuse_taken_port "$LOCAL_PORT" "free it, or set CHECK_LOCAL_PORT"

step "the AWS reads"
stack_load "$ENVNAME"
[ -n "$STACK_JSON" ] || die "stack $ENVNAME does not exist"
box_id=$(out BoxId)
group_id=$(out BoxGroupId)
vpc_id=$(out VpcId)
# Layer four's names, masked here before anything else can print them; empty before the stack holds it.
LAYER4=1
app_load || LAYER4=0
public=$(aws ec2 describe-instances --instance-ids "$box_id" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
expect "the box's public address" None "$public"
igw=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$vpc_id" --query 'length(InternetGateways)' --output text)
expect "internet gateways on the VPC" 0 "$igw"
endpoint_groups=$(aws ec2 describe-instance-connect-endpoints --filters "Name=vpc-id,Values=$vpc_id" \
  --query 'InstanceConnectEndpoints[].SecurityGroupIds[]' --output json)
rules=$(aws ec2 describe-security-groups --group-ids "$group_id" --query 'SecurityGroups[0].IpPermissions' --output json)
# Ssh from a group of the endpoint and, from layer four, c-storage's port from the BFF's group: those and nothing else.
expect "the box's group admits ssh from the endpoint's group, and c-storage's port from the BFF's group, nothing else" yes \
  "$(box_rules_verdict "$rules" "$endpoint_groups" "$BFF_GROUP" "$BOX_PORT")"

step "the tunnel, and the box's reads"
box_open "$ENVNAME" "$LOCAL_PORT" || die "the box does not answer through the endpoint, or 127.0.0.1:$LOCAL_PORT could not be bound (taken since it was checked)"
facts=$(box sudo bash -s -- "$BOX_PORT" <<'REMOTE'
port=$1
echo "unit=$(systemctl is-active c-storage 2>&1 || true)"
echo "listen=$(ss -Hltn sport = :"$port" | awk '{print $4}' | sort -u | tr '\n' ' ')"
echo "keys=$(stat -c '%a %U' /etc/c-storage/keys.env 2>&1 || true)"
echo "oom=$(journalctl -k -b --no-pager 2>/dev/null | grep -ciE 'out of memory|oom-kill' || true)"
echo "dbdir=$(stat -L -c '%a' /var/lib/c-storage 2>&1 || true)"
echo "dbfiles=$(stat -L -c '%a' /var/lib/c-storage/c-storage.db* 2>&1 | sort -u | tr '\n' ' ')"
echo "arch=$(uname -m)"
echo "memory=$(free -m | awk '/^Mem:/{print $7" MiB available of "$2" MiB"}')"
echo "swap=$(free -m | awk '/^Swap:/{print $3" of "$2" MiB used"}')"
echo "disk=$(df -Pm / | awk 'NR==2{print $4" MiB free of "$2" MiB"}')"
REMOTE
)
fact() { sed -n "s/^$1=//p" <<<"$facts"; }
expect "c-storage's unit" active "$(fact unit)"
# yes or no, so a red never prints the box's private address either way
expect "c-storage listens on the box's private address alone" yes "$([ "$(fact listen)" = "$BOX_LISTEN_ADDR:$BOX_PORT " ] && echo yes || echo no)"
expect "the keys file's mode and owner" "600 root" "$(fact keys)"
expect "the database directory's mode" 700 "$(fact dbdir)"
expect "the database files' mode (the db, its wal and shm)" "600 " "$(fact dbfiles)"
expect "OOM kills since boot" 0 "$(fact oom)"
echo "box: $(fact arch); memory $(fact memory); swap $(fact swap); disk $(fact disk)"

step "/health names a commit of main"
health_main_read "$LOCAL_PORT"
if [ -n "$HEALTH_PROBLEM" ]; then
  red "$HEALTH_PROBLEM"
else
  ok "/health names $HEALTH_BUILD, a commit of main"
fi

step "the records' copy: the status on the box, and the bucket's newest copy"
copy_bucket=$(out CopyBucketName)
if [ -z "$copy_bucket" ]; then
  echo "skipped: $ENVNAME's stack holds no copy bucket yet"
else
  copy_state=$(copy_status) || die "c-storage's /api/status did not answer on the box"
  copy_listing=$(aws s3api list-objects-v2 --bucket "$copy_bucket" --prefix "$COPY_PATH/" \
    --query 'Contents[].{Key: Key, LastModified: LastModified}' --output json)
  copy_faults=$(copy_problems "$copy_state" "$copy_listing" "$(date +%s)")
  if [ -z "$copy_faults" ]; then
    ok "the copy holds the last write within ${COPY_LAG_S}s, a full copy under six days old, and the records disk is above its floor: $(jq -c . <<<"$copy_state")"
  else
    while IFS= read -r fault; do red "$fault"; done <<<"$copy_faults"
  fi
fi

step "Bruno's collection, through the tunnel"
if [ "$READS_ONLY" = 1 ]; then
  echo "skipped: reads only, so no key is read off the box and no collection runs"
else
  read_keys
  service_code="check-$(date -u +%Y%m%dT%H%M%SZ)"
  access_key=$(random_hex)
  mask "$access_key"
  # A fresh code and access key each run: the collection registers a service, and a second run under
  # the same code would answer 409. The file is 0600, git-ignored, and deleted at the end.
  bruno_env_write "$BRUNO_DIR/environments/$ENVNAME.yml" "$LOCAL_PORT" "$service_code" "$access_key"
  ran=0
  (cd "$BRUNO_DIR" && bru_clean run --env "$ENVNAME" --reporter-json "$WORK/report.json") || ran=$?
  expect "bru run exits" 0 "$ran"
  # bru exits 0 for a file it cannot parse and for a run that reaches no request: the shared proof
  # (the same e2e.sh asks) wants every request file passed, with a test, and none skipped.
  proof=0
  requests=$(node "$REPO_DIR/services/c-storage/scripts/bruno-proof.cjs" "$WORK/report.json" "$BRUNO_DIR" check) || proof=$?
  expect "every request ran, passed and asserted ($requests)" 0 "$proof"
  rm -f "$BRUNO_DIR/environments/$ENVNAME.yml"
fi

step "layer four's AWS reads: the BFF's group, its function, the UI's bucket"
if [ "$LAYER4" = 0 ]; then
  echo "skipped: $ENVNAME's stack holds no layer four yet"
else
  if [ "$READS_ONLY" = 0 ]; then
    [ -d "$REPO_DIR/scripts/node_modules" ] || [ -n "${RIDGE_SCRIPTS_DIR:-}" ] || die "needs pnpm install done, for the client the check makes"
  fi
  bff_sg=$(aws ec2 describe-security-groups --group-ids "$BFF_GROUP" --output json)
  expect "the BFF's group sends to c-storage's port on the box's group alone, and admits nothing" yes \
    "$(bff_rules_verdict "$(jq -c '.SecurityGroups[0].IpPermissionsEgress' <<<"$bff_sg")" "$(jq -c '.SecurityGroups[0].IpPermissions' <<<"$bff_sg")" "$group_id" "$BOX_PORT")"
  # The function's configuration holds its two access keys, so only the fields BFF_FN_QUERY names are
  # read: no key value reaches this shell, on any environment (open item 50).
  fn=$(aws lambda get-function-configuration --function-name "$BFF_NAME" --query "$BFF_FN_QUERY" --output json)
  expect "the function sits in ridge's subnet, under the BFF's group alone" yes "$(function_network_verdict "$fn" "$SUBNET_ID" "$BFF_GROUP")"
  expect "the function's variables (names only; never the super-admin key)" "$BFF_ENV_NAMES" "$(function_env_names "$fn")"
  expect "the function's APP_ORIGIN is the app's address, which its passkeys are bound to" yes "$(function_origin_verdict "$fn" "$APP_ADDRESS")"
  expect "the function reaches c-storage at the box's private address" yes \
    "$([ "$(function_url "$fn")" = "http://$BOX_LISTEN_ADDR:$BOX_PORT" ] && echo yes || echo no)"
  fn_commit=$(jq -r '.Description // empty' <<<"$fn")
  pab=$(aws s3api get-public-access-block --bucket "$UI_BUCKET" --output json)
  policy=$(aws s3api get-bucket-policy --bucket "$UI_BUCKET" --output json)
  expect "the UI's bucket blocks all public access, and its policy admits the distribution alone" yes "$(bucket_verdict "$pab" "$policy")"
  EDGE_BASE=$APP_ADDRESS
  edge GET /index.html
  index_commit=$(meta_commit "$EDGE_HEADERS")
  expect "/health, the function's description and index.html's metadata name one commit" yes "$(commits_agree "$HEALTH_BUILD" "$fn_commit" "$index_commit")"
fi

step "through the app's address, as a partner reaches it"
if [ "$LAYER4" = 0 ]; then
  echo "skipped: $ENVNAME's stack holds no layer four yet"
elif [ "$READS_ONLY" = 1 ]; then
  echo "skipped: reads only, so no client of the check's own is made or swept, and the reads that need one wait"
  edge_reads_open "$APP_ADDRESS"
else
  bff_env_read
  # First the stranded ones: every check client older than two hours (an earlier run's delete failed or
  # the run died) goes, inside this tunnel with the same keys. A failed sweep is a WARN and never turns
  # a green check red, as cleanup_extra's delete does.
  if swept=$(INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT \
    ridge_cli clear-checks 2>&1); then
    echo "ok   $swept"
  else
    echo "WARN the sweep of stranded check clients did not finish (delete them in the console): $swept"
  fi
  # A fresh client each run, made by the operator's own create function through the tunnel (the BFF's
  # own service and keys); cleanup_extra deletes it at the run's end, by the same function and keys.
  # (Each Bruno run still leaves a service row.)
  tenant=check-$(date -u +%Y%m%dt%H%M%Sz)
  CHECK_TENANT=$tenant
  tenant_name="Check $tenant"
  tenant_pass=$(INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT \
    ridge_cli tenant "$tenant" "$tenant_name") || die "the check's client could not be made"
  mask "$tenant_pass"
  edge_reads "$APP_ADDRESS" "$tenant" "$tenant_pass" "$tenant_name"
fi

verdict
