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

# on_exit: removes the Bruno environment this run wrote, closes the tunnel, lets the log catch up, searches it for the keys, removes the scratch
# folder, then ends the log
on_exit() {
  local rc=$?
  trap - EXIT
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
    local s leaked=0
    while IFS= read -r s; do
      if [ -n "$s" ] && grep -qF -- "$s" "$LOG"; then leaked=1; fi
    done <<<"$SECRETS"
    if [ "$leaked" = 1 ]; then
      final "RED  a key is in this log: delete it and replace the key (docs/plans/2026-10-28-ridge.md#deploys-from-github-actions)"
      rc=1
    else
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

# mask <value>: GitHub's log mask, written past the log file so the log never holds the value.
# Remembers the value for the end-of-run search. fd 3 is the terminal and tee writes the same pipe
# from another process, so the command opens with a newline: it can then never land mid-line, where
# GitHub would not read it and the value would print.
mask() {
  if [ -z "$1" ]; then return 0; fi
  if [ "${GITHUB_ACTIONS:-}" = true ]; then printf '\n::add-mask::%s\n' "$1" >&3; fi
  SECRETS="${SECRETS}$1"$'\n'
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
# The address on the box that a forward reaches c-storage at: the one home of it, read by box_open for
# check.sh and tunnel.sh. It moves with open item 7 (c-storage off loopback), not before.
BOX_LISTEN_ADDR=127.0.0.1
box_ready=0

# box_open <env> [<local port>]: mints a key for this run, pushes it through Instance Connect (it
# holds 60 s), and opens one connection through the endpoint that every box call then rides. With
# a local port, that port forwards to c-storage's loopback port on the box. Returns non-zero when
# the box does not answer, so a reboot's wait can try again.
box_open() {
  local zone
  mkwork
  stack_load "$1"
  [ -n "$STACK_JSON" ] || die "stack $1 does not exist: ops/stack.sh env $1"
  BOX_ID=$(out BoxId)
  zone=$(out Zone)
  [ -n "$BOX_ID" ] || die "stack $1 names no box"
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
# Written 0600 as a new file, and remembered in BRUNO_ENV_FILE so on_exit removes it, and removes
# nothing a refused run did not write.
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

# bru_clean <bru arguments...>: bru, without the job's credentials
bru_clean() {
  env "${BRU_UNSET[@]}" bru "$@"
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
