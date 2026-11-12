#!/usr/bin/env bash
# ops/destroy.sh ridge
# Destroys ridge, the AWS environment, in dependency order, after printing everything it owns and
# everything the templates cannot re-create, and after you type the environment's name. Then it
# switches off the GitHub workflows that reach ridge (never deleted). Ridge alone: any other name is
# refused before any call. The way back is ops/remake.sh ridge, then ops/operator.sh ridge.
#
# IT CANNOT BE UNDONE. The records of ridge are one SQLite file on the box's root disk. The box and
# that disk are deleted here, and nothing in ops/ keeps a copy. The only way to keep the disk is to
# run with RIDGE_KEEP_DISK_SNAPSHOT=1 in front of the command, which takes one EBS snapshot of it
# first (a few cents a month, kept until you delete it). Without it the disk is gone for good.
#
# WHAT IT REMOVES: the box and its disk, the UI bucket and its files, the function, the API, the
#   distribution, both roles, the security groups, ridge's subnet and both log groups.
# WHAT IT KEEPS: the network stack and GitHub's provider stack (shared by every environment),
#   GitHub's environment ridge and its secret, and every workflow file.
# WHAT IT DOES, in this order (the order is not a preference):
#   1. Refuses before acting: any environment but ridge, a stranger's code, no terminal, no AWS
#      session, no gh login.
#   2. Enumerates what ridge owns by asking the live account (stacks, the stack's resources, the
#      box, its disk, the bucket and its contents, the log groups, the network interfaces in
#      ridge's subnet), not by trusting the templates. Prints it. Stops, and says what it found, at
#      anything it cannot attribute to ridge, and at a workflow run still in progress or queued.
#   3. Prints "RE-UP": the commands that bring ridge back, and what nothing re-creates.
#   4. Asks you to type the environment's name. Anything else stops the run, with nothing changed.
#   5. Switches off the workflows that name `environment: ridge` (ci.yml and seed.yml today, read
#      from the files), reads each back, and looks again for a run in progress. Others stay on.
#   6. Destroys, each step followed by a read-back that it is gone: the box (CloudFormation keeps
#      it on a stack delete), its disk, the UI bucket's files, the stack (everything else in it),
#      the two log groups if they are still there, then a final read of every name.
# LOOK FOR: "== RE-UP" (the way back, in the log too), "== verdict", and the closing paragraph.
# Length: about 4 minutes (the 11-08 rerun took 3 minutes 39; its first run took 6), nearly all in
#   the stack delete. Safe to run again after a stop: it enumerates again and skips what is gone.
# Run by the human, from a worktree at main, in a terminal holding an AWS session and a gh login.
# shellcheck disable=SC2016 # the backticks are JMESPath literals for aws --query, not shell
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -eq 1 ] || {
  echo "usage: ops/destroy.sh ridge" >&2
  exit 2
}
ENVNAME=$1

log_start destroy "$ENVNAME"
refuse_real "$ENVNAME" "destroy.sh destroys ridge alone: any other environment may hold a real company's records"
main_synced

STACK=$ENVNAME
NETWORK_STACK=credo-network
GITHUB_STACK=credo-github
LOG_GROUP_BFF=/aws/lambda/credo-$ENVNAME-bff
LOG_GROUP_API=/aws/apigateway/credo-$ENVNAME
KEEP_SNAPSHOT=${RIDGE_KEEP_DISK_SNAPSHOT:-0}

# Everything printed passes this: a run of twelve digits (an account id) is hidden, since AWS's
# listings and errors quote ARNs. The account id itself is also masked and searched for at the end.
scrub() { sed -E 's/[0-9]{12}/<12 digits>/g'; }
say() { printf '%s\n' "$*" | scrub; }
fail() {
  say "== STOPPED: $1"
  exit 1
}

# ---- 1. refusals, before acting
case "$KEEP_SNAPSHOT" in 0 | 1) ;; *) die "RIDGE_KEEP_DISK_SNAPSHOT must be 0 or 1" ;; esac
for tool in aws gh jq git sed; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed"
done
# OPS_TEST_NO_TTY is ops/test.sh's alone, on a machine that cannot open a pseudo-terminal: the name is
# then read from the input. ridge is the only environment this script acts on, so nothing else sees it.
[ -t 0 ] || [ "${OPS_TEST_NO_TTY:-}" = 1 ] || die "no terminal on the input: the confirmation has to be typed by you"
WF_FILES=$(workflows_of "$ENVNAME")
[ -n "$WF_FILES" ] || die "no workflow file in $REPO_DIR/.github/workflows names environment: $ENVNAME"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) ||
  die "no working AWS session in this terminal (sign in first); the identity is not printed"
mask "$ACCOUNT" "the AWS account id"
gh auth status >/dev/null 2>&1 || die "gh is not logged in"
REPO=$(repository)
[ -n "$REPO" ] || die "the origin remote names no repository"
say "== repository: $REPO; AWS region: $CREDO_REGION; stack to destroy: $STACK"
say "-- the workflows that reach $ENVNAME, and so go off after the typed name: $(printf '%s' "$WF_FILES" | tr '\n' ' ')"

wf_table() { # prints the repository's workflow list as GitHub holds it
  gh workflow list --all --repo "$REPO" --limit 100 --json name,path,state |
    jq -r '.[] | "   \(.state)\t\(.path)\t(\(.name))"' | scrub
}
wf_state() { # <path> -> state, or nothing
  gh workflow list --all --repo "$REPO" --limit 100 --json path,state |
    jq -r --arg p "$1" '.[] | select(.path == $p) | .state'
}
runs_running() { # a line for each run in progress or queued
  local s
  for s in in_progress queued; do
    gh run list --repo "$REPO" --status "$s" --limit 50 --json databaseId,workflowName,status,url
  done | jq -rs 'add | .[] | "   \(.status)  \(.workflowName)  \(.url)"'
}
no_runs() { # stops, nothing destroyed, when a run is in progress or queued
  local running
  running=$(runs_running)
  if [ -n "$running" ]; then
    say "$running"
    fail "a workflow run is still in progress or queued (listed above). Disabling does not cancel it. Cancel it on GitHub, then run this script again. Nothing was destroyed."
  fi
  say "   no run in progress or queued"
}

# ---- 2. the enumeration, read-only
say "== 2. what ridge owns, read from the live account (nothing is changed in this part)"
STACKS_JSON=$(aws cloudformation list-stacks --output json | jq '[.StackSummaries[] | select(.StackStatus != "DELETE_COMPLETE")]')
say "-- every stack in the account (name, status):"
jq -r '.[] | "   \(.StackName)  \(.StackStatus)"' <<<"$STACKS_JSON" | scrub
ODD=$(jq -r --arg s "$STACK" '.[] | select((.StackName | test("ridge")) and .StackName != $s) | .StackName' <<<"$STACKS_JSON")
[ -z "$ODD" ] || fail "another stack has ridge in its name and this script cannot tell if it is ridge's: $ODD. Nothing was destroyed. Tell the session which it is."
HAVE_NETWORK=$(jq -r --arg s "$NETWORK_STACK" '[.[] | select(.StackName == $s)] | length' <<<"$STACKS_JSON")
HAVE_GITHUB=$(jq -r --arg s "$GITHUB_STACK" '[.[] | select(.StackName == $s)] | length' <<<"$STACKS_JSON")
say "-- stays: $NETWORK_STACK present=$HAVE_NETWORK, $GITHUB_STACK present=$HAVE_GITHUB (shared by every environment; this script never touches them)"

HAVE_STACK=$(jq -r --arg s "$STACK" '[.[] | select(.StackName == $s)] | length' <<<"$STACKS_JSON")
BOX=''
VOL=''
BUCKET=''
NOBJ=''
SUBNET=''
STACK_RES=''
LIVE_BOXES=$(aws ec2 describe-instances --filters "Name=tag:Env,Values=$ENVNAME" \
  --query 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId' --output text | tr '\t' '\n' | grep . || true)

if [ "$HAVE_STACK" = 0 ]; then
  say "   there is no stack named $STACK"
  [ -z "$LIVE_BOXES" ] || fail "no stack $STACK, but instances tagged Env=$ENVNAME exist: $LIVE_BOXES. They cannot be attributed to a stack; nothing was destroyed. Tell the session."
  say "   no instance tagged Env=$ENVNAME either: ridge's AWS side is already gone. Skipping to the way back and the close."
else
  DESC=$(aws cloudformation describe-stacks --stack-name "$STACK" --output json)
  ST=$(jq -r '.Stacks[0].StackStatus' <<<"$DESC")
  case "$ST" in
    CREATE_COMPLETE | UPDATE_COMPLETE | UPDATE_ROLLBACK_COMPLETE | DELETE_FAILED | ROLLBACK_COMPLETE) ;;
    *) fail "stack $STACK is in status $ST, which this script does not delete from. Wait for it to settle or tell the session." ;;
  esac
  [ "$(jq -r '.Stacks[0].EnableTerminationProtection' <<<"$DESC")" = false ] ||
    fail "stack $STACK has termination protection on. This script never lifts it; lift it yourself if you mean it, then run again."
  PENV=$(jq -r '.Stacks[0].Parameters[]? | select(.ParameterKey == "Env") | .ParameterValue' <<<"$DESC")
  [ "$PENV" = "$ENVNAME" ] || fail "stack $STACK has parameter Env='$PENV', not '$ENVNAME': not clearly ridge's."
  PNET=$(jq -r '.Stacks[0].Parameters[]? | select(.ParameterKey == "Network") | .ParameterValue' <<<"$DESC")
  [ "$PNET" = "$NETWORK_STACK" ] || fail "stack $STACK reads network '$PNET', not '$NETWORK_STACK': unexpected."
  say "-- stack $STACK: status $ST, Env=$PENV, network=$PNET, repository=$(jq -r '.Stacks[0].Parameters[]? | select(.ParameterKey == "Repository") | .ParameterValue' <<<"$DESC")"
  EXPORTED=$(jq -r '[.Stacks[0].Outputs[]? | select(.ExportName != null)] | length' <<<"$DESC")
  [ "$EXPORTED" = 0 ] || fail "stack $STACK exports values ($EXPORTED); another stack may import them. Not what the template says. Tell the session."

  STACK_RES=$(aws cloudformation list-stack-resources --stack-name "$STACK" --output json)
  say "-- the stack's resources (type, logical name, physical name, status):"
  jq -r '.StackResourceSummaries[] | "   \(.ResourceType)  \(.LogicalResourceId)  \(.PhysicalResourceId // "-")  \(.ResourceStatus)"' <<<"$STACK_RES" | scrub
  # The types env.yml declares, and no others. Anything else is not clearly ridge's. The list is read
  # from origin/main's template by CloudFormation itself, the file stack.sh reads, so a lane that adds
  # a type is allowed with no second list.
  git -C "$REPO_DIR" show "origin/main:ops/env.yml" >"$WORK/env.yml" || fail "origin/main holds no ops/env.yml, so the allowed types are not known. Nothing was destroyed."
  ALLOWED=$(aws cloudformation get-template-summary --template-body "file://$WORK/env.yml" --query ResourceTypes --output json) ||
    fail "CloudFormation could not read origin/main's ops/env.yml for its resource types. Nothing was destroyed."
  jq -e 'type == "array" and length > 0' <<<"$ALLOWED" >/dev/null || fail "origin/main's ops/env.yml gave no resource types. Nothing was destroyed."
  STRANGE=$(jq -r --argjson ok "$ALLOWED" '.StackResourceSummaries[] | select(.ResourceType as $t | ($ok | index($t)) == null) | "\(.ResourceType) \(.LogicalResourceId)"' <<<"$STACK_RES")
  [ -z "$STRANGE" ] || fail "the stack holds resources of a type env.yml does not declare: $STRANGE. Not clearly ridge's. Nothing was destroyed."
  phys() { jq -r --arg id "$1" '.StackResourceSummaries[] | select(.LogicalResourceId == $id) | .PhysicalResourceId // empty' <<<"$STACK_RES"; }

  # the log groups: exactly these two names, or stop
  for lg in BffLogs ApiLogs; do
    n=$(phys "$lg")
    case "$n" in
      "$LOG_GROUP_BFF" | "$LOG_GROUP_API") ;;
      *) fail "the stack's $lg is '$n', not one of the two expected names ($LOG_GROUP_BFF, $LOG_GROUP_API)." ;;
    esac
  done

  # the box
  BOX=$(phys Box)
  SUBNET=$(phys Subnet)
  if [ -n "$BOX" ]; then
    # A retained box stays in the stack's resource list after a failed delete; once AWS has reaped the
    # terminated instance, the id is not found. That means already gone, not a failure.
    if BOXOUT=$(aws ec2 describe-instances --instance-ids "$BOX" --output json 2>&1); then
      BOXJ=$(jq '.Reservations[0].Instances[0]' <<<"$BOXOUT")
    else
      case "$BOXOUT" in
        *NotFound*) BOXJ='{"State":{"Name":"terminated"}}' ;;
        *) fail "could not read box $BOX: $BOXOUT" ;;
      esac
    fi
    BSTATE=$(jq -r '.State.Name' <<<"$BOXJ")
    BENV=$(jq -r '[.Tags[]? | select(.Key == "Env") | .Value] | first // ""' <<<"$BOXJ")
    BNAME=$(jq -r '[.Tags[]? | select(.Key == "Name") | .Value] | first // ""' <<<"$BOXJ")
    BSUB=$(jq -r '.SubnetId // ""' <<<"$BOXJ")
    if [ "$BSTATE" != terminated ]; then
      [ "$BENV" = "$ENVNAME" ] && [ "$BNAME" = "credo-$ENVNAME" ] || fail "box $BOX is tagged Env='$BENV' Name='$BNAME', not ridge's (Env=$ENVNAME, Name=credo-$ENVNAME). Nothing was destroyed."
      [ "$BSUB" = "$SUBNET" ] || fail "box $BOX sits in subnet '$BSUB', not the stack's subnet '$SUBNET'."
      VOL=$(jq -r '.BlockDeviceMappings[]? | select(.DeviceName == "/dev/xvda") | .Ebs.VolumeId' <<<"$BOXJ")
      VDOT=$(jq -r '.BlockDeviceMappings[]? | select(.DeviceName == "/dev/xvda") | .Ebs.DeleteOnTermination' <<<"$BOXJ")
      NVOLS=$(jq -r '[.BlockDeviceMappings[]?] | length' <<<"$BOXJ")
      [ "$NVOLS" = 1 ] && [ -n "$VOL" ] || fail "box $BOX has $NVOLS attached disks (wanted exactly one, the root disk). Not what the template says."
      say "-- the box: $BOX, state $BSTATE, type $(jq -r '.InstanceType' <<<"$BOXJ"), tags Env=$BENV Name=$BNAME"
      say "-- its root disk: $VOL (delete-on-termination: $VDOT)"
      NSNAP=$(aws ec2 describe-snapshots --owner-ids self --filters "Name=volume-id,Values=$VOL" --query 'length(Snapshots)' --output text)
      say "-- snapshots of that disk that exist now: $NSNAP"
    else
      say "-- the box $BOX is already terminated"
      BOX=''
    fi
  fi
  # any other ridge-tagged instance is not the stack's
  for i in $LIVE_BOXES; do
    [ "$i" = "$BOX" ] || fail "instance $i is tagged Env=$ENVNAME but is not the stack's box. Not attributable; nothing was destroyed."
  done

  # network interfaces in ridge's subnet: the box's and the function's, nothing else
  if [ -n "$SUBNET" ]; then
    ENIS=$(aws ec2 describe-network-interfaces --filters "Name=subnet-id,Values=$SUBNET" \
      --query 'NetworkInterfaces[].{id:NetworkInterfaceId,d:Description,i:Attachment.InstanceId}' --output json)
    say "-- network interfaces in ridge's subnet $SUBNET:"
    jq -r '.[] | "   \(.id)  \(.d // "-")  instance=\(.i // "-")"' <<<"$ENIS" | scrub
    OWNED=$(jq -r --arg b "${BOX:-none}" '.[] | select((.i // "-") != $b and ((.d // "") | startswith("AWS Lambda VPC ENI") | not)) | .id' <<<"$ENIS")
    [ -z "$OWNED" ] || fail "interfaces in ridge's subnet that are neither the box's nor the function's: $OWNED. Something else lives there. Nothing was destroyed."
  fi

  # the bucket
  BUCKET=$(phys UiBucket)
  if [ -n "$BUCKET" ]; then
    case "$BUCKET" in
      ridge-uibucket-*) ;;
      *) fail "the UI bucket is named '$BUCKET', not ridge-uibucket-<random> (CloudFormation's name for stack ridge). Not clearly ridge's." ;;
    esac
    if aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
      BTAG=$(aws s3api get-bucket-tagging --bucket "$BUCKET" --output json 2>/dev/null | jq -r '[.TagSet[]? | select(.Key == "Env") | .Value] | first // ""' || true)
      [ "$BTAG" = "$ENVNAME" ] || fail "bucket $BUCKET is tagged Env='$BTAG', not $ENVNAME."
      VERS=$(aws s3api get-bucket-versioning --bucket "$BUCKET" --query Status --output text 2>/dev/null || true)
      case "$VERS" in "" | None) ;; *) fail "bucket $BUCKET has versioning '$VERS'; the template has none. Emptying it would leave old versions behind. Tell the session." ;; esac
      NOBJ=$(aws s3api list-objects-v2 --bucket "$BUCKET" --query 'length(Contents || `[]`)' --output text 2>"$WORK/count.err") ||
        fail "could not count the files in bucket $BUCKET; AWS said: $(cat "$WORK/count.err"). Nothing was destroyed."
      case "$NOBJ" in None | "") NOBJ=0 ;; esac
      say "-- the UI bucket: $BUCKET, tagged Env=$BTAG, versioning off, $NOBJ file(s) now (a stack delete does NOT empty a bucket; this script does, below)"
    else
      say "-- the UI bucket $BUCKET is already gone"
      BUCKET=''
    fi
  fi

  # the log groups as they are now (past lines are kept 14 days and are lost with the group)
  say "-- log groups:"
  for lgn in "$LOG_GROUP_BFF" "$LOG_GROUP_API"; do
    found=$(aws logs describe-log-groups --log-group-name-prefix "$lgn" --query "logGroups[?logGroupName=='$lgn'] | length(@)" --output text)
    say "   $lgn  exists=$([ "$found" = 0 ] && echo no || echo yes)"
  done
  EXTRA=$(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/credo-$ENVNAME" --query 'logGroups[].logGroupName' --output text | tr '\t' '\n'
    aws logs describe-log-groups --log-group-name-prefix "/aws/apigateway/credo-$ENVNAME" --query 'logGroups[].logGroupName' --output text | tr '\t' '\n')
  EXTRA=$(printf '%s\n' "$EXTRA" | grep . | grep -vxF -e "$LOG_GROUP_BFF" -e "$LOG_GROUP_API" || true)
  [ -z "$EXTRA" ] || fail "log groups that start like ridge's but are not the two expected: $EXTRA. Not attributable. Nothing was destroyed."
  say "-- will be removed with the stack (names above): the function, its role and the deploy role, the HTTP API, the CloudFront distribution and its function and access control, the security groups, the subnet."
fi

# GitHub, read only: the workflows as they stand, and no run in the way
say "-- GitHub's workflows now (gh workflow list --all):"
wf_table
no_runs

# ---- 3. the way back, printed before the confirmation and kept in the log
say ""
say "== RE-UP: what it takes to bring ridge back (this heading is in the log for the session that does it)"
say "-- the commands, in order. Run from the worktree at main, whose ops/ must match origin/main. Each is alone below."
say "   1. make ridge again and turn the workflows back on:"
say "        cd $REPO_DIR && bash $OPS_DIR/remake.sh $ENVNAME"
say "      That runs ops/stack.sh env $ENVNAME, ops/release.sh, ops/app.sh and ops/check.sh, then turns on: $(printf '%s' "$WF_FILES" | tr '\n' ' ')"
say "      If the stack step ends with \"the box never answered through the endpoint\", the secret AWS_ROLE_ARN of environment $ENVNAME still holds the deleted role's address: run remake.sh again (the stack is then an update, and it reaches the secret step)."
say "   2. make the operator again, and open its link at the new address to make your passkey:"
say "        cd $REPO_DIR && bash $OPS_DIR/operator.sh $ENVNAME"
say "-- what nothing re-creates (read this before you type the confirmation):"
say "   a. THE RECORDS. All of ridge's data is one SQLite file on the box's root disk. ops/ holds no backup and no copy job. After this run the file is gone, unless you set RIDGE_KEEP_DISK_SNAPSHOT=1 (then the snapshot holds the file, but no script in ops/ restores a snapshot into a new box). Snapshots of the disk existing right now: ${NSNAP:-unknown, not read}."
say "   b. THE COPIES AND THE OPERATOR. The demo copies are made by hand at /operator, and the operator by ops/operator.sh. After the remake ridge holds no operator and no demo copy; ops/seed.sh only fills copies that already exist. Passkeys are bound to the address, so old ones stop working at the new one: ops/operator.sh makes the operator's one-time join link on the new ridge, and ops/root-password.sh gives each demo copy's root a new password."
say "   c. THE ADDRESS. The app's address is a CloudFront domain CloudFront chooses, so a re-created ridge has a NEW address unless a custom domain is set; a DNS record that points at the old distribution is repointed by hand. Anything that holds the old address (links given to people, Bruno environment files, bookmarks, docs) must be updated."
say "   d. THE KEYS ON THE BOX. ops/app.sh reads the BFF's keys from the box and copies them to the function; they live on the box's disk and are gone with it. A new box makes new ones."
say "   e. THE LOG LINES. The two log groups keep 14 days of lines. They are deleted here; the lines cannot be re-created."
say "   f. UNKNOWN: whether anything else in the account depends on ridge or was created by hand outside the stack. This script reads ridge-tagged instances, the network interfaces in ridge's subnet, log groups starting with credo-$ENVNAME and the stack list; it cannot see anything else."
say "-- GitHub's environment $ENVNAME and its secret are left as they are; no workflow file is deleted."
say "== END RE-UP"
say ""

if [ "$HAVE_STACK" = 0 ]; then
  say "== nothing to destroy on AWS (no stack, no box). Nothing was read back as gone, because nothing was deleted. No name was asked for and no workflow was changed."
  say "-- looking for an orphaned disk: unattached (available) volumes in this region. A retained box's root disk has no tags, so these are CANDIDATES, not proven ridge's. ridge's was 8 GB gp3, encrypted."
  ORPHANS=$(aws ec2 describe-volumes --filters Name=status,Values=available --output json |
    jq -r '.Volumes[] | "   \(.VolumeId)  \(.Size) GB  \(.VolumeType)  encrypted=\(.Encrypted)  made \(.CreateTime)  tags=\([.Tags[]? | "\(.Key)=\(.Value)"] | join(","))"')
  if [ -n "$ORPHANS" ]; then printf '%s\n' "$ORPHANS" | scrub; else say "   none found"; fi
  say "   This script deletes none of them: the records live on such a disk. If one is ridge's and you do not want it, delete it yourself."
else
  # ---- 4. the typed confirmation, before anything is changed
  say "== 4. confirmation"
  say "   This will, with no way back (except the disk snapshot if you set it, snapshot requested: $KEEP_SNAPSHOT):"
  [ -z "$BOX" ] || say "     terminate box $BOX and delete its disk $VOL"
  [ -z "$BUCKET" ] || say "     delete every file in bucket $BUCKET"
  say "     delete stack $STACK and every resource listed above, and the two log groups"
  say "     switch off the workflows that reach $ENVNAME: $(printf '%s' "$WF_FILES" | tr '\n' ' ')"
  say "   Type the environment's name ($ENVNAME) and press Enter to go on. Anything else stops here, with nothing changed."
  printf '   > ' >&3
  ANSWER=''
  if [ "${OPS_TEST_NO_TTY:-}" = 1 ]; then
    read -r ANSWER || ANSWER=''
  else
    read -r ANSWER </dev/tty || ANSWER=''
  fi
  say "   typed: $ANSWER"
  [ "$ANSWER" = "$ENVNAME" ] || fail "the typed name was not '$ENVNAME'. Nothing was changed: the workflows are still on and nothing was destroyed."

  # ---- 5. the workflows that reach ridge, off
  say "== 5. GitHub workflows that name environment: $ENVNAME, switched off (never deleted)"
  for base in $WF_FILES; do
    p=.github/workflows/$base
    st=$(wf_state "$p")
    [ -n "$st" ] || fail "GitHub does not list $p (is the file on the default branch?). Nothing was disabled for it; nothing was destroyed."
    if [ "$st" = active ]; then
      say "   disabling $base (was: $st)"
      gh workflow disable "$base" --repo "$REPO" 2>&1 | scrub
    else
      say "   $base is already off (state: $st)"
    fi
  done
  say "-- after (gh workflow list --all):"
  wf_table
  for base in $WF_FILES; do
    st=$(wf_state ".github/workflows/$base")
    [ -n "$st" ] && [ "$st" != active ] || fail "$base is still '$st' after the disable. Nothing was destroyed."
    say "   read back: $base is off (state: $st)"
  done
  OTHER_ACTIVE=$( (gh workflow list --all --repo "$REPO" --limit 100 --json path,state |
    jq -r '.[] | select(.state == "active") | .path') || true)
  if [ -n "$OTHER_ACTIVE" ]; then
    say "   stay on, because they do not reach $ENVNAME:"
    printf '%s\n' "$OTHER_ACTIVE" | sed 's/^/     /' | scrub
  fi
  no_runs

  # ---- 6. destroy, in dependency order
  say "== 6. destroying (started $(date '+%H:%M:%S'))"
  gone() { # <label> <command...>: succeeds only when the command fails with a not-found message
    local label=$1 out
    shift
    if out=$("$@" 2>&1); then fail "$label is still there after the delete."; fi
    case "$out" in
      *NotFound* | *NoSuch* | *"does not exist"* | *"not found"* | *"Not Found"* | *404*) say "   read back: $label is gone" ;;
      *) fail "could not tell whether $label is gone; the command said: $out" ;;
    esac
  }

  # 6a. the stack's status right before acting: it must not have moved since the list
  ST2=$(aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text)
  [ "$ST2" = "$ST" ] || fail "stack $STACK changed status from $ST to $ST2 while you were reading. Nothing was destroyed; run again."

  # 6b. the disk snapshot, only on request
  if [ "$KEEP_SNAPSHOT" = 1 ] && [ -n "$VOL" ]; then
    say "-- 6b. snapshot of disk $VOL (requested)"
    SNAP=$(aws ec2 create-snapshot --volume-id "$VOL" --description "ridge disk before teardown" \
      --tag-specifications "ResourceType=snapshot,Tags=[{Key=Env,Value=$ENVNAME},{Key=Note,Value=before-teardown}]" --query SnapshotId --output text)
    say "   snapshot $SNAP started; waiting for it to complete"
    aws ec2 wait snapshot-completed --snapshot-ids "$SNAP"
    SS=$(aws ec2 describe-snapshots --snapshot-ids "$SNAP" --query 'Snapshots[0].State' --output text)
    [ "$SS" = completed ] || fail "snapshot $SNAP is '$SS', not completed. The box was not touched."
    say "   read back: snapshot $SNAP is completed (it stays in the account until you delete it)"
  fi

  # 6c. the box: a stack delete retains it (and its subnet and groups then cannot go), so it is terminated first
  if [ -n "$BOX" ]; then
    say "-- 6c. terminate box $BOX"
    CUR=$(aws ec2 describe-instances --instance-ids "$BOX" --query 'Reservations[0].Instances[0].[Tags[?Key==`Env`]|[0].Value,SubnetId]' --output text)
    [ "$CUR" = "$ENVNAME"$'\t'"$SUBNET" ] || fail "box $BOX is not what was listed (tag/subnet now: $CUR). Not terminated."
    aws ec2 terminate-instances --instance-ids "$BOX" >/dev/null
    aws ec2 wait instance-terminated --instance-ids "$BOX"
    BS=$(aws ec2 describe-instances --instance-ids "$BOX" --query 'Reservations[0].Instances[0].State.Name' --output text)
    [ "$BS" = terminated ] || fail "box $BOX is '$BS' after the wait, not terminated."
    say "   read back: box $BOX is terminated"
  fi

  # 6d. the disk: it outlives the box when delete-on-termination is false
  if [ -n "$VOL" ]; then
    say "-- 6d. delete disk $VOL"
    if VOUT=$(aws ec2 describe-volumes --volume-ids "$VOL" --output json 2>&1); then
      VST=$(jq -r '.Volumes[0].State' <<<"$VOUT")
      VATT=$(jq -r '.Volumes[0].Attachments | length' <<<"$VOUT")
      [ "$VATT" = 0 ] || fail "disk $VOL is still attached to something ($VATT attachment); not deleted."
      say "   disk $VOL is '$VST' with no attachment; waiting until it is available"
      aws ec2 wait volume-available --volume-ids "$VOL"
      aws ec2 delete-volume --volume-id "$VOL"
      gone "disk $VOL" aws ec2 describe-volumes --volume-ids "$VOL"
    else
      case "$VOUT" in
        *NotFound*) say "   read back: disk $VOL is already gone (it went with the box)" ;;
        *) fail "could not read disk $VOL: $VOUT" ;;
      esac
    fi
  fi

  # 6e. the bucket's files: a stack delete fails on a bucket that holds files
  if [ -n "$BUCKET" ]; then
    case "$BUCKET" in ridge-uibucket-*) ;; *) fail "bucket name '$BUCKET' lost its ridge prefix; not emptied." ;; esac
    say "-- 6e. empty bucket $BUCKET (the bucket itself goes with the stack)"
    RMOUT=$(aws s3 rm "s3://$BUCKET" --recursive 2>&1) || fail "emptying bucket $BUCKET failed; AWS said: $RMOUT"
    DELETED=$(printf '%s\n' "$RMOUT" | grep -c '^delete: ' || true)
    say "   AWS reported $DELETED delete(s); $NOBJ file(s) were counted before"
    [ "$DELETED" = "$NOBJ" ] || fail "bucket $BUCKET: $DELETED delete(s) reported against $NOBJ file(s) counted before. The stack delete was not started."
    LEFT=$(aws s3api list-objects-v2 --bucket "$BUCKET" --query 'length(Contents || `[]`)' --output text 2>"$WORK/left.err") ||
      fail "could not read bucket $BUCKET after emptying it, so I cannot say it is empty; AWS said: $(cat "$WORK/left.err"). The stack delete was not started."
    case "$LEFT" in None | "") LEFT=0 ;; esac
    [ "$LEFT" = 0 ] || fail "bucket $BUCKET still holds $LEFT file(s) after the delete."
    say "   read back: bucket $BUCKET holds 0 files"
  fi

  # 6f. the stack: everything else in it
  say "-- 6f. delete stack $STACK (CloudFront and the function's interfaces are slow)"
  aws cloudformation delete-stack --stack-name "$STACK"
  if ! aws cloudformation wait stack-delete-complete --stack-name "$STACK"; then
    say "   the stack did not finish deleting. Its failed events:"
    aws cloudformation describe-stack-events --stack-name "$STACK" --output json 2>/dev/null |
      jq -r '[.StackEvents[] | select(.ResourceStatus | test("FAILED"))] | .[0:6][] | "   \(.LogicalResourceId)  \(.ResourceStatus)  \(.ResourceStatusReason // "-")"' | scrub || true
    fail "stack $STACK is not deleted (events above). The box, disk and files are already gone, and the workflows are off. A function's network interface can take a while to release: run this script again in 20 minutes, it will pick up from here."
  fi
  gone "stack $STACK" aws cloudformation describe-stacks --stack-name "$STACK"

  # 6g. the log groups, only if the stack delete left them
  for lgn in "$LOG_GROUP_BFF" "$LOG_GROUP_API"; do
    found=$(aws logs describe-log-groups --log-group-name-prefix "$lgn" --query "logGroups[?logGroupName=='$lgn'] | length(@)" --output text)
    if [ "$found" != 0 ]; then
      say "-- 6g. log group $lgn survived the stack; deleting it by its exact name"
      aws logs delete-log-group --log-group-name "$lgn"
      found=$(aws logs describe-log-groups --log-group-name-prefix "$lgn" --query "logGroups[?logGroupName=='$lgn'] | length(@)" --output text)
      [ "$found" = 0 ] || fail "log group $lgn is still there after the delete."
      say "   read back: log group $lgn is gone"
    else
      say "   read back: log group $lgn is gone (the stack removed it)"
    fi
  done

  # 6h. a last read of every name from the enumeration
  say "-- 6h. last read of every name"
  if [ -n "$BOX" ]; then
    if BOUT=$(aws ec2 describe-instances --instance-ids "$BOX" --query 'Reservations[0].Instances[0].State.Name' --output text 2>&1); then
      [ "$BOUT" = terminated ] || fail "box $BOX is '$BOUT'"
      say "   box $BOX: terminated"
    else
      case "$BOUT" in
        *NotFound*) say "   box $BOX: gone (AWS no longer lists it)" ;;
        *) fail "could not read box $BOX: $BOUT" ;;
      esac
    fi
  fi
  [ -z "$VOL" ] || gone "disk $VOL" aws ec2 describe-volumes --volume-ids "$VOL"
  [ -z "$BUCKET" ] || gone "bucket $BUCKET" aws s3api head-bucket --bucket "$BUCKET"
  for logical in Distribution Bff Api UiAccess UiRewrite BffRole DeployRole BoxGroup BffGroup Subnet; do
    id=$(phys "$logical")
    [ -n "$id" ] || continue
    case "$logical" in
      Distribution) gone "distribution $id" aws cloudfront get-distribution --id "$id" ;;
      Bff) gone "function $id" aws lambda get-function --function-name "$id" ;;
      Api) gone "HTTP API $id" aws apigatewayv2 get-api --api-id "$id" ;;
      UiAccess) gone "access control $id" aws cloudfront get-origin-access-control --id "$id" ;;
      UiRewrite) gone "CloudFront function credo-$ENVNAME-rewrite" aws cloudfront describe-function --name "credo-$ENVNAME-rewrite" ;;
      BffRole | DeployRole) gone "role $id" aws iam get-role --role-name "$id" ;;
      BoxGroup | BffGroup) gone "security group $id" aws ec2 describe-security-groups --group-ids "$id" ;;
      Subnet) gone "subnet $id" aws ec2 describe-subnets --subnet-ids "$id" ;;
    esac
  done
  REST=$(aws ec2 describe-instances --filters "Name=tag:Env,Values=$ENVNAME" --query 'Reservations[].Instances[?State.Name!=`terminated`].InstanceId' --output text | tr '\t' '\n' | grep . || true)
  [ -z "$REST" ] || fail "instances tagged Env=$ENVNAME still exist: $REST"
  say "   no instance tagged Env=$ENVNAME is left"
fi

# ---- the closing
say ""
OFF_LIST=$(printf '%s' "$WF_FILES" | tr '\n' ' ' | sed 's/ $//; s/ / and /g')
if [ "$HAVE_STACK" = 0 ]; then
  say "== verdict: ridge's stack and box were already gone, so nothing was destroyed by this run, and no workflow was changed"
  say "== CLOSING, in plain words:"
  say "   Gone before this run: the stack $STACK and any box tagged Env=$ENVNAME (I found neither). Nothing was read back as gone, because this run deleted nothing on AWS."
  say "   Check the list of unattached volumes printed above: an orphaned root disk keeps billing and may hold the records, and this script did not delete any."
else
  say "== verdict: ridge is destroyed, $OFF_LIST are off"
  say "== CLOSING, in plain words:"
  say "   Gone: the box and its disk, the UI bucket and its files, the function, the API, the CloudFront distribution, the deploy role and the function's role, the security groups, ridge's subnet, and the two log groups. Each was read back as gone above."
fi
say "   What remains in the account: the network stack $NETWORK_STACK and GitHub's provider stack $GITHUB_STACK (shared, not ridge's), and any other stack in the list near the top. If you set RIDGE_KEEP_DISK_SNAPSHOT=1, one snapshot of the old disk remains and costs a few cents a month${SNAP:+ (it is $SNAP)}. On GitHub: the environment $ENVNAME and its secret remain, and no workflow file was deleted."
say "   Ridge is gone until it is re-created. Its records are gone with the disk${SNAP:+ unless you restore snapshot $SNAP, which no script here does}. The way back is the RE-UP section above (also in the log under '== RE-UP'). The command that remakes ridge and turns the workflows back on:"
say "        cd $REPO_DIR && bash $OPS_DIR/remake.sh $ENVNAME"
say "   Then the operator, whose link you open to make your passkey:"
say "        cd $REPO_DIR && bash $OPS_DIR/operator.sh $ENVNAME"
