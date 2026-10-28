#!/usr/bin/env bash
# ops/check.sh <env>
# Reads <env> from AWS and from the box, then runs c-storage's Bruno collection through the tunnel.
# Green is every read below passing; the log ends on == green, or names each red.
# Runs after each release in the deploy job, and by hand.
# Needs c-storage/bruno/ (the collection), Bruno CLI 4.2.0 (`npm install -g --ignore-scripts @usebruno/cli@4.2.0`) and
# node, which reads its report, and /health's buildVersion (the plan's step 6).
# Run from a worktree whose ops/ is origin/main's.
# Expected length: about 2 minutes.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -eq 1 ] || {
  echo "usage: ops/check.sh <env>" >&2
  exit 2
}
ENVNAME=$1
STEPS=5
# Never the local stack's port (3181): a c-storage on this machine must not answer for the box.
LOCAL_PORT=${CHECK_LOCAL_PORT:-3191}
BRUNO_DIR=$REPO_DIR/c-storage/bruno
WANT_BRUNO=4.2.0

log_start check "$ENVNAME"
mkwork

cleanup_extra() {
  rm -f "$BRUNO_DIR/environments/$ENVNAME.yml"
}

step "the tools and the collection"
main_synced
command -v node >/dev/null || die "needs node on PATH, to read Bruno's report"
[ -d "$BRUNO_DIR" ] || die "no c-storage/bruno: the collection arrives with main (the plan's step 5)"
have=$(bru_clean --version 2>/dev/null) || have=none
[ "$have" = "$WANT_BRUNO" ] || die "needs Bruno CLI $WANT_BRUNO, found $have: npm install -g --ignore-scripts @usebruno/cli@$WANT_BRUNO"
# The keys go into this file, so git must ignore it.
require_ignored "c-storage/bruno/environments/$ENVNAME.yml"
refuse_taken_port "$LOCAL_PORT" "free it, or set CHECK_LOCAL_PORT"

step "the AWS reads"
stack_load "$ENVNAME"
[ -n "$STACK_JSON" ] || die "stack $ENVNAME does not exist"
box_id=$(out BoxId)
group_id=$(out BoxGroupId)
vpc_id=$(out VpcId)
public=$(aws ec2 describe-instances --instance-ids "$box_id" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
expect "the box's public address" None "$public"
igw=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$vpc_id" --query 'length(InternetGateways)' --output text)
expect "internet gateways on the VPC" 0 "$igw"
endpoint_groups=$(aws ec2 describe-instance-connect-endpoints --filters "Name=vpc-id,Values=$vpc_id" \
  --query 'InstanceConnectEndpoints[].SecurityGroupIds[]' --output json)
rules=$(aws ec2 describe-security-groups --group-ids "$group_id" --query 'SecurityGroups[0].IpPermissions' --output json)
# One rule: tcp 22, from a group of the endpoint, and from no address range, list or other group.
rule_ok=$(jq -r --argjson eg "$endpoint_groups" '
  if length == 1 and .[0].IpProtocol == "tcp" and .[0].FromPort == 22 and .[0].ToPort == 22
     and (.[0].IpRanges | length) == 0 and (.[0].Ipv6Ranges | length) == 0 and (.[0].PrefixListIds | length) == 0
     and (.[0].UserIdGroupPairs | length) == 1 and (.[0].UserIdGroupPairs[0].GroupId as $g | $eg | index($g) != null)
  then "yes" else "no" end' <<<"$rules")
expect "the box's group holds one rule, ssh from the endpoint's group" yes "$rule_ok"

step "the tunnel, and the box's reads"
box_open "$ENVNAME" "$LOCAL_PORT" || die "the box does not answer through the endpoint"
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
expect "c-storage listens on" "127.0.0.1:$BOX_PORT " "$(fact listen)"
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

step "Bruno's collection, through the tunnel"
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
requests=$(node "$REPO_DIR/c-storage/scripts/bruno-proof.cjs" "$WORK/report.json" "$BRUNO_DIR" check) || proof=$?
expect "every request ran, passed and asserted ($requests)" 0 "$proof"
rm -f "$BRUNO_DIR/environments/$ENVNAME.yml"

verdict
