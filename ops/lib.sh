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

# ops_match_main: dies unless ops/ in the working copy (tracked and untracked files) is as reviewed.
#   By hand: equal to origin/main's.
#   In the deploy job (GITHUB_ACTIONS=true): equal to the commit checked out, which must be a commit
#   of origin/main. A push that lands during the run moves origin/main on, and the job still runs
#   what it checked out; comparing with the moved ref would turn a sound deploy red.
ops_match_main() {
  local base=origin/main whose="origin/main's"
  git -C "$REPO_DIR" rev-parse --verify -q origin/main >/dev/null || die "origin/main is unknown here: git fetch origin main"
  if [ "${GITHUB_ACTIONS:-}" = true ]; then
    git -C "$REPO_DIR" merge-base --is-ancestor HEAD origin/main || die "the commit checked out is not a commit of main: only main is released"
    base=HEAD
    whose="this commit's"
  fi
  if ! git -C "$REPO_DIR" diff --quiet "$base" -- ops ||
    [ -n "$(git -C "$REPO_DIR" ls-files --others --exclude-standard -- ops)" ]; then
    die "ops/ here differs from $whose: run the scripts from a worktree at main, never unreviewed ones"
  fi
  ok "ops/ is $whose"
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
OUTPUTS_PRINTED='["Env","Repository","BoxId","BoxGroupId","SubnetId","SubnetCidr","Zone","VpcId","VpcCidr","RoutesId","EndpointId","EndpointGroupId","ProviderArn","BffName","BffGroupId","UiBucketName","AppAddress"]'

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
    ROLLBACK_COMPLETE) die "the stack is in ROLLBACK_COMPLETE: delete the stack (console or aws cloudformation delete-stack), then run this again" ;;
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

# box_resources → MEM_MB (available), SWAP_MB (total) and DISK_MB (free on /), logged
MEM_MB=0
SWAP_MB=0
DISK_MB=0
box_resources() {
  local r
  r=$(
    box bash -s <<'REMOTE'
awk '/^MemAvailable:/{m=int($2/1024)} /^SwapTotal:/{s=int($2/1024)} END{printf "%d %d ", m, s}' /proc/meminfo
df -Pm / | awk 'NR==2{print $4}'
REMOTE
  )
  read -r MEM_MB SWAP_MB DISK_MB <<<"$r"
  echo "box: memory $MEM_MB MiB available, swap $SWAP_MB MiB, disk $DISK_MB MiB free"
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
# empty before layer four> <c-storage's port> → yes, or no. Ssh from a group of the endpoint, and with
# layer four c-storage's port from BffGroup alone, each a single tcp port from one group: no address
# range, list or other group, and no third rule.
box_rules_verdict() {
  jq -r --argjson eg "$2" --arg bff "$3" --argjson port "$4" '
    if all(.[]; .IpProtocol == "tcp" and .FromPort == .ToPort and (.IpRanges | length) == 0
        and (.Ipv6Ranges | length) == 0 and (.PrefixListIds | length) == 0 and (.UserIdGroupPairs | length) == 1)
    then
      [.[] | {port: .FromPort, group: .UserIdGroupPairs[0].GroupId}] as $r
      | ($r | map(select(.port == 22))) as $ssh
      | ($r | map(select(.port != 22))) as $app
      | if ($ssh | length) == 1 and ($eg | index($ssh[0].group) != null)
           and $app == (if $bff == "" then [] else [{port: $port, group: $bff}] end)
        then "yes" else "no" end
    else "no" end' <<<"$1"
}

# bff_rules_verdict <BffGroup's IpPermissionsEgress> <its IpPermissions> <the box group's id> <port> →
# yes, or no: it sends to c-storage's port on the box's group, one rule and nowhere else, and admits nothing
bff_rules_verdict() {
  jq -r --argjson ingress "$2" --arg box "$3" --argjson port "$4" '
    if $ingress == [] and length == 1 and .[0].IpProtocol == "tcp" and .[0].FromPort == $port and .[0].ToPort == $port
       and (.[0].IpRanges | length) == 0 and (.[0].Ipv6Ranges | length) == 0 and (.[0].PrefixListIds | length) == 0
       and (.[0].UserIdGroupPairs | length) == 1 and .[0].UserIdGroupPairs[0].GroupId == $box
    then "yes" else "no" end' <<<"$1"
}

# function_network_verdict <get-function-configuration> <subnet> <group> → yes, or no: in ridge's
# subnet, under the BFF's group alone
function_network_verdict() {
  jq -r --arg s "$2" --arg g "$3" \
    'if .VpcConfig.SubnetIds == [$s] and .VpcConfig.SecurityGroupIds == [$g] then "yes" else "no" end' <<<"$1"
}

# BFF_ENV_NAMES: the four variables the function holds, sorted, and no other (never the super-admin key)
# shellcheck disable=SC2034 # check.sh reads it
BFF_ENV_NAMES=C_STORAGE_URL,INTERNAL_ACCESS_KEY,SERVICE_ACCESS_KEY,SERVICE_CODE
# function_env_names <get-function-configuration> → the names of its variables, sorted and comma-joined;
# values are never read here
function_env_names() {
  jq -r '(.Environment.Variables // {}) | keys | join(",")' <<<"$1"
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

# edge_reads <base address> <a client code> <its root's password> <the company's name>: ridge as a
# partner reaches it, each a red when it fails. The password goes to the BFF on curl's stdin, never
# on a command line. The unknown code, the missing code and the operator's door without a session are
# answered by the BFF behind /api/*; a cache would answer them from CloudFront.
edge_reads() {
  local base=$1 code=$2 pass=$3 name=$4 device auth timed
  EDGE_BASE=$base
  device=check-$(random_hex)
  edge GET "/login?client-code=$code"
  expect "the app's page at the client's link" "200 yes" "$EDGE_STATUS $(grep -q '<div id="root">' <<<"$EDGE_BODY" && echo yes || echo no)"
  edge GET /health
  expect "/health is the app's page, never c-storage's body" "200 no" "$EDGE_STATUS $(grep -q buildVersion <<<"$EDGE_BODY" && echo yes || echo no)"
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
  edge POST /api/auth/sign-out -H "x-client-code: $code" -H "x-auth-id: $auth"
  expect "  signs out" 204 "$EDGE_STATUS"
  edge GET /api/auth/me -H "x-client-code: $code" -H "x-auth-id: $auth"
  expect "  and the handle is refused after" 401 "$EDGE_STATUS"
  edge GET /api/config -H 'x-client-code: check-no-such-client'
  expect "a code we do not know is the BFF's 404 (not the app's page)" 404 "$EDGE_STATUS"
  edge GET /api/config
  expect "a missing code is a 400" 400 "$EDGE_STATUS"
  edge GET /api/operator/me
  expect "the operator's door without a session is a 401" 401 "$EDGE_STATUS"
  edge GET /api/health
  expect "/api/health is the BFF's 404 and carries no build" "404 no" "$EDGE_STATUS $(grep -q buildVersion <<<"$EDGE_BODY" && echo yes || echo no)"
}
