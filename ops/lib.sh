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
# A release stops below these free amounts on the box (MiB).
FLOOR_DISK_MB=1024
FLOOR_MEM_MB=96

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
# in the credo root, the folder that holds .bare, derived from git. The log ends on == exit <n>.
# A named pipe feeds tee, since the sandbox the machine works in refuses process substitution.
TEE_PID=''
log_start() {
  local root
  root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
  mkdir -p "$root/logs"
  LOG="$root/logs/$(date +%Y-%m-%d-%H%M%S)-$1-${2:-all}.log"
  mkwork
  mkfifo "$WORK/log.fifo"
  exec 3>&1
  tee -a "$LOG" <"$WORK/log.fifo" &
  TEE_PID=$!
  exec >"$WORK/log.fifo" 2>&1
  trap on_exit EXIT
  echo "== $1 ${2:-} started $(date '+%Y-%m-%d %H:%M:%S %z')"
}

# final <text>: a line after the pipe is closed, to the terminal and the log
final() { echo "$*" | tee -a "$LOG"; }

# on_exit: closes the tunnel, lets the log catch up, searches it for the keys, removes the scratch
# folder, then ends the log
on_exit() {
  local rc=$?
  trap - EXIT
  if declare -F cleanup_extra >/dev/null; then cleanup_extra || true; fi
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
# Remembers the value for the end-of-run search.
mask() {
  if [ -z "$1" ]; then return 0; fi
  if [ "${GITHUB_ACTIONS:-}" = true ]; then echo "::add-mask::$1" >&3; fi
  SECRETS="${SECRETS}$1"$'\n'
}

# repository → owner/name, from the origin remote; never written in a committed file
repository() {
  git -C "$REPO_DIR" remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##'
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
  local fwd=()
  if [ -n "${2:-}" ]; then fwd=(-L "127.0.0.1:$2:127.0.0.1:$BOX_PORT"); fi
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

# box_floor: stops below the free disk and memory the box needs to take a release
box_floor() {
  box_resources
  [ "$DISK_MB" -ge "$FLOOR_DISK_MB" ] || die "disk: $DISK_MB MiB free, below the floor of $FLOOR_DISK_MB"
  [ "$MEM_MB" -ge "$FLOOR_MEM_MB" ] || die "memory: $MEM_MB MiB available, below the floor of $FLOOR_MEM_MB"
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
