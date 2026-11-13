# shellcheck shell=bash
# Shared by ops/*.sh: the log, the steps, the stack reads, the tunnel to the box. It does nothing
# when sourced; each script calls what it needs. Written for bash 3.2 (macOS) and Ubuntu's.
# Why the scripts are shaped so: docs/plans/2026-10-28-ridge.md.

OPS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=$(dirname "$OPS_DIR")
START=$(date +%s)

# The one Region of the account's stacks (the plan's step 1). Every aws call below uses it.
CREDO_REGION=${CREDO_REGION:-ap-southeast-5}
export AWS_REGION=$CREDO_REGION AWS_DEFAULT_REGION=$CREDO_REGION

BOX_USER=ec2-user
# A release stops below these amounts on the box (MiB): free disk, available memory, total swap
# (the box is made with 2 GiB of swap, which a t4g.nano needs).
FLOOR_DISK_MB=1024
FLOOR_MEM_MB=96
FLOOR_SWAP_MB=1024
# The check reds below this much free on the records disk (MiB), and when the newest copy lags the last
# write by more than COPY_LAG_S, or the newest full copy is older than COPY_FULL_MAX_S (six days: Litestream
# makes no full copy on an idle file, so this is the only guard on one).
FLOOR_RECORDS_MB=1024
COPY_LAG_S=300
COPY_FULL_MAX_S=518400
# The box's path in the copy's bucket (the one home: the release builds COPY_URL, with the region, from it and
# passes it to the box's records step, and the check lists it), and where Litestream's S3 client keeps full
# copies under it: <path>/<level as four hex digits>/<min TXID>-<max TXID>.ltx, level 9 being the full copy
# (the pinned release's s3/replica_client.go, lines 698 and 1571). The ltx/<level>/ layout is the file replica's, not S3's.
COPY_PATH=Box/records
COPY_FULL_PREFIX=$COPY_PATH/0009/

LOG=''
WORK=''
STEP=0
STEPS=0
REDS=''
SECRETS=''
SECRET_LABELS=''

die() {
  echo "error: $*" >&2
  exit 1
}

elapsed() {
  local s
  s=$(($(date +%s) - START))
  printf '%dm%02ds' $((s / 60)) $((s % 60))
}

# step <text>: the n/N line, with the time elapsed
step() {
  STEP=$((STEP + 1))
  printf '[%s/%s] %s (%s)\n' "$STEP" "$STEPS" "$1" "$(elapsed)"
}

ok() { echo "ok   $*"; }

red() {
  echo "RED  $*"
  REDS="${REDS}$*"$'\n'
}

# expect <what> <wanted> <got>
expect() {
  if [ "$2" = "$3" ]; then ok "$1: $3"; else red "$1: wanted '$2', got '$3'"; fi
}

# verdict: ends the run on == green, or on each red; non-zero for a red
verdict() {
  if [ -z "$REDS" ]; then
    echo "== green"
  else
    echo "== red"
    printf '%s' "$REDS" | sed 's/^/   - /'
    return 1
  fi
}

# log_start <script> <env>: all output goes to the terminal and to logs/<date>-<time>-<script>-<env>.log
# in the credo root, the folder that holds .bare, derived from git (OPS_LOG_DIR names another
# folder, for the test). The log ends on == exit <n>: 130 after Ctrl-C, 143 after SIGTERM, 129 after
# SIGHUP, since a signal's trap must exit for on_exit to see a code.
# A named pipe feeds tee, since the sandbox the machine works in refuses process substitution.
TEE_PID=''
log_start() {
  local root dir=${OPS_LOG_DIR:-}
  if [ -z "$dir" ]; then
    root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
    dir=$root/logs
  fi
  mkdir -p "$dir"
  LOG="$dir/$(date +%Y-%m-%d-%H%M%S)-$1-${2:-all}.log"
  mkwork
  mkfifo "$WORK/log.fifo"
  exec 3>&1
  tee -a "$LOG" <"$WORK/log.fifo" &
  TEE_PID=$!
  exec >"$WORK/log.fifo" 2>&1
  trap on_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 129' HUP
  echo "== $1 ${2:-} started $(date '+%Y-%m-%d %H:%M:%S %z')"
}

# final <text>: a line after the pipe is closed, to the terminal and the log
final() { echo "$*" | tee -a "$LOG"; }

# on_exit: removes the Bruno environment this run wrote, closes the tunnel, lets the log catch up,
# searches it for the keys, removes the scratch folder, then ends the log. A second Ctrl-C, or
# another signal, while it waits does not cut it short: the signals are ignored from here on.
on_exit() {
  local rc=$?
  trap - EXIT
  trap '' INT TERM HUP
  if declare -F cleanup_extra >/dev/null; then cleanup_extra || true; fi
  bruno_env_remove
  box_close
  if [ -n "$TEE_PID" ]; then
    exec >&3 2>&3
    # tee ends when the pipe's last writer is gone; a stray writer must not hang the run
    for _ in $(seq 1 30); do
      kill -0 "$TEE_PID" 2>/dev/null || break
      sleep 0.1
    done
  fi
  if declare -F search_extra >/dev/null; then search_extra || rc=1; fi
  if [ -n "$SECRETS" ] && [ -n "$LOG" ]; then
    local s leaked_key=0 leaked_what=''
    local i=1 label
    while IFS= read -r s; do
      if [ -n "$s" ] && grep -qF -- "$s" "$LOG"; then
        label=$(sed -n "${i}p" <<<"$SECRET_LABELS")
        if [ -n "$label" ]; then leaked_what=$label; else leaked_key=1; fi
      fi
      i=$((i + 1))
    done <<<"$SECRETS"
    if [ "$leaked_key" = 1 ]; then
      final "RED  a key is in this log: delete it and replace the key (docs/plans/2026-10-28-ridge.md#deploys-from-github-actions)"
      rc=1
    fi
    if [ -n "$leaked_what" ]; then
      final "RED  $leaked_what is in this log: redact it in this log; nothing to replace"
      rc=1
    fi
    if [ -z "$leaked_what" ] && [ "$leaked_key" = 0 ]; then
      final "ok   no key in this log"
    fi
  fi
  if [ -n "$WORK" ]; then rm -rf "$WORK"; fi
  final "== exit $rc"
  exit "$rc"
}

mkwork() {
  if [ -z "$WORK" ]; then WORK=$(mktemp -d "${TMPDIR:-/tmp}/credo-ops.XXXXXX"); fi
}

# mask <value> [<what it is>]: GitHub's log mask, written past the log file so the log never holds the value.
# Remembers the value for the end-of-run search. fd 3 is the terminal and tee writes the same pipe
# from another process, so the command opens with a newline: it can then never land mid-line, where
# GitHub would not read it and the value would print. The label, when given (not a key), is what the
# end-of-run search names if the value is found in the log. GitHub masks and the search matches one
# line at a time, so a value of several lines is taken as one secret per line, each with the label.
mask() {
  local line
  if [ -z "$1" ]; then return 0; fi
  while IFS= read -r line; do
    if [ -z "$line" ]; then continue; fi
    if [ "${GITHUB_ACTIONS:-}" = true ]; then
      { printf '\n::add-mask::%s\n' "$line" >&3; } 2>/dev/null || die "mask: fd 3 is closed; log_start opens it"
    fi
    SECRETS="${SECRETS}${line}"$'\n'
    SECRET_LABELS="${SECRET_LABELS}${2:-}"$'\n'
  done <<<"$1"
}

# repository → owner/name, from the origin remote; never written in a committed file
repository() {
  git -C "$REPO_DIR" remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##'
}

# main_synced: fetches origin/main, then refuses unless ops/ here is as reviewed (ops_match_main), so
# a script that acts under the human's AWS session is always a reviewed one.
main_synced() {
  git -C "$REPO_DIR" fetch --quiet origin main || die "cannot fetch origin main: the scripts here cannot be compared with main's"
  ops_match_main
}

# INVENTED_ENVS: the environments that hold invented data alone, space-separated, this list's one home.
# Every other name may hold a real company's records and is treated as production
# (docs/plans/2026-11-12-safe-scripts.md, "What production means to a script"). A production stack must
# never be named like one of these.
INVENTED_ENVS="ridge"
# DESTROY_BY_HAND: the logical ids in env.yml that a stack delete keeps (a Retain or Snapshot policy) or
# cannot empty (a bucket), this list's one home. ops/destroy.sh deletes each by hand, and stops before its
# prompt on an id none of its steps deletes; ops/test.sh row 14 compares the list with env.yml.
# shellcheck disable=SC2034 # read by destroy.sh and test.sh
DESTROY_BY_HAND="Box CopyBucket RecordsVolume UiBucket"
# WANT_BRUNO: the Bruno CLI version ops/check.sh runs and ops/remake.sh refuses to start without, one home.
# shellcheck disable=SC2034 # read by check.sh and remake.sh
WANT_BRUNO=4.2.0
# REAL: 1 once real_ok has run on an unlisted environment. Set to 0 here, before any environment is read
# by a script, so a stray REAL=1 in a shell or a workflow's env cannot narrow ridge's check.
REAL=0

# is_invented <env>: succeeds when the environment is listed in INVENTED_ENVS.
is_invented() {
  case " $INVENTED_ENVS " in
    *" $1 "*) return 0 ;;
  esac
  return 1
}

# refuse_real <env> <why>: dies with <why> (the script's own words) unless the environment is listed as
# invented. A script that must never act on a real company's records calls it after log_start, so the
# refusal lands in the log, and before main_synced, so it comes before any AWS call.
refuse_real() {
  is_invented "$1" || die "$2"
}

# real_ok <env> <why>: for a script that is safe on an environment that may hold real data. On an unlisted
# environment it prints one ok line saying why, sets REAL=1 for a script that branches on it, and refuses
# the two switches the tests set in the environment (RIDGE_SCRIPTS_DIR, OPS_TEST_NO_TTY) unless the tests'
# own marker OPS_TESTS_RUNNING is set beside them, so the code that runs there is the reviewed tree's.
# On a listed environment it prints and refuses nothing. Called after log_start and before main_synced.
real_ok() {
  is_invented "$1" && return 0
  if [ -z "${OPS_TESTS_RUNNING:-}" ]; then
    [ -z "${RIDGE_SCRIPTS_DIR:-}" ] || die "RIDGE_SCRIPTS_DIR is set, and $1 may hold real data: that switch is the tests' alone, so the code run there is the reviewed tree's"
    [ -z "${OPS_TEST_NO_TTY:-}" ] || die "OPS_TEST_NO_TTY is set, and $1 may hold real data: that switch is the tests' alone"
  fi
  # shellcheck disable=SC2034 # read by the script that sources this file
  REAL=1
  echo "ok   $1 may hold real data; this script is safe there: $2"
}

# ops_match_main: dies unless the tracked and untracked files git does not ignore, under every path
#   ci.yml's push trigger deploys on, and the root .gitignore (one local line there would hide a new
#   file under any of them), are as reviewed. Ignored files (node_modules, dist) are not compared.
#   Those paths are what the scripts here execute, deploy or seed (ridge_cli runs scripts/ and the
#   packages it imports), and the list is read from the base's own ci.yml through push_paths: one
#   home, and a working copy cannot shorten it.
#   By hand: equal to origin/main's.
#   In the deploy job (GITHUB_ACTIONS=true): equal to the commit checked out, which must be a commit
#   of origin/main. A push that lands during the run moves origin/main on, and the job still runs
#   what it checked out; comparing with the moved ref would turn a sound deploy red.
ops_match_main() {
  local base=origin/main whose="origin/main's" ci paths path rc
  local deployed=()
  git -C "$REPO_DIR" rev-parse --verify -q origin/main >/dev/null || die "origin/main is unknown here: git fetch origin main"
  if [ "${GITHUB_ACTIONS:-}" = true ]; then
    git -C "$REPO_DIR" merge-base --is-ancestor HEAD origin/main || die "the commit checked out is not a commit of main: only main is released"
    base=HEAD
    whose="this commit's"
  fi
  # push_paths reads a real file, as seed.sh gives it: the base's ci.yml, removed on every way out.
  ci=$(mktemp "${TMPDIR:-/tmp}/ci-base.XXXXXX")
  git -C "$REPO_DIR" show "$base:.github/workflows/ci.yml" >"$ci" || {
    rm -f "$ci"
    die "$whose .github/workflows/ci.yml cannot be read, so the paths a push deploys on are not known: nothing was written"
  }
  rc=0
  paths=$(push_paths "$ci") || rc=$?
  rm -f "$ci"
  [ "$rc" = 0 ] || exit 1
  while IFS= read -r path; do deployed+=("$path"); done <<<"$paths"
  deployed+=(.gitignore)
  if ! git -C "$REPO_DIR" diff --quiet "$base" -- "${deployed[@]}" ||
    [ -n "$(git -C "$REPO_DIR" ls-files --others --exclude-standard -- "${deployed[@]}")" ]; then
    die "the code here (tracked and unignored files under every path ci.yml deploys on, and .gitignore) differs from $whose: run the scripts from a worktree at main, never unreviewed ones"
  fi
  ok "the code here (tracked and unignored files under every path ci.yml deploys on, and .gitignore) is $whose"
}

region_enabled() {
  local s
  s=$(aws account get-region-opt-status --region-name "$CREDO_REGION" --query RegionOptStatus --output text)
  case "$s" in
    ENABLED | ENABLED_BY_DEFAULT) ok "$CREDO_REGION is $s" ;;
    *) die "$CREDO_REGION is '$s' in this account: enable it first" ;;
  esac
}

# stack_load <name>: STACK_JSON is its description; a missing stack leaves it empty
STACK_JSON=''
stack_load() {
  local err
  mkwork
  err="$WORK/describe.err"
  if STACK_JSON=$(aws cloudformation describe-stacks --stack-name "$1" --output json 2>"$err"); then
    return 0
  fi
  if grep -q 'does not exist' "$err"; then
    STACK_JSON=''
    return 0
  fi
  cat "$err" >&2
  die "describe-stacks $1 failed"
}

# OUTPUTS_PRINTED: the outputs that carry no secret and are read in the human's log. Any other
# output (a new one included) prints "(not printed)" until it is named here.
OUTPUTS_PRINTED='["Env","Repository","BoxId","BoxGroupId","SubnetId","SubnetCidr","Zone","VpcId","VpcCidr","RoutesId","EndpointId","EndpointGroupId","ProviderArn","BffName","BffGroupId","UiBucketName","AppAddress","Watch"]'

# outputs_print: the stack's outputs from STACK_JSON, one line each. An output prints its value only
# when it is named in OUTPUTS_PRINTED and holds no masked line (SECRETS); the secrets go to jq in its
# environment, never on its command line.
outputs_print() {
  OPS_SECRETS="$SECRETS" jq -r --argjson printed "$OUTPUTS_PRINTED" '
    ((env.OPS_SECRETS // "") | split("\n") | map(select(. != ""))) as $s
    | .Stacks[0].Outputs[]?
    | .OutputValue as $v
    | "  \(.OutputKey) = " + (
        if (.OutputKey | IN($printed[])) and (any($s[]; . as $x | $v | contains($x)) | not) then $v
        elif .OutputKey == "DeployRoleArn" then "(not printed: the account id)"
        elif .OutputKey == "ApiAddress" then "(not printed: the API is reached through the app)"
        elif .OutputKey == "BoxAddress" then "(not printed: an address)"
        else "(not printed)" end)' <<<"$STACK_JSON"
}

# outputs_show: the read-back's one way to show a stack's outputs (stack.sh). The deploy role's ARN
# holds the account's id, the API's own address answers anyone and is reached through CloudFront, and
# the box's private address is no log's: all three are searched for in the log, never printed. The
# app's address is printed, in the human's local log, and in no committed file or public log.
outputs_show() {
  mask "$(out DeployRoleArn)"
  mask "$(out ApiAddress)"
  mask "$(out BoxAddress)" "the box's private address"
  outputs_print
}

# stack_param <ParameterKey> → the stack's value of it in STACK_JSON, empty if none
stack_param() {
  jq -r --arg k "$1" '.Stacks[0].Parameters // [] | map(select(.ParameterKey == $k))[0].ParameterValue // empty' <<<"$STACK_JSON"
}

# rolled_back_refusal: dies on a stack in ROLLBACK_COMPLETE, whatever kind of stack it is. That status
# exists only after a failed (or cancelled) stack creation, and only a delete is allowed on such a stack: the creation's
# rollback deleted what it had made, Box included (its DeletionPolicy is RetainExceptOnCreate, which retains
# on every operation but the one that created it), so no box, disk or record can be in it. Delete the stack,
# then run again. It never reads Env: network and github stacks carry none, and a missing Env says "not an
# environment stack", not "holds records".
# Source of both claims: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/view-stack-events.html,
# "Stack status codes", the ROLLBACK_COMPLETE row ("exists only after a failed stack creation", "only a delete
# operation can be performed"; the row also covers an explicitly canceled creation).
rolled_back_refusal() {
  die "the stack is in ROLLBACK_COMPLETE: its creation did not complete and was rolled back, and it holds nothing a delete could lose, so delete the stack (console or aws cloudformation delete-stack), then run this again"
}

# choose_change_type: sets CS_TYPE from STACK_JSON. No stack, or one that only holds a change set
# (REVIEW_IN_PROGRESS, left by a planned, failed or interrupted creation), is a CREATE with fresh
# parameters; any other is an UPDATE; a stack that rolled back is deleted by hand first.
CS_TYPE=''
# shellcheck disable=SC2034 # stack.sh reads CS_TYPE
choose_change_type() {
  local status
  if [ -z "$STACK_JSON" ]; then
    CS_TYPE=CREATE
    return 0
  fi
  status=$(jq -r '.Stacks[0].StackStatus // empty' <<<"$STACK_JSON")
  case "$status" in
    REVIEW_IN_PROGRESS) CS_TYPE=CREATE ;;
    ROLLBACK_COMPLETE) rolled_back_refusal ;;
    '') die "the stack's description names no StackStatus" ;;
    *) CS_TYPE=UPDATE ;;
  esac
}

# repository_matches_stack <owner/name>: an update never moves the deploy role's trust to another
# repository, such as a fork's clone; a stack with no Repository yet passes
repository_matches_stack() {
  local have
  have=$(stack_param Repository)
  if [ -n "$have" ] && [ "$have" != "$1" ]; then
    die "this clone's origin is $1, but the stack's Repository is $have: run from a clone of $have"
  fi
}

# The shape env.yml's SubjectPrefix accepts (its AllowedPattern, which ops/test.sh compares)
SUBJECT_PREFIX_RE='^repo:[A-Za-z0-9_.-]+(@[0-9]+)?/[A-Za-z0-9_.-]+(@[0-9]+)?$'

# subject_prefix_of <owner/name> <GitHub's answer> → the start of the subject GitHub puts in this
# repository's tokens, read from repos/<owner/name>/actions/oidc/customization/sub. GitHub may issue
# the immutable subject (owner@id/name@id), which no name alone predicts. Refused: an answer that
# cannot be read, custom claim keys (use_default false: the subject's whole shape changes), the
# immutable subject without its prefix, a prefix of another shape than the role's trust takes, and a prefix naming another repository.
subject_prefix_of() {
  local repo=$1 body=$2 use_default immutable prefix
  use_default=$(jq -r 'if type == "object" then (.use_default | if . == null then empty else tostring end) else empty end' <<<"$body" 2>/dev/null) ||
    die "GitHub's OIDC subject settings for $repo cannot be read (the answer is not JSON)"
  [ -n "$use_default" ] || die "GitHub's OIDC subject settings for $repo cannot be read (no use_default in the answer)"
  [ "$use_default" = true ] ||
    die "the OIDC subject of $repo uses custom claim keys (use_default is $use_default): its whole shape changes, and the role's trust is not made for it"
  immutable=$(jq -r '.use_immutable_subject // false' <<<"$body")
  prefix=$(jq -r '.sub_claim_prefix // empty' <<<"$body")
  if [ -z "$prefix" ]; then
    [ "$immutable" != true ] ||
      die "the OIDC subject of $repo is the immutable one, but GitHub gave no sub_claim_prefix: the ids cannot be known"
    prefix=repo:$repo
  fi
  [[ $prefix =~ $SUBJECT_PREFIX_RE ]] ||
    die "the OIDC subject prefix GitHub gave for $repo is not of the shape repo:owner[@id]/name[@id]"
  # it names this repository: the ids dropped, the name equal to repo:<owner/name>, case aside
  local bare want
  bare=$(sed -E 's/@[0-9]+//g' <<<"$prefix" | tr '[:upper:]' '[:lower:]')
  want=$(tr '[:upper:]' '[:lower:]' <<<"repo:$repo")
  [ "$bare" = "$want" ] ||
    die "the OIDC subject prefix GitHub gave for $repo ($prefix) names another repository"
  echo "$prefix"
}

# github_subject_prefix <owner/name> → subject_prefix_of, asked of GitHub with the human's gh
github_subject_prefix() {
  local body
  body=$(gh api "repos/$1/actions/oidc/customization/sub" 2>/dev/null) ||
    die "gh api repos/$1/actions/oidc/customization/sub failed: is gh logged in with rights on $1?"
  subject_prefix_of "$1" "$body"
}

# subject_matches_stack <prefix>: an update never moves the deploy role's trust to another subject,
# such as a fork's clone, whose ids differ; a stack with no SubjectPrefix yet passes
subject_matches_stack() {
  local have
  have=$(stack_param SubjectPrefix)
  if [ -n "$have" ] && [ "$have" != "$1" ]; then
    die "GitHub's subject prefix for this repository is $1, but the stack's SubjectPrefix is $have: either this is a fork's clone (run from a clone of the stack's repository), or the repository's OIDC subject setting changed on GitHub (see the plan, 'Deploys from GitHub Actions', and the runbook's 'The first deploy was refused at the role')"
  fi
}

# subject_param_plan <prefix> → "previous" when the stack already holds a SubjectPrefix (kept, after
# subject_matches_stack), "set" when it holds none (ridge before this parameter existed: the
# trust alone changes, to GitHub's prefix)
subject_param_plan() {
  subject_matches_stack "$1"
  if [ -n "$(stack_param SubjectPrefix)" ]; then echo previous; else echo set; fi
}

# add_param <key> <value>, or <key> alone to keep its previous value: appends to PARAMS, the
# template's parameters as a JSON array. A new stack gets the values read now; an updated one
# keeps those it must not move.
add_param() { # <key> <value> | <key> (previous)
  if [ $# -eq 2 ]; then
    PARAMS=$(jq -c --arg k "$1" --arg v "$2" '. + [{ParameterKey: $k, ParameterValue: $v}]' <<<"$PARAMS")
  else
    PARAMS=$(jq -c --arg k "$1" '. + [{ParameterKey: $k, UsePreviousValue: true}]' <<<"$PARAMS")
  fi
}

# add_subject_param <prefix>: on an update, appends SubjectPrefix to PARAMS: the stack's own value
# kept (after subject_matches_stack), or GitHub's prefix once on a stack that holds none
add_subject_param() {
  local plan
  plan=$(subject_param_plan "$1") || exit 1
  if [ "$plan" = previous ]; then
    add_param SubjectPrefix
  else
    add_param SubjectPrefix "$1"
  fi
}

# slack_param_plan → how the two Slack IDs (CREDO_SLACK_WORKSPACE_ID, CREDO_SLACK_CHANNEL_ID, from the
# environment) reach the stack: "set" when both are given (new values, "none" included), "previous" when
# neither is and the stack holds them (kept), "default" when neither is and the stack holds none (the
# template's "none"; also on a creation, whatever a stack left in REVIEW_IN_PROGRESS lists, since a
# creation has no previous value to use). One without the other is refused: a lone channel ID makes no channel, silently.
# So is "none" for one and a real ID for the other: the template's condition then makes no channel and
# the run still exits 0. Turning the channel off is "none" for both, and on a stack that holds a channel
# that is a removal: the run takes --take AlertsChannel --take AlertsChannelRole.
slack_param_plan() {
  local w="${CREDO_SLACK_WORKSPACE_ID:-}" c="${CREDO_SLACK_CHANNEL_ID:-}"
  if [ -n "$w" ] && [ -n "$c" ]; then
    if [ "$w" = none ] || [ "$c" = none ]; then
      [ "$w" = "$c" ] || die "one of CREDO_SLACK_WORKSPACE_ID and CREDO_SLACK_CHANNEL_ID is none and the other is an ID: that makes no channel, silently (give two IDs, or none for both)"
    fi
    echo set
  elif [ -n "$w" ] || [ -n "$c" ]; then
    die "CREDO_SLACK_WORKSPACE_ID and CREDO_SLACK_CHANNEL_ID go together: one without the other makes no channel (give both, or neither to keep the stack's values; none for both turns the channel off, and on a stack that holds a channel that run takes --take AlertsChannel --take AlertsChannelRole)"
  elif [ "${CS_TYPE:-}" != CREATE ] && [ -n "$(stack_param SlackWorkspaceId)" ]; then
    echo previous
  else
    echo default
  fi
}

# add_slack_params: appends the two Slack IDs to PARAMS as slack_param_plan says
add_slack_params() {
  local plan
  plan=$(slack_param_plan) || exit 1
  case "$plan" in
    set)
      add_param SlackWorkspaceId "$CREDO_SLACK_WORKSPACE_ID"
      add_param SlackChannelId "$CREDO_SLACK_CHANNEL_ID"
      ;;
    previous)
      add_param SlackWorkspaceId
      add_param SlackChannelId
      ;;
  esac
}

# out <OutputKey> → its value in STACK_JSON, empty if none
out() {
  jq -r --arg k "$1" '.Stacks[0].Outputs // [] | map(select(.OutputKey == $k))[0].OutputValue // empty' <<<"$STACK_JSON"
}

# unit_port <unit file> → the port the unit sets, the one home of c-storage's port on the box
unit_port() {
  sed -n 's/^Environment=PORT=//p' "$1"
}

# --- the box, over one ssh connection through the Instance Connect Endpoint ---

BOX_ID=''
BOX_PORT=$(unit_port "$OPS_DIR/c-storage.service")
# The activity log's writing port, from its unit, the one home: the template takes it as AuditPort
# shellcheck disable=SC2034 # read by stack.sh, which sources this file
AUDIT_PORT=$(unit_port "$OPS_DIR/audit-backbone.service")
# and its reading port, on the box's loopback alone, which the check reads an entry through, on the box
# shellcheck disable=SC2034 # read by check.sh
AUDIT_OPEN_PORT=$(sed -n 's/^Environment=OPEN_PORT=//p' "$OPS_DIR/audit-backbone.service")
# The address on the box that c-storage listens on, and that a forward and every read of /health
# reach it at: the stack's BoxAddress, set by box_open and read by check.sh, tunnel.sh, release.sh
# and drill.sh. release.sh writes it into /etc/c-storage/listen.env, which the unit reads.
BOX_LISTEN_ADDR=''
box_ready=0

# box_open <env> [<local port>]: mints a key for this run, pushes it through Instance Connect (it
# holds 60 s), and opens one connection through the endpoint that every box call then rides. With
# a local port, that port forwards to c-storage's port on the box's private address. Returns non-zero when
# the box does not answer, so a reboot's wait can try again.
box_open() {
  local zone
  mkwork
  stack_load "$1"
  [ -n "$STACK_JSON" ] || die "stack $1 does not exist: ops/stack.sh env $1"
  BOX_ID=$(out BoxId)
  zone=$(out Zone)
  [ -n "$BOX_ID" ] || die "stack $1 names no box"
  BOX_LISTEN_ADDR=$(out BoxAddress)
  [[ "$BOX_LISTEN_ADDR" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "stack $1 names no private address for its box (BoxAddress)"
  # No log holds the box's private address (the plan's "no key, address or password"), and GitHub masks it.
  mask "$BOX_LISTEN_ADDR" "the box's private address"
  rm -f "$WORK/key" "$WORK/key.pub"
  ssh-keygen -q -t ed25519 -N '' -C credo-ops -f "$WORK/key"
  aws ec2-instance-connect send-ssh-public-key --instance-id "$BOX_ID" --availability-zone "$zone" \
    --instance-os-user "$BOX_USER" --ssh-public-key "file://$WORK/key.pub" --query Success --output text >/dev/null ||
    return 1
  # A forward that cannot bind (the port taken since it was checked) fails the open: ssh would
  # otherwise stay up without it, and the caller would read whatever else answers on that port.
  local fwd=()
  if [ -n "${2:-}" ]; then fwd=(-o ExitOnForwardFailure=yes -L "127.0.0.1:$2:$BOX_LISTEN_ADDR:$BOX_PORT"); fi
  # No host key is kept: the key is new each run and the tunnel is AWS's, to this instance id.
  ssh -f -N -M -S "$WORK/cm" -i "$WORK/key" -o IdentitiesOnly=yes -o BatchMode=yes \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    -o ConnectTimeout=30 -o ServerAliveInterval=15 \
    -o ProxyCommand="aws ec2-instance-connect open-tunnel --instance-id %h" \
    ${fwd[@]+"${fwd[@]}"} "$BOX_USER@$BOX_ID" || return 1
  box_ready=1
}

# box <command...>: runs on the box over the open connection
box() {
  ssh -S "$WORK/cm" -o LogLevel=ERROR "$BOX_USER@$BOX_ID" "$@"
}

box_close() {
  if [ "$box_ready" = 1 ]; then
    ssh -S "$WORK/cm" -O exit -o LogLevel=ERROR "$BOX_USER@$BOX_ID" >/dev/null 2>&1 || true
    box_ready=0
  fi
}

# clock <epoch seconds> → HH:MM local time (GNU date, then BSD's)
clock() { date -d "@$1" +%H:%M 2>/dev/null || date -r "$1" +%H:%M; }

# tunnel_hold <seconds>: asks the open connection every <seconds> whether it is still up, and dies
# naming the drop when it is not. The sleep runs apart from the log's pipe and is waited on, so a
# signal ends the wait at once and on_exit runs.
tunnel_hold() {
  while ssh -S "$WORK/cm" -O check -o LogLevel=ERROR "$BOX_USER@$BOX_ID" >/dev/null 2>&1; do
    sleep "$1" >/dev/null 2>&1 &
    wait $!
  done
  die "the tunnel dropped (the endpoint's hour, a reboot of the box, or the network): run it again"
}

# The records disk's mount on the box: the path c-storage's state directory resolves to (a dynamic
# user's /var/lib/c-storage is a link to it), where ops/c-storage.service waits for the mount.
RECORDS_MOUNT=/var/lib/private/c-storage

# box_resources → MEM_MB (available), SWAP_MB (total) and DISK_MB (free on /), and RECORDS_MB (free on
# the records disk beside it, -1 when that disk is not mounted), logged
MEM_MB=0
SWAP_MB=0
DISK_MB=0
RECORDS_MB=-1
box_resources() {
  local r
  r=$(
    box bash -s "$RECORDS_MOUNT" <<'REMOTE'
awk '/^MemAvailable:/{m=int($2/1024)} /^SwapTotal:/{s=int($2/1024)} END{printf "%d %d ", m, s}' /proc/meminfo
df -Pm / | awk 'NR==2{printf "%s ", $4}'
if mountpoint -q "$1"; then df -Pm "$1" | awk 'NR==2{print $4}'; else echo -1; fi
REMOTE
  )
  read -r MEM_MB SWAP_MB DISK_MB RECORDS_MB <<<"$r"
  RECORDS_MB=${RECORDS_MB:--1}
  if [ "$RECORDS_MB" = -1 ]; then
    echo "box: memory $MEM_MB MiB available, swap $SWAP_MB MiB, disk $DISK_MB MiB free, no records disk mounted"
  else
    echo "box: memory $MEM_MB MiB available, swap $SWAP_MB MiB, disk $DISK_MB MiB free, records disk $RECORDS_MB MiB free"
  fi
}

# litestream_pin → LITESTREAM_VERSION and LITESTREAM_ARM64_SHA256, from the pin's one home (the tests point
# LITESTREAM_PIN at a pin of their own)
litestream_pin() {
  # shellcheck source=litestream.pin
  . "${LITESTREAM_PIN:-$OPS_DIR/litestream.pin}"
  [[ "${LITESTREAM_VERSION:-}" =~ ^[0-9]+[.][0-9]+[.][0-9]+$ ]] || die "ops/litestream.pin names no version"
  [[ "${LITESTREAM_ARM64_SHA256:-}" =~ ^[0-9a-f]{64}$ ]] || die "ops/litestream.pin holds no SHA-256 for the arm64 archive (a FILL marker is not a sum)"
}

# litestream_binary <out file> → Litestream's arm64 binary at <out file>, taken from the pinned archive
# alone. LITESTREAM_ARCHIVE names an archive already fetched (the deploy job's); otherwise it is fetched
# from the release. Either way its SHA-256 must be the pin's, or nothing is unpacked.
litestream_binary() {
  local archive=${LITESTREAM_ARCHIVE:-} got
  litestream_pin
  if [ -z "$archive" ]; then
    archive=$WORK/litestream.tar.gz
    curl -fsSL -o "$archive" "https://github.com/benbjohnson/litestream/releases/download/v$LITESTREAM_VERSION/litestream-$LITESTREAM_VERSION-linux-arm64.tar.gz" ||
      die "Litestream $LITESTREAM_VERSION could not be fetched"
  fi
  [ -f "$archive" ] || die "LITESTREAM_ARCHIVE $archive does not exist"
  got=$(shasum -a 256 "$archive" | cut -d' ' -f1)
  [ "$got" = "$LITESTREAM_ARM64_SHA256" ] || die "the Litestream archive is $got, the pin says $LITESTREAM_ARM64_SHA256: nothing unpacked"
  mkdir -p "$WORK/litestream"
  tar -xzf "$archive" -C "$WORK/litestream" litestream
  [ -f "$WORK/litestream/litestream" ] || die "the pinned archive holds no litestream binary"
  cp "$WORK/litestream/litestream" "$1"
}

# copy_status → c-storage's GET /api/status, read on the box: the internal key goes from its file into curl's
# config on stdin and never leaves the box. The first word tells the stand-ins apart.
copy_status() {
  box sudo bash -s -- status "$BOX_PORT" "$BOX_LISTEN_ADDR" <<'REMOTE'
set -euo pipefail
. /etc/c-storage/keys.env
printf 'header = "X-Internal-Access-Key: %s"\n' "$INTERNAL_ACCESS_KEY" |
  curl -fsS -m 5 -K - "http://$3:$2/api/status"
REMOTE
}

# copy_problems <status json> <listing json: [{Key, LastModified}] or null> <now, epoch seconds> → one line for
# each fault of the copy, nothing when it is sound: the records disk below its floor, no copy at all, the newest
# copy behind the last write by over COPY_LAG_S, no full copy, the newest full copy older than COPY_FULL_MAX_S. The newest full copy is the one with the largest
# key (the largest <min>-<max> name, which is TXID order, as Litestream's own restore picks); its age is that object's
# LastModified, S3's time of the upload of that snapshot, which is when the full copy was made.
copy_problems() {
  jq -nr --argjson st "$1" --argjson ls "$2" --argjson now "$3" --argjson lag "$COPY_LAG_S" \
    --argjson fullmax "$COPY_FULL_MAX_S" --argjson floor "$((FLOOR_RECORDS_MB * 1048576))" --arg full "$COPY_FULL_PREFIX" '
    def epoch: sub("\\.[0-9]+"; "") | sub("\\+00:00$"; "Z") | fromdateiso8601;
    ($ls // []) as $objs
    | ($objs | map(.LastModified | epoch) | max) as $newest
    | ($objs | map(select(.Key | startswith($full))) | sort_by(.Key) | last | if . == null then null else .LastModified | epoch end) as $fullest
    | ($st.lastWriteAt | if . == null then null else epoch end) as $write
    | (if $st.freeBytes < $floor then "the records disk has \($st.freeBytes / 1048576 | floor) MiB free, below the floor of \($floor / 1048576) MiB" else empty end),
      (if $newest == null then "the bucket holds no copy of the records" else empty end),
      (if $write != null and $newest != null and ($write - $newest) > $lag then "the newest copy lags the last write by \($write - $newest) s, over \($lag) s" else empty end),
      (if $fullest == null then "the bucket holds no full copy" else empty end),
      (if $fullest != null and ($now - $fullest) > $fullmax then "the newest full copy is \(($now - $fullest) / 86400 | floor) days old, over \($fullmax / 86400) days" else empty end)
  '
}

# copy_lag_read <status json> → yes when the status holds a time of the last write (so copy_problems can read the
# lag), no when it is null: c-storage keeps that time in memory only, so after any restart there is none until
# the next save, and the lag test then has nothing to compare. The check says so rather than call the copy current.
copy_lag_read() {
  jq -nr --argjson st "$1" 'if $st.lastWriteAt == null then "no" else "yes" end'
}

# box_restore_blank <time or -> <records disk id> → the one path onto a records disk that holds no c-storage.db:
# on the box, a disk with no filesystem is formatted, the disk is mounted at the records path, and the newest
# copy (or the copy as of <time>) is restored onto c-storage.db there, before c-storage ever starts. It refuses
# when c-storage is running, when the disk holds a filesystem other than XFS, and when it already holds a
# c-storage.db. Prints restored=<the file>.
box_restore_blank() {
  box sudo bash -s -- blank "$RECORDS_MOUNT" "$1" "$2" <<'REMOTE'
set -euo pipefail
mount=$2 at=$3 vol=${4//-/}
dev=/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_$vol
[ -e "$dev" ] || { echo "the records disk $vol is not attached to this box" >&2; exit 3; }
if systemctl is-active --quiet c-storage; then echo "c-storage is running: a blank-disk restore runs before it starts" >&2; exit 1; fi
install -d -m 0700 /var/lib/private "$mount"
if ! mountpoint -q "$mount"; then
  type=$(blkid -o value -s TYPE "$dev" || true)
  [ -z "$type" ] || [ "$type" = xfs ] || { echo "the records disk holds a $type filesystem, not the XFS this restore makes or mounts" >&2; exit 1; }
  if [ -z "$type" ]; then mkfs.xfs -q "$dev"; echo "records disk: formatted"; fi
  uuid=$(blkid -o value -s UUID "$dev")
  grep -q "^UUID=$uuid $mount " /etc/fstab || { { grep -v " $mount " /etc/fstab || true; echo "UUID=$uuid $mount xfs defaults,nofail 0 2"; } >/etc/fstab.new && mv /etc/fstab.new /etc/fstab; }
  systemctl daemon-reload
  mount "$mount"
fi
mountpoint -q "$mount" || { echo "the records disk is not mounted at $mount" >&2; exit 1; }
[ ! -e "$mount/c-storage.db" ] || { echo "the records disk already holds c-storage.db: this restore is for a disk without one" >&2; exit 1; }
# On a replacement box no release has finished, so the address and the binary are still the release's .new files
# (it sends them, then stops at the records step that refuses): fall back to them.
envf=/etc/c-storage/copy.env
bin=/opt/c-storage/litestream
if [ ! -e "$envf" ]; then envf=/opt/c-storage/copy.env.new; fi
if [ ! -x "$bin" ]; then bin=/opt/c-storage/litestream.new; chmod 0755 "$bin"; fi
[ -e "$envf" ] && [ -x "$bin" ] || { echo "no copy address or Litestream on this box, installed or sent: run a release first (it stops at the records disk, after sending them)" >&2; exit 1; }
set -a
. "$envf"
set +a
args=(-o "$mount/c-storage.db")
if [ "$at" != - ]; then args+=(-timestamp "$at"); fi
"$bin" restore "${args[@]}" "$COPY_URL"
[ -s "$mount/c-storage.db" ] || { echo "the restore wrote no file" >&2; exit 1; }
chmod 600 "$mount/c-storage.db"
echo "restored=$mount/c-storage.db"
REMOTE
}

# box_restore <time or -> <1 to put it onto the live file, else 0> <stamp> → restores the records from the copy
# on the box, with its role's credentials. By default to a new file beside the live one and nothing live touched;
# onto the live file, c-storage is stopped, the live file and its companions are moved aside (never deleted) and
# the restored one takes the live path. Prints restored=<the new file> or, onto the live file, aside=<stamp>.
box_restore() {
  box sudo bash -s -- "$RECORDS_MOUNT" "$1" "$2" "$3" "$BOX_LISTEN_ADDR" "$BOX_PORT" <<'REMOTE'
set -euo pipefail
mount=$1 at=$2 live=$3 stamp=$4 addr=$5 port=$6
db=$mount/c-storage.db
new=$mount/restored-$stamp.db
mountpoint -q "$mount" || { echo "the records disk is not mounted at $mount" >&2; exit 1; }
# The restore writes a second whole file onto the disk the live c-storage writes to: it must leave room, or the
# live saves fail. Under twice the live file (and its companions) free, nothing is written.
used=0
for f in "$db" "$db-wal"; do
  if [ -e "$f" ]; then used=$((used + $(du -sk "$f" | cut -f1))); fi
done
free=$(df -Pk "$mount" | awk 'NR==2{print $4}')
if [ "$free" -lt $((used * 2)) ]; then
  echo "the records disk has $((free / 1024)) MiB free, under twice the live file's $((used / 1024)) MiB: nothing was written" >&2
  exit 1
fi
set -a
. /etc/c-storage/copy.env
set +a
args=(-o "$new")
if [ "$at" != - ]; then args+=(-timestamp "$at"); fi
/opt/c-storage/litestream restore "${args[@]}" "$COPY_URL"
[ -s "$new" ] || { echo "the restore wrote no file" >&2; exit 1; }
chmod 600 "$new"
if [ -e "$db" ]; then chown --reference="$db" "$new"; fi
if [ "$live" = 1 ]; then
  systemctl stop c-storage
  for f in "$db" "$db-wal" "$db-shm" "$mount/.c-storage.db-litestream"; do
    if [ -e "$f" ]; then mv "$f" "$f.aside-$stamp"; fi
  done
  mv "$new" "$db"
  systemctl start c-storage
  for _ in $(seq 1 30); do
    if curl -fsS -m 2 -o /dev/null "http://$addr:$port/health"; then echo "answering=yes"; break; fi
    sleep 1
  done
  echo "aside=$stamp"
else
  echo "restored=$new"
fi
REMOTE
}

# floor_verdict: dies below the free disk, available memory or total swap the box needs to take a release
floor_verdict() {
  [ "$DISK_MB" -ge "$FLOOR_DISK_MB" ] || die "disk: $DISK_MB MiB free, below the floor of $FLOOR_DISK_MB"
  [ "$MEM_MB" -ge "$FLOOR_MEM_MB" ] || die "memory: $MEM_MB MiB available, below the floor of $FLOOR_MEM_MB"
  [ "$SWAP_MB" -ge "$FLOOR_SWAP_MB" ] || die "swap: $SWAP_MB MiB, below the floor of $FLOOR_SWAP_MB"
}

# box_floor: reads the box, then stops below the floor
box_floor() {
  box_resources
  floor_verdict
}

# keys_sum → the sha256 of the box's keys file, empty if it does not exist yet
keys_sum() {
  box 'sudo sha256sum /etc/c-storage/keys.env 2>/dev/null || true' | cut -d' ' -f1
}

# keys_unchanged <sum before> <sum after>: no release rewrites the keys. The first release makes
# them (nothing before, something after); any later one leaves the file as it was.
keys_unchanged() {
  if [ -z "$1" ] && [ -n "$2" ]; then return 0; fi
  [ -n "$2" ] && [ "$1" = "$2" ] || die "the keys file changed during the release (before: ${1:-none}, after: ${2:-none}): a release never rewrites it"
}

# read_keys: INTERNAL_KEY and ADMIN_KEY from the box's file, masked before anything is printed
INTERNAL_KEY=''
ADMIN_KEY=''
read_keys() {
  local kv
  kv=$(box sudo cat /etc/c-storage/keys.env)
  INTERNAL_KEY=$(sed -n 's/^INTERNAL_ACCESS_KEY=//p' <<<"$kv")
  ADMIN_KEY=$(sed -n 's/^X_SUPER_ADMIN_KEY=//p' <<<"$kv")
  [ -n "$INTERNAL_KEY" ] && [ -n "$ADMIN_KEY" ] || die "the box's keys file holds no keys"
  mask "$INTERNAL_KEY"
  mask "$ADMIN_KEY"
}

# random_hex → 32 random hex characters
random_hex() { head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# port_taken <port>: succeeds when anything listens on 127.0.0.1:<port>. A TCP connect, so a
# listener that speaks no HTTP counts too.
port_taken() {
  (exec 9<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# refuse_taken_port <port> <what to do>: dies when the port is taken, before anything is opened
refuse_taken_port() {
  if port_taken "$1"; then die "something already answers on 127.0.0.1:$1: $2"; fi
}

# require_ignored <path>: dies unless git ignores the path, since it will hold keys
require_ignored() {
  git -C "$REPO_DIR" check-ignore -q "$1" || die "git does not ignore ${1#"$REPO_DIR"/}: it would hold the keys"
}

# bruno_env_write <file> <local port> <service code> <access key>: the Bruno environment that points
# at the tunnel, with INTERNAL_KEY and ADMIN_KEY from read_keys. Refused unless git ignores the file.
# Written 0600 as a new file, and remembered in BRUNO_ENV_FILE once the ignore check has
# passed, so on_exit removes what this run wrote and a refused write removes nothing. (check.sh also clears its own
# file at the end, whatever wrote it, since each check rewrites it.)
BRUNO_ENV_FILE=''
bruno_env_write() {
  require_ignored "$1"
  BRUNO_ENV_FILE=$1
  rm -f "$1"
  (
    umask 077
    cat >"$1" <<YAML
variables:
  - name: baseUrl
    value: http://127.0.0.1:$2
  - name: internalAccessKey
    value: $INTERNAL_KEY
  - name: superAdminKey
    value: $ADMIN_KEY
  - name: serviceCode
    value: $3
  - name: accessKey
    value: $4
  - name: recordKey
    value: sample-record
YAML
  )
}

bruno_env_remove() {
  if [ -n "$BRUNO_ENV_FILE" ]; then rm -f "$BRUNO_ENV_FILE"; fi
  BRUNO_ENV_FILE=''
}

# health_main_read <local port>: reads /health through the port. HEALTH_BUILD is the commit it names;
# HEALTH_PROBLEM is empty only when that is a commit of origin/main. What runs, not what this run
# shipped: after a superseded release it is the newer commit, still one of main.
HEALTH_BUILD=''
HEALTH_PROBLEM=''
# shellcheck disable=SC2034 # check.sh and tunnel.sh read HEALTH_PROBLEM
health_main_read() {
  local body
  body=$(curl -fsS -m 5 "http://127.0.0.1:$1/health" || true)
  HEALTH_BUILD=$(build_of "$body")
  HEALTH_PROBLEM=''
  if [ -z "$HEALTH_BUILD" ] || [ "$HEALTH_BUILD" = dev ]; then
    HEALTH_PROBLEM="/health names no commit (answered: ${body:-nothing})"
  elif ! git -C "$REPO_DIR" merge-base --is-ancestor "$HEALTH_BUILD" origin/main 2>/dev/null; then
    HEALTH_PROBLEM="/health names $HEALTH_BUILD, which origin/main does not hold"
  fi
}

# superseded <env> <sha> <command that prints /health's body...>: succeeds, saying so, when the build
# <env> runs has <sha> as a strict ancestor: a release never moves an environment backwards. No
# answer, an unstamped build, the same commit, a commit this clone lacks and a commit that does not
# descend from <sha> all fail, and the release goes on.
superseded() {
  local env=$1 sha=$2 running
  shift 2
  running=$(build_of "$("$@" 2>/dev/null || true)")
  [ -n "$running" ] && [ "$running" != "$sha" ] || return 1
  git -C "$REPO_DIR" merge-base --is-ancestor "$sha" "$running" 2>/dev/null || return 1
  echo "superseded: $env runs $running"
}

# BRU_UNSET: the job's credentials, which bru must never hold: Bruno CLI runs third-party code (its
# npm dependencies). The OIDC variables are present in every step of a job that may mint a token.
BRU_UNSET=(-u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN -u ACTIONS_ID_TOKEN_REQUEST_TOKEN -u ACTIONS_ID_TOKEN_REQUEST_URL -u ACTIONS_RUNTIME_TOKEN)

# clean <command...>: the command without the job's credentials. Bruno CLI, pnpm's installs and
# builds and the scripts under scripts/ run third-party code (their npm dependencies) beside the role.
clean() {
  env "${BRU_UNSET[@]}" "$@"
}

# build_app <source folder> <commit>: the BFF's bundle and the UI's files, built in the folder, each
# stamped with the commit (CREDO_BUILD), which the Services status page reads back. The install is
# not stamped: it builds nothing of ours.
build_app() {
  (cd "$1" && clean pnpm install --frozen-lockfile && CREDO_BUILD=$2 clean pnpm --filter @credo/bff bundle && CREDO_BUILD=$2 clean pnpm --filter @credo/ui build)
}

# bru_clean <bru arguments...>: bru, without the job's credentials
bru_clean() {
  clean bru "$@"
}

# ridge_cli <arguments...>: scripts/src/ridge-main.ts, the product's own functions (register the BFF's
# service, make the operator, make a client) run against the c-storage the open tunnel reaches. The
# connection comes in the environment the caller sets for this command alone. RIDGE_SCRIPTS_DIR is
# the test's, which has no workspace of its own.
ridge_cli() {
  (cd "${RIDGE_SCRIPTS_DIR:-$REPO_DIR/scripts}" && clean node --import tsx src/ridge-main.ts "$@")
}

# build_of <body> → /health's buildVersion, empty if the body names none
build_of() {
  jq -r '.buildVersion // empty' <<<"$1" 2>/dev/null || true
}

# push_paths <ci.yml>: the paths ci.yml's push trigger deploys on, one a line, a trailing /** dropped.
#   Fails closed: under `paths:`, any line that is not `      - "<plain path>"` or
#   `      - "<plain path>/**"` (a blank line apart) dies naming the line, since a line read as
#   nothing would leave a path out of the comparison and let a seed run on older code.
push_paths() {
  local out
  out=$(awk '
    /^  push:$/ { on = 1; next }
    on && /^  [a-z_]+:$/ { exit }
    on && /^    paths:$/ { listed = 1; next }
    on && /^    paths/ { print "!" $0; bad = 1; exit }
    on && /^    [a-z_-]+:/ { listed = 0; next }
    on && listed && /^$/ { next }
    on && listed && /^      - "[A-Za-z0-9._\/-]+(\/\*\*)?"$/ { gsub(/^      - "|"$/, ""); sub(/\/\*\*$/, ""); print; next }
    on && listed { print "!" $0; bad = 1; exit }
    END { exit bad }
  ' "$1") || die "ci.yml's push trigger holds a line this script cannot read, so the paths a push deploys on are not known: nothing was written. The line: $(grep -m1 '^!' <<<"$out" | cut -c2-)"
  [ -n "$out" ] || die "found no paths under ci.yml's push trigger: nothing was written"
  printf '%s\n' "$out"
}

# wait_build <sha> <seconds> <command that prints /health's body...>: until /health names the
# commit, or the seconds run out (returns 1, saying what it answered)
wait_build() {
  local want=$1 secs=$2 t=0 body='' got=''
  shift 2
  while :; do
    body=$("$@" 2>/dev/null) || body=''
    got=$(build_of "$body")
    if [ "$got" = "$want" ]; then
      echo "/health names $want"
      return 0
    fi
    if [ "$t" -ge "$secs" ]; then break; fi
    sleep 1
    t=$((t + 1))
  done
  echo "/health answered ${body:-nothing}, wanted buildVersion $want"
  return 1
}

# --- layer four: the BFF, the UI's bucket and the distribution (docs/plans/2026-10-28-ridge-app.md) ---

BFF_NAME=''
BFF_GROUP=''
SUBNET_ID=''
UI_BUCKET=''
APP_ADDRESS=''
API_ADDRESS=''

# app_load: the layer-four outputs of STACK_JSON, masked before anything can print them. Fails when
# the stack does not hold layer four yet (the change set of the plan's step 15 is the human's), which
# makes app.sh and the check's new reads skip.
app_load() {
  BFF_NAME=$(out BffName)
  BFF_GROUP=$(out BffGroupId)
  SUBNET_ID=$(out SubnetId)
  UI_BUCKET=$(out UiBucketName)
  APP_ADDRESS=$(out AppAddress)
  API_ADDRESS=$(out ApiAddress)
  [ -n "$BFF_NAME" ] || return 1
  # Both addresses are public in nothing but the human's local log, and in no committed file: the
  # whole address and its host are masked, as well as the bare host the tools print.
  mask "$APP_ADDRESS"
  mask "$(sed -E 's#^https?://##; s#/.*$##' <<<"$APP_ADDRESS")"
  mask "$API_ADDRESS"
  mask "$(sed -E 's#^https?://##; s#/.*$##' <<<"$API_ADDRESS")"
  [ -n "$APP_ADDRESS" ] && [ -n "$UI_BUCKET" ] && [ -n "$SUBNET_ID" ] && [ -n "$BFF_GROUP" ] ||
    die "the stack names the BFF but not the rest of layer four (AppAddress, UiBucketName, SubnetId, BffGroupId)"
}

# bff_env_read: SERVICE_CODE and SERVICE_ACCESS_KEY from the box's bff.env, masked before anything
# is printed
SERVICE_CODE=''
SERVICE_ACCESS_KEY=''
bff_env_read() {
  local kv
  kv=$(box sudo cat /etc/c-storage/bff.env)
  SERVICE_CODE=$(sed -n 's/^SERVICE_CODE=//p' <<<"$kv")
  SERVICE_ACCESS_KEY=$(sed -n 's/^SERVICE_ACCESS_KEY=//p' <<<"$kv")
  [ -n "$SERVICE_CODE" ] && [ -n "$SERVICE_ACCESS_KEY" ] || die "the box's bff.env holds no service"
  mask "$SERVICE_ACCESS_KEY"
}

# box_rules_verdict <the box group's IpPermissions> <the endpoint's group ids, JSON> <BffGroup's id, or
# empty before layer four> <c-storage's port> <the activity log's writing port> → yes, or no. Ssh from a
# group of the endpoint, and with layer four c-storage's port and the activity log's writing port from
# BffGroup, each a single tcp port from one group: no address range, list or other group, no other port
# and no further rule. A ridge without the log's rule reads red: the stack run that adds it comes before
# the code that uses it, and a ridge that never had it, or lost it, must not read green. The port is
# required: without it nothing but ssh before layer four is accepted.
box_rules_verdict() {
  jq -r --argjson eg "$2" --arg bff "$3" --argjson port "$4" --argjson audit "${5:-null}" '
    if all(.[]; .IpProtocol == "tcp" and .FromPort == .ToPort and (.IpRanges | length) == 0
        and (.Ipv6Ranges | length) == 0 and (.PrefixListIds | length) == 0 and (.UserIdGroupPairs | length) == 1)
    then
      [.[] | {port: .FromPort, group: .UserIdGroupPairs[0].GroupId}] as $r
      | ($r | map(select(.port == 22))) as $ssh
      | ($r | map(select(.port != 22)) | sort_by(.port)) as $app
      | (if $bff == "" then [[]]
         elif $audit == null then []
         else [[{port: $port, group: $bff}, {port: $audit, group: $bff}] | sort_by(.port)] end) as $ok
      | if ($ssh | length) == 1 and ($eg | index($ssh[0].group) != null) and any($ok[]; . == $app)
        then "yes" else "no" end
    else "no" end' <<<"$1"
}

# bff_rules_verdict <BffGroup's IpPermissionsEgress> <its IpPermissions> <the box group's id> <port> <the activity
# log's writing port> → yes, or no: it sends to c-storage's port and to the activity log's port on the box's
# group, each a single rule to the box's group alone, nothing else, and admits nothing. A group with the
# store's rule alone reads red (see box_rules_verdict), and so does a call that names no log port.
bff_rules_verdict() {
  jq -r --argjson ingress "$2" --arg box "$3" --argjson port "$4" --argjson audit "${5:-null}" '
    def one($p): .IpProtocol == "tcp" and .FromPort == $p and .ToPort == $p
       and (.IpRanges | length) == 0 and (.Ipv6Ranges | length) == 0 and (.PrefixListIds | length) == 0
       and (.UserIdGroupPairs | length) == 1 and .UserIdGroupPairs[0].GroupId == $box;
    sort_by(.FromPort) as $r
    | if $ingress == [] and $audit != null
         and ($r | length) == 2 and ($r[0] | one([$port, $audit] | min)) and ($r[1] | one([$port, $audit] | max))
      then "yes" else "no" end' <<<"$1"
}

# audit_fact <facts> <name> → the value a line "name=value" of the box's facts holds
audit_fact() { sed -n "s/^$2=//p" <<<"$1"; }

# audit_problems <the log's facts, read on the box> <the box's private address> <the log's writing port> <its reading
# port> <the commit /health must name> → one problem a line, none when the log is sound: the unit active, the writing
# listener on the box's private address alone, the reading one on loopback alone, the key file 600 root, the data
# folder 700 and its files 600, and /health naming the commit. No address is printed, and no key is on the box's lines.
audit_problems() {
  local f=$1 addr=$2 w=$3 r=$4 want=$5 got
  [ "$(audit_fact "$f" unit)" = active ] || echo "the activity log's unit is '$(audit_fact "$f" unit)', not active"
  [ "$(audit_fact "$f" listen_w)" = "$addr:$w " ] || echo "the activity log's writing listener is not the box's private address alone"
  [ "$(audit_fact "$f" listen_r)" = "127.0.0.1:$r " ] || echo "the activity log's reading listener is not loopback alone"
  [ "$(audit_fact "$f" keys)" = "600 root" ] || echo "the activity log's key file is '$(audit_fact "$f" keys)', not '600 root'"
  [ "$(audit_fact "$f" dir)" = 700 ] || echo "the activity log's data folder is mode '$(audit_fact "$f" dir)', not 700"
  [ "$(audit_fact "$f" files)" = "600 " ] || echo "the activity log's database files are mode '$(audit_fact "$f" files)', not '600 '"
  got=$(build_of "$(audit_fact "$f" health)")
  [ "$got" = "$want" ] || echo "the activity log's /health names '${got:-nothing}', not $want"
}

# audit_memory_line <facts> → each program's resident memory beside the box's, in MiB; a figure the box did not give
# (systemd's accounting off) is said as not read, never as zero
audit_memory_line() {
  local one name v out=''
  for name in c-storage audit-backbone; do
    v=$(audit_fact "$1" "mem_$name")
    case $v in
      '' | *[!0-9]*) one="$name not read" ;;
      *) one="$name $((v / 1048576)) MiB" ;;
    esac
    out="$out$one; "
  done
  printf '%s' "${out%; }"
}

# audit_entry_problems <the box's lines from its read of one record's entries> → one problem a line, none when the
# record holds exactly one customer.create entry, read with a token minted on the box, and no entry holds the write key;
# when no token was minted nothing was read, and that is the one problem named
audit_entry_problems() {
  local f=$1
  # no token, no read: the box prints minted=no alone, and a count or a leak claimed from nothing would be false
  if [ "$(audit_fact "$f" minted)" != yes ]; then
    echo "the box could not mint a read token for the check's client"
    return 0
  fi
  [ "$(audit_fact "$f" created)" = 1 ] || echo "the customer's record holds '$(audit_fact "$f" created)' customer.create entries in the activity log, not 1"
  [ "$(audit_fact "$f" leak)" = 0 ] || echo "an entry read from the activity log holds the write key ('$(audit_fact "$f" leak)')"
}

# BFF_FN_QUERY: the only fields of the function's configuration the check reads, as --query. The
# configuration's Environment.Variables hold the BFF's two access keys, so no read takes it whole: the
# names come as a list and the two values the check compares are the non-secret ones (APP_ORIGIN,
# C_STORAGE_URL). No key value reaches the shell, the here-strings below, or a temp file, on any environment.
# shellcheck disable=SC2034,SC2016 # check.sh reads it; the backticks are JMESPath's literal, not a substitution
BFF_FN_QUERY='{VpcConfig: VpcConfig, Description: Description, Names: keys(Environment.Variables || `{}`), AppOrigin: Environment.Variables.APP_ORIGIN, Url: Environment.Variables.C_STORAGE_URL}'

# function_network_verdict <the function, read by BFF_FN_QUERY> <subnet> <group> → yes, or no: in ridge's
# subnet, under the BFF's group alone
function_network_verdict() {
  jq -r --arg s "$2" --arg g "$3" \
    'if .VpcConfig.SubnetIds == [$s] and .VpcConfig.SecurityGroupIds == [$g] then "yes" else "no" end' <<<"$1"
}

# BFF_ENV_NAMES: the seven variables the function holds, sorted, and no other (never the super-admin key)
# shellcheck disable=SC2034 # check.sh reads it
BFF_ENV_NAMES=APP_ORIGIN,AUDIT_KEY,AUDIT_URL,C_STORAGE_URL,INTERNAL_ACCESS_KEY,SERVICE_ACCESS_KEY,SERVICE_CODE
# function_env_names <the function, read by BFF_FN_QUERY> → the names of its variables, sorted and
# comma-joined; no value is in what it reads
function_env_names() {
  jq -r '(.Names // []) | sort | join(",")' <<<"$1"
}

# function_origin_verdict <the function, read by BFF_FN_QUERY> <the app's address> → yes, or no: the
# function's APP_ORIGIN is the app's address with no trailing slash, the name its passkeys are bound to
function_origin_verdict() {
  jq -r --arg a "${2%/}" 'if (.AppOrigin // "") == $a and $a != "" then "yes" else "no" end' <<<"$1"
}

# function_url <the function, read by BFF_FN_QUERY> → its C_STORAGE_URL, empty when it holds none
function_url() {
  jq -r '.Url // empty' <<<"$1"
}

# bucket_verdict <get-public-access-block's body> <get-bucket-policy's body> → yes, or no: all four
# blocks on, and one statement, an allow of s3:GetObject to CloudFront's service under a condition on
# the distribution's source ARN (the id is not readable by the deploy role, which holds no CloudFront right)
bucket_verdict() {
  local policy
  policy=$(jq -r '.Policy // empty' <<<"$2" 2>/dev/null) || policy=''
  [ -n "$policy" ] || { echo no; return 0; }
  jq -rn --argjson b "$1" --argjson p "$policy" '
    if ($b.PublicAccessBlockConfiguration == {BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true})
       and ($p.Statement | length) == 1
       and ($p.Statement[0] | .Effect == "Allow" and .Principal == {Service: "cloudfront.amazonaws.com"} and .Action == "s3:GetObject"
            and ((.Condition // {}) | keys == ["StringEquals"]) and (.Condition.StringEquals | keys == ["AWS:SourceArn"])
            and (.Condition.StringEquals["AWS:SourceArn"] | test("^arn:aws[a-z-]*:cloudfront::[0-9]+:distribution/[A-Z0-9]+$")))
    then "yes" else "no" end'
}

# commits_agree <health's commit> <the function's description> <index.html's commit> → yes, or no: one
# commit, in all three places
commits_agree() {
  if [ -n "$1" ] && [ "$1" = "$2" ] && [ "$1" = "$3" ]; then echo yes; else echo no; fi
}

# meta_commit <response headers, lower-cased> → the commit index.html's metadata names: CloudFront passes
# S3's x-amz-meta-* headers on, and app.sh puts the commit in `commit`
meta_commit() {
  sed -n 's/^x-amz-meta-commit: //p' <<<"$1"
}

# lambda_wait <function> <seconds>: until the last update of the function is Successful. Polls
# GetFunctionConfiguration, which the deploy role holds; `aws lambda wait` reads GetFunction, which it does not.
lambda_wait() {
  local t=0 status reason
  while :; do
    status=$(aws lambda get-function-configuration --function-name "$1" --query LastUpdateStatus --output text)
    case "$status" in
      Successful) return 0 ;;
      Failed)
        reason=$(aws lambda get-function-configuration --function-name "$1" --query LastUpdateStatusReason --output text)
        die "the function's update failed: $reason"
        ;;
    esac
    [ "$t" -lt "$2" ] || die "the function's update is still '$status' after $2 s"
    sleep 2
    t=$((t + 2))
  done
}

# --- through CloudFront, as a browser reaches it ---

EDGE_BASE=''
EDGE_STATUS=''
EDGE_BODY=''
EDGE_HEADERS=''
# edge <method> <path> [<curl argument>...]: one call through the app's address. The status, the
# body and the headers are kept in EDGE_*; curl's own words (which name the address) are never printed.
edge() {
  local method=$1 path=$2
  shift 2
  mkwork
  EDGE_STATUS=$(curl -sS -m 30 -X "$method" -D "$WORK/edge.headers" -o "$WORK/edge.body" -w '%{http_code}' \
    "$@" "$EDGE_BASE$path" 2>/dev/null) || EDGE_STATUS=000
  EDGE_BODY=$(cat "$WORK/edge.body" 2>/dev/null || true)
  EDGE_HEADERS=$(tr -d '\r' <"$WORK/edge.headers" 2>/dev/null | tr '[:upper:]' '[:lower:]' || true)
}

# edge_reads_open <base address>: the six reads through the app's address that need no client and write
# nothing, each a red when it fails: /health is the app's page, an unknown code and a missing one, the
# operator's door without a session, the sign-in options' relying party and /api/health. None writes: the
# options' challenge is signed, not stored. The BFF answers the five behind /api/*; a cache would answer
# them from CloudFront.
edge_reads_open() {
  EDGE_BASE=$1
  edge GET /health
  expect "/health is the app's page, never c-storage's body" "200 no" "$EDGE_STATUS $(grep -q buildVersion <<<"$EDGE_BODY" && echo yes || echo no)"
  edge GET /api/config -H 'x-client-code: check-no-such-client'
  expect "a code we do not know is the BFF's 404 (not the app's page)" 404 "$EDGE_STATUS"
  edge GET /api/config
  expect "a missing code is a 400" 400 "$EDGE_STATUS"
  edge GET /api/operator/me
  expect "the operator's door without a session is a 401" 401 "$EDGE_STATUS"
  edge POST /api/operator/passkey/options
  # yes or no, so the log never holds the app's host, which the deploy masks like a key
  expect "the sign-in options' relying party is the app's host, never the request's" "200 yes" \
    "$EDGE_STATUS $([ "$(jq -r '.options.rpId // empty' <<<"$EDGE_BODY" 2>/dev/null)" = "$(sed -E 's#^https?://##; s#[:/].*$##' <<<"$1")" ] && echo yes || echo no)"
  edge GET /api/health
  expect "/api/health is the BFF's 404 and carries no build" "404 no" "$EDGE_STATUS $(grep -q buildVersion <<<"$EDGE_BODY" && echo yes || echo no)"
}

# edge_reads_client <base address> <a client code> <its root's password> <the company's name>: the reads that
# need a client of the check's own, which write (a sign-in is a session): the app's page at its link,
# /api/config with no cache in front, the root signing in, being known, signing out and refused after. The
# password goes to the BFF on curl's stdin, never on a command line.
edge_reads_client() {
  local base=$1 code=$2 pass=$3 name=$4 device auth timed
  EDGE_BASE=$base
  device=check-$(random_hex)
  edge GET "/login?client-code=$code"
  expect "the app's page at the client's link" "200 yes" "$EDGE_STATUS $(grep -q '<div id="root">' <<<"$EDGE_BODY" && echo yes || echo no)"
  edge GET /api/config -H "x-client-code: $code"
  expect "/api/config reaches the BFF, which reads c-storage for the client's name" "200 $name" "$EDGE_STATUS $(jq -r '.config.name // empty' <<<"$EDGE_BODY" 2>/dev/null)"
  expect "  with no cache in front of /api/*" "no" "$(grep -qE '^(age:|x-cache: hit)' <<<"$EDGE_HEADERS" && echo yes || echo no)"
  edge GET /api/config -H "x-client-code: $code"
  expect "  a second read, too" "no" "$(grep -qE '^(age:|x-cache: hit)' <<<"$EDGE_HEADERS" && echo yes || echo no)"
  timed=$(date +%s)
  edge POST /api/auth/sign-in -H "x-client-code: $code" -H "x-device-id: $device" -H 'content-type: application/json' --data-binary @- <<<"$(P=$pass jq -nc '{name: "root", password: env.P}')"
  expect "the root signs in through the edge" 200 "$EDGE_STATUS"
  echo "sign-in took $(($(date +%s) - timed)) s"
  auth=$(jq -r '.authId // empty' <<<"$EDGE_BODY" 2>/dev/null)
  mask "$auth"
  edge GET /api/auth/me -H "x-client-code: $code" -H "x-auth-id: $auth"
  expect "  and is known by its handle" "200 root" "$EDGE_STATUS $(jq -r '.user.name // empty' <<<"$EDGE_BODY" 2>/dev/null)"
  # With EDGE_ADD_CUSTOMER set (check.sh, never the stand-in cases of the reads), the root adds one customer, a change
  # the back end enters in the activity log; its id is EDGE_RECORD for the box's read of that entry.
  EDGE_RECORD=''
  if [ -n "${EDGE_ADD_CUSTOMER:-}" ]; then
    edge POST /api/customers -H "x-client-code: $code" -H "x-auth-id: $auth" -H 'content-type: application/json' \
      --data-binary '{"code":"CHK-1","name":"Check customer","extra":{}}'
    EDGE_RECORD=$(jq -r '.customer.id // empty' <<<"$EDGE_BODY" 2>/dev/null || true)
    expect "  adds one customer through the edge" "200 yes" "$EDGE_STATUS $([ -n "$EDGE_RECORD" ] && echo yes || echo no)"
  fi
  edge POST /api/auth/sign-out -H "x-client-code: $code" -H "x-auth-id: $auth"
  expect "  signs out" 204 "$EDGE_STATUS"
  edge GET /api/auth/me -H "x-client-code: $code" -H "x-auth-id: $auth"
  expect "  and the handle is refused after" 401 "$EDGE_STATUS"
}

# edge_reads <base address> <a client code> <its root's password> <the company's name>: ridge as a
# partner reaches it: the reads that need the check's client, then the six that need none.
edge_reads() {
  edge_reads_client "$@"
  edge_reads_open "$1"
}

# workflows_of <env>: the workflow files (basenames, sorted) in .github/workflows whose jobs name
# `environment: <env>`, the only ones that reach that environment. Read from the files here.
workflows_of() {
  local dir=$REPO_DIR/.github/workflows f odd
  [ -d "$dir" ] || return 0
  # Fails closed, as push_paths does: only the plain line `environment: <name>` is read. GitHub also takes a
  # mapping (`environment:` then `name:`), a quoted name and a trailing comment, and a workflow in one of
  # those shapes would be missed and stay on through a destroy, so any other `environment:` line stops here.
  for f in "$dir"/*.yml "$dir"/*.yaml; do
    [ -f "$f" ] || continue
    odd=$(grep -nE '^[[:space:]]*environment:' "$f" | grep -vE '^[0-9]+:[[:space:]]*environment:[[:space:]]+[A-Za-z0-9_-]+[[:space:]]*$' | head -n 1 || true)
    [ -z "$odd" ] || die "$(basename "$f") has an environment: line that is not the plain form 'environment: <name>' (line $odd), so which environment the workflow reaches is not known and it might stay on through a destroy: nothing was changed"
  done
  for f in "$dir"/*.yml "$dir"/*.yaml; do
    [ -f "$f" ] || continue
    if grep -qE "^[[:space:]]*environment:[[:space:]]*$1[[:space:]]*\$" "$f"; then basename "$f"; fi
  done | sort
}
