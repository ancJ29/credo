#!/usr/bin/env bash
# The ops job's guards, run with no AWS, each on hand-written input: the change-set filter, the
# choice between creating and updating a stack, an update's refusal to move the repository, the
# check that ops/ is main's (by hand, and in the deploy job), the box's floor, the keys' checksum, wait_build's retry, the proof of a
# Bruno run, the credentials bru never holds, the log's exit code after a signal, the workflow's
# deploy job, and the release's checks of /health against the real c-storage binary, built here with
# several stamps and without one (it needs Go): the build it waits for, and the newer build it must
# never overwrite.
# Expected length: about 40 seconds with a cold Go cache, about 20 with a warm one.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

fail=0
check() { # name wanted got
  if [ "$2" = "$3" ]; then echo "  ok   $1"; else echo "  FAIL $1: wanted '$2', got '$3'"; fail=1; fi
}
# refuses <name> <text the refusal names> <command...>: the command, in a subshell, dies naming the text
refuses() {
  local name=$1 text=$2 out rc=0
  shift 2
  out=$( ("$@") 2>&1 ) || rc=$?
  if [ "$rc" = 1 ] && grep -qF -- "$text" <<<"$out"; then
    echo "  ok   $name"
  else
    echo "  FAIL $name: wanted a refusal naming '$text', got exit $rc: $out"
    fail=1
  fi
}
# passes <name> <command...>: the command, in a subshell, succeeds
passes() {
  local name=$1 out rc=0
  shift
  out=$( ("$@") 2>&1 ) || rc=$?
  if [ "$rc" = 0 ]; then echo "  ok   $name"; else echo "  FAIL $name: exit $rc: $out"; fail=1; fi
}

WORK=$(mktemp -d "${TMPDIR:-/tmp}/credo-ops-test.XXXXXX")
PID=''
trap '[ -z "$PID" ] || kill "$PID" 2>/dev/null || true; rm -rf "$WORK"' EXIT

echo "== the change-set filter (stack.sh refuses what it names)"
filter() { # change set, then the ids taken on purpose as JSON
  jq -r --argjson take "$2" -f "$OPS_DIR/unsafe-changes.jq" "$OPS_DIR/testdata/$1"
}
check "a change set that adds and modifies in place passes" "" "$(filter changeset-adds.json '[]')"
check "a replaced box and a removed group are both named" \
  "Box (AWS::EC2::Instance): Modify, replacement True
OldGroup (AWS::EC2::SecurityGroup): Remove, replacement none" \
  "$(filter changeset-replaces.json '[]')"
check "a replacement named on purpose is taken, the removal still refused" \
  "OldGroup (AWS::EC2::SecurityGroup): Remove, replacement none" \
  "$(filter changeset-replaces.json '["Box"]')"
check "a replacement that may happen (Conditional) is named" \
  "Box (AWS::EC2::Instance): Modify, replacement Conditional" \
  "$(filter changeset-conditional.json '[]')"
check "a change CloudFormation cannot foresee (Dynamic) is named" \
  "Hook (AWS::CloudFormation::CustomResource): Dynamic, replacement none" \
  "$(filter changeset-dynamic.json '[]')"

echo "== create or update (stack.sh, from the stack's status)"
change_type() { # a describe-stacks body, or nothing
  STACK_JSON=$1
  choose_change_type
  echo "$CS_TYPE"
}
described() { # <status> [<Repository>]
  jq -nc --arg s "$1" --arg r "${2:-}" \
    '{Stacks: [{StackName: "ridge", StackStatus: $s, Parameters: (if $r == "" then [] else [{ParameterKey: "Repository", ParameterValue: $r}] end)}]}'
}
check "no stack is a creation" CREATE "$(change_type '')"
check "a stack that holds only a change set (REVIEW_IN_PROGRESS) is a creation" CREATE "$(change_type "$(described REVIEW_IN_PROGRESS)")"
check "a made stack (CREATE_COMPLETE) is an update" UPDATE "$(change_type "$(described CREATE_COMPLETE)")"
check "an updated stack (UPDATE_COMPLETE) is an update" UPDATE "$(change_type "$(described UPDATE_COMPLETE)")"
refuses "a rolled-back stack is not touched: delete the stack" "delete the stack" change_type "$(described ROLLBACK_COMPLETE)"

echo "== an update never moves the deploy role's repository"
STACK_JSON=$(described UPDATE_COMPLETE owner/name)
check "the stack's Repository is read" owner/name "$(stack_param Repository)"
passes "the same repository passes" repository_matches_stack owner/name
refuses "a fork's clone is refused" "stack's Repository is owner/name" repository_matches_stack fork/name
STACK_JSON=$(described UPDATE_COMPLETE)
passes "a stack with no Repository yet passes" repository_matches_stack fork/name
STACK_JSON=''

echo "== ops/ is origin/main's (release, check, drill and stack run only reviewed scripts); in the deploy job, the checked-out commit's"
git_repo() { git -C "$WORK/repo" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false "$@"; }
mkdir -p "$WORK/repo/ops"
git -C "$WORK/repo" init -q
echo 'echo reviewed' >"$WORK/repo/ops/a.sh"
git_repo add ops/a.sh
git_repo commit -q -m main
old_sha=$(git_repo rev-parse HEAD)
git_repo update-ref refs/remotes/origin/main HEAD
# GITHUB_ACTIONS is set to nothing in the by-hand case: this suite runs in GitHub's own job too.
at_repo() { GITHUB_ACTIONS='' REPO_DIR=$WORK/repo ops_match_main; }
at_repo_job() { GITHUB_ACTIONS=true REPO_DIR=$WORK/repo ops_match_main; }
passes "a clean ops/ passes" at_repo
passes "  and in the job" at_repo_job
echo 'echo edited' >"$WORK/repo/ops/a.sh"
refuses "an edited script is refused" "ops/ here differs from origin/main's" at_repo
refuses "  and in the job, against its own commit" "ops/ here differs from this commit's" at_repo_job
git_repo checkout -q -- ops/a.sh
echo 'echo new' >"$WORK/repo/ops/b.sh"
refuses "a new script is refused" "ops/ here differs from origin/main's" at_repo
refuses "  and in the job" "ops/ here differs from this commit's" at_repo_job
rm "$WORK/repo/ops/b.sh"
git_repo update-ref -d refs/remotes/origin/main
refuses "an unknown origin/main is refused" "origin/main is unknown" at_repo
# A push lands during the deploy: origin/main moves on to a commit that changes ops/, and the job
# still holds the commit it checked out.
echo 'echo pushed meanwhile' >"$WORK/repo/ops/a.sh"
git_repo commit -q -am newer
new_sha=$(git_repo rev-parse HEAD)
git_repo update-ref refs/remotes/origin/main "$new_sha"
git_repo checkout -q --detach "$old_sha"
refuses "by hand, a clone behind main's ops/ is refused" "ops/ here differs from origin/main's" at_repo
passes "in the job, a push that landed meanwhile does not turn a sound deploy red" at_repo_job
git_repo checkout -q -b side "$old_sha"
git_repo commit -q --allow-empty -m side
side_sha=$(git_repo rev-parse HEAD)
refuses "in the job, a commit that main does not hold is refused" "not a commit of main" at_repo_job
git_repo checkout -q --detach "$new_sha"

echo "== mask writes its line whole (tee writes the same pipe, so it opens with a newline)"
(GITHUB_ACTIONS=true mask thekey 3>"$WORK/fd3")
check "the mask line opens with a newline" 1 "$(head -n 1 "$WORK/fd3" | wc -c | tr -d ' ')"
check "  and the next line is the mask" "::add-mask::thekey" "$(sed -n 2p "$WORK/fd3")"
(GITHUB_ACTIONS='' mask thekey 3>"$WORK/fd3")
check "by hand it writes nothing" 0 "$(wc -c <"$WORK/fd3" | tr -d ' ')"

echo "== bru gets none of the job's credentials (Bruno CLI's npm dependencies run beside the role)"
mkdir "$WORK/fakebin"
printf '#!/bin/sh\nenv\n' >"$WORK/fakebin/bru"
chmod +x "$WORK/fakebin/bru"
seen=$(AWS_ACCESS_KEY_ID=a AWS_SECRET_ACCESS_KEY=b AWS_SESSION_TOKEN=c ACTIONS_ID_TOKEN_REQUEST_TOKEN=d \
  ACTIONS_ID_TOKEN_REQUEST_URL=e ACTIONS_RUNTIME_TOKEN=f KEEP=yes PATH="$WORK/fakebin:$PATH" bru_clean --version)
check "none of the job's credentials reaches bru" 0 "$(grep -cE '^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|ACTIONS_ID_TOKEN_REQUEST_TOKEN|ACTIONS_ID_TOKEN_REQUEST_URL|ACTIONS_RUNTIME_TOKEN)=' <<<"$seen" || true)"
check "  and the rest of the environment does" 1 "$(grep -c '^KEEP=yes$' <<<"$seen" || true)"
check "check.sh runs bru only through bru_clean" 0 "$(grep -cE '(&& |\$\()bru ' "$OPS_DIR/check.sh" || true)"

echo "== the box's floor (a release stops below it)"
floor() { # disk memory swap
  DISK_MB=$1 MEM_MB=$2 SWAP_MB=$3
  floor_verdict
}
passes "a box at the floors passes" floor "$FLOOR_DISK_MB" "$FLOOR_MEM_MB" "$FLOOR_SWAP_MB"
refuses "too little disk stops the release" "disk:" floor "$((FLOOR_DISK_MB - 1))" "$FLOOR_MEM_MB" "$FLOOR_SWAP_MB"
refuses "too little memory stops the release" "memory:" floor "$FLOOR_DISK_MB" "$((FLOOR_MEM_MB - 1))" "$FLOOR_SWAP_MB"
refuses "too little swap stops the release" "swap:" floor "$FLOOR_DISK_MB" "$FLOOR_MEM_MB" "$((FLOOR_SWAP_MB - 1))"

echo "== the keys (no release rewrites them)"
passes "the first release makes them" keys_unchanged '' abc
passes "a later release leaves them" keys_unchanged abc abc
refuses "a rewritten file is named" "the keys file changed" keys_unchanged abc def
refuses "a deleted file is named" "the keys file changed" keys_unchanged abc ''
refuses "no file at all is named" "the keys file changed" keys_unchanged '' ''

echo "== wait_build retries until /health names the commit"
want=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
other=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
: >"$WORK/calls"
# answers(): a /health that does not answer twice, then names the old build once, then the new one
answers() {
  echo x >>"$WORK/calls"
  case $(wc -l <"$WORK/calls" | tr -d ' ') in
    1 | 2) return 1 ;;
    3) echo "{\"status\":\"OK\",\"buildVersion\":\"$other\"}" ;;
    *) echo "{\"status\":\"OK\",\"buildVersion\":\"$want\"}" ;;
  esac
}
rc=0
wait_build "$want" 10 answers >"$WORK/out" || rc=$?
check "a server that answers late, and first with the old build, still passes" 0 "$rc"
check "  after four tries" 4 "$(wc -l <"$WORK/calls" | tr -d ' ')"

echo "== the proof of a Bruno run (e2e.sh and check.sh both ask it)"
PROOF=$REPO_DIR/c-storage/scripts/bruno-proof.cjs
mkdir -p "$WORK/coll/01-things" "$WORK/coll/environments"
for f in 01-things/a.yml 01-things/b.yml folder.yml opencollection.yml environments/x.yml; do echo 'info: {}' >"$WORK/coll/$f"; done
report() { # <passedRequests in the summary> <results as a JSON array>
  jq -nc --argjson p "$1" --argjson r "$2" '[{summary: {passedRequests: $p, skippedRequests: 0}, results: $r}]' >"$WORK/report.json"
}
good='{"path":"a","status":"pass","testResults":[{}],"assertionResults":[]}'
no_tests='{"path":"b","status":"pass","testResults":[],"assertionResults":[]}'
errored='{"path":"b","status":"error","testResults":[{}],"assertionResults":[]}'
skipped='{"path":"b","status":"skipped","testResults":[],"assertionResults":[],"error":"unparseable"}'
proof() { node "$PROOF" "$WORK/report.json" "$WORK/coll" test; }
report 2 "[$good,$good]"
passes "every request file passed, each with a test" proof
check "  and the count is of the request files, not of folder, collection or environment files" 2 "$(proof 2>/dev/null)"
report 1 "[$good,$skipped]"
refuses "an unparseable request file (skipped) is refused" "status skipped" proof
report 0 '[]'
refuses "a run that reaches no request is refused" "0 results" proof
report 2 "[$good,$no_tests]"
refuses "a request with no test is refused" "0 tests" proof
report 2 "[$good,$errored]"
refuses "a request whose status is not pass is refused" "status error" proof
report 2 "[$good]"
refuses "results fewer than the request files are refused" "1 results" proof
report 1 "[$good,$good]"
refuses "a summary that passed fewer than the request files is refused" "1 passed" proof
rm "$WORK/report.json"
refuses "no report at all is refused" "no readable report" proof

echo "== the log ends on the signal's exit code, and the exit still closes the tunnel and cleans up"
cat >"$WORK/child.sh" <<'CHILD'
set -euo pipefail
. "$OPS_DIR/lib.sh"
log_start sigtest x
ssh() { echo "ssh $*" >>"$MARK"; }
box_ready=1
BOX_ID=i-test
kill -s "$1" $$
sleep 5
echo "not reached"
CHILD
for sig in TERM:143 INT:130 HUP:129; do
  name=${sig%%:*} code=${sig##*:}
  rm -rf "$WORK/logs" "$WORK/tmp" "$WORK/ssh.calls"
  mkdir -p "$WORK/tmp"
  rc=0
  OPS_DIR=$OPS_DIR OPS_LOG_DIR=$WORK/logs TMPDIR=$WORK/tmp MARK=$WORK/ssh.calls bash "$WORK/child.sh" "$name" >/dev/null 2>&1 || rc=$?
  check "$name: the script exits $code" "$code" "$rc"
  check "$name: the log ends on its exit code" "== exit $code" "$(tail -n 1 "$WORK"/logs/*.log)"
  check "$name: the tunnel is closed" 1 "$(grep -c -e '-O exit' "$WORK/ssh.calls" || true)"
  check "$name: the scratch folder is removed" 0 "$(find "$WORK/tmp" -mindepth 1 | wc -l | tr -d ' ')"
done

echo "== the workflow's deploy job (a push to main only, never under act, one at a time, the account id masked)"
WORKFLOW=$REPO_DIR/.github/workflows/c-storage.yml
deploy_block() { # <workflow>: the lines of the job deploy, up to the next job
  awk '/^  deploy:$/ {f = 1; next} f && /^  [A-Za-z_-]+:/ {exit} f' "$1"
}
# deploy_guards <workflow>: dies naming each condition of the plan's "Deploys from GitHub Actions"
# that the deploy job lacks. The job's own `if` cannot read env, so under act (which sets ACT,
# and has no AWS) every step carries `if: ${{ !env.ACT }}`.
deploy_guards() {
  local block missing='' steps guarded want_region have_region
  block=$(deploy_block "$1")
  [ -n "$block" ] || die "no deploy job"
  need() { grep -qxF -- "$1" <<<"$block" || missing="${missing}[$1] "; }
  need "    if: github.event_name == 'push' && github.ref == 'refs/heads/main'"
  need "    needs: [check, e2e, ops]"
  need "    runs-on: ubuntu-24.04"
  need "    environment: ridge"
  need "      group: ridge"
  need "      cancel-in-progress: false"
  need "      id-token: write"
  need "      contents: read"
  need "          mask-aws-account-id: true"
  grep -qE '^    timeout-minutes: [0-9]+$' <<<"$block" || missing="${missing}[a job timeout] "
  grep -qE '^        uses: aws-actions/configure-aws-credentials@[0-9a-f]{40} # v[0-9.]+$' <<<"$block" ||
    missing="${missing}[credentials step pinned by sha] "
  steps=$(grep -c '^      - ' <<<"$block" || true)
  # shellcheck disable=SC2016 # a literal workflow expression
  guarded=$(grep -cxF -- '        if: ${{ !env.ACT }}' <<<"$block" || true)
  [ "$steps" -gt 0 ] && [ "$steps" = "$guarded" ] || missing="${missing}[if: \${{ !env.ACT }} on each of the $steps steps, found $guarded] "
  # No other cancel-in-progress than false, in any group of the file, and no step that may fail and go on.
  if grep 'cancel-in-progress:' "$1" | grep -qv 'cancel-in-progress: false$'; then
    missing="${missing}[cancel-in-progress: false everywhere in the file] "
  fi
  if grep -q 'continue-on-error' <<<"$block"; then missing="${missing}[no continue-on-error in the deploy job] "; fi
  [ "$(grep -c 'id-token:' "$1" || true)" = 1 ] || missing="${missing}[id-token in the deploy job alone] "
  [ "$(grep -c 'secrets\.' "$1" || true)" = 1 ] || missing="${missing}[one secret read, in the deploy job] "
  # shellcheck disable=SC2016 # lib.sh's text, not an expansion
  want_region=$(sed -n 's/^CREDO_REGION=\${CREDO_REGION:-\(.*\)}$/\1/p' "$OPS_DIR/lib.sh")
  have_region=$(sed -n 's/^ *aws-region: //p' <<<"$block")
  [ -n "$want_region" ] && [ "$want_region" = "$have_region" ] || missing="${missing}[aws-region is lib.sh's $want_region, found '$have_region'] "
  [ -z "$missing" ] || die "the deploy job lacks: $missing"
}
passes "the deploy job holds every condition" deploy_guards "$WORKFLOW"
sed "s/ && github.ref == 'refs\/heads\/main'//" "$WORKFLOW" >"$WORK/wf-branch.yml"
refuses "a deploy job that also runs on a branch is refused" "github.ref == 'refs/heads/main'" deploy_guards "$WORK/wf-branch.yml"
awk '$0 == "        if: ${{ !env.ACT }}" && !d {d = 1; next} 1' "$WORKFLOW" >"$WORK/wf-act.yml"
refuses "a deploy step that would run under act is refused" "!env.ACT" deploy_guards "$WORK/wf-act.yml"
sed 's/mask-aws-account-id: true/mask-aws-account-id: false/' "$WORKFLOW" >"$WORK/wf-mask.yml"
refuses "a deploy that leaves the account id unmasked is refused" "mask-aws-account-id" deploy_guards "$WORK/wf-mask.yml"
sed 's/cancel-in-progress: false/cancel-in-progress: true/' "$WORKFLOW" >"$WORK/wf-cancel.yml"
refuses "a deploy that may cancel a running deploy is refused" "cancel-in-progress" deploy_guards "$WORK/wf-cancel.yml"
awk '/^permissions:$/ && !d {print "concurrency:"; print "  group: all"; print "  cancel-in-progress: true"; d = 1} 1' "$WORKFLOW" >"$WORK/wf-cancel-all.yml"
refuses "a cancel-in-progress: true at the workflow's level is refused" "cancel-in-progress: false everywhere" deploy_guards "$WORK/wf-cancel-all.yml"
awk '/^    environment: ridge$/ {print; print "    continue-on-error: true"; next} 1' "$WORKFLOW" >"$WORK/wf-continue-job.yml"
refuses "a deploy job that may fail and go on is refused" "continue-on-error" deploy_guards "$WORK/wf-continue-job.yml"
awk '/^        run: make box$/ {print "        continue-on-error: true"} 1' "$WORKFLOW" >"$WORK/wf-continue-step.yml"
refuses "a deploy step that may fail and go on is refused" "continue-on-error" deploy_guards "$WORK/wf-continue-step.yml"
sed 's/needs: \[check, e2e, ops\]/needs: [check, e2e]/' "$WORKFLOW" >"$WORK/wf-needs.yml"
refuses "a deploy that does not wait for the three gates is refused" "needs: [check, e2e, ops]" deploy_guards "$WORK/wf-needs.yml"
sed 's/^      group: ridge$/      group: ridge-per-run/' "$WORKFLOW" >"$WORK/wf-group.yml"
refuses "a deploy whose concurrency group is not the one ridge group is refused" "group: ridge" deploy_guards "$WORK/wf-group.yml"
sed '/^    environment: ridge$/d' "$WORKFLOW" >"$WORK/wf-env.yml"
refuses "a deploy outside environment ridge is refused" "environment: ridge" deploy_guards "$WORK/wf-env.yml"
sed 's/aws-region: ap-southeast-5/aws-region: eu-west-1/' "$WORKFLOW" >"$WORK/wf-region.yml"
refuses "a deploy in another Region than lib.sh's is refused" "aws-region is lib.sh's" deploy_guards "$WORK/wf-region.yml"

echo "== the checks of /health, against the real c-storage (release.sh and drill.sh wait on it; check.sh reads it once)"
command -v go >/dev/null || { echo "ops/test.sh: needs go on PATH, to build c-storage" >&2; exit 2; }
STAMP_VAR=$(sed -n 's/^STAMP_VAR[[:space:]]*:=[[:space:]]*//p' "$REPO_DIR/c-storage/Makefile")
[ -n "$STAMP_VAR" ] || { echo "ops/test.sh: c-storage/Makefile names no STAMP_VAR" >&2; exit 2; }
# The first build compiles c-storage; the others only relink it.
build() { # <output> [<stamp>]
  if [ -n "${2:-}" ]; then
    (cd "$REPO_DIR/c-storage" && go build -ldflags "-X $STAMP_VAR=$2" -o "$1" ./cmd/server)
  else
    (cd "$REPO_DIR/c-storage" && go build -o "$1" ./cmd/server)
  fi
}
build "$WORK/server-want" "$want"
build "$WORK/server-other" "$other"
build "$WORK/server-dev"
build "$WORK/server-new" "$new_sha"
build "$WORK/server-old" "$old_sha"

# start_server <binary>: starts it on a free loopback port with throwaway keys and its own database.
# UP is 1 once /health answers (the stop is stop_server's), and URL is /health's address.
UP=0
URL=''
start_server() {
  local port
  port=$(python3 -I -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
  URL="http://127.0.0.1:$port/health"
  env -i PATH="$PATH" PORT="$port" DB_PATH="$WORK/db-$port/c-storage.db" \
    INTERNAL_ACCESS_KEY="$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')" \
    X_SUPER_ADMIN_KEY="$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')" \
    "$1" >"$WORK/server.log" 2>&1 &
  PID=$!
  UP=0
  for _ in $(seq 1 50); do
    curl -fsS -m 2 "$URL" >/dev/null 2>&1 && { UP=1; break; }
    sleep 0.2
  done
}
stop_server() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  PID=''
}

# probe <binary>: starts it, asks wait_build for $want, and stops it, all in this one call. The
# result is in $PROBE_RC, the answer in $WORK/out.
PROBE_RC=0
probe() {
  start_server "$1"
  PROBE_RC=0
  if [ "$UP" = 1 ]; then
    wait_build "$want" 2 curl -fsS -m 2 "$URL" >"$WORK/out" || PROBE_RC=$?
  else
    PROBE_RC=99
    cat "$WORK/server.log" >"$WORK/out"
  fi
  stop_server
}

probe "$WORK/server-other"
check "a c-storage stamped with another commit fails the check" 1 "$PROBE_RC"
check "  and the answer names what it read" 1 "$(grep -c "$other" "$WORK/out")"
probe "$WORK/server-dev"
check "an unstamped c-storage (dev) fails the check" 1 "$PROBE_RC"
probe "$WORK/server-want"
check "a c-storage stamped with the commit passes" 0 "$PROBE_RC"

# supersedes <sha> → the exit status of superseded, asked of the server now running (its answer is
# in $WORK/out). The clone is the scratch repository, where $old_sha is behind $new_sha and $side_sha
# is on another line.
supersedes() {
  local rc=0
  REPO_DIR=$WORK/repo superseded ridge "$1" curl -fsS -m 2 "$URL" >"$WORK/out" 2>&1 || rc=$?
  echo "$rc"
}
echo "== ridge never moves backwards (release.sh ends 'superseded' and changes nothing)"
start_server "$WORK/server-new"
check "a commit behind what ridge runs is superseded" 0 "$(supersedes "$old_sha")"
check "  and the answer names what ridge runs" "superseded: ridge runs $new_sha" "$(cat "$WORK/out")"
check "the commit ridge already runs is released again, not superseded" 1 "$(supersedes "$new_sha")"
check "a commit on another line than ridge's is released" 1 "$(supersedes "$side_sha")"
stop_server
start_server "$WORK/server-old"
check "a commit newer than what ridge runs is released" 1 "$(supersedes "$new_sha")"
stop_server
start_server "$WORK/server-dev"
check "an unstamped ridge is released over" 1 "$(supersedes "$old_sha")"
stop_server
start_server "$WORK/server-other"
check "a ridge running a commit this clone lacks is released over" 1 "$(supersedes "$old_sha")"
stop_server
check "a ridge that does not answer is released over (its first release)" 1 "$(supersedes "$old_sha")"

[ "$fail" = 0 ] || { echo "ops/test.sh: FAILURES"; exit 1; }
echo "ops/test.sh: all checks passed"
