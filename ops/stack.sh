#!/usr/bin/env bash
# ops/stack.sh network | github | env <name> [--plan] [--take <LogicalId>]...
# Makes or changes one stack through a change set built from the template in origin/main, so only a
# reviewed template reaches AWS. A change set that removes or replaces anything is deleted and
# named, unless the plan's step names that logical id with --take. --plan builds and reads the
# change set, deletes it, and changes nothing: for a first creation it also deletes the empty stack
# that CloudFormation keeps for the change set (REVIEW_IN_PROGRESS), so the next run is a creation too.
# Run by the human, from a worktree at main, in a terminal holding an AWS session. Never by CI.
# Expected length: about 5 minutes for network and env (the endpoint and the box take the time),
# about a minute for github.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

NETWORK_STACK=credo-network
GITHUB_STACK=credo-github
GITHUB_ISSUER=token.actions.githubusercontent.com

usage() {
  echo "usage: ops/stack.sh network | github | env <name> [--plan] [--take <LogicalId>]..." >&2
  exit 2
}

[ $# -ge 1 ] || usage
KIND=$1
shift
ENVNAME=''
case "$KIND" in
  network | github) ;;
  env)
    [ $# -ge 1 ] || usage
    ENVNAME=$1
    shift
    ;;
  *) usage ;;
esac
PLAN_ONLY=0
TAKE='[]'
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) PLAN_ONLY=1 ;;
    --take)
      [ $# -ge 2 ] || usage
      TAKE=$(jq -c --arg id "$2" '. + [$id]' <<<"$TAKE")
      shift
      ;;
    *) usage ;;
  esac
  shift
done

case "$KIND" in
  network)
    STACK=$NETWORK_STACK
    TEMPLATE=network.yml
    CAPS=''
    STEPS=6
    ;;
  github)
    STACK=$GITHUB_STACK
    TEMPLATE=github.yml
    CAPS=''
    STEPS=7
    ;;
  env)
    [[ "$ENVNAME" =~ ^[a-z][a-z0-9-]{1,20}$ ]] || die "'$ENVNAME' is not an environment name (a-z, 0-9, -)"
    STACK=$ENVNAME
    TEMPLATE=env.yml
    CAPS=CAPABILITY_IAM
    STEPS=8
    ;;
esac

log_start stack "${ENVNAME:-$KIND}"
mkwork
main_synced

CS=''
CS_OPEN=0
# cleanup_extra: a change set left behind is deleted, whatever ended the run; and a stack that
# holds nothing but that change set (REVIEW_IN_PROGRESS) is deleted with it. After an execute,
# CS_OPEN is 0 and the stack is left alone.
cleanup_extra() {
  local status
  if [ "$CS_OPEN" = 1 ]; then
    aws cloudformation delete-change-set --stack-name "$STACK" --change-set-name "$CS" >/dev/null 2>&1 || true
    status=$(aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text 2>/dev/null) || status=''
    if [ "$status" = REVIEW_IN_PROGRESS ]; then
      aws cloudformation delete-stack --stack-name "$STACK" >/dev/null 2>&1 || true
      aws cloudformation wait stack-delete-complete --stack-name "$STACK" >/dev/null 2>&1 || true
    fi
  fi
}

# stack_events: what failed, from the stack's events
stack_events() {
  aws cloudformation describe-stack-events --stack-name "$STACK" --output json |
    jq -r '.StackEvents[] | select(.ResourceStatus | test("FAILED")) | "  \(.LogicalResourceId): \(.ResourceStatusReason)"' | head -10
}

# free_cidr <vpc cidr> <vpc id> → the lowest unused 10.x.N.0/24 for N >= 1
free_cidr() {
  local prefix used n
  prefix=$(cut -d. -f1,2 <<<"$1")
  used=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$2" --query 'Subnets[].CidrBlock' --output text)
  for n in $(seq 1 255); do
    if ! grep -qw -- "$prefix.$n.0/24" <<<"$used"; then
      echo "$prefix.$n.0/24"
      return 0
    fi
  done
  die "the VPC holds no free /24"
}

step "the Region is enabled"
region_enabled

# --- github: the provider, only where the account lacks one ---
if [ "$KIND" = github ]; then
  step "the account's providers"
  stack_load "$STACK"
  choose_change_type
  if [ "$CS_TYPE" = CREATE ]; then
    arn=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[].Arn" --output text |
      tr '\t' '\n' | grep "/$GITHUB_ISSUER\$" || true)
    if [ -n "$arn" ]; then
      aud=$(aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$arn" --query ClientIDList --output text)
      case " $aud " in
        *" sts.amazonaws.com "*) ok "found already there: the provider for $GITHUB_ISSUER holds the audience sts.amazonaws.com; no stack made" ;;
        *) die "the account's provider for $GITHUB_ISSUER lacks the audience sts.amazonaws.com (it holds: $aud)" ;;
      esac
      exit 0
    fi
  fi
fi

# --- the change set ---
step "the parameters"
git -C "$REPO_DIR" show "origin/main:ops/$TEMPLATE" >"$WORK/template.yml" ||
  die "origin/main holds no ops/$TEMPLATE: the template must be merged first"
echo "template: ops/$TEMPLATE at origin/main $(git -C "$REPO_DIR" rev-parse --short origin/main)"

stack_load "$STACK"
choose_change_type
echo "stack $STACK: $CS_TYPE"
PARAMS='[]'
case "$KIND" in
  network)
    if [ "$CS_TYPE" = CREATE ]; then
      # The first zone, by name, that offers the box's type; an update keeps it.
      zone=$(aws ec2 describe-instance-type-offerings --location-type availability-zone \
        --filters Name=instance-type,Values=t4g.nano --query 'sort_by(InstanceTypeOfferings, &Location)[0].Location' --output text)
      [ -n "$zone" ] && [ "$zone" != None ] || die "no zone in $CREDO_REGION offers t4g.nano"
      echo "zone: $zone"
      add_param Zone "$zone"
    else
      add_param Zone
    fi
    ;;
  env)
    net=$(aws cloudformation describe-stacks --stack-name "$NETWORK_STACK" --output json 2>/dev/null) ||
      die "$NETWORK_STACK does not exist: ops/stack.sh network first"
    add_param Env "$ENVNAME"
    # c-storage's port, from the unit that sets it: the template has no default, so a run without it fails
    add_param BoxPort "$BOX_PORT"
    if [ "$CS_TYPE" = CREATE ]; then
      repo=$(repository)
      add_param Repository "$repo"
      prefix=$(github_subject_prefix "$repo")
      echo "subject prefix: $prefix"
      add_param SubjectPrefix "$prefix"
      vpc=$(jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "VpcId").OutputValue' <<<"$net")
      vpc_cidr=$(jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "VpcCidr").OutputValue' <<<"$net")
      cidr=$(free_cidr "$vpc_cidr" "$vpc")
      # AL2023's arm64 image, read once: an SSM-parameter type would replace the box at an update.
      image=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
        --query Parameter.Value --output text)
      echo "subnet: $cidr; image: $image"
      add_param SubnetCidr "$cidr"
      add_param ImageId "$image"
    else
      # The deploy role trusts this repository: a fork's clone must not move it.
      repo=$(repository)
      repository_matches_stack "$repo"
      add_param Repository
      # The trust's subject, too: GitHub may issue the immutable one (owner@id/name@id), and a fork's
      # clone has other ids. A stack made before the parameter existed takes GitHub's prefix once.
      prefix=$(github_subject_prefix "$repo")
      echo "subject prefix: $prefix"
      add_subject_param "$prefix"
      add_param SubnetCidr
      add_param ImageId
    fi
    ;;
esac
echo "$PARAMS" | jq -r '.[] | "  \(.ParameterKey)=\(.ParameterValue // "(previous)")"'

step "the change set"
CS="ops-$(date -u +%Y%m%d-%H%M%S)"
caps=()
if [ -n "$CAPS" ]; then caps=(--capabilities "$CAPS"); fi
CS_OPEN=1
aws cloudformation create-change-set --stack-name "$STACK" --change-set-name "$CS" --change-set-type "$CS_TYPE" \
  --template-body "file://$WORK/template.yml" --parameters "$PARAMS" ${caps[@]+"${caps[@]}"} \
  >/dev/null
no_changes=0
if ! aws cloudformation wait change-set-create-complete --stack-name "$STACK" --change-set-name "$CS" 2>/dev/null; then
  reason=$(aws cloudformation describe-change-set --stack-name "$STACK" --change-set-name "$CS" --query StatusReason --output text)
  case "$reason" in
    *"didn't contain changes"* | *"No updates"*) no_changes=1 ;;
    *) die "the change set failed: $reason" ;;
  esac
fi
if [ "$no_changes" = 1 ]; then
  echo "no changes: the stack is as the template says"
else
  aws cloudformation describe-change-set --stack-name "$STACK" --change-set-name "$CS" --output json >"$WORK/changes.json"
  jq -r '.Changes[]?.ResourceChange | "  \(.Action) \(.LogicalResourceId) (\(.ResourceType)) replacement=\(.Replacement // "none")"' "$WORK/changes.json"

  step "the guard: nothing removed or replaced"
  unsafe=$(jq -r --argjson take "$TAKE" -f "$OPS_DIR/unsafe-changes.jq" "$WORK/changes.json")
  if [ -n "$unsafe" ]; then
    echo "REFUSED: this change set removes or replaces:"
    while IFS= read -r line; do echo "  $line"; done <<<"$unsafe"
    echo "The change set is deleted and nothing changed. A change meant on purpose is named in its"
    echo "plan step, and taken with --take <LogicalId>."
    exit 1
  fi
  ok "no removal and no replacement"

  if [ "$PLAN_ONLY" = 1 ]; then
    echo "--plan: the change set is deleted, nothing changed"
    exit 0
  fi

  step "execute, and wait"
  aws cloudformation execute-change-set --stack-name "$STACK" --change-set-name "$CS"
  CS_OPEN=0
  if aws cloudformation wait "stack-$(tr '[:upper:]' '[:lower:]' <<<"$CS_TYPE")-complete" --stack-name "$STACK"; then
    ok "stack $STACK: $CS_TYPE complete"
  else
    stack_events
    die "stack $STACK did not complete"
  fi
fi

# --- read back ---
step "the outputs"
stack_load "$STACK"
# The deploy role's ARN holds the account's id, the API's own address answers anyone and is
# reached through CloudFront, and the box's private address is no log's: all three are searched for
# in this log, never printed. The app's address is printed here, in the human's local log, and in
# no committed file or public log.
mask "$(out DeployRoleArn)"
mask "$(out ApiAddress)"
mask "$(out BoxAddress)" "the box's private address"
outputs_print

if [ "$KIND" = network ]; then
  vpc=$(out VpcId)
  igw=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$vpc" --query 'length(InternetGateways)' --output text)
  expect "internet gateways on the VPC" 0 "$igw"
  [ "$igw" = 0 ] || exit 1
  echo "zone: $(out Zone)"
fi

if [ "$KIND" = env ]; then
  step "the box over the tunnel"
  # The instance may still be starting its first boot; the key and the tunnel are tried again.
  opened=0
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if box_open "$ENVNAME"; then
      opened=1
      break
    fi
    echo "the box does not answer yet; trying again in 15 s"
    sleep 15
  done
  [ "$opened" = 1 ] || die "the box never answered through the endpoint"
  box bash -s <<'REMOTE'
echo "arch: $(uname -m)"
echo "swap: $(swapon --noheadings --show=NAME,SIZE | tr '\n' ' ')"
echo "ssm agent: $(systemctl is-active amazon-ssm-agent || true)"
echo "memory: $(free -m | awk '/^Mem:/{print $7" MiB available of "$2}')"
REMOTE
  step "GitHub's environment $ENVNAME and its secret"
  repo=$(stack_param Repository)
  [ -n "$repo" ] || die "stack $STACK holds no Repository parameter"
  gh api -X PUT "repos/$repo/environments/$ENVNAME" --input - >/dev/null <<'JSON'
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
  if ! gh api "repos/$repo/environments/$ENVNAME/deployment-branch-policies" --jq '.branch_policies[].name' | grep -qx main; then
    gh api -X POST "repos/$repo/environments/$ENVNAME/deployment-branch-policies" -f name=main -f type=branch >/dev/null
  fi
  # The role's ARN holds the account's id: it goes in on stdin, never on a command line or in a log.
  out DeployRoleArn | tr -d '\n' | gh secret set AWS_ROLE_ARN --env "$ENVNAME" --repo "$repo"
  policies=$(gh api "repos/$repo/environments/$ENVNAME/deployment-branch-policies" --jq '[.branch_policies[].name] | join(",")')
  expect "environment $ENVNAME admits branches" main "$policies"
  secrets=$(gh secret list --env "$ENVNAME" --repo "$repo" --json name --jq '[.[].name] | join(",")')
  expect "environment $ENVNAME holds secrets" AWS_ROLE_ARN "$secrets"
fi

verdict
