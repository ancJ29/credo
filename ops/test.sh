#!/usr/bin/env bash
# The ops job's guards, run with no AWS, each on hand-written input: the change-set filter, the
# choice between creating and updating a stack, an update's refusal to move the repository, the
# deploy role's trust and the subject GitHub issues, the check that the code a push deploys on is main's (by hand, and in
# the deploy job), the box's floor, the keys' checksum, wait_build's retry, the proof of a Bruno run,
# the credentials bru never holds, the log's exit code after a signal, the workflow's deploy job,
# layer four's template (env.yml read as JSON through Ruby: rows 22, 25, 26, 29, 30 and 32 of
# docs/plans/2026-10-28-ridge-app.md, each with the template broken one way, and the CloudFront
# Function run under Node) and its change set, the shared helpers (the port, the forward that
# cannot bind, /health naming a commit of main, the keys file's mode), ops/tunnel.sh and check.sh's port refusal run whole on stand-ins for aws and
# ssh (every way the tunnel ends), and the release's checks of /health against the real c-storage
# binary, built here with several stamps and without one (it needs Go): the build it waits for, and
# the newer build it must never overwrite; and the walks page's three guards (walks-refused.sh,
# walks-digest.sh, walks-served.sh), which the walks workflow runs; and ops/seed.sh whole (/health must
# name its own commit, the box above its floor, no key, address or password in its log) and the seed
# workflow's guards.
# Expected length: about a minute with a cold Go cache, about 40 seconds with a warm one.
set -euo pipefail
# The tests' own marker: lib.sh's real_ok refuses the tests' two switches on an environment that may hold
# real data unless this is set beside them.
export OPS_TESTS_RUNNING=1

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

fail=0
BASE_PATH=$PATH # before the stand-ins below put their folders in front: the gate cases want the real tools
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
described() { # <status> [<Repository>] [<Env>]
  jq -nc --arg s "$1" --arg r "${2:-}" --arg e "${3:-}" \
    '{Stacks: [{StackName: "ridge", StackStatus: $s, Parameters: ((if $r == "" then [] else [{ParameterKey: "Repository", ParameterValue: $r}] end) + (if $e == "" then [] else [{ParameterKey: "Env", ParameterValue: $e}] end))}]}'
}
check "no stack is a creation" CREATE "$(change_type '')"
check "a stack that holds only a change set (REVIEW_IN_PROGRESS) is a creation" CREATE "$(change_type "$(described REVIEW_IN_PROGRESS)")"
check "a made stack (CREATE_COMPLETE) is an update" UPDATE "$(change_type "$(described CREATE_COMPLETE)")"
check "an updated stack (UPDATE_COMPLETE) is an update" UPDATE "$(change_type "$(described UPDATE_COMPLETE)")"
# a stack in ROLLBACK_COMPLETE is one whose creation failed and was rolled back: it holds nothing, whatever its kind.
# Its refusal never reads Env (network has no Env parameter, github no Parameters block at all) and says delete it.
net_rolled=$(jq -nc '{Stacks: [{StackName: "network", StackStatus: "ROLLBACK_COMPLETE", Parameters: [{ParameterKey: "Cidr", ParameterValue: "10.0.0.0/16"}]}]}')
gh_rolled=$(jq -nc '{Stacks: [{StackName: "github", StackStatus: "ROLLBACK_COMPLETE"}]}')
rolled_back_text() { # <a describe-stacks body>: the refusal's text for it
  ( change_type "$1" ) 2>&1 || true
}
for kind_body in "ridge:$(described ROLLBACK_COMPLETE '' ridge)" "acme:$(described ROLLBACK_COMPLETE '' acme)" "no-Env:$(described ROLLBACK_COMPLETE)" "network:$net_rolled" "github:$gh_rolled"; do
  kind=${kind_body%%:*}
  body=${kind_body#*:}
  text=$(rolled_back_text "$body")
  refuses "a rolled-back stack ($kind) is not touched: delete the stack, then run again" "delete the stack" change_type "$body"
  check "  ($kind) it says the creation did not complete and the delete loses nothing" yes "$(grep -qF 'creation did not complete and was rolled back, and it holds nothing a delete could lose' <<<"$text" && echo yes || echo no)"
  check "  ($kind) it does not call the stack precious or send anyone to the README" no "$(grep -qE 'records|Stop and ask|README|retained' <<<"$text" && echo yes || echo no)"
done

echo "== an update never moves the deploy role's repository"
STACK_JSON=$(described UPDATE_COMPLETE owner/name)
check "the stack's Repository is read" owner/name "$(stack_param Repository)"
passes "the same repository passes" repository_matches_stack owner/name
refuses "a fork's clone is refused" "stack's Repository is owner/name" repository_matches_stack fork/name
STACK_JSON=$(described UPDATE_COMPLETE)
passes "a stack with no Repository yet passes" repository_matches_stack fork/name
STACK_JSON=''

echo "== the deploy role's trust reads the subject GitHub issues (the immutable one, owner@id/name@id, or the plain one)"
# subject_for <repo> <gh api's answer> → the prefix, or a refusal
immutable='{"use_default":true,"use_immutable_subject":true,"sub_claim_prefix":"repo:alice@111/demo@222"}'
plain='{"use_default":true,"use_immutable_subject":false}'
plain_prefixed='{"use_default":true,"use_immutable_subject":false,"sub_claim_prefix":"repo:alice/demo"}'
check "the immutable subject's prefix is taken" "repo:alice@111/demo@222" "$(subject_prefix_of alice/demo "$immutable")"
check "with no immutable subject and no prefix, the prefix is repo:<Repository>" "repo:alice/demo" "$(subject_prefix_of alice/demo "$plain")"
check "a prefix given without the immutable subject is taken" "repo:alice/demo" "$(subject_prefix_of alice/demo "$plain_prefixed")"
check "the repository's name is compared with the ids dropped and the case aside" "repo:alice@111/demo@222" "$(subject_prefix_of Alice/Demo "$immutable")"
refuses "a prefix naming another repository is refused" "names another repository" subject_prefix_of other/else "$plain_prefixed"
refuses "  and so is an immutable one" "names another repository" subject_prefix_of other/else "$immutable"
refuses "the immutable subject without its prefix is refused" "the immutable one" \
  subject_prefix_of alice/demo '{"use_default":true,"use_immutable_subject":true}'
refuses "custom claim keys (use_default false) are refused" "custom claim keys" \
  subject_prefix_of alice/demo '{"use_default":false,"include_claim_keys":["repo"]}'
refuses "an answer that is not JSON is refused" "is not JSON" subject_prefix_of alice/demo 'Not Found'
refuses "an empty answer is refused" "cannot be read" subject_prefix_of alice/demo ''
refuses "an answer with no use_default is refused" "no use_default" subject_prefix_of alice/demo '{"message":"Not Found"}'
refuses "a prefix of another shape is refused" "not of the shape" \
  subject_prefix_of alice/demo '{"use_default":true,"sub_claim_prefix":"repo:alice/demo:ref:x"}'
refuses "a prefix of two lines, the first of the right shape, is refused" "not of the shape" \
  subject_prefix_of alice/demo "$(jq -nc '{use_default: true, sub_claim_prefix: "repo:alice/demo\nrepo:alice/demo"}')"
check "lib.sh's pattern is the template's AllowedPattern for SubjectPrefix" \
  "$SUBJECT_PREFIX_RE" "$(awk '/^  SubjectPrefix:$/ {f = 1} f && /AllowedPattern:/ {gsub(/^[^'"'"']*'"'"'|'"'"'$/, ""); print; exit}' "$OPS_DIR/env.yml")"

echo "== an update never moves the deploy role's subject"
described_sub() { # <SubjectPrefix>, or none
  jq -nc --arg p "${1:-}" '{Stacks: [{StackName: "ridge", StackStatus: "UPDATE_COMPLETE", Parameters: ([{ParameterKey: "Repository", ParameterValue: "alice/demo"}] + (if $p == "" then [] else [{ParameterKey: "SubjectPrefix", ParameterValue: $p}] end))}]}'
}
STACK_JSON=$(described_sub repo:alice@111/demo@222)
check "the stack's SubjectPrefix is read" "repo:alice@111/demo@222" "$(stack_param SubjectPrefix)"
passes "the same prefix passes" subject_matches_stack repo:alice@111/demo@222
check "  and is passed as the previous value" previous "$(subject_param_plan repo:alice@111/demo@222)"
refuses "a fork's clone (other ids) is refused" "stack's SubjectPrefix is repo:alice@111/demo@222" subject_matches_stack repo:bob@333/demo@444
refuses "  and the plan refuses it too" "stack's SubjectPrefix" subject_param_plan repo:bob@333/demo@444
refuses "the plain prefix against a stack holding the immutable one is refused" "stack's SubjectPrefix" subject_matches_stack repo:alice/demo
STACK_JSON=$(described_sub)
check "ridge today (no SubjectPrefix yet) reads empty" "" "$(stack_param SubjectPrefix)"
check "  and takes GitHub's prefix, set once" set "$(subject_param_plan repo:alice@111/demo@222)"
# add_subject_param is stack.sh's choice, on its PARAMS: the stack's value kept, or GitHub's set once
STACK_JSON=$(described_sub repo:alice@111/demo@222)
PARAMS='[]'
add_subject_param repo:alice@111/demo@222
check "an update on a stack that holds a SubjectPrefix keeps it (previous value)" \
  '[{"ParameterKey":"SubjectPrefix","UsePreviousValue":true}]' "$PARAMS"
STACK_JSON=$(described_sub)
PARAMS='[]'
add_subject_param repo:alice@111/demo@222
check "an update on a stack that holds none sets GitHub's prefix" \
  '[{"ParameterKey":"SubjectPrefix","ParameterValue":"repo:alice@111/demo@222"}]' "$PARAMS"
STACK_JSON=$(described_sub repo:alice@111/demo@222)
refuses "an update on a stack holding another prefix is refused, and appends nothing" "stack's SubjectPrefix" \
  add_subject_param repo:bob@333/demo@444
STACK_JSON=''

echo "== the Slack alarm's two IDs go together, and an update keeps the stack's"
described_slack() { # <workspace> <channel>, or nothing
  jq -nc --arg w "${1:-}" --arg c "${2:-}" '{Stacks: [{StackName: "ridge", Parameters: (if $w == "" then [] else [{ParameterKey: "SlackWorkspaceId", ParameterValue: $w}, {ParameterKey: "SlackChannelId", ParameterValue: $c}] end)}]}'
}
slack_plan() { CREDO_SLACK_WORKSPACE_ID="$1" CREDO_SLACK_CHANNEL_ID="$2" slack_param_plan; }
slack_add() { PARAMS='[]'; CREDO_SLACK_WORKSPACE_ID="$1" CREDO_SLACK_CHANNEL_ID="$2" add_slack_params; echo "$PARAMS"; }
STACK_JSON=$(described_slack)
refuses "a workspace ID without a channel ID is refused" "go together" slack_plan T01ABCDEF ''
refuses "a channel ID without a workspace ID is refused" "go together" slack_plan '' C01ABCDEF
check "neither ID on a stack that holds none adds nothing (the template's none)" default "$(slack_plan '' '')"
check "  and appends no parameter" '[]' "$(slack_add '' '')"
check "both IDs are set" set "$(slack_plan T01ABCDEF C01ABCDEF)"
check "  and appended as given" '[{"ParameterKey":"SlackWorkspaceId","ParameterValue":"T01ABCDEF"},{"ParameterKey":"SlackChannelId","ParameterValue":"C01ABCDEF"}]' "$(slack_add T01ABCDEF C01ABCDEF)"
check "none and none on a stack that holds none is set" '[{"ParameterKey":"SlackWorkspaceId","ParameterValue":"none"},{"ParameterKey":"SlackChannelId","ParameterValue":"none"}]' "$(slack_add none none)"
STACK_JSON=$(described_slack T09OLDOLD C09OLDOLD)
check "an update with no IDs keeps the stack's" previous "$(slack_plan '' '')"
check "  as previous values" '[{"ParameterKey":"SlackWorkspaceId","UsePreviousValue":true},{"ParameterKey":"SlackChannelId","UsePreviousValue":true}]' "$(slack_add '' '')"
check "an update with both IDs takes the new ones" '[{"ParameterKey":"SlackWorkspaceId","ParameterValue":"T01ABCDEF"},{"ParameterKey":"SlackChannelId","ParameterValue":"C01ABCDEF"}]' "$(slack_add T01ABCDEF C01ABCDEF)"
refuses "an update with one ID is refused too" "go together" slack_add T01ABCDEF ''
refuses "none for the workspace and a real channel ID is refused (no channel, silently)" "is none and the other is an ID" slack_plan none C01ABCDEF
refuses "a real workspace ID and none for the channel is refused" "is none and the other is an ID" slack_plan T01ABCDEF none
refuses "  and on an update, through the function that appends" "is none and the other is an ID" slack_add none C01ABCDEF
check "none and none on a stack that holds a channel is set (the removal, which the guard then asks to take)" set "$(slack_plan none none)"
slack_plan_creation() { CS_TYPE=CREATE slack_plan "$1" "$2"; }
check "a creation takes no previous value, though a REVIEW_IN_PROGRESS stack lists the IDs" default "$(slack_plan_creation '' '')"
check "  and an update does" previous "$(CS_TYPE=UPDATE slack_plan '' '')"
STACK_JSON=''

# trust_guard <template>: dies unless the deploy role's trust reads SubjectPrefix, not the repository
# shellcheck disable=SC2016 # the template's literal text
trust_guard() {
  grep -qxF -- '                token.actions.githubusercontent.com:sub: !Sub ${SubjectPrefix}:environment:${Env}' "$1" ||
    die "the trust's sub is not \${SubjectPrefix}:environment:\${Env}"
  # every role's trust document (the lines under each AssumeRolePolicyDocument: key), whatever the resources are
  # named: a role's own policy may use StringLike (BoxRole's list is held to its box's path), a trust may not
  # shellcheck disable=SC2016 # awk's program, in single quotes
  ! awk '/^ *AssumeRolePolicyDocument:/ {match($0, /^ */); ind = RLENGTH; f = 1; next} f {match($0, /^ */); if (length($0) > 0 && RLENGTH <= ind) f = 0; else print}' "$1" | grep -qF 'StringLike' ||
    die "the trust uses StringLike, which takes wildcards"
  ! grep -qF 'repo:${Repository}' "$1" || die "the trust still builds the subject from Repository"
  grep -qxF -- '                token.actions.githubusercontent.com:aud: sts.amazonaws.com' "$1" || die "the trust lost its audience condition"
}
# modifies_role_in_place <change set>: dies unless the one change is a Modify of DeployRole with no replacement
modifies_role_in_place() {
  local seen
  seen=$(jq -r '[.Changes[].ResourceChange | "\(.Action) \(.LogicalResourceId) \(.Replacement // "none")"] | join(",")' "$1")
  [ "$seen" = "Modify DeployRole False" ] || die "the change set is not a Modify of DeployRole in place: $seen"
  [ -z "$(jq -r --argjson take '[]' -f "$OPS_DIR/unsafe-changes.jq" "$1")" ] || die "the guard names a change in it"
}
passes "the template's trust uses the prefix, and keeps its audience" trust_guard "$OPS_DIR/env.yml"
# shellcheck disable=SC2016 # the template's literal text
sed 's/!Sub ${SubjectPrefix}:environment/!Sub repo:${Repository}:environment/' "$OPS_DIR/env.yml" >"$WORK/env-old-trust.yml"
refuses "a trust built from Repository again is refused" "sub is not" trust_guard "$WORK/env-old-trust.yml"
# the first StringEquals under an AssumeRolePolicyDocument: a trust (the file's first StringEquals is a bucket policy's)
awk '/^ *AssumeRolePolicyDocument:/ {match($0, /^ */); ind = RLENGTH; f = 1; print; next} f {match($0, /^ */); if (length($0) > 0 && RLENGTH <= ind) f = 0} f && !done && /^ *StringEquals:$/ {sub(/StringEquals/, "StringLike"); done = 1} {print}' "$OPS_DIR/env.yml" >"$WORK/env-like.yml"
refuses "a trust that matches with StringLike is refused" "StringLike" trust_guard "$WORK/env-like.yml"
# the box's profile renamed leaves the role's cut with no end in the old guard: a StringLike in the deploy role's trust must still be seen
sed 's/BoxProfile/BoxProfileRenamed/g' "$OPS_DIR/env.yml" | awk '/^  DeployRole:/ {d = 1} d && !done && /^ *StringEquals:$/ {sub(/StringEquals/, "StringLike"); done = 1} {print}' >"$WORK/env-like-renamed.yml"
refuses "  and so is one in the deploy role's trust with the box's profile renamed" "StringLike" trust_guard "$WORK/env-like-renamed.yml"
# shellcheck disable=SC2016 # the template's literal text
sed 's/^\( *\)\(token.actions.githubusercontent.com:sub: !Sub \${SubjectPrefix}:environment:\${Env}\)$/\1\2\
\1token.actions.githubusercontent.com:sub: !Sub repo:${Repository}:environment:${Env}/' "$OPS_DIR/env.yml" >"$WORK/env-both.yml"
refuses "a trust that keeps the prefix and adds the repository's name is refused" "still builds the subject from Repository" trust_guard "$WORK/env-both.yml"
sed 's/aud: sts.amazonaws.com/aud: other/' "$OPS_DIR/env.yml" >"$WORK/env-aud.yml"
refuses "a trust that lost its audience is refused" "audience" trust_guard "$WORK/env-aud.yml"
passes "ridge's update, hand-written as CloudFormation shows it, is a Modify of DeployRole in place and the guard passes" \
  modifies_role_in_place "$OPS_DIR/testdata/changeset-trust.json"
refuses "a replacement of DeployRole is not that update" "not a Modify of DeployRole in place" \
  modifies_role_in_place "$OPS_DIR/testdata/changeset-replaces.json"

echo "== layer four's template (env.yml read as JSON: rows 22, 25, 26, 29, 30, 32 of docs/plans/2026-10-28-ridge-app.md)"
# tojson <template> → CloudFormation's long form as JSON ("!Ref x" is {"Ref": "x"}), read with Ruby
# (on the runner and the Mac): jq has no YAML, and a plain loader drops the tags.
tojson() {
  ruby -ryaml -rjson -e '
    def plain(node)
      return node.value if node.quoted || node.style != Psych::Nodes::Scalar::PLAIN
      begin
        value = YAML.safe_load(node.value)
        value.is_a?(String) || value.is_a?(Numeric) || value == true || value == false || value.nil? ? value : node.value
      rescue StandardError
        node.value
      end
    end
    def conv(node)
      value =
        case node
        when Psych::Nodes::Scalar then node.tag ? node.value : plain(node)
        when Psych::Nodes::Sequence then node.children.map { |c| conv(c) }
        when Psych::Nodes::Mapping then node.children.each_slice(2).map { |k, v| [k.value, conv(v)] }.to_h
        end
      return value unless node.tag
      name = node.tag.sub(/\A!/, "")
      return { "Ref" => value } if name == "Ref"
      return { "Fn::GetAtt" => value.split(".", 2) } if name == "GetAtt" && value.is_a?(String)
      { "Fn::#{name}" => value }
    end
    puts JSON.generate(conv(YAML.parse(File.read(ARGV[0])).root))
  ' "$1"
}
tojson "$OPS_DIR/env.yml" >"$WORK/env.json"
check "the template reads as JSON, its tags in long form" '{"Ref":"Subnet"} {"Fn::GetAtt":["Box","PrivateIp"]}' \
  "$(jq -c '.Resources.Box.Properties.NetworkInterfaces[0].SubnetId, .Outputs.BoxAddress.Value' "$WORK/env.json" | tr '\n' ' ' | sed 's/ $//')"
# the API stage's access log (plan 2026-11-08-access-log, step 1): the stage sends one JSON line a call to this
# environment's own group, and the group is the API's own, kept 14 days
# shellcheck disable=SC2016 # the format's $context names, in single quotes
api_log_wanted='{"DestinationArn":{"Fn::GetAtt":["ApiLogs","Arn"]},"Format":"{\"requestId\":\"$context.requestId\",\"time\":\"$context.requestTime\",\"ip\":\"$context.identity.sourceIp\",\"method\":\"$context.httpMethod\",\"path\":\"$context.path\",\"route\":\"$context.routeKey\",\"status\":\"$context.status\",\"latencyMs\":\"$context.responseLatency\",\"userAgent\":\"$context.identity.userAgent\",\"integrationError\":\"$context.integration.error\"}"}'
check "the API stage sends its access log to ApiLogs, in one JSON line of when, who, what path, route and answer" \
  "$api_log_wanted" "$(jq -c '.Resources.ApiStage.Properties.AccessLogSettings' "$WORK/env.json")"
# shellcheck disable=SC2016 # the template's ${Env}, in single quotes
check "ApiLogs is the API's own group, kept 14 days" '{"LogGroupName":{"Fn::Sub":"/aws/apigateway/credo-${Env}"},"RetentionInDays":14}' \
  "$(jq -c '.Resources.ApiLogs.Properties' "$WORK/env.json")"
# mut <jq program> → the path of a copy of the template's JSON with the program applied: a template broken one way
mut() {
  jq -c "$1" "$WORK/env.json" >"$WORK/env-mut.json"
  echo "$WORK/env-mut.json"
}

# must <json> <what the template must hold> <jq test>: dies naming what is wrong
must() { jq -e "$3" "$1" >/dev/null || die "$2"; }

# row 22: the BFF's group sends to c-storage's port on the box's group alone; the function sits in
# ridge's subnet under that group alone; the box admits the BFF's group on that port and nothing
# but ssh from the endpoint's group besides.
bff_network_guard() {
  must "$1" "BffGroup does not send to c-storage's port on the box's group alone" \
    '.Resources.BffGroup.Properties.SecurityGroupEgress == [{"IpProtocol":"tcp","FromPort":{"Ref":"BoxPort"},"ToPort":{"Ref":"BoxPort"},"DestinationSecurityGroupId":{"Fn::GetAtt":["BoxGroup","GroupId"]}}]'
  must "$1" "BffGroup admits traffic in" '.Resources.BffGroup.Properties.SecurityGroupIngress == null'
  must "$1" "the function is not in ridge's subnet under BffGroup alone" \
    '.Resources.Bff.Properties.VpcConfig == {"SubnetIds":[{"Ref":"Subnet"}],"SecurityGroupIds":[{"Fn::GetAtt":["BffGroup","GroupId"]}]}'
  must "$1" "the box's second rule is not c-storage's port from BffGroup alone" \
    '.Resources.BoxFromBff.Properties | . == {"GroupId":{"Fn::GetAtt":["BoxGroup","GroupId"]},"IpProtocol":"tcp","FromPort":{"Ref":"BoxPort"},"ToPort":{"Ref":"BoxPort"},"SourceSecurityGroupId":{"Fn::GetAtt":["BffGroup","GroupId"]}, "Description": .Description}'
  must "$1" "a rule other than BoxFromBff opens the box" \
    '[.Resources | to_entries[] | select(.value.Type == "AWS::EC2::SecurityGroupIngress" or .value.Type == "AWS::EC2::SecurityGroupEgress") | .key] == ["BoxFromBff"]'
  must "$1" "the box's own rules are not ssh from the endpoint's group alone" \
    '.Resources.BoxGroup.Properties.SecurityGroupIngress | length == 1 and .[0].FromPort == 22 and .[0].ToPort == 22 and (.[0] | keys == ["FromPort","IpProtocol","SourceSecurityGroupId","ToPort"])'
  must "$1" "BoxPort has a default, so a stack.sh that forgets it would not be refused" \
    '.Parameters.BoxPort.Type == "Number" and (.Parameters.BoxPort | has("Default") | not)'
}
# row 25: the rewrite, the behaviours, no error pages
rewrite_guard() {
  must "$1" "the rewrite is not a cloudfront-js-2.0 function" '.Resources.UiRewrite.Properties.FunctionConfig.Runtime == "cloudfront-js-2.0" and .Resources.UiRewrite.Properties.AutoPublish == true'
  must "$1" "the default behaviour does not carry the rewrite on viewer-request alone" \
    '.Resources.Distribution.Properties.DistributionConfig.DefaultCacheBehavior.FunctionAssociations == [{"EventType":"viewer-request","FunctionARN":{"Fn::GetAtt":["UiRewrite","FunctionMetadata.FunctionARN"]}}]'
  must "$1" "/api/* is not the one extra behaviour, uncached, to the API, every method" \
    '.Resources.Distribution.Properties.DistributionConfig.CacheBehaviors | length == 1 and .[0].PathPattern == "/api/*" and .[0].TargetOriginId == "api" and .[0].CachePolicyId == "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" and .[0].OriginRequestPolicyId == "b689b0a8-53d0-40ab-baf2-68738e2966ac" and (.[0].AllowedMethods | sort) == ["DELETE","GET","HEAD","OPTIONS","PATCH","POST","PUT"] and (.[0] | has("FunctionAssociations") | not)'
  must "$1" "the distribution turns an error answer into the app's page (CustomErrorResponses)" \
    '.Resources.Distribution.Properties.DistributionConfig | has("CustomErrorResponses") | not'
  must "$1" "a behaviour admits plain HTTP" \
    '.Resources.Distribution.Properties.DistributionConfig | [.DefaultCacheBehavior, .CacheBehaviors[]] | all(.ViewerProtocolPolicy == "redirect-to-https" or .ViewerProtocolPolicy == "https-only")'
}
# rewrite_run <json>: the CloudFront Function's own code, run under Node on paths; prints "<path> <uri>"
rewrite_run() {
  jq -r '.Resources.UiRewrite.Properties.FunctionCode' "$1" >"$WORK/rewrite.js"
  node -e '
    const vm = require("vm"), fs = require("fs");
    const ctx = {};
    vm.runInNewContext(fs.readFileSync(process.argv[1], "utf8"), ctx);
    for (const uri of ["/", "/login", "/operator", "/settings/brand", "/assets/app-3fa9.js", "/favicon.svg", "/index.html", "/a.b/login"]) {
      const query = { "client-code": { value: "acme" } };
      const out = ctx.handler({ request: { uri, querystring: query, headers: {} } });
      console.log(uri + " " + out.uri + (JSON.stringify(out.querystring) === JSON.stringify(query) ? "" : " QUERY-LOST"));
    }
  ' "$WORK/rewrite.js" 2>&1 | tr '\n' ';'
}
rewrite_wanted='/ /index.html;/login /index.html;/operator /index.html;/settings/brand /index.html;/assets/app-3fa9.js /assets/app-3fa9.js;/favicon.svg /favicon.svg;/index.html /index.html;/a.b/login /index.html;'
# row 26: the UI's bucket is private and read by the distribution alone
# shellcheck disable=SC2016 # jq programs and the template's text, in single quotes
bucket_guard() {
  must "$1" "the UI's bucket does not block all public access" \
    '.Resources.UiBucket.Properties.PublicAccessBlockConfiguration == {"BlockPublicAcls":true,"BlockPublicPolicy":true,"IgnorePublicAcls":true,"RestrictPublicBuckets":true}'
  must "$1" "the UI's bucket is a website, or not owned by the bucket owner alone" \
    '.Resources.UiBucket.Properties | has("WebsiteConfiguration") == false and has("AccessControl") == false and .OwnershipControls.Rules[0].ObjectOwnership == "BucketOwnerEnforced"'
  must "$1" "the UI's bucket is not encrypted" '.Resources.UiBucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration | length == 1'
  must "$1" "the bucket policy is not one statement reading objects for the distribution alone" \
    '.Resources.UiBucketPolicy.Properties | .Bucket == {"Ref":"UiBucket"} and (.PolicyDocument.Statement | length == 1) and (.PolicyDocument.Statement[0] | .Effect == "Allow" and .Principal == {"Service":"cloudfront.amazonaws.com"} and .Action == "s3:GetObject" and .Resource == {"Fn::Sub":"${UiBucket.Arn}/*"} and (.Condition | keys == ["StringEquals"]) and (.Condition.StringEquals | keys == ["AWS:SourceArn"]) and (.Condition.StringEquals["AWS:SourceArn"]["Fn::Sub"] | contains("distribution/${Distribution}")))'
  must "$1" "the distribution reaches the bucket other than through origin access control" \
    '.Resources.Distribution.Properties.DistributionConfig.Origins | map(select(.Id == "ui")) | length == 1 and .[0].OriginAccessControlId == {"Fn::GetAtt":["UiAccess","Id"]} and .[0].S3OriginConfig == {"OriginAccessIdentity":""} and (.[0] | has("CustomOriginConfig") | not)'
  must "$1" "origin access control does not always sign" \
    '.Resources.UiAccess.Properties.OriginAccessControlConfig | .OriginAccessControlOriginType == "s3" and .SigningBehavior == "always" and .SigningProtocol == "sigv4"'
}
# row 29: the deploy role holds exactly its actions, the function's code and settings held to
# ridge's subnet and group, the bucket's put; no list, stack, IAM or CloudFront right
deploy_role_guard() {
  local got want
  got=$(jq -r '.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | .Action | if type == "array" then .[] else . end' "$1" | sort | tr '\n' ' ')
  want='cloudformation:DescribeStacks ec2-instance-connect:OpenTunnel ec2-instance-connect:SendSSHPublicKey ec2:DescribeInstanceConnectEndpoints ec2:DescribeInstances ec2:DescribeInternetGateways ec2:DescribeSecurityGroups ec2:DescribeSubnets ec2:DescribeVpcs ec2:GetSecurityGroupsForVpc lambda:GetFunctionConfiguration lambda:UpdateFunctionCode lambda:UpdateFunctionConfiguration s3:GetBucketPolicy s3:GetBucketPublicAccessBlock s3:ListBucket s3:PutObject '
  [ "$got" = "$want" ] || die "the deploy role's actions are not the wanted ones: $got"
  must "$1" "a lambda action reaches a function other than Bff" \
    '[.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action | tostring | contains("lambda:")) | .Resource] | all(. == {"Fn::GetAtt":["Bff","Arn"]})'
  must "$1" "an s3 action reaches a bucket other than UiBucket" \
    '[.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action | tostring | contains("s3:")) | select(.Action != "s3:ListBucket") | .Resource | tostring] | all(contains("UiBucket"))'
  must "$1" "the deploy role's list reaches a bucket other than CopyBucket, or lists more than it" \
    '[.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action == "s3:ListBucket")] | length == 1 and .[0].Resource == {"Fn::GetAtt":["CopyBucket","Arn"]} and .[0].Effect == "Allow" and (.[0] | has("Condition") | not)'
  must "$1" "UpdateFunctionConfiguration is not held to ridge's subnet and the BFF's group" \
    '[.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action | tostring | contains("UpdateFunctionConfiguration"))] | length == 1 and (.[0].Action == "lambda:UpdateFunctionConfiguration") and (.[0].Condition | has("ForAllValues:StringEquals")) and .[0].Condition["ForAllValues:StringEquals"] == {"lambda:SubnetIds":[{"Ref":"Subnet"}],"lambda:SecurityGroupIds":[{"Fn::GetAtt":["BffGroup","GroupId"]}]}'
  must "$1" "UpdateFunctionConfiguration passes a request whose subnet and group lists are absent or empty (no Null condition requiring both keys)" \
    '[.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action == "lambda:UpdateFunctionConfiguration")] | .[0].Condition.Null == {"lambda:SubnetIds":"false","lambda:SecurityGroupIds":"false"}'
  must "$1" "a statement of the deploy role allows every resource for a write" \
    '[.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Resource == "*") | .Action | if type == "array" then .[] else . end] | all(startswith("ec2:Describe") or . == "ec2:GetSecurityGroupsForVpc")'
}
# row 30: the function's keys arrive from the box at each deploy; the template holds none, and
# gives the function no Environment (an update of it would clear what the deploy set)
bff_keys_guard() {
  must "$1" "Bff holds an Environment" '.Resources.Bff.Properties | has("Environment") | not'
  must "$1" "Bff is not the stub that answers 503 until the first deploy" \
    '.Resources.Bff.Properties.Code | keys == ["ZipFile"] and (.ZipFile | contains("503"))'
  ! grep -qE 'SERVICE_ACCESS_KEY|INTERNAL_ACCESS_KEY|SERVICE_CODE' "$2" || die "the template names one of the BFF's keys"
}
# row 32: the API refuses calls past 10 a second, bursts of 50, on the $default stage
# shellcheck disable=SC2016 # jq programs and the template's text, in single quotes
throttle_guard() {
  must "$1" "the stage is not \$default, throttled to 10 a second with bursts of 50" \
    '.Resources.ApiStage.Properties | .StageName == "$default" and .DefaultRouteSettings.ThrottlingRateLimit == 10 and .DefaultRouteSettings.ThrottlingBurstLimit == 50 and .ApiId == {"Ref":"Api"}'
  must "$1" "the route is not \$default to the BFF's integration" \
    '.Resources.ApiRoute.Properties | .RouteKey == "$default" and (.Target["Fn::Sub"] == "integrations/${ApiIntegration}")'
  must "$1" "the API's invoke permission is not for this API alone (an execute-api ARN of its own: the API has no ExecuteApiArn attribute)" \
    '.Resources.ApiInvoke.Properties | .Principal == "apigateway.amazonaws.com" and .FunctionName == {"Ref":"Bff"} and (.SourceArn["Fn::Sub"] | test("^arn:[$][{]AWS::Partition[}]:execute-api:[$][{]AWS::Region[}]:[$][{]AWS::AccountId[}]:[$][{]Api[}]/"))'
}

# the API stage's access log (plan 2026-11-08-access-log, step 2): the stage sends its log to ApiLogs, in a format holding
# the time, the caller, the path, the route and the answer. Read from the parsed template, never grepped.
# shellcheck disable=SC2016 # jq programs and the template's text, in single quotes
api_log_guard() {
  must "$1" "the stage has no AccessLogSettings" '.Resources.ApiStage.Properties.AccessLogSettings | type == "object"'
  must "$1" "the stage's access log does not go to ApiLogs" \
    '.Resources.ApiStage.Properties.AccessLogSettings.DestinationArn == {"Fn::GetAtt":["ApiLogs","Arn"]}'
  must "$1" "the stage's access log format is not JSON" \
    '.Resources.ApiStage.Properties.AccessLogSettings.Format | type == "string" and (try (fromjson | type == "object") catch false)'
  local what field
  for what in 'the time:$context.requestTime' 'the caller:$context.identity.sourceIp' 'the path:$context.path' 'the route:$context.routeKey' 'the answer:$context.status'; do
    field=${what#*:}
    must "$1" "the stage's access log format drops ${what%%:*} ($field)" \
      ".Resources.ApiStage.Properties.AccessLogSettings.Format | fromjson | [.[]] | index(\"$field\") != null"
  done
}

passes "the BFF's network: its group, the function in ridge's subnet, the box's rule (row 22)" bff_network_guard "$WORK/env.json"
refuses "  a BFF group that also sends anywhere (a second egress rule) is refused" "send to c-storage's port on the box's group alone" \
  bff_network_guard "$(mut '.Resources.BffGroup.Properties.SecurityGroupEgress += [{"IpProtocol":"-1","CidrIp":"0.0.0.0/0"}]')"
refuses "  a box rule for the whole VPC is refused" "box's second rule" \
  bff_network_guard "$(mut '.Resources.BoxFromBff.Properties |= (del(.SourceSecurityGroupId) | .CidrIp = "10.0.0.0/16")')"
refuses "  a third rule on the box is refused" "other than BoxFromBff opens the box" \
  bff_network_guard "$(mut '.Resources.BoxFromAny = {"Type":"AWS::EC2::SecurityGroupIngress","Properties":{"GroupId":{"Fn::GetAtt":["BoxGroup","GroupId"]},"IpProtocol":"tcp","FromPort":3181,"ToPort":3181,"CidrIp":"0.0.0.0/0"}}')"
refuses "  a function in another group is refused" "ridge's subnet under BffGroup alone" \
  bff_network_guard "$(mut '.Resources.Bff.Properties.VpcConfig.SecurityGroupIds = [{"Fn::GetAtt":["BoxGroup","GroupId"]}]')"
refuses "  a function out of the subnet is refused" "ridge's subnet under BffGroup alone" \
  bff_network_guard "$(mut 'del(.Resources.Bff.Properties.VpcConfig)')"
refuses "  a port with a default is refused" "BoxPort has a default" \
  bff_network_guard "$(mut '.Parameters.BoxPort.Default = 3181')"

passes "the page rewrite, the behaviours and no error pages (row 25)" rewrite_guard "$WORK/env.json"
check "  a path with no extension is the app's page, a file is itself, the query is kept" "$rewrite_wanted" "$(rewrite_run "$WORK/env.json")"
refuses "  an error page turned into the app's page is refused" "CustomErrorResponses" \
  rewrite_guard "$(mut '.Resources.Distribution.Properties.DistributionConfig.CustomErrorResponses = [{"ErrorCode":404,"ResponseCode":200,"ResponsePagePath":"/index.html"}]')"
refuses "  the rewrite on the /api/* behaviour is refused" "/api/* is not the one extra behaviour" \
  rewrite_guard "$(mut '.Resources.Distribution.Properties.DistributionConfig.CacheBehaviors[0].FunctionAssociations = [{"EventType":"viewer-request","FunctionARN":"x"}]')"
refuses "  a cached /api/* is refused" "/api/* is not the one extra behaviour" \
  rewrite_guard "$(mut '.Resources.Distribution.Properties.DistributionConfig.CacheBehaviors[0].CachePolicyId = "658327ea-f89d-4fab-a63d-7e88639e58f6"')"
refuses "  plain HTTP is refused" "admits plain HTTP" \
  rewrite_guard "$(mut '.Resources.Distribution.Properties.DistributionConfig.DefaultCacheBehavior.ViewerProtocolPolicy = "allow-all"')"
# a rewrite that sends every path to the page (files too) is not the wanted one
jq -c '.Resources.UiRewrite.Properties.FunctionCode = "function handler(event) { event.request.uri = \"/index.html\"; return event.request; }"' "$WORK/env.json" >"$WORK/env-rewrite-all.json"
check "  a rewrite that also takes the files is told apart" no "$([ "$(rewrite_run "$WORK/env-rewrite-all.json")" = "$rewrite_wanted" ] && echo yes || echo no)"
jq -c '.Resources.UiRewrite.Properties.FunctionCode |= sub("return request;"; "request.querystring = {}; return request;")' "$WORK/env.json" >"$WORK/env-rewrite-query.json"
check "  and one that drops the query (the client's code)" no "$([ "$(rewrite_run "$WORK/env-rewrite-query.json")" = "$rewrite_wanted" ] && echo yes || echo no)"

passes "the UI's bucket is private and read by the distribution alone (row 26)" bucket_guard "$WORK/env.json"
refuses "  a bucket that allows public policy is refused" "block all public access" \
  bucket_guard "$(mut '.Resources.UiBucket.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy = false')"
# shellcheck disable=SC2016 # jq's program, in single quotes
refuses "  a policy that also admits everyone is refused" "distribution alone" \
  bucket_guard "$(mut '.Resources.UiBucketPolicy.Properties.PolicyDocument.Statement += [{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":{"Fn::Sub":"${UiBucket.Arn}/*"}}]')"
refuses "  a policy that drops the distribution condition is refused" "distribution alone" \
  bucket_guard "$(mut 'del(.Resources.UiBucketPolicy.Properties.PolicyDocument.Statement[0].Condition)')"
refuses "  a website bucket is refused" "is a website" \
  bucket_guard "$(mut '.Resources.UiBucket.Properties.WebsiteConfiguration = {"IndexDocument":"index.html"}')"

# A plain Null key reads as YAML's null in cfn-lint ("E0000 Null key 'Null' not supported"), while the
# reader above takes every scalar as text and cannot see it: the condition operator is quoted.
check "no key of env.yml is a plain null word (the IAM condition operator Null is quoted)" 0 \
  "$(grep -cE '^[[:space:]]*(Null|null|NULL|~):' "$OPS_DIR/env.yml" || true)"
passes "the deploy role holds exactly its actions (row 29)" deploy_role_guard "$WORK/env.json"
refuses "  one more action (cloudformation:UpdateStack) is refused" "actions are not the wanted ones" \
  deploy_role_guard "$(mut '.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[0].Action = ["cloudformation:DescribeStacks","cloudformation:UpdateStack"]')"
refuses "  a delete on the bucket is refused" "actions are not the wanted ones" \
  deploy_role_guard "$(mut '(.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action == "s3:PutObject") | .Action) = ["s3:PutObject","s3:DeleteObject"]')"
refuses "  a function setting free of the subnet and group is refused" "held to ridge's subnet" \
  deploy_role_guard "$(mut '(.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action == "lambda:UpdateFunctionConfiguration")) |= del(.Condition)')"
refuses "  a function setting that needs no subnet or group key (an empty list passes ForAllValues) is refused" "absent or empty" \
  deploy_role_guard "$(mut '(.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action == "lambda:UpdateFunctionConfiguration") | .Condition) |= del(.Null)')"
refuses "  and one that requires only the subnet key" "absent or empty" \
  deploy_role_guard "$(mut '(.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action == "lambda:UpdateFunctionConfiguration") | .Condition.Null) |= del(.["lambda:SecurityGroupIds"])')"
refuses "  a code right on every function is refused" "other than Bff" \
  deploy_role_guard "$(mut '(.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action == "lambda:UpdateFunctionCode") | .Resource) = "*"')"

passes "the function holds no key and no Environment, and is the 503 stub (row 30)" bff_keys_guard "$WORK/env.json" "$OPS_DIR/env.yml"
refuses "  an Environment on the function is refused" "holds an Environment" \
  bff_keys_guard "$(mut '.Resources.Bff.Properties.Environment = {"Variables":{"X":"y"}}')" "$OPS_DIR/env.yml"
refuses "  code that is not the stub is refused" "503 until the first deploy" \
  bff_keys_guard "$(mut '.Resources.Bff.Properties.Code = {"S3Bucket":"b","S3Key":"k"}')" "$OPS_DIR/env.yml"
echo 'SERVICE_ACCESS_KEY: x' >"$WORK/env-keyed.yml"
refuses "  a key's name in the template is refused" "names one of the BFF's keys" bff_keys_guard "$WORK/env.json" "$WORK/env-keyed.yml"

passes "the API is throttled to 10 a second, bursts of 50 (row 32)" throttle_guard "$WORK/env.json"
refuses "  a looser throttle is refused" "throttled to 10 a second" \
  throttle_guard "$(mut '.Resources.ApiStage.Properties.DefaultRouteSettings.ThrottlingRateLimit = 100')"
refuses "  no throttle is refused" "throttled to 10 a second" \
  throttle_guard "$(mut 'del(.Resources.ApiStage.Properties.DefaultRouteSettings)')"
refuses "  an invoke permission for every API is refused" "this API alone" \
  throttle_guard "$(mut '.Resources.ApiInvoke.Properties.SourceArn = "*"')"

passes "the API stage logs every call to ApiLogs, in a format of time, caller, path, route and answer" api_log_guard "$WORK/env.json"
refuses "  a stage with no access log settings is refused" "has no AccessLogSettings" \
  api_log_guard "$(mut 'del(.Resources.ApiStage.Properties.AccessLogSettings)')"
refuses "  an access log sent to the function's group is refused" "does not go to ApiLogs" \
  api_log_guard "$(mut '.Resources.ApiStage.Properties.AccessLogSettings.DestinationArn = {"Fn::GetAtt":["BffLogs","Arn"]}')"
refuses "  a format with the caller cut is refused" "drops the caller" \
  api_log_guard "$(mut '.Resources.ApiStage.Properties.AccessLogSettings.Format |= (fromjson | del(.ip) | tojson)')"

# the box's disk is the only copy of a deployment's records (plan 2026-11-08-backup-policy, step 1). Read from the
# parsed template, never grepped: a comment naming the setting is not the setting. Retain alone is legal on an
# instance - Snapshot is not, and the UpdateReplacePolicy page documents CloudFormation reverting it to Delete, so it would read as protection and not be.
volume_guard() {
  local inst='.Resources | to_entries[] | select(.value.Type == "AWS::EC2::Instance") | .value'
  # DeletionPolicy may be Retain or RetainExceptOnCreate (retain on every act but the creation's own rollback, which
  # deletes a box that never served); UpdateReplacePolicy takes Retain alone, RetainExceptOnCreate being a
  # DeletionPolicy value only.
  must "$1" "Box has a DeletionPolicy of Snapshot, which an instance cannot take: the UpdateReplacePolicy page documents CloudFormation reverting it to Delete" \
    '.Resources.Box.DeletionPolicy != "Snapshot"'
  must "$1" "Box has an UpdateReplacePolicy of Snapshot, which an instance cannot take: CloudFormation reverts it to Delete" \
    '.Resources.Box.UpdateReplacePolicy != "Snapshot"'
  must "$1" "Box has no DeletionPolicy of Retain or RetainExceptOnCreate" \
    '.Resources.Box.DeletionPolicy == "Retain" or .Resources.Box.DeletionPolicy == "RetainExceptOnCreate"'
  must "$1" "Box has no UpdateReplacePolicy of Retain" '.Resources.Box.UpdateReplacePolicy == "Retain"'
  must "$1" "an instance resource has no DeletionPolicy of Retain or RetainExceptOnCreate" \
    "[$inst | .DeletionPolicy] | all(. == \"Retain\" or . == \"RetainExceptOnCreate\")"
  must "$1" "an instance resource has no UpdateReplacePolicy of Retain" \
    "[$inst | .UpdateReplacePolicy] | all(. == \"Retain\")"
  must "$1" "Box's root device does not keep its disk on termination (DeleteOnTermination is not false)" \
    '.Resources.Box.Properties.BlockDeviceMappings | length == 1 and .[0].DeviceName == "/dev/xvda" and .[0].Ebs.DeleteOnTermination == false'
  must "$1" "an instance resource has a disk that does not keep itself on termination (DeleteOnTermination is not false)" \
    "[$inst | (.Properties.BlockDeviceMappings // []) as \$m | (\$m | length > 0) and all(\$m[]; .Ebs.DeleteOnTermination == false)] | all"
  must "$1" "Box's root device is not gp3, encrypted, at VolumeSize" \
    '.Resources.Box.Properties.BlockDeviceMappings[0].Ebs | .VolumeType == "gp3" and .Encrypted == true and .VolumeSize == {"Ref":"VolumeSize"}'
  # Any volume resource carries both policies (a volume can snapshot; Retain is legal too), so one added with none is refused.
  must "$1" "a volume resource has no DeletionPolicy and UpdateReplacePolicy of Retain or Snapshot" \
    '[.Resources | to_entries[] | select(.value.Type == "AWS::EC2::Volume") | .value | (.DeletionPolicy == "Retain" or .DeletionPolicy == "Snapshot") and (.UpdateReplacePolicy == "Retain" or .UpdateReplacePolicy == "Snapshot")] | all'
  must "$1" "RecordsVolume is not gp3, encrypted, in the box's zone, at RecordsVolumeSize" \
    '.Resources.RecordsVolume.Properties | .VolumeType == "gp3" and .Encrypted == true and .Size == {"Ref":"RecordsVolumeSize"} and .AvailabilityZone == {"Fn::GetAtt":["Subnet","AvailabilityZone"]}'
  must "$1" "RecordsVolume is not kept on a stack delete and a replacement" \
    '.Resources.RecordsVolume | (.DeletionPolicy == "Retain" or .DeletionPolicy == "Snapshot") and (.UpdateReplacePolicy == "Retain" or .UpdateReplacePolicy == "Snapshot")'
  must "$1" "RecordsAttachment does not attach RecordsVolume to Box" \
    '.Resources.RecordsAttachment.Properties | .InstanceId == {"Ref":"Box"} and .VolumeId == {"Ref":"RecordsVolume"}'
}

passes "the box keeps its disk: Retain on a stack delete and a replacement, and DeleteOnTermination false" volume_guard "$WORK/env.json"
refuses "  a box with no DeletionPolicy is refused" "Box has no DeletionPolicy of Retain or RetainExceptOnCreate" \
  volume_guard "$(mut 'del(.Resources.Box.DeletionPolicy)')"
refuses "  a box with no UpdateReplacePolicy is refused" "Box has no UpdateReplacePolicy of Retain" \
  volume_guard "$(mut 'del(.Resources.Box.UpdateReplacePolicy)')"
refuses "  a DeletionPolicy of Snapshot, which an instance reverts to Delete, is refused" "DeletionPolicy of Snapshot" \
  volume_guard "$(mut '.Resources.Box.DeletionPolicy = "Snapshot"')"
refuses "  an UpdateReplacePolicy of Snapshot is refused" "UpdateReplacePolicy of Snapshot" \
  volume_guard "$(mut '.Resources.Box.UpdateReplacePolicy = "Snapshot"')"
refuses "  a root device deleted on termination is refused" "DeleteOnTermination is not false" \
  volume_guard "$(mut '.Resources.Box.Properties.BlockDeviceMappings[0].Ebs.DeleteOnTermination = true')"
refuses "  a root device with no DeleteOnTermination (the default is true) is refused" "DeleteOnTermination is not false" \
  volume_guard "$(mut 'del(.Resources.Box.Properties.BlockDeviceMappings[0].Ebs.DeleteOnTermination)')"
refuses "  a second instance without both attributes is refused" "an instance resource has no DeletionPolicy" \
  volume_guard "$(mut '.Resources.Box2 = {"Type":"AWS::EC2::Instance","Properties":{}}')"
passes "  a DeletionPolicy of plain Retain is accepted too" volume_guard "$(mut '.Resources.Box.DeletionPolicy = "Retain"')"
refuses "  a Delete DeletionPolicy is refused" "Box has no DeletionPolicy of Retain or RetainExceptOnCreate" \
  volume_guard "$(mut '.Resources.Box.DeletionPolicy = "Delete"')"
refuses "  an UpdateReplacePolicy of RetainExceptOnCreate (a DeletionPolicy value only) is refused" "Box has no UpdateReplacePolicy of Retain" \
  volume_guard "$(mut '.Resources.Box.UpdateReplacePolicy = "RetainExceptOnCreate"')"
refuses "  a volume added with no policy is refused (row 5)" "a volume resource has no DeletionPolicy" \
  volume_guard "$(mut '.Resources.Volume2 = {"Type":"AWS::EC2::Volume","Properties":{}}')"
refuses "  a records disk with its policies removed is refused" "a volume resource has no DeletionPolicy" \
  volume_guard "$(mut 'del(.Resources.RecordsVolume.DeletionPolicy)')"
refuses "  a records disk that is not encrypted is refused (row 4)" "RecordsVolume is not gp3, encrypted" \
  volume_guard "$(mut '.Resources.RecordsVolume.Properties.Encrypted = false')"
refuses "  a records disk of another type is refused" "RecordsVolume is not gp3, encrypted" \
  volume_guard "$(mut '.Resources.RecordsVolume.Properties.VolumeType = "gp2"')"
refuses "  a records disk at a fixed size, not its parameter, is refused" "RecordsVolume is not gp3, encrypted" \
  volume_guard "$(mut '.Resources.RecordsVolume.Properties.Size = 8')"
refuses "  a records disk deleted with its stack is refused" "a volume resource has no DeletionPolicy" \
  volume_guard "$(mut '.Resources.RecordsVolume.DeletionPolicy = "Delete"')"
refuses "  a second instance with both attributes but a disk deleted on termination is refused" "an instance resource has a disk that does not keep itself" \
  volume_guard "$(mut '.Resources.Box2 = {"Type":"AWS::EC2::Instance","DeletionPolicy":"Retain","UpdateReplacePolicy":"Retain","Properties":{"BlockDeviceMappings":[{"DeviceName":"/dev/xvda","Ebs":{"DeleteOnTermination":true}}]}}')"

# box_port_guard <stack.sh>: dies unless the stack's parameters take BoxPort, for a creation and an update, from the unit's port
# shellcheck disable=SC2016 # jq programs and the template's text, in single quotes
box_port_guard() {
  [ "$(grep -c '^ *add_param BoxPort "\$BOX_PORT"$' "$1" || true)" = 1 ] || die "stack.sh does not pass BoxPort from the unit's port"
  grep -B2 '^ *add_param BoxPort' "$1" | grep -q '^ *add_param Env ' || die "BoxPort is not passed beside Env, on both paths"
}
passes "stack.sh passes BoxPort from the unit's port, on a creation and on an update" box_port_guard "$OPS_DIR/stack.sh"
# slack_params_guard <stack.sh>: dies unless the env branch calls add_slack_params once, beside the BoxPort line and before the creation/update split
# shellcheck disable=SC2016 # grep patterns, in single quotes
slack_params_guard() {
  [ "$(grep -c '^ *add_slack_params$' "$1" || true)" = 1 ] || die "stack.sh does not call add_slack_params once"
  grep -B3 '^ *add_slack_params$' "$1" | grep -q '^ *add_param BoxPort ' || die "add_slack_params is not called beside BoxPort, before the creation and update paths split"
}
passes "stack.sh appends the Slack IDs once, before the creation and update paths split" slack_params_guard "$OPS_DIR/stack.sh"
grep -v '^ *add_slack_params$' "$OPS_DIR/stack.sh" >"$WORK/stack-noslack.sh"
refuses "  a stack.sh that forgets the Slack IDs is refused" "does not call add_slack_params once" slack_params_guard "$WORK/stack-noslack.sh"
grep -v 'add_param BoxPort' "$OPS_DIR/stack.sh" >"$WORK/stack-noport.sh"
refuses "  a stack.sh that forgets the port is refused" "does not pass BoxPort" box_port_guard "$WORK/stack-noport.sh"

echo "== the watch (plan 2026-11-11-slack-alarm, step 2): four alarms to one topic, the channel behind two IDs and a deny-all guardrail"
# watch_guard <template json>: dies naming what is wrong. Read from the parsed template, never grepped.
# Each case below names the one mutation that must turn it red.
# shellcheck disable=SC2016 # jq programs and the template's ${Env}, in single quotes
watch_guard() {
  local alarm
  # row 1: each alarm sends its alarm and its return to normal to Alerts, and nowhere else
  for alarm in AlarmCalls AlarmErrors AlarmRefusals AlarmBox; do
    must "$1" "$alarm does not send its alarm to Alerts alone" \
      ".Resources.$alarm.Properties.AlarmActions == [{\"Ref\":\"Alerts\"}]"
    must "$1" "$alarm does not send its return to normal to Alerts alone" \
      ".Resources.$alarm.Properties.OKActions == [{\"Ref\":\"Alerts\"}]"
    must "$1" "$alarm sends something on missing data besides its own rule" \
      ".Resources.$alarm.Properties.InsufficientDataActions == null"
    must "$1" "$alarm is not an alarm on the watch's own topic and a condition-free resource" \
      ".Resources.$alarm | .Type == \"AWS::CloudWatch::Alarm\" and .Condition == null"
  done
  # every alarm's whole rule, pinned: operator, threshold, period, evaluation periods, statistic, switched on, every datapoint counted
  must "$1" "AlarmCalls, AlarmErrors or AlarmRefusals is not Sum, 300 s, one period, threshold 1, at or above, switched on, every datapoint counted" \
    '[.Resources.AlarmCalls, .Resources.AlarmErrors, .Resources.AlarmRefusals] | all(.Properties | .Statistic == "Sum" and .Period == 300 and .EvaluationPeriods == 1 and .Threshold == 1 and .ComparisonOperator == "GreaterThanOrEqualToThreshold" and (.ActionsEnabled | . == null or . == true) and (.DatapointsToAlarm // .EvaluationPeriods) == .EvaluationPeriods)'
  must "$1" "AlarmBox is not Maximum, 60 s, three periods, threshold 1, at or above, switched on, every datapoint counted" \
    '.Resources.AlarmBox.Properties | .Statistic == "Maximum" and .Period == 60 and .EvaluationPeriods == 3 and .Threshold == 1 and .ComparisonOperator == "GreaterThanOrEqualToThreshold" and (.ActionsEnabled | . == null or . == true) and (.DatapointsToAlarm // .EvaluationPeriods) == .EvaluationPeriods'
  must "$1" "a resource other than the four alarms and the channel acts on Alerts" \
    '[.Resources | to_entries[] | select(.value.Properties | tostring | test("\"Ref\":\"Alerts\"")) | .key] | sort == ["AlarmBox","AlarmCalls","AlarmErrors","AlarmRefusals","AlertsChannel"]'
  # row 2: the calls alarm reads this stack's own API and stage; a 5xx in five minutes; no calls is no failure
  must "$1" "AlarmCalls does not read this stack's API and stage 5xx" \
    '.Resources.AlarmCalls.Properties | .Namespace == "AWS/ApiGateway" and .MetricName == "5xx" and .Dimensions == [{"Name":"ApiId","Value":{"Ref":"Api"}},{"Name":"Stage","Value":{"Ref":"ApiStage"}}]'
  must "$1" "AlarmCalls is not one 5xx in five minutes, with no calls counting as no failure" \
    '.Resources.AlarmCalls.Properties | .Statistic == "Sum" and .Period == 300 and .EvaluationPeriods == 1 and .Threshold == 1 and .ComparisonOperator == "GreaterThanOrEqualToThreshold" and .TreatMissingData == "notBreaching"'
  # row 3: the errors and the refusals alarms read this stack's own function
  must "$1" "AlarmErrors does not read this stack's function Errors" \
    '.Resources.AlarmErrors.Properties | .Namespace == "AWS/Lambda" and .MetricName == "Errors" and .Dimensions == [{"Name":"FunctionName","Value":{"Ref":"Bff"}}] and .Statistic == "Sum" and .TreatMissingData == "notBreaching"'
  must "$1" "AlarmRefusals does not read this stack's function Throttles" \
    '.Resources.AlarmRefusals.Properties | .Namespace == "AWS/Lambda" and .MetricName == "Throttles" and .Dimensions == [{"Name":"FunctionName","Value":{"Ref":"Bff"}}] and .Statistic == "Sum" and .TreatMissingData == "notBreaching"'
  # row 4: the box alarm reads this stack's own box, and a box reporting nothing for three minutes is down
  must "$1" "AlarmBox does not read this stack's box StatusCheckFailed" \
    '.Resources.AlarmBox.Properties | .Namespace == "AWS/EC2" and .MetricName == "StatusCheckFailed" and .Dimensions == [{"Name":"InstanceId","Value":{"Ref":"Box"}}]'
  must "$1" "AlarmBox does not count three minutes of failed or missing reports as down" \
    '.Resources.AlarmBox.Properties | .Period == 60 and .EvaluationPeriods == 3 and .Threshold == 1 and .TreatMissingData == "breaching"'
  # row 5: with no Slack IDs the topic and the four alarms stay, the channel and its role go
  must "$1" "HasSlack is not both IDs given" \
    '.Conditions.HasSlack == {"Fn::And":[{"Fn::Not":[{"Fn::Equals":[{"Ref":"SlackWorkspaceId"},"none"]}]},{"Fn::Not":[{"Fn::Equals":[{"Ref":"SlackChannelId"},"none"]}]}]}'
  must "$1" "the topic is not made with no Slack IDs" '.Resources.Alerts | .Type == "AWS::SNS::Topic" and .Condition == null'
  must "$1" "the channel and its role are not both held to HasSlack" \
    '.Resources | (.AlertsChannel.Condition == "HasSlack") and (.AlertsChannelRole.Condition == "HasSlack") and ([.[] | select(.Condition == "HasSlack")] | length) == 2'
  # row 6: the channel's role grants nothing, and the guardrail is the managed deny-all, not AWS's default
  must "$1" "the channel's role holds a policy" \
    '.Resources.AlertsChannelRole.Properties | .Policies == null and .ManagedPolicyArns == null'
  must "$1" "the channel's guardrail is not AWS's deny-all alone (unset is AdministratorAccess)" \
    '.Resources.AlertsChannel.Properties.GuardrailPolicies == [{"Fn::Sub":"arn:${AWS::Partition}:iam::aws:policy/AWSDenyAll"}]'
  must "$1" "the channel logs errors" '.Resources.AlertsChannel.Properties.LoggingLevel == "ERROR"'
  must "$1" "the channel's role is not the channel's own, or the channel does not read the topic" \
    '.Resources.AlertsChannel.Properties | .IamRoleArn == {"Fn::GetAtt":["AlertsChannelRole","Arn"]} and .SnsTopicArns == [{"Ref":"Alerts"}]'
  # row 7: both IDs are parameters defaulting to none; the channel reads them by Ref; a typed name fails the pattern
  must "$1" "a Slack ID does not default to none" \
    '.Parameters | .SlackWorkspaceId.Default == "none" and .SlackChannelId.Default == "none"'
  must "$1" "the channel does not read both IDs from the parameters" \
    '.Resources.AlertsChannel.Properties | .SlackWorkspaceId == {"Ref":"SlackWorkspaceId"} and .SlackChannelId == {"Ref":"SlackChannelId"}'
  must "$1" "an ID's pattern admits a channel's typed name, or refuses an ID or none" \
    '.Parameters as $p | ($p.SlackChannelId.AllowedPattern as $c | ($p.SlackWorkspaceId.AllowedPattern) as $w | ("alerts-ridge" | test($c) | not) and ("C01ABCDEF" | test($c)) and ("none" | test($c)) and ("my-workspace" | test($w) | not) and ("T01ABCDEF" | test($w)) and ("none" | test($w)))'
  # row 10: each alarm's description says in plain words which environment and what failed
  must "$1" "an alarm's description does not name the environment and what failed" \
    '[.Resources | to_entries[] | select(.key | startswith("Alarm")) | {k: .key, d: (.value.Properties.AlarmDescription["Fn::Sub"] // "")}] | map(select(.d | contains("${Env}"))) | map({(.k): .d}) | add | (.AlarmCalls | contains("calls are failing")) and (.AlarmErrors | contains("back end is failing")) and (.AlarmRefusals | contains("refusing work")) and (.AlarmBox | contains("box is down"))'
}
passes "the watch: four alarms to one topic, the channel behind two IDs, nothing granted" watch_guard "$WORK/env.json"
refuses "  an alarm that sends to a second topic is refused (row 1)" "AlarmErrors does not send its alarm to Alerts alone" \
  watch_guard "$(mut '.Resources.AlarmErrors.Properties.AlarmActions += [{"Ref":"Other"}]')"
refuses "  an alarm with no return to normal is refused (row 1)" "AlarmBox does not send its return to normal" \
  watch_guard "$(mut 'del(.Resources.AlarmBox.Properties.OKActions)')"
refuses "  a fifth resource acting on the topic is refused (row 1)" "a resource other than the four alarms and the channel acts on Alerts" \
  watch_guard "$(mut '.Resources.Extra = {"Type":"AWS::CloudWatch::Alarm","Properties":{"AlarmActions":[{"Ref":"Alerts"}]}}')"
refuses "  a calls alarm on another stage is refused (row 2)" "AlarmCalls does not read this stack's API and stage" \
  watch_guard "$(mut '.Resources.AlarmCalls.Properties.Dimensions[1].Value = "prod"')"
refuses "  a calls alarm on the 4xx metric is refused (row 2)" "AlarmCalls does not read this stack's API and stage" \
  watch_guard "$(mut '.Resources.AlarmCalls.Properties.MetricName = "4xx"')"
refuses "  a calls alarm that counts no calls as a failure is refused (row 2)" "AlarmCalls is not one 5xx in five minutes" \
  watch_guard "$(mut '.Resources.AlarmCalls.Properties.TreatMissingData = "breaching"')"
refuses "  an errors alarm on another function is refused (row 3)" "AlarmErrors does not read this stack's function" \
  watch_guard "$(mut '.Resources.AlarmErrors.Properties.Dimensions[0].Value = "other-function"')"
refuses "  a refusals alarm on the wrong metric is refused (row 3)" "AlarmRefusals does not read this stack's function" \
  watch_guard "$(mut '.Resources.AlarmRefusals.Properties.MetricName = "Errors"')"
refuses "  a box alarm on another instance is refused (row 4)" "AlarmBox does not read this stack's box" \
  watch_guard "$(mut '.Resources.AlarmBox.Properties.Dimensions[0].Value = "i-0123456789abcdef0"')"
refuses "  a box alarm that reads missing data as normal is refused (row 4)" "AlarmBox does not count three minutes" \
  watch_guard "$(mut '.Resources.AlarmBox.Properties.TreatMissingData = "notBreaching"')"
refuses "  a channel made with no Slack IDs is refused (row 5)" "the channel and its role are not both held to HasSlack" \
  watch_guard "$(mut 'del(.Resources.AlertsChannel.Condition)')"
refuses "  a topic that waits for the IDs is refused (row 5)" "the topic is not made with no Slack IDs" \
  watch_guard "$(mut '.Resources.Alerts.Condition = "HasSlack"')"
refuses "  a condition that wants one ID only is refused (row 5)" "HasSlack is not both IDs given" \
  watch_guard "$(mut '.Conditions.HasSlack = {"Fn::Not":[{"Fn::Equals":[{"Ref":"SlackChannelId"},"none"]}]}')"
refuses "  a channel role with a policy is refused (row 6)" "the channel's role holds a policy" \
  watch_guard "$(mut '.Resources.AlertsChannelRole.Properties.ManagedPolicyArns = ["arn:aws:iam::aws:policy/ReadOnlyAccess"]')"
refuses "  a channel with no guardrail (AWS then applies AdministratorAccess) is refused (row 6)" "the channel's guardrail is not AWS's deny-all" \
  watch_guard "$(mut 'del(.Resources.AlertsChannel.Properties.GuardrailPolicies)')"
refuses "  AdministratorAccess as the guardrail is refused (row 6)" "the channel's guardrail is not AWS's deny-all" \
  watch_guard "$(mut '.Resources.AlertsChannel.Properties.GuardrailPolicies = ["arn:aws:iam::aws:policy/AdministratorAccess"]')"
refuses "  a Slack ID with a real-looking default is refused (row 7)" "a Slack ID does not default to none" \
  watch_guard "$(mut '.Parameters.SlackChannelId.Default = "C01ABCDEF"')"
refuses "  a channel with its ID written in is refused (row 7)" "the channel does not read both IDs from the parameters" \
  watch_guard "$(mut '.Resources.AlertsChannel.Properties.SlackChannelId = "C01ABCDEF"')"
refuses "  a channel ID pattern that admits a typed name is refused (row 7)" "admits a channel's typed name" \
  watch_guard "$(mut '.Parameters.SlackChannelId.AllowedPattern = "^(none|[A-Za-z0-9-]+)$"')"
refuses "  an alarm description that names no environment is refused (row 10)" "an alarm's description does not name the environment" \
  watch_guard "$(mut '.Resources.AlarmCalls.Properties.AlarmDescription = {"Fn::Sub":"the app'"'"'s calls are failing."}')"
# shellcheck disable=SC2016 # the template's ${Env}, in single quotes
refuses "  an alarm description that says nothing of what failed is refused (row 10)" "an alarm's description does not name the environment" \
  watch_guard "$(mut '.Resources.AlarmBox.Properties.AlarmDescription = {"Fn::Sub":"${Env}: an alarm."}')"

refuses "  an alarm with its actions switched off is refused (all four)" "is not Sum, 300 s" \
  watch_guard "$(mut '.Resources.AlarmCalls.Properties.ActionsEnabled = false')"
refuses "  a box alarm that a failed check never fires (above, not at or above, 1) is refused" "AlarmBox is not Maximum, 60 s" \
  watch_guard "$(mut '.Resources.AlarmBox.Properties.ComparisonOperator = "GreaterThanThreshold"')"
refuses "  an errors alarm with a threshold of 1000 is refused" "is not Sum, 300 s" \
  watch_guard "$(mut '.Resources.AlarmErrors.Properties.Threshold = 1000')"
refuses "  an errors alarm over a day is refused" "is not Sum, 300 s" \
  watch_guard "$(mut '.Resources.AlarmErrors.Properties.Period = 86400')"
refuses "  a refusals alarm that fires below its threshold is refused" "is not Sum, 300 s" \
  watch_guard "$(mut '.Resources.AlarmRefusals.Properties.ComparisonOperator = "LessThanThreshold"')"
refuses "  a calls alarm that wants five datapoints is refused" "is not Sum, 300 s" \
  watch_guard "$(mut '.Resources.AlarmCalls.Properties.DatapointsToAlarm = 5')"
refuses "  a box alarm with its actions switched off is refused" "AlarmBox is not Maximum, 60 s" \
  watch_guard "$(mut '.Resources.AlarmBox.Properties.ActionsEnabled = false')"

echo "== the update on ridge adds layer four and modifies the deploy role in place (a change set as describe-change-set shows it)"
# adds_and_one_modify <change set> <template json>: dies unless the recorded change set adds exactly layer
# four's own resources (pinned below by name, so a later piece's resources in the template leave it alone),
# the template holds each of them, the one Modify is DeployRole, in place, and the guard names nothing
adds_and_one_modify() {
  local seen lost layer4='Api ApiIntegration ApiInvoke ApiLogs ApiRoute ApiStage Bff BffGroup BffLogs BffRole BoxFromBff Distribution UiAccess UiBucket UiBucketPolicy UiRewrite'
  seen=$(jq -r '[.Changes[].ResourceChange | select(.Action == "Add") | .LogicalResourceId] | sort | join(" ")' "$1")
  [ "$seen" = "$layer4" ] || die "the change set adds '$seen', not layer four's own '$layer4'"
  lost=$(jq -r --arg l "$layer4" '.Resources as $r | [($l | split(" "))[] | select($r[.] == null)] | join(" ")' "$2")
  [ -z "$lost" ] || die "the template lacks layer four's '$lost'"
  seen=$(jq -r '[.Changes[].ResourceChange | select(.Action != "Add") | "\(.Action) \(.LogicalResourceId) \(.Replacement // "none")"] | join(",")' "$1")
  [ "$seen" = "Modify DeployRole False" ] || die "the change set's other changes are not a Modify of DeployRole in place: $seen"
  [ -z "$(jq -r --argjson take '[]' -f "$OPS_DIR/unsafe-changes.jq" "$1")" ] || die "the guard names a change in it"
}
passes "layer four's change set is adds and a Modify of DeployRole in place, and the guard passes" \
  adds_and_one_modify "$OPS_DIR/testdata/changeset-app.json" "$WORK/env.json"
passes "  a later piece's resource in the template leaves it alone (the watch's topic, any other)" \
  adds_and_one_modify "$OPS_DIR/testdata/changeset-app.json" "$(mut '.Resources.Extra = {"Type":"AWS::SNS::Topic"}')"
refuses "  a layer-four resource the template lost is refused" "the template lacks layer four's 'UiRewrite'" \
  adds_and_one_modify "$OPS_DIR/testdata/changeset-app.json" "$(mut 'del(.Resources.UiRewrite)')"
refuses "  a change set that adds a resource beyond layer four's is refused" "not layer four's own" \
  adds_and_one_modify "$(jq -c '.Changes += [{"Type":"Resource","ResourceChange":{"Action":"Add","LogicalResourceId":"Alerts","ResourceType":"AWS::SNS::Topic","Scope":[],"Details":[]}}]' "$OPS_DIR/testdata/changeset-app.json" >"$WORK/cs-alerts.json"; echo "$WORK/cs-alerts.json")" "$WORK/env.json"
refuses "  a box that would be replaced is not that update" "not a Modify of DeployRole in place" \
  adds_and_one_modify "$(jq -c '.Changes += [{"Type":"Resource","ResourceChange":{"Action":"Modify","LogicalResourceId":"Box","ResourceType":"AWS::EC2::Instance","Replacement":"True","Scope":["Properties"],"Details":[]}}]' "$OPS_DIR/testdata/changeset-app.json" >"$WORK/cs-box.json"; echo "$WORK/cs-box.json")" "$WORK/env.json"

echo "== the records' copy: the S3 door, the bucket, the box's role, and the box kept in place (rows 1 to 4 of docs/plans/2026-11-11-continuous-copy.md)"
tojson "$OPS_DIR/network.yml" >"$WORK/network.json"
# nmut <jq program> → a copy of the network's JSON with the program applied
nmut() {
  jq -c "$1" "$WORK/network.json" >"$WORK/network-mut.json"
  echo "$WORK/network-mut.json"
}
# row 1: S3's gateway door on the one route table; still no internet gateway, no NAT, no address to put on one
# shellcheck disable=SC2016 # jq programs, in single quotes
network_guard() {
  must "$1" "the network has no S3 gateway door on its route table" \
    '.Resources.S3Door | .Type == "AWS::EC2::VPCEndpoint" and .Properties.VpcEndpointType == "Gateway" and .Properties.ServiceName == {"Fn::Sub":"com.amazonaws.${AWS::Region}.s3"} and .Properties.RouteTableIds == [{"Ref":"Routes"}] and .Properties.VpcId == {"Ref":"Vpc"}'
  must "$1" "the network has a way out other than the door (an internet gateway, a NAT, an elastic address, a route, or an interface endpoint)" \
    '([.Resources[] | .Type] | all(. != "AWS::EC2::InternetGateway" and . != "AWS::EC2::NatGateway" and . != "AWS::EC2::EIP" and . != "AWS::EC2::Route" and . != "AWS::EC2::VPCGatewayAttachment")) and ([.Resources[] | select(.Type == "AWS::EC2::VPCEndpoint") | .Properties.VpcEndpointType] | all(. == "Gateway"))'
}
passes "the network gains an S3 gateway door on its route table, and has no internet gateway and no NAT (row 1)" network_guard "$WORK/network.json"
refuses "  a network with no door is refused" "no S3 gateway door" network_guard "$(nmut 'del(.Resources.S3Door)')"
refuses "  an interface endpoint in place of the gateway is refused" "no S3 gateway door" \
  network_guard "$(nmut '.Resources.S3Door.Properties.VpcEndpointType = "Interface"')"
refuses "  an internet gateway is refused" "a way out other than the door" \
  network_guard "$(nmut '.Resources.Igw = {"Type":"AWS::EC2::InternetGateway"}')"
refuses "  a NAT is refused" "a way out other than the door" \
  network_guard "$(nmut '.Resources.Nat = {"Type":"AWS::EC2::NatGateway","Properties":{}}')"

# row 2: the copy's bucket
copy_bucket_guard() {
  must "$1" "CopyBucket does not block all public access" \
    '.Resources.CopyBucket.Properties.PublicAccessBlockConfiguration == {"BlockPublicAcls":true,"BlockPublicPolicy":true,"IgnorePublicAcls":true,"RestrictPublicBuckets":true}'
  must "$1" "CopyBucket is not encrypted" '.Resources.CopyBucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration | length == 1'
  must "$1" "CopyBucket is not kept on a stack delete and a replacement" \
    '.Resources.CopyBucket | .DeletionPolicy == "Retain" and .UpdateReplacePolicy == "Retain"'
  must "$1" "CopyBucket does not expire copies after seven days" \
    '.Resources.CopyBucket.Properties.LifecycleConfiguration.Rules | length == 1 and .[0].Status == "Enabled" and .[0].ExpirationInDays == 7'
  must "$1" "CopyBucket is a website, or has a policy of its own" \
    '([.Resources | to_entries[] | select(.value.Type == "AWS::S3::BucketPolicy" and (.value.Properties.Bucket | tostring | contains("CopyBucket")))] | length == 0) and (.Resources.CopyBucket.Properties | has("WebsiteConfiguration") | not)'
}
# row 3: the box's role
# shellcheck disable=SC2016 # jq programs, in single quotes
box_role_guard() {
  must "$1" "the box's role holds an action other than put and get under its own path, and list" \
    '[.Resources.BoxRole.Properties.Policies[].PolicyDocument.Statement[] | .Action | if type == "array" then .[] else . end] | sort == ["s3:GetObject","s3:ListBucket","s3:PutObject"]'
  must "$1" "the box's role reaches a resource other than CopyBucket, or put and get beyond its own box path" \
    '[.Resources.BoxRole.Properties.Policies[].PolicyDocument.Statement[] | select(.Action != "s3:ListBucket") | .Resource] == [{"Fn::Sub":"${CopyBucket.Arn}/Box/*"}] and ([.Resources.BoxRole.Properties.Policies[].PolicyDocument.Statement[] | select(.Action == "s3:ListBucket") | .Resource] == [{"Fn::GetAtt":["CopyBucket","Arn"]}])'
  must "$1" "the box's role has a statement that is not an Allow, or a managed policy" \
    '([.Resources.BoxRole.Properties.Policies[].PolicyDocument.Statement[] | .Effect] | all(. == "Allow")) and (.Resources.BoxRole.Properties | has("ManagedPolicyArns") | not)'
  must "$1" "the box's role lists beyond its own box path (the list's prefix condition is gone or wider)" \
    '[.Resources.BoxRole.Properties.Policies[].PolicyDocument.Statement[] | select(.Action == "s3:ListBucket") | .Condition] == [{"StringLike":{"s3:prefix":["Box/*"]}}]'
  must "$1" "the box's role is assumed by something other than EC2" \
    '.Resources.BoxRole.Properties.AssumeRolePolicyDocument.Statement | length == 1 and .[0].Principal == {"Service":"ec2.amazonaws.com"}'
  must "$1" "the box does not take BoxProfile, or BoxProfile does not hold BoxRole alone" \
    '.Resources.Box.Properties.IamInstanceProfile == {"Ref":"BoxProfile"} and .Resources.BoxProfile.Properties.Roles == [{"Ref":"BoxRole"}]'
}
# The hazard: an update that changes a create-only property of the box replaces it, and the records stay on the old one.
# The box gains IamInstanceProfile (in place) and nothing else: its property names are pinned, no inline Volumes, and the
# first-boot script is pinned by its hash (UserData is create-only in effect). A deliberate change here moves the pin.
box_in_place_guard() {
  must "$1" "the box's properties are not the pinned set (a new property may replace the box)" \
    '.Resources.Box.Properties | keys == ["BlockDeviceMappings","CreditSpecification","IamInstanceProfile","ImageId","InstanceType","MetadataOptions","NetworkInterfaces","Tags","UserData"]'
  [ "$(jq -j '.Resources.Box.Properties.UserData["Fn::Base64"]' "$1" | shasum -a 256 | cut -d' ' -f1)" = 9c594c9c06ed30a3c6204546fc8195e13eb9d72ab207b52bf30ca595e53f50fc ] ||
    die "the box's first-boot script changed: UserData replaces the box (mount the records disk in the release, not here)"
}
passes "the copy's bucket blocks public access, is encrypted, is kept, and expires copies after seven days (row 2)" copy_bucket_guard "$WORK/env.json"
refuses "  a bucket that allows public policy is refused" "block all public access" \
  copy_bucket_guard "$(mut '.Resources.CopyBucket.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy = false')"
refuses "  a bucket with no encryption is refused" "not encrypted" copy_bucket_guard "$(mut 'del(.Resources.CopyBucket.Properties.BucketEncryption)')"
refuses "  a bucket deleted with its stack is refused" "not kept" copy_bucket_guard "$(mut 'del(.Resources.CopyBucket.DeletionPolicy)')"
refuses "  a bucket deleted on a replacement is refused" "not kept" copy_bucket_guard "$(mut 'del(.Resources.CopyBucket.UpdateReplacePolicy)')"
refuses "  a bucket that expires copies after a day is refused" "seven days" \
  copy_bucket_guard "$(mut '.Resources.CopyBucket.Properties.LifecycleConfiguration.Rules[0].ExpirationInDays = 1')"
passes "the box's role may put, get and list its own path in its own bucket, and holds no delete (row 3)" box_role_guard "$WORK/env.json"
refuses "  a role that may delete is refused" "an action other than" \
  box_role_guard "$(mut '.Resources.BoxRole.Properties.Policies[0].PolicyDocument.Statement[0].Action += ["s3:DeleteObject"]')"
refuses "  a role over every bucket is refused" "a resource other than CopyBucket" \
  box_role_guard "$(mut '.Resources.BoxRole.Properties.Policies[0].PolicyDocument.Statement[0].Resource = "*"')"
# shellcheck disable=SC2016 # jq's program, in single quotes
refuses "  a role over the whole bucket, not its box path, is refused" "a resource other than CopyBucket" \
  box_role_guard "$(mut '.Resources.BoxRole.Properties.Policies[0].PolicyDocument.Statement[0].Resource = {"Fn::Sub":"${CopyBucket.Arn}/*"}')"
refuses "  a role that lists the whole bucket, its prefix condition gone, is refused" "lists beyond its own box path" \
  box_role_guard "$(mut 'del(.Resources.BoxRole.Properties.Policies[0].PolicyDocument.Statement[1].Condition)')"
refuses "  a role with a managed policy is refused" "managed policy" \
  box_role_guard "$(mut '.Resources.BoxRole.Properties.ManagedPolicyArns = ["arn:aws:iam::aws:policy/AdministratorAccess"]')"
refuses "  a box with no profile is refused" "does not take BoxProfile" box_role_guard "$(mut 'del(.Resources.Box.Properties.IamInstanceProfile)')"
passes "the box gains its profile and keeps every create-only property: its names and first-boot script are pinned" box_in_place_guard "$WORK/env.json"
refuses "  a property added to the box is refused" "not the pinned set" \
  box_in_place_guard "$(mut '.Resources.Box.Properties.Volumes = [{"Device":"/dev/sdf","VolumeId":"vol-1"}]')"
refuses "  a changed first-boot script is refused" "first-boot script changed" \
  box_in_place_guard "$(mut '.Resources.Box.Properties.UserData["Fn::Base64"] += "echo mount\n"')"

# copy_update <change set>: dies unless the update is the copy's five additions and a Modify of the box and of the
# deploy role, both in place, and the guard names nothing
copy_update() {
  local seen
  seen=$(jq -r '[.Changes[].ResourceChange | select(.Action == "Add") | .LogicalResourceId] | sort | join(" ")' "$1")
  [ "$seen" = "BoxProfile BoxRole CopyBucket RecordsAttachment RecordsVolume" ] || die "the change set adds '$seen'"
  seen=$(jq -r '[.Changes[].ResourceChange | select(.Action != "Add") | "\(.Action) \(.LogicalResourceId) \(.Replacement // "none")"] | sort | join(",")' "$1")
  [ "$seen" = "Modify Box False,Modify DeployRole False" ] || die "the change set's other changes are not a Modify of Box and DeployRole in place: $seen"
  [ -z "$(jq -r --argjson take '[]' -f "$OPS_DIR/unsafe-changes.jq" "$1")" ] || die "the guard names a change in it"
}
passes "the update on ridge, as CloudFormation shows it, adds the copy's five and modifies Box in place; the guard passes" \
  copy_update "$OPS_DIR/testdata/changeset-copy.json"
refuses "  a box shown as replaced is not that update, and the guard names it" "not a Modify of Box and DeployRole in place" \
  copy_update "$(jq -c '(.Changes[] | select(.ResourceChange.LogicalResourceId == "Box") | .ResourceChange.Replacement) = "True"' "$OPS_DIR/testdata/changeset-copy.json" >"$WORK/cs-copy-replaced.json"; echo "$WORK/cs-copy-replaced.json")"
check "  and stack.sh's guard refuses that box, naming it" "Box (AWS::EC2::Instance): Modify, replacement True" \
  "$(jq -c '(.Changes[] | select(.ResourceChange.LogicalResourceId == "Box") | .ResourceChange.Replacement) = "True"' "$OPS_DIR/testdata/changeset-copy.json" >"$WORK/cs-copy-replaced2.json"; jq -r --argjson take '[]' -f "$OPS_DIR/unsafe-changes.jq" "$WORK/cs-copy-replaced2.json")"
refuses "  a box shown as Conditional is not that update either" "not a Modify of Box" \
  copy_update "$(jq -c '(.Changes[] | select(.ResourceChange.LogicalResourceId == "Box") | .ResourceChange.Replacement) = "Conditional"' "$OPS_DIR/testdata/changeset-copy.json" >"$WORK/cs-copy-cond.json"; echo "$WORK/cs-copy-cond.json")"

echo "== the box's side of the copy: Litestream's pin, its configuration, the unit, the mount and the move (rows 7 to 12 of docs/plans/2026-11-11-continuous-copy.md)"
# need <file> <ERE> <what is missing>: dies unless a line of the file matches
CI_YML=$REPO_DIR/.github/workflows/ci.yml
# mutated <name> <sed expression> <file> → the path of a copy of the file with the expression applied
mutated() {
  sed "$2" "$3" >"$WORK/$1"
  echo "$WORK/$1"
}
need() { grep -qE -- "$2" "$1" || die "$3"; }
# first_before <file> <ERE first> <ERE second> <what is wrong>: dies unless the first match comes before the second, both present
first_before() {
  FB_A=$2 FB_B=$3 awk '$0 ~ ENVIRON["FB_A"] && !x {x=NR} $0 ~ ENVIRON["FB_B"] && !y {y=NR} END{exit !(x && y && x < y)}' "$1" || die "$4"
}
# records_block <release.sh> → the script the release runs on the box to mount the records disk
records_block() { sed -n "/<<'REMOTE' || RECORDS_RC/,/^REMOTE\$/p" "$1"; }
# row 7: the version and the sum have one home (the pin); the job and the release both compare the archive's sum before
# unpacking it, and nothing else holds the sum or the version
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
pin_guard() { # <pin> <release.sh> <lib.sh> <ci.yml>
  need "$1" '^LITESTREAM_VERSION=[0-9]+[.][0-9]+[.][0-9]+$' "the pin holds no version"
  need "$1" '^LITESTREAM_ARM64_SHA256=[0-9a-f]{64}$' "the pin holds no SHA-256 for the arm64 archive"
  local ver sum other
  ver=$(sed -n 's/^LITESTREAM_VERSION=//p' "$1")
  sum=$(sed -n 's/^LITESTREAM_ARM64_SHA256=//p' "$1")
  other=$(grep -cF -e "$sum" -e "$ver" "$2" "$3" "$4" | tr '\n' ' ')
  case $other in *:[1-9]*) die "the version or the sum is written outside the pin ($other)" ;; esac
  local step=$WORK/ci-litestream-step.txt
  sed -n '/name: Litestream, the pinned archive/,/^      # No stored key/p' "$4" >"$step"
  [ -s "$step" ] || die "the deploy job has no Litestream step"
  need "$step" 'sha256sum -c -$' "the deploy job does not check the Litestream archive's sum"
  first_before "$step" 'curl -fsSL' 'sha256sum -c -$' "the job checks the sum before it fetches"
  first_before "$4" 'name: Litestream, the pinned archive' 'run: bash ops/release.sh ridge' "the job releases before it fetches the archive"
  need "$4" 'LITESTREAM_ARCHIVE: ' "the job does not hand the archive to the release"
  first_before "$3" 'LITESTREAM_ARM64_SHA256" ]' 'tar -xzf' "the release unpacks the archive before comparing its sum"
  need "$3" 'die "the Litestream archive is' "the release has no refusal for an archive that is not the pin's"
}
# unpack_with <pin dir> <archive>: litestream_binary on a pin and an archive of the test's own, 
unpack_with() {
  local WORK=$1/work
  mkdir -p "$WORK"
  LITESTREAM_PIN=$1/litestream.pin LITESTREAM_ARCHIVE=$2 litestream_binary "$1/out"
}
lpin=$WORK/lpin
mkdir -p "$lpin"
printf 'a binary' >"$lpin/litestream"
tar -czf "$lpin/real.tar.gz" -C "$lpin" litestream
printf 'another' >"$lpin/litestream"
tar -czf "$lpin/other.tar.gz" -C "$lpin" litestream
printf 'LITESTREAM_VERSION=0.0.1\nLITESTREAM_ARM64_SHA256=%s\n' "$(shasum -a 256 "$lpin/real.tar.gz" | cut -d' ' -f1)" >"$lpin/litestream.pin"
printf 'LITESTREAM_VERSION=0.0.1\nLITESTREAM_ARM64_SHA256=FILL\n' >"$WORK/fill.pin"
passes "the pin, the job and the release: one home for the version and the sum, each checking the archive before it is unpacked (row 7)" \
  pin_guard "$OPS_DIR/litestream.pin" "$OPS_DIR/release.sh" "$OPS_DIR/lib.sh" "$CI_YML"
refuses "  a sum written in the release too is refused" "outside the pin" \
  pin_guard "$OPS_DIR/litestream.pin" "$(mutated release-sum.sh "s#^set -euo pipefail#LS_SUM=$(sed -n 's/^LITESTREAM_ARM64_SHA256=//p' "$OPS_DIR/litestream.pin")#" "$OPS_DIR/release.sh")" "$OPS_DIR/lib.sh" "$CI_YML"
refuses "  a pin that is a FILL marker is refused" "holds no SHA-256" \
  pin_guard "$WORK/fill.pin" "$OPS_DIR/release.sh" "$OPS_DIR/lib.sh" "$CI_YML"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a deploy job that does not compare the archive's sum is refused" "does not check the Litestream archive's sum" \
  pin_guard "$OPS_DIR/litestream.pin" "$OPS_DIR/release.sh" "$OPS_DIR/lib.sh" "$(mutated wf-nosum.yml '/LITESTREAM_ARM64_SHA256  \$archive/d' "$CI_YML")"
passes "  the release unpacks an archive whose sum is the pin's" unpack_with "$lpin" "$lpin/real.tar.gz"
refuses "  and refuses one whose sum is not, unpacking nothing" "the pin says" unpack_with "$lpin" "$lpin/other.tar.gz"
fill_pin() { LITESTREAM_PIN=$WORK/fill.pin litestream_pin; }
refuses "  a pin with a FILL marker stops the release before anything is fetched" "holds no SHA-256" fill_pin
# row 8: the copy's configuration
# shellcheck disable=SC2016 # the file's source text is searched, not expanded
copy_config_guard() { # <litestream.yml> <release.sh>
  need "$1" '^  enabled: false$' "the copy's own deleting is not off"
  need "$1" '^  - path: /var/lib/c-storage/c-storage[.]db$' "the configuration does not name the records' file"
  need "$1" '^      url: \$\{COPY_URL\}$' "the copy's address is not the box's path"
  need "$1" '^      sync-interval: 1s$' "the copy does not sync every second"
  need "$1" '^  interval: 24h$' "the copy does not take a full copy a day"
  need "$2" "COPY_URL=s3://%s/%s[?]region=%s" "the release writes an address with no region (Litestream then asks us-east-1 where the bucket is, which the box cannot reach)"
  need "$2" '"[$]COPY_BUCKET" "[$]COPY_PATH" "[$]CREDO_REGION"' "the release builds the address from something other than the bucket, COPY_PATH and the region"
  ! grep -v '^ *#' "$2" | grep -qF 'Box/records' || die "the release writes the box's path in the bucket as a literal, not from COPY_PATH"
}
passes "the copy's configuration names the records' file, the box's path, a sync a second, a full copy a day and its own deleting off (row 8)" \
  copy_config_guard "$OPS_DIR/litestream.yml" "$OPS_DIR/release.sh"
refuses "  a configuration that deletes in the bucket is refused" "own deleting is not off" \
  copy_config_guard "$(mutated ls-del.yml 's#^  enabled: false#  enabled: true#' "$OPS_DIR/litestream.yml")" "$OPS_DIR/release.sh"
refuses "  an address with no region is refused" "writes an address with no region" \
  copy_config_guard "$OPS_DIR/litestream.yml" "$(mutated release-noregion.sh 's#COPY_URL=s3://%s/%s?region=%s#COPY_URL=s3://%s/%s#' "$OPS_DIR/release.sh")"
refuses "  and one whose path is written out in the release again" "as a literal" \
  copy_config_guard "$OPS_DIR/litestream.yml" "$(mutated release-literal.sh 's#^RECORDS_VOLUME=#BOX_PATH=Box/records; RECORDS_VOLUME=#' "$OPS_DIR/release.sh")"
# row 9: the unit
# shellcheck disable=SC2016 # the file's source text is searched, not expanded
unit_guard() { # <c-storage.service> <lib.sh>
  need "$1" '^ExecStart=/opt/c-storage/litestream replicate .*-exec /opt/c-storage/c-storage$' "the unit does not start Litestream with c-storage as its child"
  need "$1" '^RequiresMountsFor=/var/lib/private/c-storage$' "the unit does not wait on the records disk's mount"
  need "$1" '^EnvironmentFile=/etc/c-storage/copy.env$' "the unit does not read the copy's address"
  need "$2" '^RECORDS_MOUNT=/var/lib/private/c-storage$' "the scripts and the unit name different mounts"
}
passes "c-storage's unit starts Litestream with c-storage as its child, and waits on the records disk's mount (row 9)" \
  unit_guard "$OPS_DIR/c-storage.service" "$OPS_DIR/lib.sh"
refuses "  a unit that starts c-storage alone is refused" "c-storage as its child" \
  unit_guard "$(mutated unit-plain.service 's#^ExecStart=.*#ExecStart=/opt/c-storage/c-storage#' "$OPS_DIR/c-storage.service")" "$OPS_DIR/lib.sh"
refuses "  a unit that does not wait on the mount is refused" "wait on the records disk" \
  unit_guard "$(mutated unit-nomount.service '/^RequiresMountsFor=/d' "$OPS_DIR/c-storage.service")" "$OPS_DIR/lib.sh"
# row 10: the release stops before the restart when the disk is not mounted
# shellcheck disable=SC2016 # the file's source text is searched, not expanded
mount_refusal_guard() { # <release.sh>
  need "$1" 'mountpoint -q \$RECORDS_MOUNT" \|\| die "the records disk is not mounted' "the release does not refuse a records disk that is not mounted"
  first_before "$1" 'mountpoint -q \$RECORDS_MOUNT" \|\| die' 'systemctl restart c-storage' "the release restarts c-storage before it reads the mount"
}
passes "a release refuses to start c-storage when the records disk is not mounted (row 10)" mount_refusal_guard "$OPS_DIR/release.sh"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a release with no such refusal is refused" "does not refuse a records disk" \
  mount_refusal_guard "$(mutated release-nomount.sh '/mountpoint -q \$RECORDS_MOUNT" || die/d' "$OPS_DIR/release.sh")"
# row 11: a file on the system disk moves once, c-storage stopped, and the old one is kept
# shellcheck disable=SC2016 # the file's source text is searched, not expanded
move_guard() { # <release.sh>
  local b=$WORK/records-block.sh
  records_block "$1" >"$b"
  [ -s "$b" ] || die "the release has no records disk step"
  first_before "$b" 'systemctl stop c-storage' 'cp -p "\$old" ' "the file is copied before c-storage is stopped"
  first_before "$b" 'cp -p "\$old" ' 'mv "\$old" "\$old[.]moved"' "the old file is set aside before it is copied"
  first_before "$b" '\[ -e "\$tmp/c-storage.db" \]' 'cp -p "\$old" ' "the file is moved without asking whether the disk holds one already"
  [ "$(grep -cE '(^|[ ;])(rm|shred|unlink) ' "$b")" = 0 ] || die "the records disk step deletes a file"
}
passes "a file on the system disk is moved once onto a blank records disk with c-storage stopped, and the old one is kept (row 11)" move_guard "$OPS_DIR/release.sh"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a release that deletes the old file is refused" "deletes a file" \
  move_guard "$(mutated release-rm.sh 's#mv "\$old" "\$old.moved"#rm -f "$old"; mv "$old" "$old.moved"#' "$OPS_DIR/release.sh")"
# row 12: a records disk with no c-storage.db and a copy waiting is a restore, never a fresh start: blank, hand-formatted
# or hand-mounted alike, refused before anything is formatted or started, naming the one scripted path
# shellcheck disable=SC2016 # the file's source text is searched, not expanded
blank_guard() { # <release.sh>
  local b=$WORK/records-block.sh
  records_block "$1" >"$b"
  need "$b" 'list-objects-v2 --bucket "\$bucket" --prefix "\$cpath/"' "the release does not list the box's path in the bucket"
  first_before "$b" '^  if copy_held; then refuse_held; fi' 'mkfs[.]xfs' "the disk is formatted before the bucket is read"
  need "$b" '^  exit 4$' "a copy in the bucket does not end the step with exit 4"
  [ "$(grep -c '^ *if \[ ! -e "\$mnt/c-storage.db" \] && copy_held; then refuse_held; fi' "$b")" = 2 ] ||
    die "a disk with no c-storage.db, formatted or mounted by hand, is not refused when the bucket holds a copy (both the mounted case and the check after the mount)"
  need "$1" '4\) die "the records disk holds no c-storage.db and the bucket holds a copy' "the release does not name the refusal"
  need "$1" 'ops/restore.sh \$ENVNAME --onto-blank' "the release does not name the one scripted restore"
}
passes "a records disk with no c-storage.db whose box path in the bucket holds a copy refuses a fresh start, blank or mounted by hand, and names ops/restore.sh --onto-blank (row 12)" blank_guard "$OPS_DIR/release.sh"
refuses "  a release that formats first is refused" "formatted before the bucket" \
  blank_guard "$(awk '/^  if copy_held; then refuse_held; fi/ && !d {print "  mkfs.xfs -q \"$dev\""; d=1} {print}' "$OPS_DIR/release.sh" >"$WORK/release-mkfs.sh"; echo "$WORK/release-mkfs.sh")"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a release whose refusal never stops it is refused" "does not end the step with exit 4" \
  blank_guard "$(mutated release-nostop.sh 's#^  exit 4$#  exit 0#' "$OPS_DIR/release.sh")"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a release that lets a hand-formatted disk through to c-storage is refused" "formatted or mounted by hand" \
  blank_guard "$(mutated release-nohand.sh '/^mount "$mnt"$/,/records disk: mounted at/{/copy_held; then refuse_held/d;}' "$OPS_DIR/release.sh")"
# the restore reads the address from the same file the unit does (the region is in it), onto a new file, the live path, or a blank disk
# shellcheck disable=SC2016 # the file's source text is searched, not expanded
restore_address_guard() { # <lib.sh>
  [ "$(grep -cE '^("[$]bin"|/opt/c-storage/litestream) restore .* "[$]COPY_URL"$' "$1")" = 2 ] || die "a restore does not read the address the release wrote"
  [ "$(grep -cE '^(\. |envf=)/etc/c-storage/copy.env$' "$1")" = 2 ] || die "a restore does not read the unit's copy.env"
}
passes "  and the restore, onto a new file, the live path or a blank disk, restores from the address the release wrote (the unit's file)" restore_address_guard "$OPS_DIR/lib.sh"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a restore from an address of its own is refused" "does not read the address" \
  restore_address_guard "$(mutated lib-addr.sh '/litestream restore/s#"$COPY_URL"$#"s3://elsewhere/Box/records"#' "$OPS_DIR/lib.sh")"

echo "== the check reads the copy (row 15) and the restore writes a new file and moves nothing live aside for good (row 16) (docs/plans/2026-11-11-continuous-copy.md)"
# row 15: copy_problems on written input. Now is 10:10:00 on the 12th.
cp_now=$(jq -n '"2026-11-12T10:10:00Z" | fromdateiso8601')
cp_status() { printf '{"freeBytes": %s, "lastWriteAt": %s}' "$1" "$2"; } # <free bytes> <quoted time or null>
cp_listing() { # <newest copy's time> <newest full copy's time>
  # the S3 client's own layout, written out here and not read from the constant: <path>/<four hex digits of the level>/<name>
  printf '[{"Key":"Box/records/0000/0000000000000001-0000000000000002.ltx","LastModified":"%s"},{"Key":"Box/records/0009/0000000000000001-0000000000000001.ltx","LastModified":"%s"}]' "$1" "$2"
}
# copy_eval <lib.sh> <status> <listing>: the faults that file's own copy_problems names (the constants stay this tree's)
copy_eval() {
  ( eval "$(sed -n '/^copy_problems() {/,/^}/p' "$1")"; copy_problems "$2" "$3" "$cp_now" )
}
cp_ok_status=$(cp_status 5000000000 '"2026-11-12T10:00:00.123456789Z"')
cp_ok_list=$(cp_listing 2026-11-12T10:00:00+00:00 2026-11-12T00:00:00+00:00)
check "row 15: the limits are five minutes, six days and 1 GiB" "300 518400 1024" "$COPY_LAG_S $COPY_FULL_MAX_S $FLOOR_RECORDS_MB"
check "row 15: a copy as new as the last write, a full copy of today and a roomy disk are sound" "" "$(copy_eval "$OPS_DIR/lib.sh" "$cp_ok_status" "$cp_ok_list")"
check "  a copy exactly five minutes behind the last write is still sound" "" \
  "$(copy_eval "$OPS_DIR/lib.sh" "$cp_ok_status" "$(cp_listing 2026-11-12T09:55:00+00:00 2026-11-12T00:00:00+00:00)")"
cp_lag=$(cp_listing 2026-11-12T09:50:00+00:00 2026-11-12T00:00:00+00:00)
cp_old=$(cp_listing 2026-11-12T10:00:00+00:00 2026-11-05T00:00:00+00:00)
cp_low=$(cp_status 1000000 '"2026-11-12T10:00:00Z"')
check "  a copy over five minutes behind the last write is red, and only that" "the newest copy lags the last write by 600 s, over 300 s" "$(copy_eval "$OPS_DIR/lib.sh" "$cp_ok_status" "$cp_lag")"
check "  a newest full copy over six days old is red, and only that" "the newest full copy is 7 days old, over 6 days" "$(copy_eval "$OPS_DIR/lib.sh" "$cp_ok_status" "$cp_old")"
check "  a records disk below its floor is red, and only that" "the records disk has 0 MiB free, below the floor of 1024 MiB" "$(copy_eval "$OPS_DIR/lib.sh" "$cp_low" "$cp_ok_list")"
check "  an empty bucket is red for no copy and no full copy; a file not yet written is not a lag" "the bucket holds no copy of the records|the bucket holds no full copy" \
  "$(copy_eval "$OPS_DIR/lib.sh" "$(cp_status 5000000000 null)" null | paste -sd'|' -)"
check "  a copy with no full copy is red, and a write time in S3's own form (+00:00) is read" "the bucket holds no full copy" \
  "$(copy_eval "$OPS_DIR/lib.sh" "$cp_ok_status" "$(cp_listing 2026-11-12T10:00:00+00:00 2026-11-12T00:00:00+00:00 | jq -c --arg p "$COPY_FULL_PREFIX" 'map(select(.Key | startswith($p) | not))')")"
check "  the full copies' prefix is the S3 client's <path>/0009/, declared once" "Box/records/0009/" "$COPY_FULL_PREFIX"
check "  a bucket laid out as the file replica's ltx/9/ holds no full copy for the check (the layout is S3's, not a folder's)" "the bucket holds no full copy" \
  "$(copy_eval "$OPS_DIR/lib.sh" "$cp_ok_status" "$(cp_listing 2026-11-12T10:00:00+00:00 2026-11-12T00:00:00+00:00 | sed 's#Box/records/0009/#Box/records/ltx/9/#; s#Box/records/0000/#Box/records/ltx/0/#')")"
# the newest full copy is the largest key, not the latest LastModified: the older name is the one touched today
cp_keyorder='[{"Key":"Box/records/0009/0000000000000001-0000000000000001.ltx","LastModified":"2026-11-12T00:00:00+00:00"},{"Key":"Box/records/0009/0000000000000001-0000000000000009.ltx","LastModified":"2026-11-05T00:00:00+00:00"},{"Key":"Box/records/0000/0000000000000009-0000000000000009.ltx","LastModified":"2026-11-12T10:00:00+00:00"}]'
check "  the newest full copy is the one with the largest name, not the latest LastModified" "the newest full copy is 7 days old, over 6 days" \
  "$(copy_eval "$OPS_DIR/lib.sh" "$cp_ok_status" "$cp_keyorder")"
# row 16: the restore's box script and the script that calls it, read as text
# shellcheck disable=SC2016 # the file's source text is searched, not expanded
restore_guard() { # <lib.sh> <restore.sh>
  local b=$WORK/restore-block.sh
  sed -n '/^box_restore() {/,/^REMOTE$/p' "$1" >"$b"
  [ -s "$b" ] || die "lib.sh has no box_restore"
  need "$b" '^new=\$mount/restored-\$stamp[.]db$' "the restore does not name a new file by default"
  need "$b" '^args=\(-o "\$new"\)$' "the restore does not write to the new file"
  [ "$(grep -c -- '-o "\$db"' "$b")" = 0 ] || die "the restore writes to the live path"
  first_before "$b" '^if \[ "\$live" = 1 \]; then$' 'systemctl stop c-storage' "c-storage is stopped outside the live branch"
  first_before "$b" 'systemctl stop c-storage' 'mv "\$f" "\$f[.]aside-\$stamp"' "the live file is moved aside before c-storage is stopped"
  first_before "$b" 'mv "\$f" "\$f[.]aside-\$stamp"' 'mv "\$new" "\$db"' "the restored file takes the live path before the live file is set aside"
  [ "$(grep -cE '(^|[ ;])(rm|shred|unlink) ' "$b")" = 0 ] || die "the restore deletes a file"
  need "$b" '^if \[ "\$free" -lt \$\(\(used \* 2\)\) \]; then$' "the restore does not look at the records disk's free space before it writes"
  first_before "$b" '^if \[ "\$free" -lt ' '^/opt/c-storage/litestream restore' "the restore looks at the free space after it has written"
  need "$2" '^ONTO_LIVE=0$' "the restore does not default to a new file"
  need "$2" 'box_restore "\$AT" "\$ONTO_LIVE"' "the restore script does not pass the flag on"
  need "$2" '"\$REAL" = 1 \] && \[ "\$ONTO_LIVE" = 1 \]' "the restore does not refuse the live path on an environment that may hold real data"
}
passes "the restore writes a new file by default, writes the live path only when named, and moves the live file aside, never deleting it (row 16)" \
  restore_guard "$OPS_DIR/lib.sh" "$OPS_DIR/restore.sh"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a restore that writes to the live path is refused" "does not write to the new file" \
  restore_guard "$(mutated lib-live.sh 's#^args=(-o "\$new")$#args=(-o "$db")#' "$OPS_DIR/lib.sh")" "$OPS_DIR/restore.sh"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a restore that deletes the live file instead of moving it aside is refused" "deletes a file" \
  restore_guard "$(mutated lib-rm.sh 's#mv "\$f" "\$f.aside-\$stamp"#rm -f "$f"; mv "$f" "$f.aside-$stamp"#' "$OPS_DIR/lib.sh")" "$OPS_DIR/restore.sh"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a restore that fills the live disk (no look at the free space first) is refused" "free space before it writes" \
  restore_guard "$(mutated lib-nofree.sh 's#^if \[ "$free" -lt .*#if false; then#' "$OPS_DIR/lib.sh")" "$OPS_DIR/restore.sh"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a restore script that puts the live path first is refused" "does not default to a new file" \
  restore_guard "$OPS_DIR/lib.sh" "$(mutated restore-live.sh 's#^ONTO_LIVE=0$#ONTO_LIVE=1#' "$OPS_DIR/restore.sh")"
# the box's script, read as text: it formats only a disk with no filesystem, mounts, then restores onto the records path, refusing a running c-storage or a disk that holds a file
# shellcheck disable=SC2016 # the file's source text is searched, not expanded
blank_restore_guard() { # <lib.sh>
  local b=$WORK/blank-block.sh
  sed -n '/^box_restore_blank() {/,/^REMOTE$/p' "$1" >"$b"
  [ -s "$b" ] || die "lib.sh has no box_restore_blank"
  need "$b" 'systemctl is-active --quiet c-storage' "the blank-disk restore does not refuse a running c-storage"
  need "$b" '^\[ ! -e "\$mount/c-storage.db" \] \|\| \{ echo "the records disk already holds c-storage.db' "the blank-disk restore does not refuse a disk that holds a c-storage.db"
  first_before "$b" 'mkfs[.]xfs' '^"\$bin" restore' "the disk is not formatted before the restore"
  first_before "$b" '^ *mount "\$mount"$' '^"\$bin" restore' "the restore runs before the disk is mounted"
  first_before "$b" 'systemctl is-active --quiet c-storage' 'mkfs[.]xfs' "a running c-storage is looked for after the disk is formatted"
  need "$b" '^args=\(-o "\$mount/c-storage.db"\)$' "the blank-disk restore does not write onto the records path"
  need "$b" '\[ -z "\$type" \] \|\| \[ "\$type" = xfs \]' "the blank-disk restore formats or mounts a filesystem that is not XFS"
  need "$b" '^if \[ ! -e "\$envf" \]; then envf=/opt/c-storage/copy.env.new; fi$' "the blank-disk restore does not fall back to the release's copy.env.new on a box no release has finished on"
  need "$b" '^if \[ ! -x "\$bin" \]; then bin=/opt/c-storage/litestream.new; chmod 0755 "\$bin"; fi$' "the blank-disk restore does not fall back to the release's litestream.new on a box no release has finished on"
  [ "$(grep -cE '(^|[ ;])(rm|shred|unlink) ' "$b")" = 0 ] || die "the blank-disk restore deletes a file"
}
passes "the blank-disk restore looks for a running c-storage first, formats only a disk with no filesystem, mounts, and restores onto the records path, refusing a disk that holds a c-storage.db" \
  blank_restore_guard "$OPS_DIR/lib.sh"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a restore that needs the installed copy.env on a replacement box (only the .new files are there) is refused" "copy.env.new" \
  blank_restore_guard "$(mutated lib-blank-new.sh '/^if \[ ! -e "$envf" \]; then envf=/d' "$OPS_DIR/lib.sh")"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  and one that needs the installed binary is refused" "litestream.new" \
  blank_restore_guard "$(mutated lib-blank-bin.sh '/^if \[ ! -x "$bin" \]; then bin=/d' "$OPS_DIR/lib.sh")"
# The fstab line, run on a copy of fstab: a disk whose UUID is not the one fstab holds for the mount (a new disk on
# the same box) gets its own line in place of the old, other lines kept, and a repeat changes nothing
fstab_probe() { # <script holding the line> → dies unless the line leaves exactly the new disk's line for the mount
  local line f=$WORK/fstab-probe
  line=$(grep -m1 'etc/fstab' "$1" | sed "s#/etc/fstab#$f#g")
  printf 'UUID=oldold /var/lib/private/c-storage xfs defaults,nofail 0 2\nUUID=keep / xfs defaults 0 0\n' >"$f"
  uuid=newnew mount=/var/lib/private/c-storage mnt=/var/lib/private/c-storage bash -c "$line" || die "the fstab line failed"
  uuid=newnew mount=/var/lib/private/c-storage mnt=/var/lib/private/c-storage bash -c "$line" || die "the fstab line failed on a repeat"
  if [ "$(grep -c 'c-storage' "$f")" != 1 ] || ! grep -q '^UUID=newnew /var/lib/private/c-storage ' "$f" || ! grep -q '^UUID=keep ' "$f"; then
    die "a new disk is mounted by the old disk's fstab line: $(tr '\n' '|' <"$f")"
  fi
}
fstab_both() { fstab_probe "$OPS_DIR/lib.sh" && fstab_probe "$OPS_DIR/release.sh"; }
passes "a new disk on the same box replaces the old disk's fstab line, keeps the others, and a repeat adds none (records step and blank restore)" \
  fstab_both
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a fstab line that keeps the old disk's UUID is refused" "old disk's fstab line" \
  fstab_probe "$(mutated lib-fstab.sh 's#^  grep -q "^UUID=$uuid $mount " /etc/fstab .*#  grep -q " $mount " /etc/fstab || echo "UUID=$uuid $mount xfs defaults,nofail 0 2" >>/etc/fstab#' "$OPS_DIR/lib.sh")"
# the free-space sum with c-storage stopped (no -wal beside the file), under the box script's own options
used_probe() { # <lib.sh> → dies unless the sum is the file's size when there is no -wal
  local d=$WORK/used-probe snippet
  mkdir -p "$d"
  head -c 4096 /dev/zero >"$d/c-storage.db"
  rm -f "$d/c-storage.db-wal"
  snippet=$(sed -n '/^box_restore() {/,/^REMOTE$/p' "$1" | awk '/^used=/ {f = 1} /^free=/ {f = 0} f')
  [ -n "$snippet" ] || die "lib.sh has no free-space sum"
  [ "$(bash -c "set -euo pipefail; db=$d/c-storage.db; $snippet; echo \$used")" = 4 ] || die "the free-space sum stops the restore when c-storage is stopped (no -wal beside the file)"
}
passes "the default restore's free-space sum does not stop the script when c-storage is stopped and there is no -wal" used_probe "$OPS_DIR/lib.sh"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  the one-line sum over both names (the first build) is refused" "no -wal beside" \
  used_probe "$(awk '/^used=0$/ {print "used=$(du -sk \"$db\" \"$db-wal\" 2>/dev/null | awk '"'"'{s+=$1} END{print s+0}'"'"')"; skip = 3; next} skip > 0 {skip--; next} {print}' "$OPS_DIR/lib.sh" >"$WORK/lib-du.sh"; echo "$WORK/lib-du.sh")"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a restore that does not look for a running c-storage is refused" "running c-storage" \
  blank_restore_guard "$(mutated lib-blank-run.sh 's#systemctl is-active --quiet c-storage#false#' "$OPS_DIR/lib.sh")"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a restore that formats any disk is refused" "not XFS" \
  blank_restore_guard "$(mutated lib-blank-fs.sh 's#\[ -z "$type" \] || \[ "$type" = xfs \] || ##' "$OPS_DIR/lib.sh")"
# shellcheck disable=SC2016 # sed programs, in single quotes
refuses "  a restore that goes ahead over a c-storage.db on the disk is refused" "holds a c-storage.db" \
  blank_restore_guard "$(mutated lib-blank-file.sh '/^\[ ! -e "$mount\/c-storage.db" \] || /d' "$OPS_DIR/lib.sh")"


echo "== the code here is origin/main's (every path ci.yml's push trigger deploys on; release, check, drill and stack run only reviewed code); in the deploy job, the checked-out commit's"
git_repo() { git -C "$WORK/repo" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false "$@"; }
# A scratch repository of the paths a script can run or deploy, and one (docs/) it cannot. Its ci.yml
# is the reviewed base's list: ops_match_main reads it from there.
scratch_ci() { # <the extra push paths, one a line, each already '      - "x"'>
  printf 'name: CI\n\non:\n  push:\n    paths:\n      - "ops/**"\n      - "scripts/**"\n      - "bff/**"\n      - "shared/**"\n      - "ui/**"\n      - "package.json"\n      - ".github/workflows/ci.yml"\n%s  pull_request:\n    paths:\n      - "ops/**"\n\njobs:\n' "$1"
}
mkdir -p "$WORK/repo/ops" "$WORK/repo/scripts" "$WORK/repo/bff" "$WORK/repo/shared" "$WORK/repo/ui" "$WORK/repo/docs" "$WORK/repo/.github/workflows"
git -C "$WORK/repo" init -q
echo 'echo reviewed' >"$WORK/repo/ops/a.sh"
echo 'reviewed' >"$WORK/repo/scripts/s.ts"
echo 'reviewed' >"$WORK/repo/bff/b.ts"
echo 'reviewed' >"$WORK/repo/shared/h.ts"
echo 'reviewed' >"$WORK/repo/ui/u.ts"
echo 'reviewed' >"$WORK/repo/docs/d.md"
scratch_ci '' >"$WORK/repo/.github/workflows/ci.yml"
# The repository's own ignores for what the deploy job installs and builds (the real .gitignore's lines).
printf 'dist\nnode_modules/\ncoverage\nplaywright-report/\ntest-results/\n' >"$WORK/repo/.gitignore"
git_repo add -A
git_repo commit -q -m main
old_sha=$(git_repo rev-parse HEAD)
git_repo update-ref refs/remotes/origin/main HEAD
# What the deploy job's installs and builds leave in the deployed paths, all ignored: it stays in the
# tree for every case below, so each pass is a pass with the outputs present.
mkdir -p "$WORK/repo/scripts/node_modules/x" "$WORK/repo/bff/dist" "$WORK/repo/ui/dist" "$WORK/repo/shared/coverage" "$WORK/repo/ui/test-results" "$WORK/repo/ui/playwright-report"
echo 'built' >"$WORK/repo/scripts/node_modules/x/index.js"
echo 'built' >"$WORK/repo/bff/dist/server.js"
echo 'built' >"$WORK/repo/ui/dist/index.html"
echo 'built' >"$WORK/repo/shared/coverage/c.json"
echo 'built' >"$WORK/repo/ui/test-results/r.txt"
echo 'built' >"$WORK/repo/ui/playwright-report/index.html"
# GITHUB_ACTIONS is set to nothing in the by-hand case: this suite runs in GitHub's own job too.
at_repo() { GITHUB_ACTIONS='' REPO_DIR=$WORK/repo ops_match_main; }
at_repo_job() { GITHUB_ACTIONS=true REPO_DIR=$WORK/repo ops_match_main; }
passes "a clean tree passes, with the ignored build outputs present" at_repo
passes "in the deploy job, the checked-out commit's tree passes with ignored build outputs present" at_repo_job
# The ignores carry that pass: a base commit without the .gitignore, the same outputs untracked.
git_repo rm -q .gitignore
git_repo commit -q -m 'no ignores'
git_repo update-ref refs/remotes/origin/main HEAD
refuses "  and with a base that lacks the .gitignore the same tree is refused, so the ignores are what carry it" "differs from this commit's" at_repo_job
git_repo reset -q --hard "$old_sha"
git_repo update-ref refs/remotes/origin/main "$old_sha"
echo '# one local line' >>"$WORK/repo/.gitignore"
refuses "a clean tree with one line appended to .gitignore is refused, which would hide any new file" "differs from origin/main's" at_repo
git_repo checkout -q -- .gitignore
check "the line names the code, not the folder" "1 0" \
  "$(at_repo 2>&1 | grep -c 'the code here (tracked and unignored files under every path ci.yml deploys on, and .gitignore) is origin/main') $(at_repo 2>&1 | grep -c 'ops/ is')"
echo 'echo edited' >"$WORK/repo/ops/a.sh"
refuses "an edited script is refused" "the code here (tracked and unignored files under every path ci.yml deploys on, and .gitignore) differs from origin/main's" at_repo
refuses "  and in the job, against its own commit" "the code here (tracked and unignored files under every path ci.yml deploys on, and .gitignore) differs from this commit's" at_repo_job
git_repo checkout -q -- ops/a.sh
echo 'echo new' >"$WORK/repo/ops/b.sh"
refuses "a new script is refused" "differs from origin/main's" at_repo
refuses "  and in the job" "differs from this commit's" at_repo_job
rm "$WORK/repo/ops/b.sh"
echo 'edited' >"$WORK/repo/scripts/s.ts"
refuses "an edited file under scripts/ is refused by hand" "differs from origin/main's" at_repo
refuses "  and in the job" "differs from this commit's" at_repo_job
git_repo checkout -q -- scripts/s.ts
echo 'new' >"$WORK/repo/scripts/n.ts"
refuses "an untracked file under scripts/ is refused by hand" "differs from origin/main's" at_repo
refuses "  and in the job" "differs from this commit's" at_repo_job
rm "$WORK/repo/scripts/n.ts"
for f in bff/b.ts shared/h.ts ui/u.ts; do
  echo 'edited' >"$WORK/repo/$f"
  refuses "an edited file, $f, is refused by hand" "differs from origin/main's" at_repo
  git_repo checkout -q -- "$f"
done
echo 'edited' >"$WORK/repo/docs/d.md"
echo 'new' >"$WORK/repo/docs/n.md"
passes "an edit and a new file outside the deployed paths (docs/) do not refuse a by-hand run" at_repo
git_repo checkout -q -- docs/d.md
rm "$WORK/repo/docs/n.md"
git_repo update-ref -d refs/remotes/origin/main
refuses "an unknown origin/main is refused" "origin/main is unknown" at_repo
# A branch main does not hold, its edit committed: the tree is clean against HEAD, which a diff
# against HEAD passes, and the base is origin/main.
git_repo update-ref refs/remotes/origin/main "$old_sha"
git_repo checkout -q -b branch-edit "$old_sha"
echo 'committed edit' >"$WORK/repo/scripts/s.ts"
git_repo commit -q -am 'edit scripts on a branch'
check "the branch's tree is clean against its own HEAD" 0 "$(git_repo diff --quiet HEAD && echo 0 || echo 1)"
refuses "a worktree on a branch main does not hold is refused, though its tree is clean against HEAD" "differs from origin/main's" at_repo
git_repo checkout -q --detach "$old_sha"
# main moves on twice: a commit that changes scripts/ alone, then one that changes ops/ as well.
echo 'moved on' >"$WORK/repo/scripts/s.ts"
git_repo commit -q -am mid
mid_sha=$(git_repo rev-parse HEAD)
git_repo update-ref refs/remotes/origin/main "$mid_sha"
git_repo checkout -q --detach "$old_sha"
refuses "by hand, a clone at an earlier commit of main that differs in scripts/ alone is refused" "differs from origin/main's" at_repo
git_repo checkout -q --detach "$mid_sha"
# A push lands during the deploy: origin/main moves on to a commit that changes ops/, and the job
# still holds the commit it checked out.
echo 'echo pushed meanwhile' >"$WORK/repo/ops/a.sh"
git_repo commit -q -am newer
new_sha=$(git_repo rev-parse HEAD)
git_repo update-ref refs/remotes/origin/main "$new_sha"
git_repo checkout -q --detach "$old_sha"
refuses "by hand, a clone behind main's ops/ is refused" "differs from origin/main's" at_repo
passes "in the job, a push that landed meanwhile does not turn a sound deploy red" at_repo_job
git_repo checkout -q -b side "$old_sha"
git_repo commit -q --allow-empty -m side
side_sha=$(git_repo rev-parse HEAD)
refuses "in the job, a commit that main does not hold is refused" "not a commit of main" at_repo_job
git_repo checkout -q --detach "$new_sha"
# The path set is ci.yml's, nothing in lib.sh: a path added to the push trigger is compared at once.
mk_scratch() { # <dir> <the extra push paths for its ci.yml>
  mkdir -p "$1/ops" "$1/extra" "$1/.github/workflows"
  echo 'echo reviewed' >"$1/ops/a.sh"
  echo 'reviewed' >"$1/extra/e.txt"
  scratch_ci "$2" >"$1/.github/workflows/ci.yml"
  git -C "$1" init -q
  git -C "$1" add -A
  git -C "$1" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit -q -m main
  git -C "$1" update-ref refs/remotes/origin/main HEAD
}
at_dir() { GITHUB_ACTIONS='' REPO_DIR=$1 ops_match_main; }
mk_scratch "$WORK/repo-plain" ''
mk_scratch "$WORK/repo-added" '      - "extra/**"
'
echo 'edited' >"$WORK/repo-plain/extra/e.txt"
echo 'edited' >"$WORK/repo-added/extra/e.txt"
passes "a path no push trigger names is not compared" at_dir "$WORK/repo-plain"
refuses "a path added to the push trigger is compared, with no edit to lib.sh" "differs from origin/main's" at_dir "$WORK/repo-added"
mk_scratch "$WORK/repo-bad" '      - extra/**
'
refuses "a push trigger the reader cannot parse stops the guard, naming the line" "      - extra/**" at_dir "$WORK/repo-bad"
check "  and it never reaches the comparison: no ok line is printed" 0 "$(at_dir "$WORK/repo-bad" 2>&1 | grep -c '^ok' || true)"

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
PROOF=$REPO_DIR/services/c-storage/scripts/bruno-proof.cjs
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

# a scratch checkout for what writes into the Bruno collection's folder: the real ignore rule, copied
KR=$WORK/kr
mkdir -p "$KR/services/c-storage/bruno/environments"
git -C "$KR" init -q
cp "$REPO_DIR/services/c-storage/bruno/environments/.gitignore" "$KR/services/c-storage/bruno/environments/.gitignore"
ENVS=$KR/services/c-storage/bruno/environments
KENV=$ENVS/ridge-tunnel.yml
kr() { REPO_DIR=$KR "$@"; }
free_port() { python3 -I -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])'; }
not_taken() { ! port_taken "$1"; }

echo "== the log ends on the signal's exit code, and the exit still closes the tunnel and cleans up"
cat >"$WORK/child.sh" <<'CHILD'
set -euo pipefail
. "$OPS_DIR/lib.sh"
log_start sigtest x
ssh() { echo "ssh $*" >>"$MARK"; }
box_ready=1
BOX_ID=i-test
REPO_DIR=$KR
INTERNAL_KEY=internalkey0
ADMIN_KEY=adminkey0
mask "$INTERNAL_KEY"
mask "$ADMIN_KEY"
bruno_env_write "$KENV" 3192 tunnel-x accesskey0
if [ -n "${LEAK:-}" ]; then echo "oops $ADMIN_KEY"; fi
kill -s "$1" $$
sleep 5
echo "not reached"
CHILD
for sig in TERM:143 INT:130 HUP:129; do
  name=${sig%%:*} code=${sig##*:}
  rm -rf "$WORK/logs" "$WORK/tmp" "$WORK/ssh.calls" "$KENV"
  mkdir -p "$WORK/tmp"
  rc=0
  OPS_DIR=$OPS_DIR OPS_LOG_DIR=$WORK/logs TMPDIR=$WORK/tmp MARK=$WORK/ssh.calls KR=$KR KENV=$KENV bash "$WORK/child.sh" "$name" >/dev/null 2>&1 || rc=$?
  check "$name: the script exits $code" "$code" "$rc"
  check "$name: the log ends on its exit code" "== exit $code" "$(tail -n 1 "$WORK"/logs/*.log)"
  check "$name: the tunnel is closed" 1 "$(grep -c -e '-O exit' "$WORK/ssh.calls" || true)"
  check "$name: the scratch folder is removed" 0 "$(find "$WORK/tmp" -mindepth 1 | wc -l | tr -d ' ')"
  check "$name: the keys file is removed" gone "$(if [ -e "$KENV" ]; then echo there; else echo gone; fi)"
  check "$name: the log was searched for the keys and held none" "ok   no key in this log" "$(tail -n 2 "$WORK"/logs/*.log | head -n 1)"
done
# A key that reaches the log is named, the run fails, and the file still goes.
rm -rf "$WORK/logs" "$WORK/tmp" "$WORK/ssh.calls" "$KENV"
mkdir -p "$WORK/tmp"
rc=0
LEAK=1 OPS_DIR=$OPS_DIR OPS_LOG_DIR=$WORK/logs TMPDIR=$WORK/tmp MARK=$WORK/ssh.calls KR=$KR KENV=$KENV bash "$WORK/child.sh" INT >/dev/null 2>&1 || rc=$?
check "a key in the log: the run fails" 1 "$rc"
check "  the log names it" "RED  a key is in this log" "$(tail -n 2 "$WORK"/logs/*.log | head -n 1 | cut -c1-25)"
check "  and the keys file is removed all the same" gone "$(if [ -e "$KENV" ]; then echo there; else echo gone; fi)"

echo "== the workflow's deploy job (a push to main or a press of ci on main only, never under act, one at a time, the account id masked; the app's gate and ship: rows 28 and 34)"
WORKFLOW=$REPO_DIR/.github/workflows/ci.yml
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
  need "    if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'"
  need "    needs: [check, e2e, ops, app]"
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
  # shellcheck disable=SC2016 # a literal workflow expression
  after=$(grep -cxF -- "        if: \${{ !env.ACT && steps.release.outputs.superseded != 'true' }}" <<<"$block" || true)
  [ "$steps" -gt 0 ] && [ "$steps" = "$((guarded + after))" ] || missing="${missing}[if: \${{ !env.ACT }} on each of the $steps steps, found $guarded and $after after the release] "
  # Row 28: the release comes first and says when it was superseded; the app's ship and the check
  # follow it, in that order, and only they skip when it was; nothing is shipped before the release.
  table=$(awk '/^      - /{ if (n != "") print n "|" c; n=$0; sub(/^      - (name: )?/, "", n); c="plain" } /^        if: .*steps\.release\.outputs\.superseded != .true./ {c="after"} END { print n "|" c }' <<<"$block" | tail -n 3)
  [ "$table" = "Release|plain
Ship the BFF and the UI|after
Check|after" ] || missing="${missing}[the steps end Release, then the ship and the check, which skip after a superseded release; found: $(tr '\n' ',' <<<"$table")] "
  grep -qxF -- '        id: release' <<<"$block" || missing="${missing}[id: release on the release step] "
  rel=$(grep -nF 'run: bash ops/release.sh ridge' <<<"$block" | head -n 1 | cut -d: -f1)
  app=$(grep -nF 'run: bash ops/app.sh ridge' <<<"$block" | head -n 1 | cut -d: -f1)
  chk=$(grep -nF 'run: bash ops/check.sh ridge' <<<"$block" | head -n 1 | cut -d: -f1)
  # Case 10: the deploy's check on ridge is the full one, which saves; only a by-hand run narrows it.
  grep -qxF -- '        run: bash ops/check.sh ridge' <<<"$block" || missing="${missing}[the check step runs bash ops/check.sh ridge with no flag] "
  [ -n "$rel" ] && [ -n "$app" ] && [ -n "$chk" ] && [ "$rel" -lt "$app" ] && [ "$app" -lt "$chk" ] || missing="${missing}[release.sh, then app.sh, then check.sh] "
  # The builds (third-party code) run before the role is taken.
  role=$(grep -nF 'uses: aws-actions/configure-aws-credentials' <<<"$block" | head -n 1 | cut -d: -f1)
  bld=$(grep -nF 'pnpm --filter @credo/bff bundle' <<<"$block" | head -n 1 | cut -d: -f1)
  [ -n "$role" ] && [ -n "$bld" ] && [ "$bld" -lt "$role" ] || missing="${missing}[the app's build before the role is taken] "
  # The build step stamps the commit on that step alone (a job-level env would turn the bundle's own
  # test of 'dev' red): the step's own text, up to the next step, holds an env with CREDO_BUILD.
  stamp_step=$(awk '/^      - name: Build the BFF.s bundle and the UI$/ {f = 1; next} f && /^      - / {exit} f' <<<"$block" | tr '\n' ' ')
  # shellcheck disable=SC2016 # the workflow's literal text
  grep -qE 'env: +CREDO_BUILD: \$\{\{ github\.sha \}\} ' <<<"$stamp_step" || missing="${missing}[CREDO_BUILD: github.sha in the env of the build step] "
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
check "the workflow caps vitest's workers, so parallel jobs (act's four on one Mac) do not starve each test" 1 \
  "$(grep -cE '^  VITEST_MAX_WORKERS: 2$' "$WORKFLOW" || true)"
passes "the deploy job holds every condition" deploy_guards "$WORKFLOW"
sed "s/ && github.ref == 'refs\/heads\/main'//" "$WORKFLOW" >"$WORK/wf-branch.yml"
refuses "a deploy job that also runs on a branch is refused" "github.ref == 'refs/heads/main'" deploy_guards "$WORK/wf-branch.yml"
sed "s/ || github.event_name == 'workflow_dispatch')/ || github.event_name == 'workflow_dispatch' || github.event_name == 'pull_request')/" "$WORKFLOW" >"$WORK/wf-pr.yml"
refuses "a deploy job that admits a pull request is refused" "github.event_name == 'workflow_dispatch') &&" deploy_guards "$WORK/wf-pr.yml"
sed "s/ || github.event_name == 'workflow_dispatch')/)/" "$WORKFLOW" >"$WORK/wf-nopress.yml"
refuses "a deploy job that lets no press through is refused" "github.event_name == 'workflow_dispatch') &&" deploy_guards "$WORK/wf-nopress.yml"
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
sed 's/needs: \[check, e2e, ops, app\]/needs: [check, e2e, ops]/' "$WORKFLOW" >"$WORK/wf-needs.yml"
refuses "a deploy that does not wait for the four gates, the app's among them, is refused (row 34)" "needs: [check, e2e, ops, app]" deploy_guards "$WORK/wf-needs.yml"
sed 's/^      group: ridge$/      group: ridge-per-run/' "$WORKFLOW" >"$WORK/wf-group.yml"
refuses "a deploy whose concurrency group is not the one ridge group is refused" "group: ridge" deploy_guards "$WORK/wf-group.yml"
sed '/^    environment: ridge$/d' "$WORKFLOW" >"$WORK/wf-env.yml"
refuses "a deploy outside environment ridge is refused" "environment: ridge" deploy_guards "$WORK/wf-env.yml"
sed 's/aws-region: ap-southeast-5/aws-region: eu-west-1/' "$WORKFLOW" >"$WORK/wf-region.yml"
refuses "a deploy in another Region than lib.sh's is refused" "aws-region is lib.sh's" deploy_guards "$WORK/wf-region.yml"

# shellcheck disable=SC2016 # literal workflow expressions
sed "s/^        if: \${{ !env.ACT && steps.release.outputs.superseded != 'true' }}\$/        if: \${{ !env.ACT }}/" "$WORKFLOW" >"$WORK/wf-after.yml"
refuses "  a ship and a check that go on after a superseded release are refused (row 28)" "skip after a superseded release" deploy_guards "$WORK/wf-after.yml"
# the ship's step moved before the release: swap the two run lines
sed -e 's#run: bash ops/release.sh ridge#run: bash ops/TMP.sh ridge#' -e 's#run: bash ops/app.sh ridge#run: bash ops/release.sh ridge#' -e 's#run: bash ops/TMP.sh ridge#run: bash ops/app.sh ridge#' "$WORKFLOW" >"$WORK/wf-order.yml"
refuses "  an app.sh that runs before the release is refused (row 28)" "release.sh, then app.sh, then check.sh" deploy_guards "$WORK/wf-order.yml"
sed 's#^        run: bash ops/check.sh ridge$#        run: bash ops/check.sh ridge --reads-only#' "$WORKFLOW" >"$WORK/wf-readsonly.yml"
refuses "  a deploy whose check passes --reads-only, so no save is proved on ridge, is refused (case 10)" "with no flag" deploy_guards "$WORK/wf-readsonly.yml"
sed 's#^        id: release$#        id: released#' "$WORKFLOW" >"$WORK/wf-id.yml"
refuses "  a release step the later steps cannot read is refused" "id: release" deploy_guards "$WORK/wf-id.yml"
awk '/Build the BFF.s bundle and the UI/ {skip = 1} skip && /^      # The arm64 binary/ {skip = 0} !skip' "$WORKFLOW" >"$WORK/wf-nobuild.yml"
refuses "  an app that is not built before the role is taken is refused" "the app's build before the role" deploy_guards "$WORK/wf-nobuild.yml"
sed '/^          CREDO_BUILD: \${{ github.sha }}$/d' "$WORKFLOW" >"$WORK/wf-nostamp.yml"
refuses "  a build step that does not stamp the commit is refused (row 39)" "CREDO_BUILD: github.sha in the env of the build step" deploy_guards "$WORK/wf-nostamp.yml"

# app_guards <workflow>: row 34, the app's gate in CI, and row 24's half: the bundle under Node 24
app_block() { awk '/^  app:$/ {f = 1; next} f && /^  [A-Za-z_-]+:/ {exit} f' "$1"; }
app_guards() {
  local block missing=''
  block=$(app_block "$1")
  [ -n "$block" ] || die "no app job"
  need() { grep -qxF -- "$1" <<<"$block" || missing="${missing}[$1] "; }
  need "        run: pnpm check"
  need "          node-version: 24"
  need "          node-version: 26"
  need "    runs-on: ubuntu-24.04"
  need "        run: pnpm install --frozen-lockfile"
  # shellcheck disable=SC2016 # the workflow's literal text
  grep -qF 'BUNDLE_NODE=$(command -v node)' <<<"$block" || missing="${missing}[the runtime's Node named in BUNDLE_NODE] "
  # Node 24 is named before Node 26 is set up, so pnpm check runs under 26 and the bundle under 24.
  n24=$(grep -n 'node-version: 24' <<<"$block" | head -n 1 | cut -d: -f1)
  n26=$(grep -n 'node-version: 26' <<<"$block" | head -n 1 | cut -d: -f1)
  chk=$(grep -n 'run: pnpm check' <<<"$block" | head -n 1 | cut -d: -f1)
  [ -n "$n24" ] && [ -n "$n26" ] && [ -n "$chk" ] && [ "$n24" -lt "$n26" ] && [ "$n26" -lt "$chk" ] || missing="${missing}[Node 24, then Node 26, then pnpm check] "
  grep -q 'continue-on-error' <<<"$block" && missing="${missing}[no continue-on-error in the app job] "
  [ -z "$missing" ] || die "the app job lacks: $missing"
}
passes "the app job runs pnpm check, with the bundle under Node 24 (rows 34 and 24)" app_guards "$WORKFLOW"
sed 's#^        run: pnpm check$#        run: pnpm lint#' "$WORKFLOW" >"$WORK/wf-nocheck.yml"
refuses "  an app job that does not run pnpm check is refused" "run: pnpm check" app_guards "$WORK/wf-nocheck.yml"
sed 's#^          node-version: 24$#          node-version: 26#' "$WORKFLOW" >"$WORK/wf-no24.yml"
refuses "  an app job that never names Node 24 is refused" "node-version: 24" app_guards "$WORK/wf-no24.yml"
# shellcheck disable=SC2016 # the workflow's literal text
sed 's#BUNDLE_NODE=\$(command -v node)#BUNDLE=\$(command -v node)#' "$WORKFLOW" >"$WORK/wf-nobn.yml"
refuses "  and one that does not hand it to the bundle's test" "BUNDLE_NODE" app_guards "$WORK/wf-nobn.yml"

echo "== the seed workflow (a manual run alone, never a schedule; main alone, environment ridge, its own group, one job, no permission but the OIDC token, never under act; row 24)"
SEED_WORKFLOW=$REPO_DIR/.github/workflows/seed.yml
# seed_guards <workflow>: dies naming each condition of the seed workflow that it lacks: since 2026-11-08 it
# is run on demand only, so a schedule, any other trigger, a second job and any permission but the OIDC
# token are refused (the plan's "The daily run" is history). As in the deploy job, the job's own `if` cannot read env, so every step carries
# `if: ${{ !env.ACT }}` for act, which has no AWS.
seed_guards() {
  local block missing='' credmin steps guarded role inst run want_region have_region ontrig jobs stepmin jobmin rolesec maxdays
  [ -f "$1" ] || die "no seed workflow"
  block=$(awk '/^  seed:$/ {f = 1; next} f && /^  [A-Za-z0-9_-]+:/ {exit} f' "$1")
  [ -n "$block" ] || die "no seed job"
  need() { grep -qxF -- "$1" <<<"$block" || missing="${missing}[$1] "; }
  grep -qxF -- '  workflow_dispatch:' "$1" || missing="${missing}[a manual run] "
  # Read the parsed shape, not words: a comment may name a schedule, a block may not hold one.
  if grep -qE '^ *(schedule:|- *cron:|cron:)' "$1"; then missing="${missing}[no schedule: the seed is run when somebody asks] "; fi
  ontrig=$(awk '/^on:$/ {f = 1; next} f && /^[A-Za-z_]/ {exit} f && /^  [A-Za-z0-9_-]+:/ {print $1}' "$1" | tr '\n' ' ')
  [ "$ontrig" = 'workflow_dispatch: ' ] || missing="${missing}[no trigger but the manual run, found: $ontrig] "
  jobs=$(awk '/^jobs:$/ {f = 1; next} f && /^[A-Za-z_]/ {exit} f && /^  [A-Za-z0-9_-]+:$/ {print $1}' "$1" | tr '\n' ' ')
  [ "$jobs" = 'seed: ' ] || missing="${missing}[the seed job alone, found: $jobs] "
  [ "$(grep -cE '^ +[a-z-]+: (write|read-all|write-all)$' "$1" || true)" = 1 ] || missing="${missing}[no permission but id-token: write] "
  if grep -qE '^ +(issues|actions|checks|deployments|discussions|packages|pages|pull-requests|security-events|statuses|attestations):' "$1"; then missing="${missing}[no permission but id-token and contents: read] "; fi
  need "    if: github.ref == 'refs/heads/main'"
  need "    runs-on: ubuntu-24.04"
  need "    environment: ridge"
  need "      group: ridge-seed"
  need "      cancel-in-progress: false"
  need "      id-token: write"
  need "      contents: read"
  need "          mask-aws-account-id: true"
  grep -qE '^    timeout-minutes: [0-9]+$' <<<"$block" || missing="${missing}[a job timeout] "
  # The chain that must hold: days a run x 7.5 minutes a day (measured) x 1.2 <= the Seed step's limit,
  # which, after the credentials step's own limit (the role's life starts inside that step), ends a
  # minute or more before the role's life, which the job outlasts by the setup's 9. At 2 days: 15 (18
  # with the margin) <= 18, 18 + 1 = 19 <= 20 - 1, and 18 + 9 = 27 <= 30. At 3 days a full catch-up
  # (about 22) outlived its own credentials. The pins stay exact; the sums are checked beside them.
  need "    timeout-minutes: 30"
  grep -qxF -- '        timeout-minutes: 18' <<<"$block" || missing="${missing}[the Seed step's 18 minutes] "
  credmin=$(awk '/^      - name: Take the deploy role$/ {f = 1} f && /^        timeout-minutes: [0-9]+$/ {print $2; exit}' <<<"$block")
  stepmin=$(awk '/^      - name: Seed$/ {f = 1} f && /^        timeout-minutes: [0-9]+$/ {print $2; exit}' <<<"$block")
  jobmin=$(sed -n 's/^    timeout-minutes: \([0-9][0-9]*\)$/\1/p' <<<"$block" | head -n 1)
  rolesec=$(sed -n 's/^ *role-duration-seconds: \([0-9][0-9]*\)$/\1/p' <<<"$block" | head -n 1)
  maxdays=$(sed -n 's/^export const MAX_DAYS_PER_RUN = \([0-9][0-9]*\);$/\1/p' "$REPO_DIR/scripts/src/demo/apply.ts")
  if [ -n "$credmin" ] && [ -n "$stepmin" ] && [ -n "$jobmin" ] && [ -n "$rolesec" ] && [ -n "$maxdays" ]; then
    [ $((credmin * 60 + stepmin * 60 + 60)) -le "$rolesec" ] ||
      missing="${missing}[the credentials step's $credmin and the Seed step's $stepmin minutes end a minute or more before the role's $rolesec s] "
    [ $((maxdays * 90)) -le $((stepmin * 10)) ] ||
      missing="${missing}[the Seed step's $stepmin minutes hold $maxdays days at 7.5 minutes a day with a fifth over] "
    [ $((stepmin + 9)) -le "$jobmin" ] || missing="${missing}[the job's $jobmin minutes hold the Seed step's $stepmin and the setup's 9] "
  else
    missing="${missing}[the credentials step's, the Seed step's, the job's and the role's limits and MAX_DAYS_PER_RUN, all readable] "
  fi
  grep -qE '^        uses: aws-actions/configure-aws-credentials@[0-9a-f]{40} # v[0-9.]+$' <<<"$block" ||
    missing="${missing}[credentials step pinned by sha] "
  steps=$(grep -c '^      - ' <<<"$block" || true)
  # shellcheck disable=SC2016 # a literal workflow expression
  guarded=$(grep -cxF -- '        if: ${{ !env.ACT }}' <<<"$block" || true)
  # shellcheck disable=SC2016 # a literal workflow expression
  [ "$steps" -gt 0 ] && [ "$steps" = "$guarded" ] || missing="${missing}[if: \${{ !env.ACT }} on each of the $steps steps, found $guarded] "
  # The seed's own group, never the deploy's, which a waiting seed would replace a waiting deploy in.
  if grep -qE '^ +group: ridge$' "$1"; then missing="${missing}[never the deploy's group, ridge] "; fi
  if grep 'cancel-in-progress:' "$1" | grep -qv 'cancel-in-progress: false$'; then missing="${missing}[cancel-in-progress: false everywhere in the file] "; fi
  if grep -q 'continue-on-error' "$1"; then missing="${missing}[no continue-on-error] "; fi
  [ "$(grep -c 'id-token:' "$1" || true)" = 1 ] || missing="${missing}[id-token in the seed job alone] "
  [ "$(grep -c 'secrets\.' "$1" || true)" = 1 ] || missing="${missing}[one secret read, in the seed job] "
  # The install runs third-party code, so it comes before the role; the seed comes after it.
  inst=$(grep -nF 'run: pnpm install --frozen-lockfile' <<<"$block" | head -n 1 | cut -d: -f1)
  role=$(grep -nF 'uses: aws-actions/configure-aws-credentials' <<<"$block" | head -n 1 | cut -d: -f1)
  run=$(grep -nF 'run: bash ops/seed.sh ridge' <<<"$block" | head -n 1 | cut -d: -f1)
  [ -n "$inst" ] && [ -n "$role" ] && [ -n "$run" ] && [ "$inst" -lt "$role" ] && [ "$role" -lt "$run" ] ||
    missing="${missing}[the install, then the role, then ops/seed.sh ridge] "
  # shellcheck disable=SC2016 # lib.sh's text, not an expansion
  want_region=$(sed -n 's/^CREDO_REGION=\${CREDO_REGION:-\(.*\)}$/\1/p' "$OPS_DIR/lib.sh")
  have_region=$(sed -n 's/^ *aws-region: //p' <<<"$block")
  [ -n "$want_region" ] && [ "$want_region" = "$have_region" ] || missing="${missing}[aws-region is lib.sh's $want_region, found '$have_region'] "
  [ -z "$missing" ] || die "the seed workflow lacks: $missing"
}
passes "the seed workflow holds every condition" seed_guards "$SEED_WORKFLOW"
# A schedule block put back before the manual run, comment and keyword both real: the decision it guards.
awk '/^  workflow_dispatch:$/ {print "  schedule:"; print "    - cron: \"17 20 * * *\""} 1' "$SEED_WORKFLOW" >"$WORK/seed-cron.yml"
refuses "a seed that regains a schedule is refused" "no schedule" seed_guards "$WORK/seed-cron.yml"
# The guard reads the document, not words: a comment that names the keyword is not a schedule.
awk '/^  workflow_dispatch:$/ {print "  # schedule: - cron: \"17 20 * * *\""} 1' "$SEED_WORKFLOW" >"$WORK/seed-cron-comment.yml"
passes "a comment that names a schedule is not one" seed_guards "$WORK/seed-cron-comment.yml"
sed 's/^    timeout-minutes: 30$/    timeout-minutes: 25/' "$SEED_WORKFLOW" >"$WORK/seed-jobtime.yml"
refuses "a seed job with less than 30 minutes is refused" "timeout-minutes: 30" seed_guards "$WORK/seed-jobtime.yml"
sed 's/^        timeout-minutes: 18$/        timeout-minutes: 15/' "$SEED_WORKFLOW" >"$WORK/seed-steptime.yml"
refuses "a Seed step with less than 18 minutes is refused" "the Seed step's 18 minutes" seed_guards "$WORK/seed-steptime.yml"
# The step that outlives its credentials: the step and the job moved together (30 and 40, the old pair), so every
# pin above is met only by the sums, and the role's 20 minutes are what refuses it.
sed -e 's/^        timeout-minutes: 18$/        timeout-minutes: 30/' -e 's/^    timeout-minutes: 30$/    timeout-minutes: 40/' "$SEED_WORKFLOW" >"$WORK/seed-outlives.yml"
refuses "a Seed step that outlives the role's credentials is refused" "end a minute or more before the role" seed_guards "$WORK/seed-outlives.yml"
# The credentials step given its old two minutes: 2 + 18 + the spare minute is 21 against the role's 20.
awk '/^      - name: Take the deploy role$/ {f = 1} f && $0 == "        timeout-minutes: 1" {print "        timeout-minutes: 2"; f = 0; next} 1' "$SEED_WORKFLOW" >"$WORK/seed-credtime.yml"
refuses "a credentials step allowed 2 minutes, which leaves the Seed step no spare minute inside the role, is refused" "end a minute or more before the role" seed_guards "$WORK/seed-credtime.yml"
# A job whose name holds a digit is a second job all the same: the name class once had no digits. Its step carries
# the act guard, so only the job list can refuse it (a bare step would be refused for lacking the guard, hiding the hole).
# shellcheck disable=SC2016 # a literal workflow expression
{ cat "$SEED_WORKFLOW"; printf '\n  tell2:\n    needs: seed\n    runs-on: ubuntu-24.04\n    steps:\n      - run: true\n        if: ${{ !env.ACT }}\n'; } >"$WORK/seed-digitjob.yml"
refuses "a second job whose name holds a digit is refused" "the seed job alone, found: seed: tell2:" seed_guards "$WORK/seed-digitjob.yml"
# The role's life cut short under the same step: the other end of the same sum.
sed 's/^\( *\)role-duration-seconds: 1200$/\1role-duration-seconds: 1080/' "$SEED_WORKFLOW" >"$WORK/seed-shortrole.yml"
refuses "a role that does not outlast the credentials and Seed steps by a minute is refused" "end a minute or more before the role" seed_guards "$WORK/seed-shortrole.yml"
# More days a run than the step holds (the constant raised, the workflow untouched), against a scratch copy of the tree.
mkdir -p "$WORK/seed-days/scripts/src/demo"
sed 's/^export const MAX_DAYS_PER_RUN = 2;$/export const MAX_DAYS_PER_RUN = 3;/' "$REPO_DIR/scripts/src/demo/apply.ts" >"$WORK/seed-days/scripts/src/demo/apply.ts"
seed_guards_days() { REPO_DIR="$WORK/seed-days" seed_guards "$SEED_WORKFLOW"; }
refuses "three days a run in an 18-minute Seed step is refused" "hold 3 days at 7.5 minutes a day" seed_guards_days
# The demo copies' fill goes in rounds, each on a tunnel that lasts the endpoint's hour: days a round x 7.5 minutes x 1.2
# must fit 50 minutes, the hour less ten (docs/plans/2026-11-12-ridge-by-script.md, case 15).
round_budget() { # <tree>: its DAYS_PER_ROUND fits the tunnel
  local d
  d=$(sed -n 's/^export const DAYS_PER_ROUND = \([0-9][0-9]*\);$/\1/p' "$1/scripts/src/demo/apply.ts")
  [ -n "$d" ] || die "DAYS_PER_ROUND is not readable"
  [ $((d * 90)) -le 500 ] || die "a round of $d days at 7.5 minutes a day with a fifth over does not fit the tunnel's 50 minutes"
}
passes "a round of DAYS_PER_ROUND days fits the tunnel's 50 minutes at 7.5 minutes a day with a fifth over" round_budget "$REPO_DIR"
mkdir -p "$WORK/round-days/scripts/src/demo"
sed 's/^export const DAYS_PER_ROUND = 5;$/export const DAYS_PER_ROUND = 7;/' "$REPO_DIR/scripts/src/demo/apply.ts" >"$WORK/round-days/scripts/src/demo/apply.ts"
refuses "seven days a round, which outlives the tunnel's hour, is refused" "a round of 7 days at 7.5 minutes a day" round_budget "$WORK/round-days"
awk '$0 == "      contents: read" && !d {d = 1; print; print "      issues: write"; next} 1' "$SEED_WORKFLOW" >"$WORK/seed-issuesseed.yml"
refuses "an issues: permission on the seed job is refused" "no permission but" seed_guards "$WORK/seed-issuesseed.yml"
awk '/^    permissions:$/ && !d {d = 1; print "    permissions:"; print "      contents: write"; skip = 1; next} skip && /^      contents: read$/ {skip = 0; next} 1' "$SEED_WORKFLOW" >"$WORK/seed-contentswrite.yml"
refuses "contents: write in place of read is refused" "no permission but id-token: write" seed_guards "$WORK/seed-contentswrite.yml"
{ cat "$SEED_WORKFLOW"; printf '\n  tell:\n    needs: seed\n    if: failure()\n    runs-on: ubuntu-24.04\n    steps:\n      - run: true\n'; } >"$WORK/seed-secondjob.yml"
refuses "a second job beside the seed is refused" "the seed job alone" seed_guards "$WORK/seed-secondjob.yml"
sed '/^  workflow_dispatch:$/d' "$SEED_WORKFLOW" >"$WORK/seed-nodispatch.yml"
refuses "a seed with no manual run is refused" "a manual run" seed_guards "$WORK/seed-nodispatch.yml"
awk '/^  workflow_dispatch:$/ {print "  push:"; print "    branches: [main]"} 1' "$SEED_WORKFLOW" >"$WORK/seed-push.yml"
refuses "a seed that also runs on a push is refused" "no trigger but the manual run" seed_guards "$WORK/seed-push.yml"
sed "s/^    if: github.ref == 'refs\/heads\/main'\$/    if: true/" "$SEED_WORKFLOW" >"$WORK/seed-branch.yml"
refuses "a seed job that also runs from a branch is refused" "github.ref == 'refs/heads/main'" seed_guards "$WORK/seed-branch.yml"
sed '/^    environment: ridge$/d' "$SEED_WORKFLOW" >"$WORK/seed-env.yml"
refuses "a seed outside environment ridge is refused" "environment: ridge" seed_guards "$WORK/seed-env.yml"
sed 's/^      group: ridge-seed$/      group: ridge/' "$SEED_WORKFLOW" >"$WORK/seed-group.yml"
refuses "a seed in the deploy's group, where it would replace a waiting deploy, is refused" "group: ridge-seed" seed_guards "$WORK/seed-group.yml"
sed 's/cancel-in-progress: false/cancel-in-progress: true/' "$SEED_WORKFLOW" >"$WORK/seed-cancel.yml"
refuses "a seed that may cancel a running one is refused" "cancel-in-progress" seed_guards "$WORK/seed-cancel.yml"
awk '$0 == "        if: ${{ !env.ACT }}" && !d {d = 1; next} 1' "$SEED_WORKFLOW" >"$WORK/seed-act.yml"
refuses "a seed step that would run under act is refused" "!env.ACT" seed_guards "$WORK/seed-act.yml"
awk '/^        run: bash ops\/seed.sh ridge$/ {print "        continue-on-error: true"} 1' "$SEED_WORKFLOW" >"$WORK/seed-continue.yml"
refuses "a seed step that may fail and go on is refused" "continue-on-error" seed_guards "$WORK/seed-continue.yml"
sed 's/mask-aws-account-id: true/mask-aws-account-id: false/' "$SEED_WORKFLOW" >"$WORK/seed-mask.yml"
refuses "a seed that leaves the account id unmasked is refused" "mask-aws-account-id" seed_guards "$WORK/seed-mask.yml"
sed 's/aws-region: ap-southeast-5/aws-region: eu-west-1/' "$SEED_WORKFLOW" >"$WORK/seed-region.yml"
refuses "a seed in another Region than lib.sh's is refused" "aws-region is lib.sh's" seed_guards "$WORK/seed-region.yml"
# shellcheck disable=SC2016 # a literal workflow expression
awk '/^      - name: pnpm 12.10.1$/ {skip = 1} skip && /^      # The same exchange/ {skip = 0} !skip' "$SEED_WORKFLOW" >"$WORK/seed-noinstall.yml"
refuses "a seed that installs nothing before the role is refused" "the install, then the role" seed_guards "$WORK/seed-noinstall.yml"

echo "== the paths a push deploys on, read from ci.yml (seed.sh compares them; a line it cannot read stops it, nothing written)"
CI_YML=$REPO_DIR/.github/workflows/ci.yml
check "the real ci.yml's push trigger reads as its 16 paths, a trailing /** dropped" "16 services/c-storage walk .github/workflows/seed.yml" \
  "$(push_paths "$CI_YML" | wc -l | tr -d ' ') $(push_paths "$CI_YML" | sed -n '1p;8p;16p' | tr '\n' ' ' | sed 's/ $//')"
# The press: ci.yml holds one workflow_dispatch trigger, beside push and pull_request and outside
# the push's paths.
check "the real ci.yml holds a workflow_dispatch trigger, once, at the top level of on:" 1 \
  "$(awk '/^on:$/ {o = 1; next} /^[a-z]/ {o = 0} o && $0 == "  workflow_dispatch:"' "$CI_YML" | wc -l | tr -d ' ')"
sed '/^  workflow_dispatch:$/d' "$CI_YML" >"$WORK/ci-nopress.yml"
check "a ci.yml without the trigger reads as none" 0 \
  "$(awk '/^on:$/ {o = 1; next} /^[a-z]/ {o = 0} o && $0 == "  workflow_dispatch:"' "$WORK/ci-nopress.yml" | wc -l | tr -d ' ')"
# push_variant <name> <the push line to replace: 'ui/**'> <what stands in its place>: ci.yml with that entry changed
push_variant() {
  awk -v from="$2" -v to="$3" '/^  push:$/ {p = 1} /^  pull_request:$/ {p = 0} p && $0 == "      - \"" from "\"" && !d {d = 1; print to; next} 1' "$CI_YML" >"$WORK/ci-$1.yml"
}
push_variant unquoted 'ui/**' '      - ui/**'
refuses "an unquoted entry stops the read, naming the line" "      - ui/**" push_paths "$WORK/ci-unquoted.yml"
push_variant single 'ui/**' "      - 'ui/**'"
refuses "a single-quoted entry stops the read, naming the line" "      - 'ui/**'" push_paths "$WORK/ci-single.yml"
push_variant comment 'ui/**' '      # - "ui/**"'
refuses "a commented entry stops the read, naming the line" '      # - "ui/**"' push_paths "$WORK/ci-comment.yml"
push_variant deep 'ui/**' '      - "ui/**/*.ts"'
refuses "a deeper glob stops the read, naming the line" '      - "ui/**/*.ts"' push_paths "$WORK/ci-deep.yml"
push_variant trailing 'ui/**' '      - "ui/**" # the app'
refuses "an entry with a trailing comment stops the read, naming the line" '# the app' push_paths "$WORK/ci-trailing.yml"
push_variant negated 'ui/**' '      - "!ui/**"'
refuses "a negated entry stops the read, naming the line" '      - "!ui/**"' push_paths "$WORK/ci-negated.yml"
push_variant indent 'ui/**' '        - "ui/**"'
refuses "an entry indented deeper stops the read, naming the line" '        - "ui/**"' push_paths "$WORK/ci-indent.yml"
sed 's/^    paths:$/    paths: [ "ui\/**" ]/' "$CI_YML" >"$WORK/ci-flow.yml"
refuses "a flow-style list stops the read, naming the line" 'paths: [ "ui/**" ]' push_paths "$WORK/ci-flow.yml"
sed 's/$/\r/' "$CI_YML" >"$WORK/ci-crlf.yml"
refuses "a file with Windows line ends stops the read" "nothing was written" push_paths "$WORK/ci-crlf.yml"
printf 'on:\n  push:\n    branches: [main]\n' >"$WORK/ci-nopaths.yml"
refuses "a push trigger with no paths stops the read" "found no paths" push_paths "$WORK/ci-nopaths.yml"

echo "== the checks of /health, against the real c-storage (release.sh and drill.sh wait on it; check.sh reads it once)"
command -v go >/dev/null || { echo "ops/test.sh: needs go on PATH, to build c-storage" >&2; exit 2; }
STAMP_VAR=$(sed -n 's/^STAMP_VAR[[:space:]]*:=[[:space:]]*//p' "$REPO_DIR/services/c-storage/Makefile")
[ -n "$STAMP_VAR" ] || { echo "ops/test.sh: services/c-storage/Makefile names no STAMP_VAR" >&2; exit 2; }
# The first build compiles c-storage; the others only relink it.
build() { # <output> [<stamp>]
  if [ -n "${2:-}" ]; then
    (cd "$REPO_DIR/services/c-storage" && go build -ldflags "-X $STAMP_VAR=$2" -o "$1" ./cmd/server)
  else
    (cd "$REPO_DIR/services/c-storage" && go build -o "$1" ./cmd/server)
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

echo "== the port (check.sh and tunnel.sh refuse a taken one before opening anything)"
start_server "$WORK/server-new"
port=${URL#http://127.0.0.1:}
port=${port%/health}
passes "a port with the real c-storage on it is taken" port_taken "$port"
refuses "  and is refused, naming the port and what to do" "something already answers on 127.0.0.1:$port: free it" refuse_taken_port "$port" "free it"
stop_server
free=$(free_port)
passes "a port nothing listens on is not taken" not_taken "$free"
python3 -I -c 'import socket, time
s = socket.socket(); s.bind(("127.0.0.1", 0)); s.listen(1)
print(s.getsockname()[1], flush=True); time.sleep(30)' >"$WORK/silent.port" &
PID=$!
for _ in $(seq 1 25); do if [ -s "$WORK/silent.port" ]; then break; fi; sleep 0.2; done
passes "a listener that speaks no HTTP is taken too" port_taken "$(cat "$WORK/silent.port")"
stop_server

echo "== a forward that cannot bind fails the open (box_open, for check.sh and tunnel.sh)"
# box_open_stub <local port>: box_open with aws and ssh stood in for. The stand-in ssh reads its
# arguments as the real one acts on them: with ExitOnForwardFailure=yes, a forward onto a taken port
# fails; without it, ssh stays up and serves nothing there.
box_open_stub() {
  (
    aws() { if [[ "$*" == *describe-stacks* ]]; then echo '{"Stacks":[{"Outputs":[{"OutputKey":"BoxId","OutputValue":"i-test"},{"OutputKey":"BoxAddress","OutputValue":"10.20.30.40"},{"OutputKey":"Zone","OutputValue":"ap-southeast-5a"}]}]}'; fi; }
    ssh() {
      local a prev='' bind='' strict=0
      echo "$*" >>"$WORK/ssh.args"
      for a in "$@"; do
        if [ "$a" = ExitOnForwardFailure=yes ]; then strict=1; fi
        if [ "$prev" = -L ]; then bind=${a#127.0.0.1:}; bind=${bind%%:*}; fi
        prev=$a
      done
      if [ -n "$bind" ] && [ "$strict" = 1 ] && port_taken "$bind"; then return 255; fi
      return 0
    }
    # fd 3 is the terminal in a real run (log_start keeps it); the mask line goes there in GitHub's job
    box_open ridge "$1" 3>>"$WORK/fd3"
  )
}
rm -f "$WORK/ssh.args"
start_server "$WORK/server-new"
port=${URL#http://127.0.0.1:}
port=${port%/health}
rc=0
box_open_stub "$port" || rc=$?
check "a forward onto a taken port fails the open" 1 "$rc"
stop_server
rc=0
box_open_stub "$free" || rc=$?
check "a forward onto a free port opens" 0 "$rc"
check "  with ExitOnForwardFailure=yes among the arguments" 2 "$(grep -c 'ExitOnForwardFailure=yes' "$WORK/ssh.args" || true)"
check "  forwarding to c-storage's port on the stack's BoxAddress, never on loopback" 2 \
  "$(grep -c -e "-L 127.0.0.1:[0-9]*:10.20.30.40:$BOX_PORT" "$WORK/ssh.args" || true)"
check "  and, in GitHub's job (the mask line goes to the terminal, fd 3), nothing is written to stderr" "" \
  "$(GITHUB_ACTIONS=true box_open_stub "$free" 2>&1 >/dev/null)"
box_open_without() { # <outputs as JSON>: box_open on a stack with those outputs alone
  (
    OUTPUTS=$1
    aws() { if [[ "$*" == *describe-stacks* ]]; then echo "{\"Stacks\":[{\"Outputs\":$OUTPUTS}]}"; fi; }
    ssh() { return 0; }
    box_open ridge "$free"
  )
}
refuses "a stack with no BoxAddress is refused before a key is sent" "names no private address" \
  box_open_without '[{"OutputKey":"BoxId","OutputValue":"i-test"},{"OutputKey":"Zone","OutputValue":"z"}]'
refuses "a BoxAddress that is no IPv4 address is refused" "names no private address" \
  box_open_without '[{"OutputKey":"BoxId","OutputValue":"i-test"},{"OutputKey":"BoxAddress","OutputValue":"0.0.0.0/0"},{"OutputKey":"Zone","OutputValue":"z"}]'

echo "== the outputs print without a secret's value (outputs_show: the three masked, then outputs_print)"
# printed_outputs <describe-stacks body>: the read-back's call, as stack.sh makes it, in GitHub's job
# (where mask writes to fd 3, open here as log_start opens it)
printed_outputs() {
  (
    STACK_JSON=$1
    GITHUB_ACTIONS=true outputs_show
  ) 3>>"$WORK/fd3"
}
outs_body='{"Stacks":[{"Outputs":[{"OutputKey":"BoxAddress","OutputValue":"10.9.8.7"},{"OutputKey":"AppAddress","OutputValue":"https://app.example.test"},{"OutputKey":"ApiAddress","OutputValue":"https://api.example.test"},{"OutputKey":"DeployRoleArn","OutputValue":"arn:aws:iam::000000000000:role/x"},{"OutputKey":"Zone","OutputValue":"z"},{"OutputKey":"NewThing","OutputValue":"some-value"}]}]}'
: >"$WORK/fd3"
printed=$(printed_outputs "$outs_body" 2>&1 || true)
check "the box's private address is never printed" 0 "$(grep -cF '10.9.8.7' <<<"$printed" || true)"
check "  the app's address still is, and a zone" "1 1" "$(grep -cF '  AppAddress = https://app.example.test' <<<"$printed" || true) $(grep -cF '  Zone = z' <<<"$printed" || true)"
check "  the deploy role's ARN and the API's address are not, each saying why" "1 1 0" \
  "$(grep -cF '  DeployRoleArn = (not printed: the account id)' <<<"$printed" || true) $(grep -cF '  ApiAddress = (not printed: the API is reached through the app)' <<<"$printed" || true) $(grep -cF -e 000000000000 -e api.example.test <<<"$printed" || true)"
check "  an output no one named as printable is not printed" "1 0" "$(grep -cF '  NewThing = (not printed)' <<<"$printed" || true) $(grep -cF some-value <<<"$printed" || true)"
check "  and each of the three is given to GitHub's mask, once, on fd 3" 3 "$(grep -c '^::add-mask::' "$WORK/fd3" || true)"
multi='{"Stacks":[{"Outputs":[{"OutputKey":"AppAddress","OutputValue":"line-one\nline-two"},{"OutputKey":"Zone","OutputValue":"z"}]}]}'
multi_printed=$(STACK_JSON=$multi SECRETS=$'line-two\n' outputs_print)
check "  a value holding any masked line is not printed" "1 0" "$(grep -cF '  AppAddress = (not printed)' <<<"$multi_printed" || true) $(grep -cF line-one <<<"$multi_printed" || true)"
check "outputs_print gives jq the secrets in its environment, never on its command line" 0 "$(grep -c -e '--arg secrets' -e 'argjson secrets' "$OPS_DIR/lib.sh" || true)"
mask_closed() { GITHUB_ACTIONS=true mask thekey 3>&-; }
refuses "mask with fd 3 closed in GitHub's job dies, saying so (never a quiet miss)" "fd 3 is closed" mask_closed
mask_lines() { (GITHUB_ACTIONS=true mask $'first\nsecond' lbl 3>"$WORK/fd3"; printf '%s|%s' "$(grep -c '^::add-mask::' "$WORK/fd3")" "$(printf '%s' "$SECRETS" | wc -l | tr -d ' ')$(printf '%s' "$SECRET_LABELS" | wc -l | tr -d ' ')"); }
check "a masked value of two lines is two masks and two secrets, each with its label" "2|22" "$(mask_lines)"

# outputs_guard <stack.sh>: dies unless stack.sh shows the outputs through outputs_show and prints none of its own
# shellcheck disable=SC2016 # the script's text, in single quotes
outputs_guard() {
  [ "$(grep -c '^outputs_show$' "$1" || true)" = 1 ] || die "stack.sh does not call outputs_show once"
  ! grep -qF '\(.OutputKey)' "$1" || die "stack.sh prints the outputs another way than outputs_show"
}
passes "stack.sh shows the outputs through outputs_show (the whole run below holds that no value printed)" outputs_guard "$OPS_DIR/stack.sh"
grep -v '^outputs_show$' "$OPS_DIR/stack.sh" >"$WORK/stack-noshow.sh"
refuses "  a stack.sh that does not call it is refused" "does not call outputs_show" outputs_guard "$WORK/stack-noshow.sh"
{ cat "$OPS_DIR/stack.sh"; echo "jq -r '.Stacks[0].Outputs[]? | \\(.OutputKey)' <<<\"\$STACK_JSON\""; } >"$WORK/stack-jq.sh"
refuses "  a second printer of the outputs is refused" "another way" outputs_guard "$WORK/stack-jq.sh"

# The RED line names what matched: an address is redacted, a key is replaced.
# red_lines <leaked text> <value> <label> [<value> <label>]: a log in which the values are masked and
# the text is written; its RED lines, and the ok line, on one line
red_lines() {
  local dir=$WORK/logs-red tmp=$WORK
  rm -rf "$dir"
  OPS_LOG_DIR=$dir TMPDIR=$tmp WORK='' OPS_DIR=$OPS_DIR LEAK=$1 M1=$2 L1=$3 M2=${4:-} L2=${5:-} bash -c '
    . "$OPS_DIR/lib.sh"
    log_start red x
    mask "$M1" "$L1"
    mask "$M2" "$L2"
    echo "oops $LEAK"
  ' >/dev/null 2>&1 || true
  grep -h -e '^RED' -e '^ok   no key' "$dir"/*.log | sed 's/ (docs[^)]*)//' | tr '\n' '|'
}
ADDR_RED="RED  the box's private address is in this log: redact it in this log; nothing to replace"
KEY_RED="RED  a key is in this log: delete it and replace the key"
check "a masked address found in the log is named an address, to redact" "$ADDR_RED|" "$(red_lines 10.9.8.7 10.9.8.7 "the box's private address")"
check "  a masked key found in the log is still a key, to replace" "$KEY_RED|" "$(red_lines thekey0 thekey0 '')"
check "  a key and the address together: both are named, the key's first, and no ok line" "$KEY_RED|$ADDR_RED|" \
  "$(red_lines 'thekey0 10.9.8.7' thekey0 '' 10.9.8.7 "the box's private address")"
check "  a key of two lines, its second line leaked, is a key still (the labels stay in step)" "$KEY_RED|" \
  "$(red_lines secondline $'firstline\nsecondline' '' 10.9.8.7 "the box's private address")"

echo "== c-storage listens on the box's private address (the unit reads it; each release writes it from BoxAddress)"
unit=$OPS_DIR/c-storage.service
check "the unit reads LISTEN_ADDR from /etc/c-storage/listen.env" 1 "$(grep -c '^EnvironmentFile=/etc/c-storage/listen.env$' "$unit" || true)"
check "  and starts once the network is online" "1 1" "$(grep -c '^After=network-online.target$' "$unit" || true) $(grep -c '^Wants=network-online.target$' "$unit" || true)"
check "  and sets no LISTEN_ADDR of its own, which would shadow the file" 0 "$(grep -c '^Environment=LISTEN_ADDR' "$unit" || true)"
check "release.sh writes LISTEN_ADDR from BOX_LISTEN_ADDR, beside the unit, and installs it before the restart" "1 1 1" \
  "$(grep -cF 'LISTEN_ADDR=%s' "$OPS_DIR/release.sh" || true) $(grep -c 'mv -f /opt/c-storage/listen.env.new /etc/c-storage/listen.env' "$OPS_DIR/release.sh" || true) $(awk '/listen.env.new \/etc/{a=NR} /systemctl restart/{b=NR} END{print (a>0 && a<b)}' "$OPS_DIR/release.sh")"
check "no script reads /health or forwards at 127.0.0.1 on the box" 0 \
  "$(cd "$OPS_DIR" && grep -hE '127[.]0[.]0[.]1:[$][{]?BOX_PORT' lib.sh check.sh drill.sh release.sh tunnel.sh | grep -c . || true)"

echo "== /health names a commit of main (the check, and the tunnel before it writes anything)"
# probe_health <binary>: starts it, reads /health through its port as health_main_read does, stops it
probe_health() {
  start_server "$1"
  port=${URL#http://127.0.0.1:}
  port=${port%/health}
  REPO_DIR=$WORK/repo health_main_read "$port"
  stop_server
}
probe_health "$WORK/server-new"
check "a c-storage stamped with a commit of main passes" "" "$HEALTH_PROBLEM"
check "  and the commit it names is read" "$new_sha" "$HEALTH_BUILD"
probe_health "$WORK/server-old"
check "a commit behind main's tip, still on main, passes" "" "$HEALTH_PROBLEM"
probe_health "$WORK/server-dev"
check "an unstamped c-storage (dev) is refused" "/health names no commit (answered:" "$(cut -c1-34 <<<"$HEALTH_PROBLEM")"
probe_health "$WORK/server-other"
check "a commit main does not hold is refused" "/health names $other, which origin/main does not hold" "$HEALTH_PROBLEM"
REPO_DIR=$WORK/repo health_main_read "$free" 2>/dev/null
check "no answer is refused, saying so" "/health names no commit (answered: nothing)" "$HEALTH_PROBLEM"

echo "== the Bruno environment (the one writer: 0600, git-ignored, removed only by the run that wrote it)"
INTERNAL_KEY=internalkey0
ADMIN_KEY=adminkey0
kenv=$KENV
printf 'an old file\n' >"$kenv"
chmod 644 "$kenv"
passes "a path git ignores is written" kr bruno_env_write "$kenv" 3192 tunnel-x accesskey0
check "the file is 0600, though an older one was 0644" "$kenv" "$(find "$kenv" -perm 600)"
check "  and it holds the variables the collection's local.yml names, in order" \
  "$(sed -n 's/^  - name: //p' "$REPO_DIR/services/c-storage/bruno/environments/local.yml")" "$(sed -n 's/^  - name: //p' "$kenv")"
check "  with this run's port, keys, service code and access key" \
  "http://127.0.0.1:3192 internalkey0 adminkey0 tunnel-x accesskey0" \
  "$(awk '$1 == "value:" {printf "%s%s", sep, $2; sep = " "} END {print ""}' "$kenv" | sed 's/ sample-record$//')"
rm -f "$kenv"
printf 'the committed one\n' >"$ENVS/local.yml"
refuses "a path git does not ignore (the committed local.yml) is refused" "git does not ignore services/c-storage/bruno/environments/local.yml" \
  kr bruno_env_write "$ENVS/local.yml" 3192 tunnel-x accesskey0
check "  and the file it would have replaced is untouched" "the committed one" "$(cat "$ENVS/local.yml")"
rm -f "$ENVS/local.yml"
# Under act the worktree is copied into a container, and its .git file names a folder of the machine
# it came from: git reads nothing there, and every path would read as kept.
if git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  check "the real repository ignores ridge-tunnel.yml and ridge.yml, not local.yml" "ignored ignored kept" \
    "$(for n in ridge-tunnel ridge local; do if git -C "$REPO_DIR" check-ignore -q "services/c-storage/bruno/environments/$n.yml"; then printf 'ignored '; else printf 'kept '; fi; done | sed 's/ $//')"
else
  echo "  == skipped: the repository's .git cannot be read here (a worktree copied from another machine), so its ignore rule is not read; GitHub's run reads it"
fi
check "check.sh writes its environment through that writer alone" "1 0" \
  "$(grep -c 'bruno_env_write' "$OPS_DIR/check.sh" || true) $(grep -c 'cat >' "$OPS_DIR/check.sh" || true)"
check "check.sh sweeps stranded check clients after bff_env_read and before it makes its own, once" "1 yes" \
  "$(grep -c 'ridge_cli clear-checks' "$OPS_DIR/check.sh" || true) $(awk '/^  bff_env_read$/ {a = NR} /ridge_cli clear-checks/ {b = NR} /ridge_cli tenant / {c = NR} END {print (a && a < b && b < c) ? "yes" : "no"}' "$OPS_DIR/check.sh")"
# Under set -e a bare assignment from a failing command ends the script, an if's condition does not:
# the sweep is a warning only while it stays `if swept=$(…); then … else WARN … fi` with no die or exit in it.
sweep_form() {
  printf '%s %s ' "$(grep -cE '^  if swept=[$][(]' "$1" || true)" "$(grep -cE '^ *swept=[$][(]' "$1" || true)"
  awk '/^  if swept=[$][(]/ {on = 1} on && /WARN the sweep of stranded check clients/ {warn = 1} on && /(^|[ ;])(die|exit)[ ;]/ {bad = 1} on && /^  fi$/ {on = 0} END {print (warn && !bad) ? "warns" : "broken"}' "$1"
}
check "check.sh runs the sweep as an if condition that warns, with no die or exit inside it" "1 0 warns" \
  "$(sweep_form "$OPS_DIR/check.sh")"

echo "== a refused write removes nothing, even through on_exit; a second signal does not cut on_exit short"
cat >"$WORK/refused.sh" <<'CHILD'
set -euo pipefail
. "$OPS_DIR/lib.sh"
REPO_DIR=$KR
log_start refusedtest x
INTERNAL_KEY=k
ADMIN_KEY=a
bruno_env_write "$KENV" 3192 c d
CHILD
fresh_dirs() { rm -rf "${WORK:?}/logs" "${WORK:?}/tmp" "${WORK:?}/ssh.calls"; mkdir -p "$WORK/tmp"; }
fresh_dirs
printf 'the committed one\n' >"$ENVS/local.yml"
rc=0
OPS_DIR=$OPS_DIR OPS_LOG_DIR=$WORK/logs TMPDIR=$WORK/tmp KR=$KR KENV=$ENVS/local.yml bash "$WORK/refused.sh" >/dev/null 2>&1 || rc=$?
check "a path git does not ignore: the run fails, naming it" "1 1" "$rc $(grep -c 'git does not ignore services/c-storage/bruno/environments/local.yml' "$WORK"/logs/*.log || true)"
check "  and the file survives the run's exit" "the committed one" "$(cat "$ENVS/local.yml")"
rm -f "$ENVS/local.yml"
cat >"$WORK/twice.sh" <<'CHILD'
set -euo pipefail
. "$OPS_DIR/lib.sh"
log_start twicetest x
mask thekey0
# a writer in a session of its own keeps the log's pipe open, so on_exit waits for it as it would for
# a stray ssh, and survives the signals sent to this script's group
python3 -I -c 'import os, time; os.setsid(); time.sleep(4)' &
touch "$READY"
sleep 10
CHILD
fresh_dirs
rc=0
OPS_DIR=$OPS_DIR OPS_LOG_DIR=$WORK/logs TMPDIR=$WORK/tmp READY=$WORK/twice.ready \
  python3 -I -c 'import os,signal,sys; signal.signal(signal.SIGINT, signal.SIG_DFL); os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' bash "$WORK/twice.sh" >/dev/null 2>&1 &
PID=$!
for _ in $(seq 1 100); do if [ -e "$WORK/twice.ready" ]; then break; fi; sleep 0.1; done
kill -s INT -- "-$PID"
sleep 0.4
kill -s INT -- "-$PID" 2>/dev/null || true
wait "$PID" || rc=$?
PID=''
rm -f "$WORK/twice.ready"
check "a second Ctrl-C while on_exit waits: the script still exits 130" 130 "$rc"
check "  the log still searched itself for the keys, then ends on its exit" "ok   no key in this log == exit 130" "$(tail -n 2 "$WORK"/logs/*.log | tr '\n' ' ' | sed 's/ $//')"
check "  and the scratch folder is removed" 0 "$(find "$WORK/tmp" -mindepth 1 | wc -l | tr -d ' ')"

echo "== tunnel_hold leaves at once on a signal, and closes the tunnel"
cat >"$WORK/hold.sh" <<'CHILD'
set -euo pipefail
. "$OPS_DIR/lib.sh"
log_start holdtest x
ssh() { echo "$*" >>"$MARK"; }
box_ready=1
BOX_ID=i-test
tunnel_hold 30
CHILD
fresh_dirs
OPS_DIR=$OPS_DIR OPS_LOG_DIR=$WORK/logs TMPDIR=$WORK/tmp MARK=$WORK/ssh.calls bash "$WORK/hold.sh" >/dev/null 2>&1 &
PID=$!
for _ in $(seq 1 100); do if [ -s "$WORK/ssh.calls" ]; then break; fi; sleep 0.1; done
SECONDS=0
kill -s TERM "$PID"
rc=0
wait "$PID" || rc=$?
PID=''
check "a connection that holds is left by a signal at once, not after the 30 s between checks (143)" "143 fast" "$rc $(if [ "$SECONDS" -lt 5 ]; then echo fast; else echo slow; fi)"
check "  the log ends on it" "== exit 143" "$(tail -n 1 "$WORK"/logs/*.log)"
check "  and the tunnel is closed (one -O exit)" 1 "$(grep -c -e '-O exit' "$WORK/ssh.calls" || true)"

echo "== ops/tunnel.sh and check.sh run whole, on stand-ins for aws and ssh, with the real c-storage behind the forward"
# A scratch clone with a local origin holds ops/ as it is here, so main_synced passes. Only two value
# lines of the clone's tunnel.sh differ from the real one: its port, so this run neither meets a
# tunnel the human holds open nor another worktree's test, and the seconds between its checks.
E2E=$WORK/e2e
mkdir -p "$E2E/fakebin" "$E2E/repo/services/c-storage/bruno/environments"
tport=$(free_port)
cport=$(free_port)
cp -R "$OPS_DIR" "$E2E/repo/ops"
cp "$REPO_DIR/services/c-storage/bruno/environments/.gitignore" "$E2E/repo/services/c-storage/bruno/environments/.gitignore"
echo 'info: {}' >"$E2E/repo/services/c-storage/bruno/opencollection.yml"
# docs/ is outside every path ci.yml deploys on: an edit there passes main_synced and meets the
# whole-tree check against HEAD that seed.sh and root-password.sh keep.
mkdir -p "$E2E/repo/docs"
echo 'a note' >"$E2E/repo/docs/note.md"
# seed.sh reads the paths a push deploys on from ci.yml, so the clone holds the real one.
mkdir -p "$E2E/repo/.github/workflows"
cp "$REPO_DIR/.github/workflows/ci.yml" "$E2E/repo/.github/workflows/ci.yml"
sed -i.bak -e "s/^TUNNEL_PORT=3192\$/TUNNEL_PORT=$tport/" -e 's/^CHECK_EVERY=5$/CHECK_EVERY=1/' "$E2E/repo/ops/tunnel.sh"
rm -f "$E2E/repo/ops/tunnel.sh.bak"
check "the clone's tunnel.sh differs from the real one in two lines" 4 "$(diff "$OPS_DIR/tunnel.sh" "$E2E/repo/ops/tunnel.sh" | grep -c '^[<>]')"
git init -q --bare "$E2E/origin.git"
git -C "$E2E/repo" init -q
git -C "$E2E/repo" remote add origin "$E2E/origin.git"
git -C "$E2E/repo" add -A
git -C "$E2E/repo" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit -q -m main
git -C "$E2E/repo" push -q origin HEAD:refs/heads/main
e2e_sha=$(git -C "$E2E/repo" rev-parse HEAD)
build "$WORK/server-e2e" "$e2e_sha"
# The stand-in aws answers the stack (with layer four's outputs when FAKE_LAYER4 is set) and the
# function and bucket calls app.sh makes, keeping what it was given in the run's state folder.
cat >"$E2E/fakebin/aws" <<'STANDIN'
#!/bin/bash
S=${FAKE_STATE:?}
echo "aws $*" >>"$S/aws.calls"
args=("$@")
# The environment file must be gone by the next call after the one that read it: any later call that
# still finds it writes envfile.kept.
if [[ "$*" != *"lambda update-function-configuration"* ]] && [ -f "$S/envfile.path" ] && [ -f "$(cat "$S/envfile.path")" ]; then
  echo kept >"$S/envfile.kept"
fi
arg_after() { local prev='' a; for a in "${args[@]}"; do if [ "$prev" = "$1" ]; then echo "$a"; return; fi; prev=$a; done; }
case "$*" in
  *"cloudformation describe-stacks"*)
    layer4=''
    if [ -n "${FAKE_LAYER4:-}" ]; then
      layer4=',{"OutputKey":"BffName","OutputValue":"ridge-bff"},{"OutputKey":"BffGroupId","OutputValue":"sg-0bff"},{"OutputKey":"SubnetId","OutputValue":"subnet-test"},{"OutputKey":"UiBucketName","OutputValue":"ui-test-bucket"},{"OutputKey":"AppAddress","OutputValue":"'"$FAKE_APP"'"},{"OutputKey":"ApiAddress","OutputValue":"'"$FAKE_API"'"}'
    fi
    echo '{"Stacks":[{"StackName":"ridge","StackStatus":"UPDATE_COMPLETE","Outputs":[{"OutputKey":"BoxId","OutputValue":"i-test"},{"OutputKey":"BoxAddress","OutputValue":"10.20.30.40"},{"OutputKey":"Zone","OutputValue":"ap-southeast-5a"}'"$layer4"']}]}' ;;
  *"send-ssh-public-key"*)
    [ ! -e "$S/send-fails" ] || { echo "stand-in aws: send-ssh-public-key failed (the session ended)" >&2; exit 254; }
    echo True ;;
  *"lambda update-function-code"*)
    [ -z "${FAKE_CODE_FAIL:-}" ] || { echo "stand-in aws: update-function-code failed" >&2; exit 254; }
    cp "$(arg_after --zip-file | sed 's#^fileb://##')" "$S/code.zip"
    openssl dgst -sha256 -binary "$S/code.zip" | base64 >"$S/code.sha"
    echo 1 >"$S/inprogress"
    echo Successful ;;
  *"lambda update-function-configuration"*)
    envfile=$(arg_after --environment | sed 's#^file://##')
    if [ -n "$envfile" ]; then
      echo "$envfile" >"$S/envfile.path"
      python3 -I -c 'import os,sys; print(oct(os.stat(sys.argv[1]).st_mode & 0o777)[2:])' "$envfile" >"$S/envfile.mode"
      cp "$envfile" "$S/envfile.seen"
    fi
    if [[ "$*" == *" --description "* ]]; then arg_after --description >"$S/description"; fi
    arg_after --vpc-config >"$S/vpc"
    echo Successful ;;
  *"lambda get-function-configuration"*)
    case $(arg_after --query) in
      LastUpdateStatus) if [ -f "$S/inprogress" ]; then rm -f "$S/inprogress"; echo InProgress; else echo Successful; fi ;;
      CodeSha256) if [ -n "${FAKE_BAD_SHA:-}" ]; then echo wrongchecksum; else cat "$S/code.sha"; fi ;;
      Description) if [ -n "${FAKE_RUNNING:-}" ]; then echo "$FAKE_RUNNING"; elif [ -f "$S/description" ]; then cat "$S/description"; else echo None; fi ;;
      *) echo "stand-in aws: unknown query: $*" >&2; exit 1 ;;
    esac ;;
  *"s3 cp"*) : ;;
  *) echo "stand-in aws: unknown: $*" >&2; exit 1 ;;
esac
STANDIN
# shellcheck disable=SC2016 # the stand-in's literal text
printf '#!/bin/sh\nif [ "${1:-}" = --version ]; then echo 4.2.0; fi\n' >"$E2E/fakebin/bru"
# The stand-in node answers the proof of a Bruno run with nothing, and runs the scripts' own commands
# (node --import tsx ...) with the real one.
REAL_NODE=$(command -v node)
# shellcheck disable=SC2016 # the stand-in's literal text
printf '#!/bin/sh\nif [ "${1:-}" = --import ]; then exec "%s" "$@"; fi\nexit 0\n' "$REAL_NODE" >"$E2E/fakebin/node"
# The stand-in ssh is the master: opening it starts the real c-storage on the forwarded port (or
# fails as ssh does with ExitOnForwardFailure when the port is taken); -O check asks whether it is
# alive, -O exit stops it; a command on the box prints the keys. FAKE_STEAL=1 takes the port first.
cat >"$E2E/fakebin/ssh" <<'STANDIN'
#!/bin/bash
S=${FAKE_STATE:?}
echo "$*" >>"$S/ssh.calls"
args=("$@")
op='' fwd='' strict=0 prev=''
for a in "${args[@]}"; do
  if [ "$prev" = -O ]; then op=$a; fi
  if [ "$prev" = -L ]; then fwd=$a; fi
  if [ "$a" = ExitOnForwardFailure=yes ]; then strict=1; fi
  prev=$a
done
detach() { python3 -I -c 'import os,sys; os.setsid(); os.execv(sys.argv[1], sys.argv[1:])' "$@"; }
alive() { [ -f "$S/master.pid" ] && kill -0 "$(cat "$S/master.pid")" 2>/dev/null; }
case $op in
  check) alive && exit 0; echo "Control socket connect: No such file or directory" >&2; exit 255 ;;
  exit) if alive; then kill "$(cat "$S/master.pid")"; rm -f "$S/master.pid"; exit 0; fi; exit 255 ;;
  forward) alive && exit 0; exit 255 ;;
esac
# A run that holds a stand-in box ($S/box.real, made by the company-restore case): the three scripts that one run
# sends with `sudo bash -s -- <records folder> ...` run here, on scratch folders for /var/lib/private/c-storage,
# /etc/c-storage, /opt/c-storage and /run, with shims for what macOS lacks. A dropped connection answers as ssh does.
if [ -e "$S/box.real" ]; then
  rest=()
  seen=0
  for a in "${args[@]}"; do if [ "$seen" = 1 ]; then rest+=("$a"); fi; case $a in ec2-user@*) seen=1 ;; esac; done
  if [ "${rest[0]:-}" = sudo ] && [ "${rest[1]:-}" = bash ] && [ "${rest[3]:-}" = -- ]; then
    alive || { echo "Control socket connect: No such file or directory" >&2; exit 255; }
    box=$S/box
    sub() { sed -e "s#/var/lib/private/c-storage#$box/records#g" -e "s#/etc/c-storage#$box/etc#g" -e "s#/opt/c-storage#$box/opt#g" -e "s#/run/#$box/run/#g"; }
    sub >"$box/script.sh"
    boxargs=()
    for a in "${rest[@]:4}"; do boxargs+=("$(printf '%s' "$a" | sub)"); done
    rc=0
    PATH="$box/bin:$PATH" bash "$box/script.sh" "${boxargs[@]}" >"$box/script.out" || rc=$?
    sed "s#$box/records#/var/lib/private/c-storage#g" "$box/script.out"
    exit $rc
  fi
fi
if [ -z "$fwd" ] && printf '%s\n' "${args[@]}" | grep -qx -- '-N'; then
  detach sleep 120 </dev/null >/dev/null 2>&1 &
  echo $! >"$S/master.pid"
  exit 0
fi
if [ -n "$fwd" ]; then
  lport=$(cut -d: -f2 <<<"$fwd")
  if [ -n "${FAKE_STEAL:-}" ]; then
    python3 -I -c "import os,socket,time; os.setsid(); s=socket.socket(); s.bind(('127.0.0.1',$lport)); s.listen(5); time.sleep(60)" </dev/null >/dev/null 2>&1 &
    echo $! >"$S/thief.pid"
    sleep 0.5
  fi
  if (exec 9<>"/dev/tcp/127.0.0.1/$lport") 2>/dev/null; then
    echo "bind [127.0.0.1]:$lport: Address already in use" >&2
    if [ "$strict" = 1 ]; then echo "Could not request local forwarding." >&2; exit 255; fi
    exit 0
  fi
  mkdir -p "$S/db"
  env -i PATH="$PATH" PORT="$lport" DB_PATH="$S/db/c-storage.db" INTERNAL_ACCESS_KEY="$FAKE_IKEY" X_SUPER_ADMIN_KEY="$FAKE_AKEY" \
    python3 -I -c 'import os,sys; os.setsid(); os.execv(sys.argv[1], sys.argv[1:])' "$FAKE_CS" </dev/null >>"$S/server.log" 2>&1 &
  echo $! >"$S/master.pid"
  for _ in $(seq 1 50); do curl -fsS -m 1 "http://127.0.0.1:$lport/health" >/dev/null 2>&1 && exit 0; sleep 0.1; done
  echo "stand-in ssh: the server did not start" >&2
  exit 255
fi
cmd=''
seen=0
for a in "${args[@]}"; do if [ "$seen" = 1 ]; then cmd="$cmd $a"; fi; case $a in ec2-user@*) seen=1 ;; esac; done
case $cmd in
  *"cat /etc/c-storage/keys.env"*) printf 'INTERNAL_ACCESS_KEY=%s\nX_SUPER_ADMIN_KEY=%s\n' "$FAKE_IKEY" "$FAKE_AKEY" ;;
  *"cat /etc/c-storage/bff.env"*) printf 'SERVICE_CODE=bff\nSERVICE_ACCESS_KEY=%s\n' "$FAKE_SKEY" ;;
  *"test -e /etc/c-storage/bff.env"*) [ -f "$S/bff.made" ] ;;
  *"sudo bash -s"*) cat >/dev/null; touch "$S/bff.made"; echo "bff.env: made"; echo "bff.env: mode 600, owner root" ;;
  *"bash -s"*) cat >/dev/null; echo "${FAKE_BOX:-2048 2048 8192} " ;;
  *"curl -fsS -m 5 http://"*"/health"*) if [ -n "${FAKE_RUNNING:-}" ]; then printf '{"status":"OK","buildVersion":"%s"}' "$FAKE_RUNNING"; else exit 7; fi ;;
  *) echo "stand-in ssh: unknown command:$cmd" >&2; exit 1 ;;
esac
STANDIN
chmod +x "$E2E/fakebin/aws" "$E2E/fakebin/bru" "$E2E/fakebin/node" "$E2E/fakebin/ssh"
export FAKE_IKEY=4f1c9e0b7a2d4c6e8f103a5b7c9d1e2f FAKE_AKEY=9a8b7c6d5e4f30211203f4e5d6c7b8a9 FAKE_SKEY=5d6e7f8091a2b3c4d5e6f708192a3b4c
export RIDGE_SCRIPTS_DIR=$REPO_DIR/scripts
export PATH="$E2E/fakebin:$PATH"
# By hand, as the human runs it: in GitHub's job GITHUB_ACTIONS is set, and mask then writes
# ::add-mask::<key> to the terminal, which is not a leak (the mask case below runs with it set).
unset GITHUB_ACTIONS
KEYS=$E2E/repo/services/c-storage/bruno/environments/ridge-tunnel.yml
S=''
RC=0
LPID=''
e2e_fresh() { # <name> [<c-storage binary>]: a state folder for the stand-ins and a log folder, for one run
  S=$E2E/state-$1
  rm -rf "${S:?}" "${E2E:?}/logs-$1"
  mkdir -p "$S"
  export FAKE_STATE=$S OPS_LOG_DIR=$E2E/logs-$1 FAKE_CS=${2:-$WORK/server-e2e}
}
e2e_launch() { # <script> <args...>: in its own session with SIGINT at its default, as a terminal's foreground job
  (cd "$E2E/repo" && exec python3 -I -c 'import os,signal,sys; signal.signal(signal.SIGINT, signal.SIG_DFL); os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' bash "ops/$1" "${@:2}") >"$S/out" 2>&1 &
  LPID=$!
}
e2e_run() { # <script> <args...>: runs it whole in the clone and waits for its end (a run that holds is killed after 40 s: RC 999)
  e2e_launch "$@"
  e2e_reap 40
}
e2e_wait() { # <text> <seconds>: until the run's terminal output holds it
  for _ in $(seq 1 $(($2 * 10))); do if grep -qF -- "$1" "$S/out" 2>/dev/null; then return 0; fi; sleep 0.1; done
  return 1
}
e2e_ended() { grep -q '^== exit' "$OPS_LOG_DIR"/*.log 2>/dev/null; }
e2e_reap() { # <seconds>: waits for LPID to end, sets RC (999, and its group and master killed, after the seconds)
  for _ in $(seq 1 $(($1 * 10))); do if e2e_ended; then break; fi; sleep 0.1; done
  if e2e_ended; then
    RC=0
    wait "$LPID" || RC=$?
  else
    kill -9 -- "-$LPID" 2>/dev/null || true
    if [ -f "$S/master.pid" ]; then kill "$(cat "$S/master.pid")" 2>/dev/null || true; fi
    RC=999
  fi
  LPID=''
}
master_state() { if [ -f "$S/master.pid" ] && kill -0 "$(cat "$S/master.pid")" 2>/dev/null; then echo alive; else echo gone; fi; }
file_state() { if [ -e "$1" ]; then echo there; else echo gone; fi; }
sum_of() { cksum <"$1" 2>/dev/null || echo none; }
keys_seen() { cat "$OPS_LOG_DIR"/*.log "$S/out" | grep -cE "$FAKE_IKEY|$FAKE_AKEY" || true; }
last2() { tail -n 2 "$OPS_LOG_DIR"/*.log | tr '\n' ' ' | sed 's/ $//'; }
# hold_port <port>: a listener that speaks no HTTP, in PID
hold_port() {
  python3 -I -c "import socket, time
s = socket.socket(); s.bind(('127.0.0.1', $1)); s.listen(5); time.sleep(30)" &
  PID=$!
  for _ in $(seq 1 25); do if port_taken "$1"; then break; fi; sleep 0.2; done
}

# A run held open: it replaces a keys file an earlier run left, and holds.
e2e_fresh held
printf 'an earlier run left this\n' >"$KEYS"
chmod 644 "$KEYS"
e2e_launch tunnel.sh ridge
held_s=$S
held_pid=$LPID
if e2e_wait "this run's service" 30; then ready=ready; else ready='not ready'; fi
check "the tunnel says ready" ready "$ready"
check "  after its four steps" 4 "$(grep -c '^\[[1-4]/4\]' "$S/out" || true)"
check "  with /health naming the commit of main it reached" 1 "$(grep -c "^ok   /health names $e2e_sha, a commit of main" "$S/out" || true)"
check "  and the endpoint's hour as a clock time" 1 "$(grep -cE "^ready: http://127.0.0.1:$tport is ridge's c-storage, until Ctrl-C or [0-9]{2}:[0-9]{2} \(the endpoint's hour\)" "$S/out" || true)"
check "  replacing the file an earlier run left, and saying so" 1 "$(grep -c '^note: replacing a keys file an earlier run left' "$S/out" || true)"
check "the keys file is 0600 and holds ridge's two keys" "$KEYS 2" "$(find "$KEYS" -perm 600) $(grep -cE "$FAKE_IKEY|$FAKE_AKEY" "$KEYS" || true)"
check "the forward is asked to fail if it cannot bind, for this port" "1 1" \
  "$(grep -c 'ExitOnForwardFailure=yes' "$S/ssh.calls" || true) $(grep -c -e "-L 127.0.0.1:$tport:" "$S/ssh.calls" || true)"
check "  to the stack's BoxAddress, from the box" 1 "$(grep -c -e "-L 127.0.0.1:$tport:10.20.30.40:$BOX_PORT" "$S/ssh.calls" || true)"
check "the real c-storage answers /health through the port" "$e2e_sha" "$(curl -fsS -m 5 "http://127.0.0.1:$tport/health" | jq -r .buildVersion)"
sleep 2
check "the run holds: two seconds on, it has not ended" no "$(if e2e_ended; then echo yes; else echo no; fi)"
sum_first=$(sum_of "$KEYS")
# a second run while the first holds the port
e2e_fresh second
e2e_run tunnel.sh ridge
check "a second run is refused at the port, naming it" "1 1" "$RC $(grep -c "something already answers on 127.0.0.1:$tport" "$OPS_LOG_DIR"/*.log || true)"
check "  before any aws call or ssh" "gone gone" "$(file_state "$S/aws.calls") $(file_state "$S/ssh.calls")"
check "  leaving the first run's keys file as it was" "$sum_first" "$(sum_of "$KEYS")"
# the drop: the first run's master dies
S=$held_s
export FAKE_STATE=$S OPS_LOG_DIR=$E2E/logs-held
# a dropped connection leaves no master: the process is killed and its pid file goes, as -O exit
# does. (Killed alone, a child nobody reaps stays a zombie that kill -0 still finds, as in a
# container whose first process reaps nothing.)
kill "$(cat "$S/master.pid")"
rm -f "$S/master.pid"
LPID=$held_pid
e2e_reap 20
check "a tunnel that drops ends the command with exit 1" 1 "$RC"
check "  the log names the drop" 1 "$(grep -c '^error: the tunnel dropped' "$OPS_LOG_DIR"/*.log || true)"
check "  the keys file is removed" gone "$(file_state "$KEYS")"
check "  the tunnel is closed (one -O exit), and the log ends on its exit" "1 == exit 1" "$(grep -c -e '-O exit' "$S/ssh.calls" || true) $(tail -n 1 "$OPS_LOG_DIR"/*.log)"
check "  with no key in the log or the terminal" 0 "$(keys_seen)"

# every way a held run is ended from outside
for sig in INT:130 TERM:143 HUP:129; do
  name=${sig%%:*} code=${sig##*:}
  e2e_fresh "sig-$name"
  rm -f "$KEYS"
  e2e_launch tunnel.sh ridge
  e2e_wait "this run's service" 30 || true
  kill -s "$name" -- "-$LPID"
  e2e_reap 20
  check "$name: the command exits $code" "$code" "$RC"
  check "$name: the keys file is removed, and the tunnel's master stopped" "gone gone" "$(file_state "$KEYS") $(master_state)"
  check "$name: the log searched itself for the keys, found none, and ends on the code" "ok   no key in this log == exit $code" "$(last2)"
  check "$name: no key reached the log or the terminal" 0 "$(keys_seen)"
done

# in GitHub's job, each key is masked as it is read: the two of the box's, and the access key made here
e2e_fresh masks
rm -f "$KEYS"
GITHUB_ACTIONS=true e2e_launch tunnel.sh ridge
e2e_wait "this run's service" 30 || true
kill -s INT -- "-$LPID"
e2e_reap 20
check "with GITHUB_ACTIONS set, the run masks its three keys and the box's private address" "130 4" "$RC $(grep -c '^::add-mask::' "$S/out" || true)"

# /health must name a commit of main before anything is written
health_case() { # <name> <c-storage binary> <what the refusal says>
  e2e_fresh "health-$1" "$2"
  rm -f "$KEYS"
  e2e_run tunnel.sh ridge
  check "a c-storage that is $1 stops the run, naming why" "1 1" "$RC $(grep -c "^error: /health.*$3" "$OPS_LOG_DIR"/*.log || true)"
  check "  with no keys file written, and the tunnel closed" "gone gone 1" "$(file_state "$KEYS") $(master_state) $(grep -c -e '-O exit' "$S/ssh.calls" || true)"
}
health_case dev "$WORK/server-dev" "names no commit"
health_case other "$WORK/server-other" "which origin/main does not hold"

# a listener that speaks no HTTP holds the port: refused before anything opens, and a file there is left
e2e_fresh silent
hold_port "$tport"
printf 'the first run keys\n' >"$KEYS"
e2e_run tunnel.sh ridge
stop_server
check "a listener that speaks no HTTP holds the port: the run is refused, naming it" "1 1" "$RC $(grep -c "something already answers on 127.0.0.1:$tport" "$OPS_LOG_DIR"/*.log || true)"
check "  before any aws call or ssh" "gone gone" "$(file_state "$S/aws.calls") $(file_state "$S/ssh.calls")"
check "  and the file already there is as it was" "the first run keys" "$(cat "$KEYS")"
rm -f "$KEYS"

# the port taken between the check and the bind
e2e_fresh stolen
FAKE_STEAL=1 e2e_run tunnel.sh ridge
if [ -f "$S/thief.pid" ]; then kill "$(cat "$S/thief.pid")" 2>/dev/null || true; fi
check "a port taken after the check fails the open, naming both causes" "1 1" "$RC $(grep -c "^error: the box does not answer through the endpoint, or 127.0.0.1:$tport could not be bound" "$OPS_LOG_DIR"/*.log || true)"
check "  and no keys file is written" gone "$(file_state "$KEYS")"

# ridge alone, before any aws call
e2e_fresh other-env
e2e_run tunnel.sh other
check "an environment other than ridge is refused, naming why" "1 1" "$RC $(grep -c '^error: tunnel.sh holds ridge alone for now' "$OPS_LOG_DIR"/*.log || true)"
check "  before any aws call or ssh" "gone gone" "$(file_state "$S/aws.calls") $(file_state "$S/ssh.calls")"

# a keys file git would not ignore is refused before any aws call
e2e_fresh not-ignored
mv "$E2E/repo/services/c-storage/bruno/environments/.gitignore" "$E2E/not-ignored.off"
e2e_run tunnel.sh ridge
mv "$E2E/not-ignored.off" "$E2E/repo/services/c-storage/bruno/environments/.gitignore"
check "a keys file git does not ignore stops the run" "1 1" "$RC $(grep -c '^error: git does not ignore services/c-storage/bruno/environments/ridge-tunnel.yml' "$OPS_LOG_DIR"/*.log || true)"
check "  before any aws call" gone "$(file_state "$S/aws.calls")"

check "the tunnel's port is fixed: no override" "3192 0" "$(sed -n 's/^TUNNEL_PORT=//p' "$OPS_DIR/tunnel.sh") $(grep -c 'TUNNEL_PORT:-' "$OPS_DIR/tunnel.sh" || true)"
rc=0
out=$(bash "$OPS_DIR/tunnel.sh" 2>&1) || rc=$?
check "tunnel.sh with no environment prints its usage and exits 2" "2 usage: ops/tunnel.sh <env>" "$rc $out"

# check.sh refuses a taken port, whatever answers on it, before any aws call
start_server "$WORK/server-new"
port=${URL#http://127.0.0.1:}
port=${port%/health}
e2e_fresh check-http
CHECK_LOCAL_PORT=$port e2e_run check.sh ridge
stop_server
check "check.sh refuses a port with c-storage on it, with its message" "1 1" \
  "$RC $(grep -c "^error: something already answers on 127.0.0.1:$port: free it, or set CHECK_LOCAL_PORT" "$OPS_LOG_DIR"/*.log || true)"
check "  before any aws call" gone "$(file_state "$S/aws.calls")"
e2e_fresh check-silent
hold_port "$cport"
CHECK_LOCAL_PORT=$cport e2e_run check.sh ridge
stop_server
check "  and a listener that speaks no HTTP too" "1 gone" "$RC $(file_state "$S/aws.calls")"

echo "== layer four's reads of AWS, on hand-written answers (rows 21, 22, 26, 27)"
tcp() { # <port> <ranges json> <group ids...>: one IpPermission, as describe-security-groups shows it
  local port=$1 ranges=$2 pairs
  shift 2
  pairs=$(printf '%s\n' "$@" | jq -R '{GroupId: .}' | jq -sc .)
  jq -nc --argjson p "$port" --argjson r "$ranges" --argjson g "$pairs" \
    '{IpProtocol: "tcp", FromPort: $p, ToPort: $p, IpRanges: $r, Ipv6Ranges: [], PrefixListIds: [], UserIdGroupPairs: $g}'
}
none='[]'
anywhere='[{"CidrIp":"0.0.0.0/0"}]'
eg='["sg-ep"]'
ssh_rule=$(tcp 22 "$none" sg-ep)
app_rule=$(tcp "$BOX_PORT" "$none" sg-bff)
rules() { jq -sc . <<<"$*"; }
check "before layer four the box admits ssh from the endpoint's group alone" yes "$(box_rules_verdict "$(rules "$ssh_rule")" "$eg" '' "$BOX_PORT")"
check "with layer four it admits ssh from the endpoint's group and c-storage's port from the BFF's group" yes \
  "$(box_rules_verdict "$(rules "$ssh_rule" "$app_rule")" "$eg" sg-bff "$BOX_PORT")"
check "  in any order" yes "$(box_rules_verdict "$(rules "$app_rule" "$ssh_rule")" "$eg" sg-bff "$BOX_PORT")"
check "c-storage's port open before layer four is refused" no "$(box_rules_verdict "$(rules "$ssh_rule" "$app_rule")" "$eg" '' "$BOX_PORT")"
check "layer four without the BFF's rule is refused" no "$(box_rules_verdict "$(rules "$ssh_rule")" "$eg" sg-bff "$BOX_PORT")"
check "c-storage's port from an address range is refused" no \
  "$(box_rules_verdict "$(rules "$ssh_rule" "$(tcp "$BOX_PORT" "$anywhere" sg-bff)")" "$eg" sg-bff "$BOX_PORT")"
check "c-storage's port from another group is refused" no \
  "$(box_rules_verdict "$(rules "$ssh_rule" "$(tcp "$BOX_PORT" "$none" sg-other)")" "$eg" sg-bff "$BOX_PORT")"
check "c-storage's port from two groups is refused" no \
  "$(box_rules_verdict "$(rules "$ssh_rule" "$(tcp "$BOX_PORT" "$none" sg-bff sg-other)")" "$eg" sg-bff "$BOX_PORT")"
check "a third rule (another port) is refused" no \
  "$(box_rules_verdict "$(rules "$ssh_rule" "$app_rule" "$(tcp 8080 "$none" sg-bff)")" "$eg" sg-bff "$BOX_PORT")"
check "ssh from another group than the endpoint's is refused" no \
  "$(box_rules_verdict "$(rules "$(tcp 22 "$none" sg-other)" "$app_rule")" "$eg" sg-bff "$BOX_PORT")"
check "ssh from anywhere is refused" no \
  "$(box_rules_verdict "$(rules "$(tcp 22 "$anywhere" sg-ep)" "$app_rule")" "$eg" sg-bff "$BOX_PORT")"
check "no ssh rule is refused" no "$(box_rules_verdict "$(rules "$app_rule")" "$eg" sg-bff "$BOX_PORT")"

egress_rule=$(tcp "$BOX_PORT" "$none" sg-box)
check "the BFF's group sends to c-storage's port on the box's group, and admits nothing" yes "$(bff_rules_verdict "$(rules "$egress_rule")" '[]' sg-box "$BOX_PORT")"
check "  a second egress rule (all traffic) is refused" no \
  "$(bff_rules_verdict "$(rules "$egress_rule" '{"IpProtocol":"-1","IpRanges":[{"CidrIp":"0.0.0.0/0"}],"Ipv6Ranges":[],"PrefixListIds":[],"UserIdGroupPairs":[]}')" '[]' sg-box "$BOX_PORT")"
check "  egress to an address range is refused" no "$(bff_rules_verdict "$(rules "$(tcp "$BOX_PORT" "$anywhere" sg-box)")" '[]' sg-box "$BOX_PORT")"
check "  egress to another group is refused" no "$(bff_rules_verdict "$(rules "$(tcp "$BOX_PORT" "$none" sg-other)")" '[]' sg-box "$BOX_PORT")"
check "  an ingress rule is refused" no "$(bff_rules_verdict "$(rules "$egress_rule")" "$(rules "$(tcp 443 "$none" sg-bff)")" sg-box "$BOX_PORT")"

# The function as BFF_FN_QUERY reads it: the names of its variables, and the two non-secret values; never a key's value.
fn='{"VpcConfig":{"SubnetIds":["subnet-test"],"SecurityGroupIds":["sg-bff"]},"Description":"abc","Names":["C_STORAGE_URL","INTERNAL_ACCESS_KEY","SERVICE_CODE","SERVICE_ACCESS_KEY","APP_ORIGIN"],"AppOrigin":"https://app.example.test","Url":"u"}'
check "the function is read by names and two non-secret values, never its variables whole" 0 "$(printf '%s' "$BFF_FN_QUERY" | grep -c 'INTERNAL_ACCESS_KEY\|SERVICE_ACCESS_KEY\|Environment.Variables}' || true)"
check "  and the query asks for the names, the origin and the storage address" 3 "$(printf '%s' "$BFF_FN_QUERY" | grep -o 'keys(Environment.Variables\|Variables.APP_ORIGIN\|Variables.C_STORAGE_URL' | wc -l | tr -d ' ')"
check "the function sits in ridge's subnet under the BFF's group alone" yes "$(function_network_verdict "$fn" subnet-test sg-bff)"
check "  another subnet is refused" no "$(function_network_verdict "$fn" subnet-other sg-bff)"
check "  a second group is refused" no "$(function_network_verdict "$(jq -c '.VpcConfig.SecurityGroupIds += ["sg-box"]' <<<"$fn")" subnet-test sg-bff)"
check "  a function out of the VPC is refused" no "$(function_network_verdict "$(jq -c '.VpcConfig = {SubnetIds: [], SecurityGroupIds: []}' <<<"$fn")" subnet-test sg-bff)"
check "the function holds the five variables" "$BFF_ENV_NAMES" "$(function_env_names "$fn")"
check "  and the super-admin key among them is seen" "APP_ORIGIN,C_STORAGE_URL,INTERNAL_ACCESS_KEY,SERVICE_ACCESS_KEY,SERVICE_CODE,X_SUPER_ADMIN_KEY" \
  "$(function_env_names "$(jq -c '.Names += ["X_SUPER_ADMIN_KEY"]' <<<"$fn")")"
check "  a function with no environment is seen" "" "$(function_env_names '{}')"
check "the function's APP_ORIGIN is the app's address, with or without a trailing slash on the address" "yes yes" \
  "$(function_origin_verdict "$fn" https://app.example.test) $(function_origin_verdict "$fn" https://app.example.test/)"
check "  another address, an origin with a path, and no origin at all are refused" "no no no no" \
  "$(function_origin_verdict "$fn" https://other.example.test) $(function_origin_verdict "$fn" https://app.example.test/x) $(function_origin_verdict "$(jq -c 'del(.AppOrigin)' <<<"$fn")" https://app.example.test) $(function_origin_verdict "$fn" '')"

pab='{"PublicAccessBlockConfiguration":{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}}'
statement='{"Effect":"Allow","Principal":{"Service":"cloudfront.amazonaws.com"},"Action":"s3:GetObject","Resource":"arn:aws:s3:::b/*","Condition":{"StringEquals":{"AWS:SourceArn":"arn:aws:cloudfront::123:distribution/E1ABC"}}}'
policy_of() { jq -nc --arg p "$(jq -nc --argjson st "$1" '{Version: "2012-10-17", Statement: $st}')" '{Policy: $p}'; }
check "the bucket blocks every public path and admits the distribution alone" yes "$(bucket_verdict "$pab" "$(policy_of "[$statement]")")"
check "  a block switched off is refused" no "$(bucket_verdict "$(jq -c '.PublicAccessBlockConfiguration.BlockPublicPolicy = false' <<<"$pab")" "$(policy_of "[$statement]")")"
check "  a second statement is refused" no "$(bucket_verdict "$pab" "$(policy_of "[$statement, $(jq -c '.Principal = "*"' <<<"$statement")]")")"
check "  a policy for everyone is refused" no "$(bucket_verdict "$pab" "$(policy_of "[$(jq -c '.Principal = "*"' <<<"$statement")]")")"
check "  a policy with no source condition is refused" no "$(bucket_verdict "$pab" "$(policy_of "[$(jq -c 'del(.Condition)' <<<"$statement")]")")"
check "  no policy at all is refused" no "$(bucket_verdict "$pab" '{}')"

sha1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
check "/health, the function's description and index.html's metadata name one commit" yes "$(commits_agree "$sha1" "$sha1" "$sha1")"
check "  a function a deploy behind is refused" no "$(commits_agree "$sha1" "$other" "$sha1")"
check "  an index.html a deploy behind is refused" no "$(commits_agree "$sha1" "$sha1" "$other")"
check "  a stub function (no description) is refused" no "$(commits_agree "$sha1" '' "$sha1")"
check "  and no commit at all is refused" no "$(commits_agree '' '' '')"
check "index.html's commit is read from CloudFront's headers" "$sha1" "$(meta_commit "$(printf 'http/2 200\nx-amz-meta-commit: %s\netag: "x"' "$sha1")")"

echo "== through the app's address, on a stand-in edge (rows 10, 23, 25: the check's reads, each red when its behaviour breaks)"
cat >"$WORK/edge.py" <<'PY'
import json, os, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
MODE, PASS, NAME, CODE = os.environ.get('FAKE_EDGE_MODE', ''), os.environ['FAKE_EDGE_PASS'], os.environ['FAKE_EDGE_NAME'], os.environ['FAKE_EDGE_CODE']
HANDLE = 'handle-' + 'x' * 12
signed_out = [False]
PAGE = b'<!doctype html><html><body><div id="root"></div></body></html>'
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def reply(self, status, body=b'', ctype='application/json', cached=False, extra=None):
        self.send_response(status)
        self.send_header('content-type', ctype)
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.send_header('content-length', str(len(body)))
        self.send_header('x-cache', 'Hit from cloudfront' if cached else 'Miss from cloudfront')
        self.end_headers()
        self.wfile.write(body)
    def body(self):
        n = int(self.headers.get('content-length') or 0)
        return json.loads(self.rfile.read(n) or b'{}')
    def known(self):
        return self.headers.get('x-client-code') == CODE
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/index.html' and os.environ.get('FAKE_EDGE_COMMIT'):
            return self.reply(200, PAGE, 'text/html', extra={'x-amz-meta-commit': os.environ['FAKE_EDGE_COMMIT']})
        if path == '/login': return self.reply(200, PAGE, 'text/html')
        if path == '/health':
            if MODE == 'health-leak': return self.reply(200, b'{"status":"OK","buildVersion":"abc"}')
            return self.reply(200, PAGE, 'text/html')
        if path == '/api/health':
            return self.reply(404, b'{"status":"OK","buildVersion":"abc"}' if MODE == 'api-health-leak' else b'{"error":"Not found"}')
        if path == '/api/operator/me':
            return self.reply(200, b'{"operator":{"name":"x"}}') if MODE == 'operator-open' else self.reply(401, b'{}')
        if path == '/api/config':
            code = self.headers.get('x-client-code')
            if code is None: return self.reply(400, b'{}')
            if not self.known():
                return self.reply(200, PAGE, 'text/html') if MODE == 'unknown-is-page' else self.reply(404, b'{}')
            return self.reply(200, json.dumps({'config': {'name': NAME}, 'version': 'v'}).encode(), cached=(MODE == 'cached'))
        if path == '/api/auth/me':
            ok = self.known() and self.headers.get('x-auth-id') == HANDLE and (not signed_out[0] or MODE == 'no-sign-out')
            return self.reply(200, b'{"user":{"name":"root","root":true}}') if ok else self.reply(401, b'{}')
        self.reply(404, b'{}')
    def do_POST(self):
        path = self.path.split('?')[0]
        if path == '/api/auth/sign-in':
            b = self.body()
            if self.known() and b.get('name') == 'root' and b.get('password') == PASS:
                return self.reply(200, json.dumps({'authId': HANDLE, 'expiresAt': 1, 'user': {'name': 'root', 'root': True}}).encode())
            return self.reply(401, b'{}')
        if path == '/api/auth/sign-out':
            signed_out[0] = True
            return self.reply(204)
        if path == '/api/operator/passkey/options':
            # the relying party is the app's host (MODE rp-from-request: the request's, which is wrong)
            rp = 'attacker.example' if MODE == 'rp-from-request' else '127.0.0.1'
            return self.reply(200, json.dumps({'options': {'rpId': rp, 'challenge': 'c'}, 'token': 't'}).encode())
        self.reply(404, b'{}')
if os.environ.get('FAKE_EDGE_LIFE'):
    import threading
    threading.Timer(float(os.environ['FAKE_EDGE_LIFE']), lambda: os._exit(0)).start()
HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
PY
export FAKE_EDGE_PASS=pa55word-test FAKE_EDGE_NAME="Check check-t" FAKE_EDGE_CODE=check-t
edge_case() { # <mode> → the reds edge_reads finds, one line each, with the stand-in edge in that mode
  local eport out
  eport=$(free_port)
  FAKE_EDGE_MODE=$1 python3 -I "$WORK/edge.py" "$eport" >/dev/null 2>&1 &
  PID=$!
  for _ in $(seq 1 50); do if port_taken "$eport"; then break; fi; sleep 0.1; done
  out=$( (REDS=''; edge_reads "http://127.0.0.1:$eport" check-t "$FAKE_EDGE_PASS" "$FAKE_EDGE_NAME" >/dev/null; printf '%s' "$REDS") 2>&1 )
  kill "$PID" 2>/dev/null || true
  PID=''
  echo "$out"
}
check "a client as a partner reaches it: no red" "" "$(edge_case '')"
refuses_edge() { # <name> <mode> <text the red names>
  local got
  got=$(edge_case "$2")
  if grep -qF -- "$3" <<<"$got"; then echo "  ok   $1"; else echo "  FAIL $1: wanted a red naming '$3', got '$got'"; fail=1; fi
}
refuses_edge "  a code we do not know answered with the app's page (error pages) is red" unknown-is-page "a code we do not know is the BFF's 404"
refuses_edge "  /health answering c-storage's body is red" health-leak "/health is the app's page"
refuses_edge "  /api/health carrying the build is red" api-health-leak "/api/health is the BFF's 404"
refuses_edge "  an /api/* answer from a cache is red" cached "with no cache in front of /api/*"
refuses_edge "  a handle that outlives sign-out is red" no-sign-out "the handle is refused after"
refuses_edge "  the operator's door open without a session is red" operator-open "the operator's door without a session"
refuses_edge "  a sign-in whose relying party is not the app's host is red" rp-from-request "relying party is the app's host"
# built like the deploy's run: logged, the app's host masked (the bare host, stricter than app_load's
# host with its port), then the reads. The host is what the relying party is, so a check that prints
# it turns a green deploy red (row 37). The log must also hold the check's own line, as a yes.
cat >"$WORK/edge-log.sh" <<'CHILD'
set -euo pipefail
. "$OPS_DIR/lib.sh"
log_start edgelog x
mask 127.0.0.1
edge_reads "http://127.0.0.1:$1" check-t "$FAKE_EDGE_PASS" "$FAKE_EDGE_NAME"
CHILD
rm -rf "$WORK/logs" "$WORK/tmp"
mkdir -p "$WORK/tmp"
(
  eport_log=$(free_port)
  FAKE_EDGE_MODE='' python3 -I "$WORK/edge.py" "$eport_log" >/dev/null 2>&1 &
  epid=$!
  for _ in $(seq 1 50); do if port_taken "$eport_log"; then break; fi; sleep 0.1; done
  OPS_DIR=$OPS_DIR OPS_LOG_DIR=$WORK/logs TMPDIR=$WORK/tmp bash "$WORK/edge-log.sh" "$eport_log" >/dev/null 2>&1 || true
  kill "$epid" 2>/dev/null || true
)
check "the edge reads, logged with the app's host masked: the host's line says yes, no key, exit 0" \
  "1 ok   no key in this log == exit 0" \
  "$(grep -c "the sign-in options' relying party is the app's host, never the request's: 200 yes" "$WORK"/logs/*.log || true) $(tail -n 2 "$WORK"/logs/*.log | tr '\n' ' ' | sed 's/ $//')"
cport_edge=$(free_port)
check "  an address that answers nothing is red, and the address is not in what is printed" "no" \
  "$( (REDS=''; edge_reads "http://127.0.0.1:$cport_edge" check-t x y 2>&1 | grep -c "127.0.0.1:$cport_edge" | sed 's/^0$/no/'))"

echo "== ops/app.sh builds the bundle and the UI with the commit stamped (row 39)"
mkdir -p "$WORK/stampbin" "$WORK/stampsrc"
cat >"$WORK/stampbin/pnpm" <<'STANDIN'
#!/bin/bash
echo "$* | ${CREDO_BUILD:-unset}" >>"$STAMP_LOG"
STANDIN
chmod +x "$WORK/stampbin/pnpm"
STAMP_LOG=$WORK/stamp.log
export STAMP_LOG
(PATH="$WORK/stampbin:$PATH" build_app "$WORK/stampsrc" 0123456789abcdef0123456789abcdef01234567)
check "the BFF's bundle is built with the commit" "--filter @credo/bff bundle | 0123456789abcdef0123456789abcdef01234567" \
  "$(grep 'bff bundle' "$STAMP_LOG")"
check "the UI is built with the commit" "--filter @credo/ui build | 0123456789abcdef0123456789abcdef01234567" \
  "$(grep 'ui build' "$STAMP_LOG")"
check "the install is not stamped, and runs from the lockfile" "install --frozen-lockfile | unset" "$(grep install "$STAMP_LOG")"

echo "== ops/check.sh only reads on an environment that may hold real data, and with --reads-only on ridge (cases 7 to 9), run whole on stand-ins"
# On top of the stand-ins above: the aws that answers layer four's reads and the box's group, the ssh that
# answers the box's facts, the bru and node that log what they were asked, and the stand-in edge, which
# carries the commit index.html's metadata names. Each run's state folder holds the calls.
CHK=$E2E/chk
mkdir -p "$CHK/bin"
chk_port=$(free_port)
chk_sha=$e2e_sha
export FAKE_APP=http://127.0.0.1:$chk_port FAKE_API=http://api-test-host.invalid:9 FAKE_LAYER4=1
rules "$ssh_rule" "$(tcp "$BOX_PORT" "$none" sg-0bff)" >"$CHK/box-rules.json"
jq -n --argjson e "$(rules "$(tcp "$BOX_PORT" "$none" sg-0box)")" '{SecurityGroups: [{IpPermissionsEgress: $e, IpPermissions: []}]}' >"$CHK/bff-sg.json"
jq -c --arg sha "$chk_sha" --arg app "$FAKE_APP" --arg url "http://10.20.30.40:$BOX_PORT" \
  '.VpcConfig = {SubnetIds: ["subnet-test"], SecurityGroupIds: ["sg-0bff"]} | .Description = $sha | .AppOrigin = $app | .Url = $url' <<<"$fn" >"$CHK/fn.json"
echo "$pab" >"$CHK/pab.json"
# the copy: a status and a bucket listing that are sound by the stand-ins' clock (a run that wants them red rewrites them)
chk_stamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '{"freeBytes": 5000000000, "lastWriteAt": "%s"}' "$chk_stamp" >"$CHK/status.json"
cp_listing "${chk_stamp%Z}+00:00" "${chk_stamp%Z}+00:00" >"$CHK/listing.json"
policy_of "[$statement]" >"$CHK/policy.json"
# aws: layer four's reads and the box's group on files; the stack gains the two outputs the base lacks; the rest is the base stand-in's
cat >"$CHK/bin/aws" <<'STANDIN'
#!/bin/bash
C=${CHK_DIR:?}
case "$*" in
  *"cloudformation describe-stacks"*) "$CHK_BASE/aws" "$@" | jq -c '.Stacks[0].Outputs += [{OutputKey: "BoxGroupId", OutputValue: "sg-0box"}, {OutputKey: "VpcId", OutputValue: "vpc-test"}, {OutputKey: "CopyBucketName", OutputValue: "credo-test-copy"}, {OutputKey: "RecordsVolumeId", OutputValue: "vol-0rec"}]' ;;
  *"ec2 describe-instances"*) echo "aws $*" >>"$FAKE_STATE/aws.calls"; echo None ;;
  *"describe-internet-gateways"*) echo "aws $*" >>"$FAKE_STATE/aws.calls"; echo 0 ;;
  *"describe-instance-connect-endpoints"*) echo "aws $*" >>"$FAKE_STATE/aws.calls"; echo '["sg-ep"]' ;;
  *"describe-security-groups --group-ids sg-0bff"*) echo "aws $*" >>"$FAKE_STATE/aws.calls"; cat "$C/bff-sg.json" ;;
  *"describe-security-groups"*) echo "aws $*" >>"$FAKE_STATE/aws.calls"; cat "$C/box-rules.json" ;;
  *"lambda get-function-configuration"*"--query {VpcConfig: VpcConfig,"*) echo "aws $*" >>"$FAKE_STATE/aws.calls"; cat "$C/fn.json" ;;
  # the whole configuration holds the BFF's two keys: a read without the check's --query is refused here
  *"lambda get-function-configuration"*"--output json"*) echo "stand-in aws: the function's whole configuration is never read: $*" >&2; exit 1 ;;
  *"s3api get-public-access-block"*) echo "aws $*" >>"$FAKE_STATE/aws.calls"; cat "$C/pab.json" ;;
  *"s3api get-bucket-policy"*) echo "aws $*" >>"$FAKE_STATE/aws.calls"; cat "$C/policy.json" ;;
  *"s3api list-objects-v2"*) echo "aws $*" >>"$FAKE_STATE/aws.calls"; cat "$C/listing.json" ;;
  *) exec "$CHK_BASE/aws" "$@" ;;
esac
STANDIN
# ssh: the box's facts (the heredoc script the check sends), the rest is the base stand-in's
cat >"$CHK/bin/ssh" <<'STANDIN'
#!/bin/bash
case "$*" in
  *"sudo bash -s -- status "*)
    echo "$*" >>"${FAKE_STATE:?}/ssh.calls"
    cat >/dev/null
    cat "${CHK_DIR:?}/status.json" ;;
  *"sudo bash -s -- blank /var/lib/private/c-storage "*)
    echo "$*" >>"${FAKE_STATE:?}/ssh.calls"
    echo "$*" >>"$FAKE_STATE/blank.calls"
    cat >/dev/null
    printf 'records disk: formatted\nrestored=/var/lib/private/c-storage/c-storage.db\n' ;;
  *"sudo bash -s -- /var/lib/private/c-storage "*)
    echo "$*" >>"${FAKE_STATE:?}/ssh.calls"
    echo "$*" >>"$FAKE_STATE/restore.calls"
    cat >/dev/null
    all="$*"
    words=${all##*-- }
    set -- $words
    if [ "$3" = 1 ]; then printf 'answering=yes\naside=%s\n' "$4"; else printf 'restored=/var/lib/private/c-storage/restored-%s.db\n' "$4"; fi ;;
  *"sudo bash -s -- "*)
    echo "$*" >>"${FAKE_STATE:?}/ssh.calls"
    cat >/dev/null
    all="$*"
    port=${all##* } # the check passes c-storage's port last
    printf 'unit=active\nlisten=10.20.30.40:%s \nkeys=600 root\noom=0\ndbdir=700\ndbfiles=600 \narch=aarch64\nmemory=2048 MiB available of 4096 MiB\nswap=0 of 0 MiB used\ndisk=8192 MiB free of 16384 MiB\n' "$port" ;;
  *) exec "$CHK_BASE/ssh" "$@" ;;
esac
STANDIN
# bru logs its calls; node logs the product's own commands (the client's make, sweep and delete) and answers them
cat >"$CHK/bin/bru" <<'STANDIN'
#!/bin/sh
echo "bru $*" >>"${FAKE_STATE:?}/bru.calls"
if [ "${1:-}" = --version ]; then echo 4.2.0; fi
STANDIN
cat >"$CHK/bin/node" <<'STANDIN'
#!/bin/sh
if [ "${1:-}" = --import ] && [ "${3:-}" = src/ridge-main.ts ]; then
  echo "$4" >>"${FAKE_STATE:?}/ridge.calls"
  case $4 in
    tenant) echo pa55word-test ;;
    untenant) echo "client $5 removed" ;;
    clear-checks) echo "swept 0 stranded clients" ;;
  esac
  exit 0
fi
exec "$CHK_BASE/node" "$@"
STANDIN
chmod +x "$CHK/bin/aws" "$CHK/bin/ssh" "$CHK/bin/bru" "$CHK/bin/node"
FAKE_EDGE_COMMIT=$chk_sha FAKE_EDGE_LIFE=170 python3 -I "$WORK/edge.py" "$chk_port" >/dev/null 2>&1 &
chk_edge=$!
for _ in $(seq 1 50); do if port_taken "$chk_port"; then break; fi; sleep 0.1; done
chk_run() { # <name> <script args...>: one run on the check's stand-ins, with the state folder named chk-<name>
  local name=$1
  shift
  e2e_fresh "chk-$name"
  CHK_DIR=$CHK CHK_BASE=$E2E/fakebin PATH="$CHK/bin:$PATH" e2e_run "$@"
}
chk_has() { grep -c -- "$1" "$2" 2>/dev/null || true; }
six_reads() { # the log of a run → how many of the six reads that need no client are green in it
  grep -cE "^ok   (/health is the app's page|a code we do not know is the BFF's 404|a missing code is a 400|the operator's door without a session|the sign-in options' relying party|/api/health is the BFF's 404)" "$1" || true
}
bruno_files() { find "$E2E/repo/services/c-storage/bruno/environments" -name '*.yml' | wc -l | tr -d ' '; }
NOCLIENT="the root signs in through the edge"

chk_run real check.sh taiga
check "case 7: the check on an environment not listed ends green, saying it is safe there" "0 1 1" \
  "$RC $(chk_has '^== green' "$S/out") $(chk_has '^ok   taiga may hold real data; this script is safe there: it only reads' "$S/out")"
check "  no key is read off the box (the ssh calls hold neither keys file)" "0 0" \
  "$(chk_has 'c-storage/keys.env' "$S/ssh.calls") $(chk_has 'c-storage/bff.env' "$S/ssh.calls")"
check "  no collection runs and Bruno is not asked for its version" "gone" "$(file_state "$S/bru.calls")"
check "  no Bruno file is written, and the run says the collection is skipped" "0 1" "$(bruno_files) $(chk_has '^skipped: reads only, so no key is read off the box' "$S/out")"
check "  and the log holds neither key" 0 "$(keys_seen)"
check "case 8: the check on an environment not listed makes no client and sweeps none" "gone 0" "$(file_state "$S/ridge.calls") $(chk_has "$NOCLIENT" "$S/out")"
check "  and still runs the six reads that need no client, each green" 6 "$(six_reads "$S/out")"
check "  and layer four's reads and the commit agreement are made" "1 1" \
  "$(chk_has '^ok   /health, the function.s description and index.html.s metadata name one commit: yes' "$S/out") $(chk_has '^ok   the UI.s bucket blocks all public access' "$S/out")"

chk_run flag check.sh ridge --reads-only
check "case 9: --reads-only on ridge gives the same run: green, no key, no collection, no client" "0 1 0 gone gone 6" \
  "$RC $(chk_has '^== green' "$S/out") $(chk_has 'c-storage/keys.env' "$S/ssh.calls") $(file_state "$S/bru.calls") $(file_state "$S/ridge.calls") $(six_reads "$S/out")"
check "  and prints no 'safe there' line, which ridge never had" 0 "$(chk_has 'may hold real data' "$S/out")"

chk_run full check.sh ridge
check "  without the flag ridge's check is today's: the keys are read, the collection runs, a client is made, swept and deleted" "1 1 1 clear-checks,tenant,untenant" \
  "$(chk_has 'c-storage/keys.env' "$S/ssh.calls") $(chk_has '^bru run' "$S/bru.calls") $(chk_has '^ok   bru run exits: 0' "$S/out") $(paste -sd, "$S/ridge.calls")"
check "  and prints nothing about real data" 0 "$(chk_has 'may hold real data' "$S/out")"
REAL=1 chk_run strayreal check.sh ridge
check "  a stray REAL=1 in the environment cannot narrow ridge's check: the keys are read, a client is made and deleted" "1 1 clear-checks,tenant,untenant" \
  "$(chk_has 'c-storage/keys.env' "$S/ssh.calls") $(chk_has '^bru run' "$S/bru.calls") $(paste -sd, "$S/ridge.calls")"
rc=0
out=$(bash "$OPS_DIR/check.sh" ridge --nope 2>&1) || rc=$?
check "  a flag it does not know is its usage, exit 2" "2 usage: ops/check.sh <env> [--reads-only]" "$rc $out"
# the copy (row 15) in the whole check: read on the box without a key off it, and each fault a red
check "  the check reads the copy: the status on the box and the bucket's listing, green on a sound copy" "1 1 1" \
  "$(chk_has '^ok   the copy holds the last write within 300s' "$S/out") $(chk_has 'list-objects-v2 --bucket credo-test-copy --prefix Box/records/ --query' "$S/aws.calls") $(chk_has 'bash -s -- status ' "$S/ssh.calls")"
# after a restart c-storage knows no write time: the check must not call the copy current, and says the lag was not read
printf '{"freeBytes": 5000000000, "lastWriteAt": null}' >"$CHK/status.json"
chk_run copynull check.sh ridge --reads-only
check "row 15: with no write time known (after any restart) the check does not say the copy holds the last write, and says the lag was not read" "0 1 0 1" \
  "$RC $(chk_has '^ok   .*the lag was NOT read' "$S/out") $(chk_has 'copy holds the last write within' "$S/out") $(chk_has '^== green' "$S/out")"
check "  copy_lag_read says no on a null write time and yes on one" "no yes" \
  "$(copy_lag_read '{"freeBytes": 1, "lastWriteAt": null}') $(copy_lag_read '{"freeBytes": 1, "lastWriteAt": "2026-11-12T10:00:00Z"}')"
printf '{"freeBytes": 1000, "lastWriteAt": "%s"}' "$chk_stamp" >"$CHK/status.json"
cp_listing 2026-01-01T00:00:00+00:00 2026-01-01T00:00:00+00:00 >"$CHK/listing.json"
chk_run copyred check.sh ridge --reads-only
check "row 15: the whole check is red on a disk below its floor, a lagging copy and an old full copy, naming each" "1 1 1 1 1" \
  "$([ "$RC" != 0 ] && echo 1 || echo 0) $(chk_has '^RED  the records disk has 0 MiB free' "$S/out") $(chk_has '^RED  the newest copy lags the last write' "$S/out") $(chk_has '^RED  the newest full copy is' "$S/out") $(chk_has '^== red' "$S/out")"
printf '{"freeBytes": 5000000000, "lastWriteAt": "%s"}' "$chk_stamp" >"$CHK/status.json"
cp_listing "${chk_stamp%Z}+00:00" "${chk_stamp%Z}+00:00" >"$CHK/listing.json"

# the restore, whole: a new file by default, the live path only when named, never on an environment that may hold real data
restore_calls() { sed -n 's/.*bash -s -- \/var\/lib\/private\/c-storage //p' "$S/restore.calls" 2>/dev/null | head -n 1; }
chk_run rdef restore.sh ridge
check "row 16: the restore on ridge writes a new file and passes the box 'no moment, not onto the live file'" "0 1 1" \
  "$RC $(chk_has '^restored=/var/lib/private/c-storage/restored-' "$S/out") $(restore_calls | grep -c '^- 0 [0-9]\{8\}T[0-9]\{6\}Z ' || true)"
check "  and says the live file is untouched" 1 "$(chk_has '^the live file is untouched' "$S/out")"
chk_run rat restore.sh ridge --at 2026-11-12T10:00:00Z
check "  a moment is passed on whole" "0 1" "$RC $(restore_calls | grep -c '^2026-11-12T10:00:00Z 0 ' || true)"
chk_run rlive restore.sh ridge --onto-live
check "  --onto-live on ridge is passed to the box, and /health is read after the swap" "0 1 1" \
  "$RC $(restore_calls | grep -c '^- 1 ' || true) $(chk_has '^ok   c-storage answers /health after the swap' "$S/out")"
chk_run rtaiga restore.sh taiga
check "  on an environment that may hold real data the default runs, saying why" "0 1 1" \
  "$RC $(chk_has '^ok   taiga may hold real data; this script is safe there: by default it writes a new file' "$S/out") $(restore_calls | grep -c '^- 0 ' || true)"
chk_run rtaigalive restore.sh taiga --onto-live
check "  --onto-live there is refused, before any aws or box call" "1 1 gone gone" \
  "$RC $(grep -c '^error: --onto-live is refused on taiga' "$S/out" || true) $(file_state "$S/aws.calls") $(file_state "$S/ssh.calls")"
# the blank-disk restore (the one scripted path): the box gets the mount, the moment and the disk's id, c-storage is not started
chk_run rblank restore.sh ridge --onto-blank
check "the blank-disk restore on ridge calls the box once with the records disk's id and no moment, and says c-storage is not started" "0 1 1 1" \
  "$RC $(sed -n 's/.*bash -s -- blank \/var\/lib\/private\/c-storage //p' "$S/blank.calls" 2>/dev/null | grep -c '^- vol-0rec$' || true) $(chk_has '^ok   the restored file stands on the records disk: yes' "$S/out") $(chk_has '^c-storage is not started: release again' "$S/out")"
chk_run rblankat restore.sh taiga --onto-blank --at 2026-11-12T10:00:00Z
check "  it runs on an environment that may hold real data (nothing live exists on a blank disk), with the moment passed on whole" "0 1" \
  "$RC $(sed -n 's/.*bash -s -- blank \/var\/lib\/private\/c-storage //p' "$S/blank.calls" 2>/dev/null | grep -c '^2026-11-12T10:00:00Z vol-0rec$' || true)"
rc=0
out=$(bash "$OPS_DIR/restore.sh" ridge --onto-blank --onto-live 2>&1) || rc=$?
check "  and --onto-blank with --onto-live together is its usage, exit 2, before any call" "2 usage: ops/restore.sh <env> [--at <time>] [--onto-live | --onto-blank]" "$rc $out"
rc=0
out=$(bash "$OPS_DIR/restore.sh" ridge --at nonsense 2>&1) || rc=$?
check "  a time that is not an RFC 3339 time is the usage, exit 2" "2 usage: ops/restore.sh <env> [--at <time>] [--onto-live | --onto-blank]" "$rc $out"
kill "$chk_edge" 2>/dev/null || true
unset FAKE_LAYER4 FAKE_APP FAKE_API

echo "== ops/app.sh run whole, on stand-ins for aws and ssh (rows 27, 28, 30, 31)"
FAKE_APP_PORT=$(free_port)
export FAKE_APP=http://localhost:$FAKE_APP_PORT FAKE_API=http://api-test-host.invalid:9
APP_LOCAL=$(free_port)
export APP_LOCAL_PORT=$APP_LOCAL
mkdir -p "$E2E/ui/assets"
app_sha=$e2e_sha
# the stand-ins carry the commit as the real builds do (CREDO_BUILD), which app.sh refuses to ship without
echo "exports.handler = async () => ({build: '$app_sha'});" >"$E2E/index.js"
echo '<div id="root"></div>' >"$E2E/ui/index.html"
echo 'body{}' >"$E2E/ui/assets/index-abc123.css"
echo "console.log('$app_sha');" >"$E2E/ui/assets/index-abc123.js"
export APP_BUNDLE=$E2E/index.js APP_UI_DIR=$E2E/ui
git_e2e() { git -C "$E2E/repo" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false "$@"; }
line_of() { grep -n -- "$1" "$S/aws.calls" | head -n 1 | cut -d: -f1; }

# before layer four: nothing is sent
e2e_fresh app-skip
e2e_run app.sh ridge
check "app.sh before layer four ends green, saying so, and sends nothing" "0 1 gone gone" \
  "$RC $(grep -c '^skipped: ridge.s stack holds no layer four yet' "$S/out" || true) $(file_state "$S/code.zip") $(file_state "$S/ssh.calls")"

# the whole deploy, in the job (GITHUB_ACTIONS and a mask on every secret)
export FAKE_LAYER4=1
e2e_fresh app-job
GITHUB_ACTIONS=true e2e_run app.sh ridge
check "app.sh ships the BFF and the UI: exit 0, and the commit shipped" "0 1" "$RC $(grep -c "^shipped $app_sha\$" "$S/out" || true)"
check "  the service is made sure of through the tunnel with the product's own function" 1 "$(grep -c '^service registered$' "$S/out" || true)"
check "  the environment goes first, then the code, then the description, then the UI's files with index.html last" yes \
  "$([ "$(line_of 'lambda update-function-configuration .*--environment')" -lt "$(line_of 'lambda update-function-code')" ] &&
    [ "$(line_of 'lambda update-function-code')" -lt "$(line_of 'lambda update-function-configuration .*--description')" ] &&
    [ "$(line_of 'lambda update-function-configuration .*--description')" -lt "$(line_of 's3 cp .*--exclude index.html')" ] &&
    [ "$(line_of 's3 cp .*--exclude index.html')" -lt "$(line_of 's3 cp .*index.html --cache-control no-cache')" ] && echo yes || echo no)"
check "  the zip holds the bundle as index.js, and its checksum was compared" "$(cksum <"$E2E/index.js")" "$(unzip -p "$S/code.zip" index.js | cksum)"
check "  the settings carry the commit as the description, and ridge's subnet and the BFF's group" "$app_sha subnet-test sg-0bff" \
  "$(cat "$S/description") $(sed -n 's/^SubnetIds=\([^,]*\),SecurityGroupIds=\(.*\)$/\1 \2/p' "$S/vpc")"
check "  case 1: the first settings call carries the environment and the VPC settings, no description, and goes before the code" "1 1 0 yes" \
  "$(grep -m1 'lambda update-function-configuration' "$S/aws.calls" | grep -c -- '--environment file://' || true) $(grep -m1 'lambda update-function-configuration' "$S/aws.calls" | grep -c -- '--vpc-config SubnetIds=subnet-test,SecurityGroupIds=sg-0bff' || true) $(grep -m1 'lambda update-function-configuration' "$S/aws.calls" | grep -c -- '--description' || true) \
$([ "$(line_of 'lambda update-function-configuration')" -lt "$(line_of 'lambda update-function-code')" ] && echo yes || echo no)"
check "  case 2: the description, the commit, goes in one later call, after the code's checksum was read and before the UI's files, with ridge's subnet and the BFF's group" "1 yes subnet-test sg-0bff" \
  "$(grep -c "lambda update-function-configuration.*--description $app_sha .*--vpc-config SubnetIds=subnet-test,SecurityGroupIds=sg-0bff" "$S/aws.calls" || true) \
$([ "$(line_of 'get-function-configuration .*CodeSha256')" -lt "$(line_of 'lambda update-function-configuration .*--description')" ] &&
    [ "$(line_of 'lambda update-function-configuration .*--description')" -lt "$(line_of 's3 cp')" ] && echo yes || echo no) \
$(sed -n 's/^SubnetIds=\([^,]*\),SecurityGroupIds=\(.*\)$/\1 \2/p' "$S/vpc")"
check "  the environment file was 0600 when aws read it, and is gone" "600 gone" "$(cat "$S/envfile.mode") $(file_state "$(cat "$S/envfile.path")")"
check "  and it was gone by the next aws call, not left until the run's end" gone "$(file_state "$S/envfile.kept")"
check "  it names the five variables, and the super-admin key is not among them" "APP_ORIGIN,C_STORAGE_URL,INTERNAL_ACCESS_KEY,SERVICE_ACCESS_KEY,SERVICE_CODE 0" \
  "$(jq -r '.Variables | keys | join(",")' "$S/envfile.seen") $(grep -c "$FAKE_AKEY" "$S/envfile.seen" || true)"
check "  and holds the app's address as the origin its passkeys are bound to" "$FAKE_APP" "$(jq -r .Variables.APP_ORIGIN "$S/envfile.seen")"
check "  and holds the box's private address for c-storage" "http://10.20.30.40:$BOX_PORT" "$(jq -r .Variables.C_STORAGE_URL "$S/envfile.seen")"
check "  the UI's files other than index.html are kept a year, index.html is read again with the commit in its metadata" "1 1 1" \
  "$(grep -c "immutable" "$S/aws.calls" || true) $(grep -c "index.html --cache-control no-cache.*--metadata commit=$app_sha" "$S/aws.calls" || true) $(grep -c 's3://ui-test-bucket/ --recursive' "$S/aws.calls" || true)"
check "  no key is in the log or on the terminal, apart from GitHub's mask lines" "0 0" "$(cat "$OPS_LOG_DIR"/*.log | grep -cE "$FAKE_IKEY|$FAKE_AKEY|$FAKE_SKEY" || true) $(grep -vE '^::add-mask::' "$S/out" | grep -cE "$FAKE_IKEY|$FAKE_AKEY|$FAKE_SKEY" || true)" 
check "  each key was masked first" 3 "$(grep -cE "^::add-mask::($FAKE_IKEY|$FAKE_AKEY|$FAKE_SKEY)\$" "$S/out" || true)"
check "  the app's address and the API's are masked, and print nowhere" "1 1 0" \
  "$(grep -cF "::add-mask::$FAKE_APP" "$S/out" || true) $(grep -cF "::add-mask::api-test-host.invalid:9" "$S/out" || true) $(cat "$OPS_LOG_DIR"/*.log | grep -cE "localhost:$FAKE_APP_PORT|api-test-host" || true)"
check "  the box's private address is masked, and prints nowhere" "1 0" \
  "$(grep -cF "::add-mask::10.20.30.40" "$S/out" || true) $(cat "$OPS_LOG_DIR"/*.log | grep -cF 10.20.30.40 || true)"
check "  and check.sh never lets expect print it as the wanted value" 0 \
  "$(grep -cE 'expect +"[^"]*" +"(http://)?[$]BOX_LISTEN_ADDR' "$OPS_DIR/check.sh" || true)"
check "  and the log says no key is in it" 1 "$(grep -c '^ok   no key in this log' "$OPS_LOG_DIR"/*.log || true)"

# a second run: the service is present; the first run's bff.env is left as it is
GITHUB_ACTIONS='' e2e_run app.sh ridge
check "a second app.sh finds the service present, and the box's file left as it is" "0 1 1" \
  "$RC $(grep -c '^service present$' "$S/out" || true) $(grep -c '^shipped ' "$S/out" || true)"

# the function runs other code than was sent
e2e_fresh app-sha
FAKE_BAD_SHA=1 e2e_run app.sh ridge
check "a function whose CodeSha256 is not the upload's stops the deploy before the UI's files" "1 1" \
  "$RC $(grep -c 'the function runs code of checksum' "$S/out" || true)"
check "  and no UI file is sent" 0 "$(grep -c 's3 cp' "$S/aws.calls" || true)"
check "  case 4: and the description is left as it was: no call names one" "gone 0" \
  "$(file_state "$S/description") $(grep -c 'lambda update-function-configuration.*--description' "$S/aws.calls" || true)"

# the code write fails: the description is never written (the production plan's case 3)
e2e_fresh app-codefail
FAKE_CODE_FAIL=1 e2e_run app.sh ridge
check "case 3: a code write that fails stops the run there, leaves the description as it was and sends no UI file" "failed 1 gone 0 0" \
  "$([ "$RC" != 0 ] && echo failed || echo "exit $RC") $(grep -c 'stand-in aws: update-function-code failed' "$S/out" || true) $(file_state "$S/description") $(grep -c 'lambda update-function-configuration.*--description' "$S/aws.calls" || true) $(grep -c 's3 cp' "$S/aws.calls" || true)"

# a bundle or a UI built without the commit is refused before anything is sent (row 39)
e2e_fresh app-unstamped-bundle
echo 'exports.handler = async () => ({build: "dev"});' >"$E2E/unstamped.js"
APP_BUNDLE=$E2E/unstamped.js e2e_run app.sh ridge
check "a bundle that does not carry the commit stops the deploy before anything is sent" "1 1 gone gone" \
  "$RC $(grep -c 'the bundle carries no .*built without CREDO_BUILD' "$S/out" || true) $(file_state "$S/code.zip") $(file_state "$S/ssh.calls")"
e2e_fresh app-unstamped-ui
mkdir -p "$E2E/unstamped-ui/assets"
echo '<div id="root"></div>' >"$E2E/unstamped-ui/index.html"
echo "console.log('dev');" >"$E2E/unstamped-ui/assets/index-abc123.js"
APP_UI_DIR=$E2E/unstamped-ui e2e_run app.sh ridge
check "a UI whose scripts do not carry the commit stops the deploy before anything is sent" "1 1 gone gone" \
  "$RC $(grep -c 'the UI.s scripts carry no .*built without CREDO_BUILD' "$S/out" || true) $(file_state "$S/code.zip") $(file_state "$S/ssh.calls")"

# ridge never moves backwards: the function already runs a descendant
e2e_fresh app-superseded
desc_newer=$(git_e2e commit-tree "HEAD^{tree}" -p HEAD -m newer)
FAKE_RUNNING=$desc_newer e2e_run app.sh ridge
check "a function that runs a newer commit is left as it is: exit 0, nothing sent" "0 1 gone" \
  "$RC $(grep -c "^nothing sent: $app_sha is behind what ridge runs" "$S/out" || true) $(file_state "$S/code.zip")"

echo "== ops/release.sh ends the deploy job's later steps when superseded"
e2e_fresh release-superseded
printf 'binary' >"$E2E/binary"
: >"$S/gh_output"
GITHUB_ACTIONS=true GITHUB_OUTPUT=$S/gh_output RELEASE_BINARY=$E2E/binary FAKE_RUNNING=$desc_newer e2e_run release.sh ridge
check "a superseded release exits 0, sends nothing and writes superseded=true for the job" "0 superseded=true 0" \
  "$RC $(cat "$S/gh_output") $(grep -c 'tee /opt/c-storage' "$S/ssh.calls" || true)"
e2e_fresh release-superseded-by-hand
GITHUB_ACTIONS='' RELEASE_BINARY=$E2E/binary FAKE_RUNNING=$desc_newer e2e_run release.sh ridge
check "  by hand it exits 0 as before" 0 "$RC"

echo "== ops/operator.sh (the operator's join link is shown on the terminal and in no log)"
# A pseudo-terminal where the machine can open one (GitHub's runner can); where it cannot, fd 3 is a
# plain file and the script is told so for this test (OPS_TEST_NO_TTY).
if python3 -I -c 'import pty; pty.openpty()' >/dev/null 2>&1; then have_pty=1; else have_pty=0; echo "note: no pseudo-terminal here; operator.sh is run with OPS_TEST_NO_TTY=1"; fi
pty_run() { # <script> <args...>: under a pseudo-terminal, its transcript in the run's out file
  if [ "$have_pty" = 0 ]; then
    OPS_TEST_NO_TTY=1 e2e_run "$@"
    return 0
  fi
  (cd "$E2E/repo" && exec python3 -I -c 'import os,pty,sys; os.setsid(); sys.exit(pty.spawn(sys.argv[1:]) >> 8)' bash "ops/$1" "${@:2}") >"$S/out" 2>&1 </dev/null &
  LPID=$!
  e2e_reap 60
}
e2e_fresh operator
GITHUB_ACTIONS='' e2e_run app.sh ridge
check "the BFF's service exists on the box, for the operator to be written with it" 0 "$RC"
export OPS_LOG_DIR=$E2E/logs-operator-pty
pty_run operator.sh ridge
link=$(sed -n 's/^.*the operator is operator, join link \(http[^ ]*\).*$/\1/p' "$S/out" | tr -d '\r' | head -n 1)
token=${link##*#}
check "the operator is made, and its join link, at the app's address, shown on the terminal once" "0 ${#token} $FAKE_APP/operator/join 1" \
  "$RC 43 ${link%%#*} $(grep -c "join link $link" "$S/out" || true)"
check "  the log holds the operator made and neither the link nor its token" "1 0 0" \
  "$(grep -c '^operator operator made' "$OPS_LOG_DIR"/*.log || true) $(cat "$OPS_LOG_DIR"/*.log | grep -cF -e "$link" || true) $(cat "$OPS_LOG_DIR"/*.log | grep -cF -e "$token" || true)"
check "  and the log's search for it ran" 1 "$(grep -c '^ok   no key in this log' "$OPS_LOG_DIR"/*.log || true)"
export OPS_LOG_DIR=$E2E/logs-operator-pty2
pty_run operator.sh ridge
check "a second run refuses to make it over, and shows no link" "1 0" \
  "$RC $(grep -c 'join link' "$S/out" || true)"
export OPS_LOG_DIR=$E2E/logs-operator-pty3
pty_run operator.sh ridge --replace
link2=$(sed -n 's/^.*the operator is operator, new-passkey link \(http[^ ]*\).*$/\1/p' "$S/out" | tr -d '\r' | head -n 1)
check "--replace gives a new-passkey link, and a different one" "0 yes" "$RC $([ -n "$link2" ] && [ "$link2" != "$link" ] && echo yes || echo no)"
export OPS_LOG_DIR=$E2E/logs-operator-pipe
e2e_run operator.sh ridge
check "without a terminal it refuses, and writes no operator" "1 1 0" \
  "$RC $(grep -c 'needs a terminal to show the link on' "$OPS_LOG_DIR"/*.log || true) $(grep -c 'join link' "$S/out" || true)"
rc=0
out=$(GITHUB_ACTIONS=true bash "$E2E/repo/ops/operator.sh" ridge 2>&1) || rc=$?
check "in GitHub's job it refuses before anything else" "1 1" "$rc $(grep -c "never in a job's log" <<<"$out" || true)"

echo "== ops/root-password.sh run whole (rows 1, 2, 3, 6, 8, 15, 16, 17: ridge's demo copies alone; the password typed twice and in no log, call or screen; every refusal before a write)"
# The password is typed at a terminal: a pseudo-terminal where the machine can open one (GitHub's runner
# can), the typing sent once each prompt shows, so nothing is echoed; elsewhere the typing is a file on
# the script's input and the script is told so for this test (OPS_TEST_NO_TTY).
cat >"$WORK/rp-driver.py" <<'DRIVER'
import os, pty, select, sys, time
answers = open(sys.argv[1]).read().split("\n")
if answers and answers[-1] == "":
    answers.pop()
prompts = [b"(not shown): ", b"Again: "]
pid, fd = pty.fork()
if pid == 0:
    os.execvp(sys.argv[2], sys.argv[2:])
seen, consumed, said = b"", 0, 0
while True:
    ready, _, _ = select.select([fd], [], [], 0.2)
    if ready:
        try:
            data = os.read(fd, 4096)
        except OSError:
            break
        if not data:
            break
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
        seen += data
    if said < len(prompts) and said < len(answers):
        at = seen.find(prompts[said], consumed)
        if at >= 0:
            consumed = at + len(prompts[said])
            time.sleep(0.3)
            os.write(fd, b"\x04" if answers[said] == "^D" else answers[said].encode() + b"\n")
            said += 1
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
DRIVER
rp_run() { # <the typing, one line a prompt (^D for none)> <args...>: root-password.sh whole, typed to; its transcript in the run's out file
  local typed=$1
  shift
  printf '%s\n' "$typed" >"$S/typed"
  if [ "$have_pty" = 1 ]; then
    (cd "$E2E/repo" && exec python3 -I "$WORK/rp-driver.py" "$S/typed" bash ops/root-password.sh "$@") >"$S/out" 2>&1 </dev/null &
  else
    grep -vx -e '\^D' "$S/typed" >"$S/typed.file" || true
    (cd "$E2E/repo" && OPS_TEST_NO_TTY=1 exec bash ops/root-password.sh "$@") >"$S/out" 2>&1 <"$S/typed.file" &
  fi
  LPID=$!
  e2e_reap 60
}
rp_status() { # <code> <password> → the status of that root's sign-in through the product's own routes, on this state's database
  local port pid result
  port=$(free_port)
  env -i PATH="$PATH" PORT="$port" DB_PATH="$S/db/c-storage.db" INTERNAL_ACCESS_KEY="$FAKE_IKEY" X_SUPER_ADMIN_KEY="$FAKE_AKEY" \
    "$FAKE_CS" >>"$S/server.log" 2>&1 &
  pid=$!
  for _ in $(seq 1 50); do curl -fsS -m 1 "http://127.0.0.1:$port/health" >/dev/null 2>&1 && break; sleep 0.1; done
  result=$(cd "$REPO_DIR/scripts" && RP_CODE=$1 RP_PASSWORD=$2 C_STORAGE_URL=http://127.0.0.1:$port INTERNAL_ACCESS_KEY=$FAKE_IKEY SERVICE_CODE=bff SERVICE_ACCESS_KEY=$FAKE_SKEY \
    node --import tsx -e "
Promise.all([import('@credo/bff'), import('@credo/shared')]).then(async ([bff, shared]) => {
  const e = process.env;
  const storage = shared.createCStorageClient({ baseUrl: e.C_STORAGE_URL, internalAccessKey: e.INTERNAL_ACCESS_KEY, serviceCode: e.SERVICE_CODE, accessKey: e.SERVICE_ACCESS_KEY });
  const app = bff.buildApp({ storage, now: Date.now, origin: 'http://localhost', serviceKey: 'the test', logger: false });
  const reply = await app.inject({ method: 'POST', url: shared.ROUTES.signIn, headers: { [shared.CLIENT_HEADER]: e.RP_CODE, [shared.DEVICE_HEADER]: 'device-test-0001' }, payload: { name: 'root', password: e.RP_PASSWORD } });
  console.log(reply.statusCode);
});")
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  echo "$result"
}
rp_make_copy() { # <code>: the operator's own create on this state's database; prints the root's first password
  local port pid
  port=$(free_port)
  env -i PATH="$PATH" PORT="$port" DB_PATH="$S/db/c-storage.db" INTERNAL_ACCESS_KEY="$FAKE_IKEY" X_SUPER_ADMIN_KEY="$FAKE_AKEY" \
    "$FAKE_CS" >>"$S/server.log" 2>&1 &
  pid=$!
  for _ in $(seq 1 50); do curl -fsS -m 1 "http://127.0.0.1:$port/health" >/dev/null 2>&1 && break; sleep 0.1; done
  INTERNAL_ACCESS_KEY=$FAKE_IKEY SERVICE_CODE=bff SERVICE_ACCESS_KEY=$FAKE_SKEY C_STORAGE_URL=http://127.0.0.1:$port ridge_cli tenant "$1" "A demo copy"
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}
rp_lines() { grep -c -- "$1" "$OPS_LOG_DIR"/*.log || true; }
rp_calls() { cat "$S/aws.calls" "$S/ssh.calls" 2>/dev/null | wc -l | tr -d ' '; }
rp_exits() { grep -c -e '-O exit' "$S/ssh.calls" || true; }
rp_seen() { # <text>: how many times the text is in this run's log, terminal and the stand-ins' calls
  cat "$OPS_LOG_DIR"/*.log "$S/out" "$S/aws.calls" "$S/ssh.calls" | grep -cF -e "$1" || true
}
rport_default=$(free_port)
export ROOT_PASSWORD_LOCAL_PORT=$rport_default
NEWPW='Invented-New1!'
DIFFPW='Invented-Other2@'
# shellcheck disable=SC2207 # the six codes have no space
rp_codes=($(cd "$REPO_DIR/scripts" && node --import tsx -e "import('./src/demo/mapping.ts').then((m) => console.log(m.allCopies().map((c) => c.code).join(' ')))"))
c1=${rp_codes[0]} c2=${rp_codes[1]} c3=${rp_codes[2]} c6=${rp_codes[5]}

e2e_fresh rootpw
export OPS_LOG_DIR=$E2E/logs-rp-app
GITHUB_ACTIONS='' e2e_run app.sh ridge
check "the BFF's service exists on the box, for the copies to be made with it" 0 "$RC"
old1=$(rp_make_copy "$c1")
old2=$(rp_make_copy "$c2")
old3=$(rp_make_copy "$c3")
check "three demo copies exist, each with its first root password" "16 16 16" "${#old1} ${#old2} ${#old3}"
check "  and each root signs in with it" "200 200 200" "$(rp_status "$c1" "$old1") $(rp_status "$c2" "$old2") $(rp_status "$c3" "$old3")"

# refused before the box is opened: no aws call, no ssh, and no root changed
refused_untouched() { # <name> <text the refusal names> <command run already>: RC 2, the line, no call made since <calls before>, the roots as they were
  check "$1" "2 1 0 1" \
    "$RC $(rp_lines "^== refused: .*$2") $(($(rp_calls) - calls_before)) $(rp_lines '^== exit 2$')"
}
calls_before=$(rp_calls)
export OPS_LOG_DIR=$E2E/logs-rp-other-env
rp_run "$NEWPW"$'\n'"$NEWPW" other "$c1"
refused_untouched "another environment than ridge is refused before any aws call, naming why" "root-password.sh holds ridge's demo copies alone"
export OPS_LOG_DIR=$E2E/logs-rp-job
GITHUB_ACTIONS=true rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1"
refused_untouched "in GitHub's job it refuses before anything else" "typed on a terminal, never in a job"
export OPS_LOG_DIR=$E2E/logs-rp-pipe
e2e_run root-password.sh ridge "$c1"
refused_untouched "without a terminal it refuses, before anything is asked or written" "needs a terminal to type the password on"
export OPS_LOG_DIR=$E2E/logs-rp-nocode
rp_run "$NEWPW"$'\n'"$NEWPW" ridge
refused_untouched "no code named is refused" "name at least one demo copy's code"
rc=0
out=$(bash "$E2E/repo/ops/root-password.sh" 2>&1) || rc=$?
check "no environment at all prints the usage and exits 2" "2 usage: ops/root-password.sh ridge <code>…" "$rc $out"
export OPS_LOG_DIR=$E2E/logs-rp-ops
printf '# touched\n' >>"$E2E/repo/ops/README.md"
rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1"
git -C "$E2E/repo" checkout -q -- ops/README.md
refused_untouched "an ops/ that is not origin/main's is refused" "the code here (tracked and unignored files under every path ci.yml deploys on, and .gitignore) differs from origin/main's"
export OPS_LOG_DIR=$E2E/logs-rp-head
printf 'a note\n' >"$E2E/repo/NOTES-ROOT-PASSWORD.md"
git -C "$E2E/repo" add NOTES-ROOT-PASSWORD.md
git -C "$E2E/repo" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit -q -m 'docs: not pushed'
rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1"
git -C "$E2E/repo" reset -q --hard "$e2e_sha"
refused_untouched "a HEAD that is no commit of main is refused" "is not a commit of main"
export OPS_LOG_DIR=$E2E/logs-rp-dirty
printf '# touched\n' >>"$E2E/repo/docs/note.md"
rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1"
git -C "$E2E/repo" checkout -q -- docs/note.md
refused_untouched "a tree that differs from its commit is refused" "this tree differs from"
export OPS_LOG_DIR=$E2E/logs-rp-modules
RIDGE_SCRIPTS_DIR='' rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1"
refused_untouched "a checkout with no pnpm install is refused" "needs pnpm install done"
export OPS_LOG_DIR=$E2E/logs-rp-differ
rp_run "$NEWPW"$'\n'"$DIFFPW" ridge "$c1"
refused_untouched "two typings that differ are refused, before the box is opened" "the two typings differ"
check "  the log holds neither typing" "0 0" "$(rp_seen "$NEWPW") $(rp_seen "$DIFFPW")"
export OPS_LOG_DIR=$E2E/logs-rp-none
rp_run '^D' ridge "$c1"
refused_untouched "no typing at all is refused" "no password was typed"
for weak in 'weak' 'ALLUPPERCASE1!' 'NoDigits!!' 'NoSymbol123a' 'Short1!'; do
  export OPS_LOG_DIR=$E2E/logs-rp-weak
  rm -rf "${OPS_LOG_DIR:?}"
  rp_run "$weak"$'\n'"$weak" ridge "$c1"
  refused_untouched "a password that breaks piece 2's rule ($weak) is refused before the box is opened" "the password or a code is refused"
  check "  the log names the rule and not the password" "1 0" "$(rp_lines 'the password breaks the rule') $(rp_seen "$weak")"
done
export OPS_LOG_DIR=$E2E/logs-rp-foreign
rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1" some-real-client
refused_untouched "a code outside the six demo copies is refused before the box is opened, nothing changed" "the password or a code is refused"
check "  and the log names it" 1 "$(rp_lines 'some-real-client is not one of the demo copies')"
check "no root was changed by any refusal above" "200 200 200" "$(rp_status "$c1" "$old1") $(rp_status "$c2" "$old2") $(rp_status "$c3" "$old3")"

# refused after the box is opened, still before any write
calls_before=$(rp_calls)
sends_before=$(grep -c 'send-ssh-public-key' "$S/aws.calls" || true)
export OPS_LOG_DIR=$E2E/logs-rp-port
rport=$(free_port)
hold_port "$rport"
ROOT_PASSWORD_LOCAL_PORT=$rport rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1"
stop_server
check "a taken port is refused before the box is opened, naming it" "2 1 $sends_before" \
  "$RC $(rp_lines "^== refused: something already answers on 127.0.0.1:$rport") $(grep -c 'send-ssh-public-key' "$S/aws.calls" || true)"
export OPS_LOG_DIR=$E2E/logs-rp-disk
exits_before=$(rp_exits)
FAKE_BOX='2048 2048 100' rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1"
check "a box below the disk floor stops the run before /health is read, nothing written, the tunnel closed" "2 1 0 0 1" \
  "$RC $(rp_lines "^== refused: disk: 100 MiB free, below the floor of $FLOOR_DISK_MB") $(rp_lines '^ok   /health names') $(rp_lines ': set$') $(($(rp_exits) - exits_before))"
export OPS_LOG_DIR=$E2E/logs-rp-dev
FAKE_CS=$WORK/server-dev rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1"
check "an unstamped ridge (dev) stops the run, naming why, nothing written" "2 1 0" \
  "$RC $(rp_lines '^== refused: /health names no commit') $(rp_lines ': set$')"
export OPS_LOG_DIR=$E2E/logs-rp-unknown
rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1" "$c6"
check "a demo copy nobody made is refused after the box is opened and before any write, the one beside it unchanged" "2 1 0 200" \
  "$RC $(rp_lines "^error: $c6 is not on this service") $(rp_lines ': set$') $(rp_status "$c1" "$old1")"
export OPS_LOG_DIR=$E2E/logs-rp-key
FAKE_SKEY=00000000000000000000000000000000 rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1"
check "a run that fails (the BFF's key refused) ends red with error:, exit 1, and says nothing was set" "1 1 0 0" \
  "$RC $(rp_lines '^error: the run stopped') $(rp_lines '^== refused') $(rp_lines ': set$')"
check "  the unchanged root still has its first password" 200 "$(rp_status "$c1" "$old1")"

# the run itself: two of the three copies
export OPS_LOG_DIR=$E2E/logs-rp-run
exits_before=$(rp_exits)
# a node that keeps what it is given, its arguments and its environment, and runs the real one
mkdir -p "$E2E/argsbin"
# shellcheck disable=SC2016 # the stand-in's literal text
printf '#!/bin/sh\necho "$*" >>"%s/node.calls"\nenv >>"%s/node.env"\nexec "%s" "$@"\n' "$S" "$S" "$(command -v node)" >"$E2E/argsbin/node"
chmod +x "$E2E/argsbin/node"
# ...and a grep that keeps its arguments: the end-of-run search must not put the password on grep's argv
# shellcheck disable=SC2016 # the stand-in's literal text
printf '#!/bin/sh\necho "$*" >>"%s/grep.calls"\nexec "%s" "$@"\n' "$S" "$(command -v grep)" >"$E2E/argsbin/grep"
chmod +x "$E2E/argsbin/grep"
PATH="$E2E/argsbin:$PATH" rp_run "$NEWPW"$'\n'"$NEWPW" ridge "$c1" "$c2"
check "the run ends 0 and the log ends on its exit" "0 == exit 0" "$RC $(tail -n 1 "$OPS_LOG_DIR"/*.log)"
check "  five steps with the time" 5 "$(grep -cE '^\[[1-5]/5\] .* \([0-9]+m[0-9]{2}s\)$' "$OPS_LOG_DIR"/*.log || true)"
check "  each code's company named, before the first write" "yes" \
  "$(awk -v a="$c1: A demo copy" -v b="$c2: A demo copy" -v s="$c1: set" '$0 == a {x = NR} $0 == b {y = NR} $0 == s {z = NR} END {print (x && y && z && x < z && y < z) ? "yes" : "no"}' "$OPS_LOG_DIR"/*.log)"
check "  each root set, then signs in" "1 1 1 1" "$(rp_lines "^$c1: set$") $(rp_lines "^$c1: signs in$") $(rp_lines "^$c2: set$") $(rp_lines "^$c2: signs in$")"
check "  the log's search ran, and the tunnel was closed once" "1 1" "$(rp_lines '^ok   no key in this log') $(($(rp_exits) - exits_before))"
check "the named roots take the new password, and refuse their old one" "200 200 401 401" \
  "$(rp_status "$c1" "$NEWPW") $(rp_status "$c2" "$NEWPW") $(rp_status "$c1" "$old1") $(rp_status "$c2" "$old2")"
check "  the copy not named keeps its password" "200 401" "$(rp_status "$c3" "$old3") $(rp_status "$c3" "$NEWPW")"
check "the password is in no log, on no screen and in no call of aws or ssh" 0 "$(rp_seen "$NEWPW")"
check "  nor is a key, or the box's address, in the log" "0 0" \
  "$(cat "$OPS_LOG_DIR"/*.log | grep -cE "$FAKE_IKEY|$FAKE_AKEY|$FAKE_SKEY" || true) $(cat "$OPS_LOG_DIR"/*.log | grep -cF 10.20.30.40 || true)"
check "  nor in node's arguments or environment, which name the command and the codes" "0 0 2" \
  "$(grep -cF -e "$NEWPW" "$S/node.calls" || true) $(grep -cF -e "$NEWPW" "$S/node.env" || true) $(grep -c -e "root-password.* $c1 $c2\$" "$S/node.calls" || true)"
check "  nor on the argument list of the grep that searches the log for it" "0 yes" \
  "$(grep -cF -e "$NEWPW" "$S/grep.calls" || true) $([ -s "$S/grep.calls" ] && echo yes || echo no)"

# the run again, with another typing: the same end state shape
export OPS_LOG_DIR=$E2E/logs-rp-again
rp_run "$DIFFPW"$'\n'"$DIFFPW" ridge "$c2"
check "a second run on one root sets it again, and only it" "0 200 401 200" \
  "$RC $(rp_status "$c2" "$DIFFPW") $(rp_status "$c2" "$NEWPW") $(rp_status "$c1" "$NEWPW")"

# the log is searched for the password: a node that echoes what it is given makes the run red
export OPS_LOG_DIR=$E2E/logs-rp-leak
mkdir -p "$E2E/leakbin"
# shellcheck disable=SC2016 # the stand-in's literal text
printf '#!/bin/sh\nif [ "${1:-}" = --import ]; then cat >"%s/leaked"; cat "%s/leaked"; exec "%s" "$@" <"%s/leaked"; fi\nexit 0\n' "$S" "$S" "$REAL_NODE" "$S" >"$E2E/leakbin/node"
chmod +x "$E2E/leakbin/node"
PATH="$E2E/leakbin:$PATH" rp_run "$DIFFPW"$'\n'"$DIFFPW" ridge "$c3"
check "a password that reached the log makes the run red, naming it, and the exit 1" "1 1" \
  "$RC $(rp_lines '^RED  the new password is in this log: redact it in this log, and run again with another password')"
unset ROOT_PASSWORD_LOCAL_PORT

echo "== ops/company-restore.sh (row 16: ridge's demo copies alone, every refusal before the box is touched; the second c-storage ends by itself and at the run's end; nothing live is written by the restore) (docs/plans/2026-11-11-store-pages-copy.md)"
# The box's helpers and the script that calls them, read as text, as the restore's are.
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
serve_guard() { # <lib.sh> <company-restore.sh>
  local b=$WORK/serve-block.sh
  sed -n '/^box_serve_restored() {/,/^REMOTE$/p' "$1" >"$b"
  [ -s "$b" ] || die "lib.sh has no box_serve_restored"
  need "$b" 'setsid timeout "\$secs" /opt/c-storage/c-storage' "the second c-storage is not started under a timeout of its own"
  need "$b" '^case \$file in "\$mount"/restored-\*\.db\) ;; \*\) echo' "the second c-storage serves a file that is not a restored one"
  need "$b" 'DB_PATH=\$file' "the second c-storage is not pointed at the restored file"
  need "$b" 'LISTEN_ADDR=127\.0\.0\.1' "the second c-storage does not bind the loopback"
  [ "$(grep -cE 'systemctl|c-storage\.db|/var/lib/c-storage' "$b")" = 0 ] || die "the second c-storage's start touches the live c-storage or its file"
  need "$2" '^  if \[ -n "\$RESTORED_FILE" \] && ! box_stop_restored "\$RESTORED_FILE"; then$' "the run does not end the second c-storage and remove the restored file whatever its end"
  need "$2" '^cleanup_extra\(\) \{$' "the run has no cleanup at its end"
}
passes "the second c-storage starts under its own timeout, on a restored file, on the loopback, touching nothing live; the run ends it at its end (row 16)" \
  serve_guard "$OPS_DIR/lib.sh" "$OPS_DIR/company-restore.sh"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
refuses "  a second c-storage without a timeout of its own is refused" "under a timeout of its own" \
  serve_guard "$(mutated lib-notimeout.sh 's#setsid timeout "$secs" /opt#setsid /opt#' "$OPS_DIR/lib.sh")" "$OPS_DIR/company-restore.sh"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
refuses "  a second c-storage on a file that is not a restored one is refused" "not a restored one" \
  serve_guard "$(mutated lib-anyfile.sh 's#^case $file in "$mount"/restored-\*\.db) ;; \*) echo.*#true#' "$OPS_DIR/lib.sh")" "$OPS_DIR/company-restore.sh"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
refuses "  a second c-storage on the live file is refused" "pointed at the restored file" \
  serve_guard "$(mutated lib-livedb.sh '/^box_serve_restored/,/^REMOTE$/s#DB_PATH=$file#DB_PATH=$mount/c-storage.db#' "$OPS_DIR/lib.sh")" "$OPS_DIR/company-restore.sh"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
refuses "  a run that does not end the second c-storage at its end is refused" "whatever its end" \
  serve_guard "$OPS_DIR/lib.sh" "$(mutated cr-nocleanup.sh 's#! box_stop_restored "$RESTORED_FILE"#! true#' "$OPS_DIR/company-restore.sh")"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
restore_call_guard() { # <company-restore.sh>
  need "$1" '^got=\$\(box_restore - 0 "c\$stamp"\)' "the run restores anything but the newest copy to a new file"
  first_before "$1" '^refuse_real ' '^box_open ' "the box is opened before the environment is refused"
  first_before "$1" '^checked=\$\(ridge_cli copy-company --check' '^box_open ' "the box is opened before the code is checked"
  first_before "$1" '^box_restore|^got=\$\(box_restore' '^WRITTEN=1$' "a record is written before the restore"
}
passes "the run restores the newest copy to a new file, and refuses the environment and the code before it opens the box (row 16)" \
  restore_call_guard "$OPS_DIR/company-restore.sh"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
refuses "  a run that restores onto the live file is refused" "anything but the newest copy to a new file" \
  restore_call_guard "$(mutated cr-live.sh 's#box_restore - 0 "c$stamp"#box_restore - 1 "c$stamp"#' "$OPS_DIR/company-restore.sh")"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
refuses "  a run that opens the box before refusing the environment is refused" "box is opened before the environment" \
  restore_call_guard "$(mutated cr-order.sh '/^refuse_real /d' "$OPS_DIR/company-restore.sh")"

cr_calls() { { cat "$S/aws.calls" "$S/ssh.calls" 2>/dev/null || true; } | wc -l | tr -d ' '; }
cr_lines() { grep -c -- "$1" "$OPS_LOG_DIR"/*.log || true; }
crun() { # <args...>: company-restore.sh whole in the clone, its transcript in the run's out file
  e2e_run company-restore.sh "$@"
}
cr_refused() { # <name> <text the refusal names>: RC 2, the line, and no aws or ssh call made since cr_before
  check "$1" "2 1 0 1" "$RC $(cr_lines "^== refused: .*$2") $(($(cr_calls) - cr_before)) $(cr_lines '^== exit 2$')"
}
e2e_fresh crestore
cr_before=$(cr_calls)
export OPS_LOG_DIR=$E2E/logs-cr-other-env
crun other "$c1"
cr_refused "another environment than ridge is refused before any aws call, naming why" "company-restore.sh holds ridge's demo copies alone"
export OPS_LOG_DIR=$E2E/logs-cr-foreign
crun ridge some-real-client
cr_refused "a code outside the six demo copies is refused before the box is opened" "some-real-client is refused"
check "  and the log names it" 1 "$(cr_lines 'some-real-client is not one of the demo copies')"
export OPS_LOG_DIR=$E2E/logs-cr-ops
printf '# touched\n' >>"$E2E/repo/ops/README.md"
crun ridge "$c1"
git -C "$E2E/repo" checkout -q -- ops/README.md
cr_refused "an ops/ that is not origin/main's is refused before the box is opened" "differs from origin/main's"
rc=0
out=$(bash "$E2E/repo/ops/company-restore.sh" ridge 2>&1) || rc=$?
check "a missing code prints the usage and exits 2" "2 usage: ops/company-restore.sh ridge <code>" "$rc $out"
check "no refusal above touched the box" 0 "$(($(cr_calls) - cr_before))"

echo "== ops/company-restore.sh run whole, on a stand-in box (row 16: the happy path offline, and what the cleanup says when the run is stopped)"
# The stand-in ssh runs the three scripts the run sends with `sudo bash -s -- <records folder> ...` here, on scratch
# folders for the box's paths: litestream restore is a sqlite3 backup of the live stand-in's file, setsid and timeout
# (which macOS lacks) are shims, and the second c-storage is the real binary on the local forward's own port (the
# forward is a no-op: COMPANY_RESTORE_BOX_PORT is that port). Two demo copies are made on the live stand-in first.
e2e_fresh crestore-run
export OPS_LOG_DIR=$E2E/logs-crr-app
GITHUB_ACTIONS='' e2e_run app.sh ridge
check "the BFF's service exists on the stand-in box, for the two copies to be made with it" 0 "$RC"
crr_pw=$(rp_make_copy "$c1")
crr_pw=$crr_pw$(rp_make_copy "$c2")
check "two demo copies exist on the live stand-in" 32 "${#crr_pw}"
BOX=$S/box
mkdir -p "$BOX/records" "$BOX/etc" "$BOX/opt" "$BOX/run" "$BOX/bin"
ln -s "$S/db/c-storage.db" "$BOX/records/c-storage.db"
ln -s "$FAKE_CS" "$BOX/opt/c-storage"
echo 'COPY_URL=s3://stand-in/copy' >"$BOX/etc/copy.env"
printf 'INTERNAL_ACCESS_KEY=%s\nX_SUPER_ADMIN_KEY=%s\n' "$FAKE_IKEY" "$FAKE_AKEY" >"$BOX/etc/keys.env"
# shellcheck disable=SC2016 # the stand-ins' literal text
printf '#!/bin/bash\nout=\nwhile [ $# -gt 0 ]; do case $1 in -o) out=$2; shift 2 ;; -timestamp) shift 2 ;; *) shift ;; esac; done\nexec sqlite3 "%s/db/c-storage.db" ".backup $out"\n' "$S" >"$BOX/opt/litestream"
printf '#!/bin/sh\nexit 0\n' >"$BOX/bin/mountpoint"
printf '#!/bin/sh\nexit 0\n' >"$BOX/bin/chown"
printf '#!/bin/sh\nexec "$@"\n' >"$BOX/bin/setsid"
# shellcheck disable=SC2016 # the stand-ins' literal text
printf '#!/bin/bash\nsecs=$1\nshift\n"$@" &\npid=$!\ntrap '"'"'kill $pid 2>/dev/null; exit 143'"'"' TERM INT\n( for _ in $(seq 1 "$secs"); do sleep 1; kill -0 $pid 2>/dev/null || exit 0; done; kill $pid 2>/dev/null ) &\nwait $pid\n' >"$BOX/bin/timeout"
chmod +x "$BOX/opt/litestream" "$BOX/bin/mountpoint" "$BOX/bin/chown" "$BOX/bin/setsid" "$BOX/bin/timeout"
touch "$S/box.real"
# A node that waits before the copy (not before its check), so that a signal can meet the copy.
mkdir -p "$E2E/slowbin"
# shellcheck disable=SC2016 # the stand-in's literal text
printf '#!/bin/sh\ncase "$*" in *--check*) ;; *copy-company*) sleep 20 ;; esac\nexec "%s" "$@"\n' "$REAL_NODE" >"$E2E/slowbin/node"
chmod +x "$E2E/slowbin/node"
crl=$(free_port)
crr=$(free_port)
export COMPANY_RESTORE_LIVE_PORT=$crl COMPANY_RESTORE_RESTORED_PORT=$crr COMPANY_RESTORE_BOX_PORT=$crr
cr_has() { # <code> → yes or no: whether that copy holds the drill's record, read on this state's database once the run is over
  local port pid out
  port=$(free_port)
  env -i PATH="$PATH" PORT="$port" DB_PATH="$S/db/c-storage.db" INTERNAL_ACCESS_KEY="$FAKE_IKEY" X_SUPER_ADMIN_KEY="$FAKE_AKEY" \
    "$FAKE_CS" >>"$S/server.log" 2>&1 &
  pid=$!
  for _ in $(seq 1 50); do curl -fsS -m 1 "http://127.0.0.1:$port/health" >/dev/null 2>&1 && break; sleep 0.1; done
  out=$(INTERNAL_ACCESS_KEY=$FAKE_IKEY SERVICE_CODE=bff SERVICE_ACCESS_KEY=$FAKE_SKEY C_STORAGE_URL=http://127.0.0.1:$port ridge_cli drill-record has "$1" 2>&1) || true
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  echo "$out"
}
cr_log() { cat "$OPS_LOG_DIR"/*.log; }
cr_n() { cr_log | grep -c "$@" || true; }
cr_second() { if curl -fsS -m 2 -o /dev/null "http://127.0.0.1:$crr/health" 2>/dev/null; then echo there; else echo gone; fi; }
cr_left() { { find "$BOX/records" -name 'restored-*' 2>/dev/null || true; } | wc -l | tr -d ' '; }

# the run whole, the code typed in capitals as a person may (the copy takes it as the checks do)
export OPS_LOG_DIR=$E2E/logs-crr-happy
crr_upper=$(printf '%s' "$c1" | tr '[:lower:]' '[:upper:]')
e2e_launch company-restore.sh ridge "$crr_upper"
e2e_reap 170
check "the whole run on a stand-in box ends 0, and the log ends on its exit" "0 == exit 0" "$RC $(tail -n 1 "$OPS_LOG_DIR"/*.log)"
check "  eight steps, each with the time" 8 "$(cr_n -E '^\[[1-8]/8\] .* \([0-9]+m[0-9]{2}s\)$')"
check "  the compare before shows the drill's record differing, and after shows none" "1 1" \
  "$(cr_n "^$c1 before: the source holds [0-9]* records, 1 differ on the target$") $(cr_n "^$c1 after: the source holds [0-9]* records, 0 differ on the target$")"
check "  the verdict is green: the named copy's record gone, the neighbour's kept and then removed" "1 1 1 1" \
  "$(cr_n "^ok   the named copy's drill record is gone: no$") $(cr_n "^ok   the neighbour's drill record is kept: yes$") $(cr_n "^ok   the neighbour's drill record is removed: no$") $(cr_n '^== green$')"
check "  the restored file, the pid file and the second c-storage are all gone" "0 gone gone" "$(cr_left) $(file_state "$BOX/run/c-storage-restored.pid") $(cr_second)"
check "  no WARN line, and the live file was not moved or replaced" "0 there" "$(cr_n '^WARN') $(file_state "$S/db/c-storage.db")"
check "  the log says how long the walks may take and until what clock time" 1 \
  "$(cr_n -E "^the copy's three whole-company walks over the tunnel may take up to 15 minutes .*, until [0-9]{2}:[0-9]{2};")"
check "  neither copy holds a drill record after it" "no no" "$(cr_has "$c1") $(cr_has "$c2")"

# Ctrl-C during the copy, the connection alive: the cleanup takes everything out and says nothing is left
export OPS_LOG_DIR=$E2E/logs-crr-int
PATH="$E2E/slowbin:$PATH" e2e_launch company-restore.sh ridge "$c1"
e2e_wait "a line follows every 30 seconds" 90 || true
kill -s INT -- "-$LPID"
e2e_reap 60
check "INT during the copy: the run exits 130, the log ends on it, and the box is clean" "130 == exit 130 0 gone gone" \
  "$RC $(tail -n 1 "$OPS_LOG_DIR"/*.log) $(cr_left) $(file_state "$BOX/run/c-storage-restored.pid") $(cr_second)"
check "  both copies are free of the drill's record, with no WARN line" "no no 0" "$(cr_has "$c1") $(cr_has "$c2") $(cr_n '^WARN')"

# the connection gone when the cleanup runs (the endpoint's hour, a drop): the cleanup says what it could not remove
export OPS_LOG_DIR=$E2E/logs-crr-drop
PATH="$E2E/slowbin:$PATH" e2e_launch company-restore.sh ridge "$c1"
e2e_wait "a line follows every 30 seconds" 90 || true
kill "$(cat "$S/master.pid")"
rm -f "$S/master.pid"
kill -s INT -- "-$LPID"
e2e_reap 60
check "a dropped connection and INT: the run exits 130 and names what was left" "130 1 1" \
  "$RC $(cr_n -E "^WARN the restored file /var/lib/private/c-storage/restored-c[0-9]{8}T[0-9]{6}Z[.]db .* by itself by [0-9]{2}:[0-9]{2}\\)") $(cr_n "^WARN a drill record may be left in: $c1 $c2 ")"
check "  and the restored file is indeed still on the box, as the line says" 1 "$(cr_left)"
if [ -s "$BOX/run/c-storage-restored.pid" ]; then kill "$(cat "$BOX/run/c-storage-restored.pid")" 2>/dev/null || true; fi
for _ in $(seq 1 50); do if [ "$(cr_second)" = gone ]; then break; fi; sleep 0.2; done
rm -f "$BOX"/records/restored-* "$BOX/run/c-storage-restored.pid"
unset COMPANY_RESTORE_LIVE_PORT COMPANY_RESTORE_RESTORED_PORT COMPANY_RESTORE_BOX_PORT

# the box's guard against a name that climbs out of the records folder (a case pattern's * also matches a /)
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
climb_probe() { # <lib.sh>: the stop must keep the live file, the serve must refuse; the plain restored name is still removed
  local d=$WORK/climb out rc=0
  rm -rf "$d"
  mkdir -p "$d/mnt/restored-x" "$d/run"
  echo live >"$d/mnt/c-storage.db"
  echo plain >"$d/mnt/restored-a.db"
  sed -n '/^box_stop_restored() {/,/^REMOTE$/p' "$1" | sed -e '1,2d;$d' -e "s#/run/#$d/run/#g" >"$d/stop.sh"
  sed -n '/^box_serve_restored() {/,/^REMOTE$/p' "$1" | sed -e '1,2d;$d' -e "s#/run/#$d/run/#g" -e "s#/etc/c-storage#$d/etc#g" >"$d/serve.sh"
  [ -s "$d/stop.sh" ] && [ -s "$d/serve.sh" ] || die "lib.sh has no stop or serve helper"
  bash "$d/stop.sh" "$d/mnt" "$d/mnt/restored-x/../c-storage.db"
  [ -e "$d/mnt/c-storage.db" ] || die "the stop removed the live file through a climbing name"
  bash "$d/stop.sh" "$d/mnt" "$d/mnt/restored-a.db"
  [ ! -e "$d/mnt/restored-a.db" ] || die "the stop no longer removes a restored file"
  out=$(bash "$d/serve.sh" "$d/mnt" "$d/mnt/restored-x/../c-storage.db" 1 1 2>&1) || rc=$?
  if [ "$rc" != 1 ] || ! grep -qF 'not a restored file' <<<"$out"; then die "the serve took a climbing name: $out"; fi
}
passes "a name that climbs out of the records folder is neither removed nor served (the review's finding 3)" climb_probe "$OPS_DIR/lib.sh"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
refuses "  the stop that lets a climbing name through is refused" "removed the live file" \
  climb_probe "$(mutated lib-climb-stop.sh 's#in \*/\*) ;; \*) rm -f#in NONE) ;; *) rm -f#' "$OPS_DIR/lib.sh")"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
refuses "  the serve that lets a climbing name through is refused" "took a climbing name" \
  climb_probe "$(mutated lib-climb-serve.sh '/^box_serve_restored/,/^REMOTE$/{/^case ${file#/d;}' "$OPS_DIR/lib.sh")"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
first_before "$OPS_DIR/company-restore.sh" '^RESTORED_FILE=\$RECORDS_MOUNT/restored-c\$stamp[.]db$' '^got=\$\(box_restore' "the restored file's name is not known before the restore writes it"

echo "== ops/seed.sh run whole (rows 7 and 23: nothing is written unless /health names its own commit and the box is above its floor; no client and no password is made; no key, address or password in the log)"
build "$WORK/server-newer" "$desc_newer"
# seed_copy: makes the first mapped copy as the operator's page would, through a c-storage on this
# state's database and the BFF's own service; prints the root's first password. The tunnel's server
# is a stand-in that stops with its run, so the copy is made apart from it.
seed_copy() {
  local port pid code
  port=$(free_port)
  mkdir -p "$S/db"
  env -i PATH="$PATH" PORT="$port" DB_PATH="$S/db/c-storage.db" INTERNAL_ACCESS_KEY="$FAKE_IKEY" X_SUPER_ADMIN_KEY="$FAKE_AKEY" \
    "$FAKE_CS" >>"$S/server.log" 2>&1 &
  pid=$!
  for _ in $(seq 1 50); do curl -fsS -m 1 "http://127.0.0.1:$port/health" >/dev/null 2>&1 && break; sleep 0.1; done
  code=$(cd "$REPO_DIR/scripts" && node --import tsx -e "import('./src/demo/mapping.ts').then((m) => console.log(m.allCopies()[0].code))")
  INTERNAL_ACCESS_KEY=$FAKE_IKEY SERVICE_CODE=bff SERVICE_ACCESS_KEY=$FAKE_SKEY C_STORAGE_URL=http://127.0.0.1:$port \
    ridge_cli tenant "$code" "A demo copy"
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}
seed_log() { cat "$OPS_LOG_DIR"/*.log; }
seed_lines() { grep -c -- "$1" "$OPS_LOG_DIR"/*.log || true; }
sport=$(free_port)
export SEED_LOCAL_PORT=$sport

e2e_fresh seed-other-env
OPS_LOG_DIR=$E2E/logs-seed-other-env e2e_run seed.sh other
check "seed.sh seeds ridge alone: another environment is refused before any aws call" "1 1 gone" \
  "$RC $(grep -c '^error: seed.sh seeds ridge alone' "$E2E/logs-seed-other-env"/*.log || true) $(file_state "$S/aws.calls")"

e2e_fresh seed-dirty
export OPS_LOG_DIR=$E2E/logs-seed-dirty
printf '# touched\n' >>"$E2E/repo/docs/note.md"
e2e_run seed.sh ridge
git -C "$E2E/repo" checkout -q -- docs/note.md
check "a tree that differs from its commit is refused before any aws call, naming why" "1 1 gone" \
  "$RC $(seed_lines '^error: this tree differs from') $(file_state "$S/aws.calls")"

e2e_fresh seed
export OPS_LOG_DIR=$E2E/logs-seed-app
GITHUB_ACTIONS='' e2e_run app.sh ridge
check "the BFF's service exists on the box, for the seed to write with it" 0 "$RC"
root_password=$(seed_copy)
check "the human's part is done by the operator's own create: the first mapped copy exists, with a root password" 16 "${#root_password}"

export OPS_LOG_DIR=$E2E/logs-seed-newer
FAKE_CS=$WORK/server-newer e2e_run seed.sh ridge
check "a ridge that runs another commit than the seed's stops the run, naming both" "1 1" \
  "$RC $(seed_lines "^error: /health names $desc_newer, not $e2e_sha")"
check "  before the seed ran" 0 "$(seed_lines '^seed: ')"
export OPS_LOG_DIR=$E2E/logs-seed-dev
FAKE_CS=$WORK/server-dev e2e_run seed.sh ridge
check "an unstamped ridge (dev) stops the run, naming why" "1 1 0" "$RC $(seed_lines '^error: /health names no commit') $(seed_lines '^seed: ')"
export OPS_LOG_DIR=$E2E/logs-seed-disk
FAKE_BOX='2048 2048 100' e2e_run seed.sh ridge
check "a box below the disk floor stops the run before /health is read" "1 1 0 0" \
  "$RC $(seed_lines "^error: disk: 100 MiB free, below the floor of $FLOOR_DISK_MB") $(seed_lines '^ok   /health names') $(seed_lines '^seed: ')"
export OPS_LOG_DIR=$E2E/logs-seed-memory
FAKE_BOX="$((FLOOR_MEM_MB - 1)) 2048 8192" e2e_run seed.sh ridge
check "  and one below the memory floor" "1 1" "$RC $(seed_lines "^error: memory: $((FLOOR_MEM_MB - 1)) MiB available, below the floor")"

export OPS_LOG_DIR=$E2E/logs-seed-first
e2e_launch seed.sh ridge
e2e_reap 120
check "ridge on the seed's own commit: the copy is filled and 2 of its 21 days applied, the 19 left said plainly, exit 0 (nothing before had written it)" "0 1 1 1" \
  "$RC $(seed_lines '^seed: 6 copies mapped, 0 up to date, 5 not on this service, 2 days applied$') $(seed_lines '^seed: STILL BEHIND, 1 copies have days left .* 19); ') $(seed_lines "^seeded $e2e_sha\$")"
check "  it made no client: the five copies nobody made are named, and left" 5 "$(seed_lines 'not on this service, left$')"
check "  the log holds no key, no address and not the copy's root password" "0 0 0" \
  "$(seed_log | grep -cE "$FAKE_IKEY|$FAKE_AKEY|$FAKE_SKEY" || true) $(seed_log | grep -cF 10.20.30.40 || true) $(cat "$S/out" "$OPS_LOG_DIR"/*.log | grep -cF -e "$root_password" || true)"
check "  and the log's search for the keys ran" 1 "$(seed_lines '^ok   no key in this log')"
export OPS_LOG_DIR=$E2E/logs-seed-second
e2e_run seed.sh ridge
check "a second run goes on from the ledger, 2 more days" "0 1" "$RC $(seed_lines '^seed: 6 copies mapped, 0 up to date, 5 not on this service, 2 days applied$')"

# A push touching none of ci.yml's paths deploys nothing: ridge stays on the commit before it, and the next run somebody asks for goes on.
export OPS_LOG_DIR=$E2E/logs-seed-docs-ahead
printf 'a note\n' >"$E2E/repo/NOTES.md"
git -C "$E2E/repo" add NOTES.md
git -C "$E2E/repo" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit -q -m 'docs: a note'
git -C "$E2E/repo" push -q origin HEAD:refs/heads/main
docs_sha=$(git -C "$E2E/repo" rev-parse HEAD)
e2e_run seed.sh ridge
check "a main one commit past ridge's that changes no path ci.yml deploys on still seeds, saying so" "0 0 1 1" \
  "$RC $(seed_lines '^error: /health names') $(seed_lines "^ridge runs $e2e_sha, an earlier commit of main") $(seed_lines "^seeded $docs_sha\$")"
# ...but one that changes a path of ci.yml's deploys, and ridge has not yet got it: refused, nothing written.
export OPS_LOG_DIR=$E2E/logs-seed-code-ahead
mkdir -p "$E2E/repo/ui"
printf 'a note\n' >"$E2E/repo/ui/NOTES.md"
git -C "$E2E/repo" add ui/NOTES.md
git -C "$E2E/repo" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit -q -m 'feat: a change to the UI'
git -C "$E2E/repo" push -q origin HEAD:refs/heads/main
e2e_run seed.sh ridge
check "a main one commit past ridge's that changes a path ci.yml deploys on is refused before the seed" "1 1 0" \
  "$RC $(seed_lines "^error: /health names $e2e_sha, not") $(seed_lines '^seed: ')"
git -C "$E2E/repo" reset -q --hard "$e2e_sha"
git -C "$E2E/repo" push -qf origin HEAD:refs/heads/main
# ...and a ci.yml whose push list this script cannot read stops the run before the comparison, nothing written.
export OPS_LOG_DIR=$E2E/logs-seed-ci-unread
sed -i.bak 's/^      - "ui\/\*\*"$/      - ui\/**/' "$E2E/repo/.github/workflows/ci.yml"
rm -f "$E2E/repo/.github/workflows/ci.yml.bak"
git -C "$E2E/repo" add .github/workflows/ci.yml
git -C "$E2E/repo" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit -q -m 'ci: an entry unquoted'
git -C "$E2E/repo" push -q origin HEAD:refs/heads/main
e2e_run seed.sh ridge
check "a ci.yml whose push list holds an unreadable line stops the seed, naming it, before any comparison or write" "1 1 0 0 0" \
  "$RC $(seed_lines '^error: ci.yml.s push trigger holds a line this script cannot read.*      - ui/\*\*') $(seed_lines '^error: /health names') $(seed_lines '^seed: ') $(seed_lines '^seeded')"
git -C "$E2E/repo" reset -q --hard "$e2e_sha"
git -C "$E2E/repo" push -qf origin HEAD:refs/heads/main
# c-storage is on this commit, the BFF's function a deploy behind (a half-failed deploy): nothing is written.
export OPS_LOG_DIR=$E2E/logs-seed-bff-behind
cp "$S/description" "$S/description.kept"
printf '%s\n' 1111111111111111111111111111111111111111 >"$S/description"
e2e_run seed.sh ridge
check "a BFF function a deploy behind /health stops the seed before it writes, naming both" "1 1 0 0" \
  "$RC $(seed_lines "^error: the BFF's function names 1111111111111111111111111111111111111111, /health $e2e_sha") $(seed_lines '^seed: ') $(seed_lines '^seeded')"
mv "$S/description.kept" "$S/description"
# A seed that stops is not a seed done: its last line is never "seeded", and its exit is red.
export OPS_LOG_DIR=$E2E/logs-seed-stops
FAKE_SKEY=00000000000000000000000000000000 e2e_run seed.sh ridge
check "a seed that stops (the BFF's key refused) ends red, naming that it stopped, and never says seeded" "1 1 0" \
  "$RC $(seed_lines '^error: the seed stopped') $(seed_lines '^seeded')"
unset SEED_LOCAL_PORT

echo "== ops/demo-remake.sh run whole (rows 12 to 14: ridge's demo copies alone, a terminal, never a job; nothing deleted without the typed words; the wait named and kept alive; a dropped round finished by --go-on)"
# The node half is a stand-in under RIDGE_SCRIPTS_DIR: it answers the three commands with a line, counts the
# rounds in the state folder, holds a round FAKE_ROUND_MS and, in round FAKE_DROP_ROUND, ends the tunnel's master
# and hangs (FAKE_OPEN_FAILS_AFTER: the aws stand-in refuses the next key; FAKE_MISSING: the last summary counts a missing copy). The real mapping and the real tsx are used, so no 21-day fill runs here (the node half's own tests hold it).
HALF=$WORK/half
mkdir -p "$HALF/src/demo"
cp "$REPO_DIR/scripts/src/demo/mapping.ts" "$HALF/src/demo/mapping.ts"
ln -s "$REPO_DIR/scripts/node_modules" "$HALF/node_modules"
cat >"$HALF/src/ridge-main.ts" <<'HALFTS'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const state = process.env.FAKE_STATE!;
const [command, ...rest] = process.argv.slice(2);
appendFileSync(`${state}/half.calls`, `${command} ${rest.join(' ')}\n`);
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
async function main() {
  if (command === 'remake') {
    readFileSync(0, 'utf8');
    console.log(rest[0] === '--check' ? 'checked: stand-in' : 'remake: stand-in');
  } else if (command === 'seed') {
    const file = `${state}/rounds`;
    const n = (existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0) + 1;
    writeFileSync(file, String(n));
    console.log(`stand-in: round ${n} begins`);
    await sleep(Number(process.env.FAKE_ROUND_MS ?? 0));
    if (process.env.FAKE_OPEN_FAILS_AFTER === String(n)) writeFileSync(`${state}/send-fails`, '');
    if (process.env.FAKE_DROP_ROUND === String(n)) {
      process.kill(Number(readFileSync(`${state}/master.pid`, 'utf8')));
      await sleep(30000);
    }
    console.log(
      n < Number(process.env.FAKE_ROUNDS ?? 3)
        ? 'seed: STILL BEHIND, 1 copies have days left (x 5); stand-in'
        : process.env.FAKE_MISSING
          ? 'seed: 6 copies mapped, 5 up to date, 1 not on this service, 5 days applied'
          : 'seed: 6 copies mapped, 6 up to date, 0 not on this service, 5 days applied',
    );
  } else {
    console.error(`stand-in half: unknown ${command}`);
    process.exit(1);
  }
}
void main();
HALFTS
drport=$(free_port)
DRPW1='Invented-One1!'
DRPW2='Invented-Two2@'
DRPW3='Invented-Three3#'
DRTYPED="$DRPW1"$'\n'"$DRPW1"$'\n'"$DRPW2"$'\n'"$DRPW2"$'\n'"$DRPW3"$'\n'"$DRPW3"
dr_run() { # <typed text> <args…>: demo-remake.sh whole in the clone, typed to over a pipe (DR_TTY=0: no test switch); log folder DR_LOGS
  export OPS_LOG_DIR=$E2E/logs-dr-${DR_LOGS:?}
  printf '%s\n' "$1" >"$S/typed"
  (cd "$E2E/repo" && exec env PATH="${DR_PATH:-$PATH}" RIDGE_SCRIPTS_DIR="$HALF" OPS_TEST_NO_TTY="${DR_TTY:-1}" DEMO_REMAKE_TICK="${DR_TICK:-1}" DEMO_REMAKE_LOCAL_PORT="$drport" \
    bash ops/demo-remake.sh "${@:2}") >"$S/out" 2>&1 <"$S/typed" &
  LPID=$!
  e2e_reap 120
}
dr_lines() { grep -c -- "$1" "$OPS_LOG_DIR"/*.log || true; }
dr_seen() { cat "$OPS_LOG_DIR"/*.log "$S/out" "$S/aws.calls" "$S/ssh.calls" "$S/half.calls" 2>/dev/null | grep -cF -e "$1" || true; }
dr_deletes() { if [ -f "$S/half.calls" ]; then grep -c '^remake $' "$S/half.calls" || true; else echo 0; fi; }
dr_refused() { # <name> <text the refusal names>: RC 2, the line, no aws or ssh call, no delete
  check "$1" "2 1 gone gone 0" \
    "$RC $(dr_lines "^== refused: .*$2") $(file_state "$S/aws.calls") $(file_state "$S/ssh.calls") $(dr_deletes)"
}
e2e_fresh dr-refuse
DR_LOGS=other dr_run "$DRTYPED" other
dr_refused "12: another environment than ridge is refused before any aws call, naming why" "demo-remake.sh holds ridge's demo copies alone"
DR_LOGS=job GITHUB_ACTIONS=true dr_run "$DRTYPED" ridge
dr_refused "  in GitHub's job it refuses before anything is asked" "never in a job"
DR_LOGS=pipe DR_TTY=0 dr_run "$DRTYPED" ridge
dr_refused "  without a terminal it refuses before anything is asked" "needs a terminal to type the passwords on"
rc=0
out=$(bash "$E2E/repo/ops/demo-remake.sh" ridge --nonsense 2>&1) || rc=$?
check "  an unknown argument prints the usage and exits 2" "2 usage: ops/demo-remake.sh ridge [--go-on]" "$rc $out"
DR_LOGS=differ dr_run "$DRPW1"$'\n'"$DRPW2" ridge
dr_refused "  two typings that differ are refused before any call" "the two typings of p1 differ"
check "  the log holds neither typing" "0 0" "$(dr_seen "$DRPW1") $(dr_seen "$DRPW2")"
DR_LOGS=reply dr_run "$DRTYPED"$'\n'"yes please" ridge
dr_refused "13: a reply other than \"remake ridge\" refuses before any call, nothing deleted" 'the reply was not "remake ridge"'
check "  and the six copies were listed before it was asked" 6 "$(dr_lines '^   p[0-9] ')"
check "  the passwords reached node on a pipe only, none in the log or a call" "0 0 0" "$(dr_seen "$DRPW1") $(dr_seen "$DRPW2") $(dr_seen "$DRPW3")"

e2e_fresh dr-whole
GITHUB_ACTIONS='' e2e_run app.sh ridge
check "the BFF's service exists on the box, for the demo copies' run" 0 "$RC"
sends_before=$(grep -c 'send-ssh-public-key' "$S/aws.calls" || true)
exits_before=$(grep -c -e '-O exit' "$S/ssh.calls" || true)
DR_LOGS=run1 FAKE_ROUNDS=3 FAKE_ROUND_MS=3000 dr_run "$DRTYPED"$'\n'"remake ridge" ridge
check "14: the run ends 0 and its log ends on its exit" "0 == exit 0" "$RC $(tail -n 1 "$OPS_LOG_DIR"/*.log)"
check "  the notice names the minutes and a clock time, before the first round" "1 yes" \
  "$(dr_lines '^the fill may wait about [0-9][0-9]* minutes, until about [0-9][0-9]:[0-9][0-9], and the AWS session must hold until then; a line every [0-9][0-9]* seconds shows it is alive$') $(awk '/^the fill may wait/ {n = NR} /^round 1$/ {r = NR} END {print (n && r && n < r) ? "yes" : "no"}' "$OPS_LOG_DIR"/*.log)"
check "  the remake ran once, after its check, and three rounds followed it" "1 1 3" \
  "$(grep -c '^remake $' "$S/half.calls") $(grep -c '^remake --check$' "$S/half.calls") $(grep -c '^seed --round$' "$S/half.calls")"
check "  a line while each round runs (rounds of 3 s, a line a second)" "yes" "$([ "$(dr_lines '^   the round runs, [0-9]*s, the tunnel is up')" -ge 3 ] && echo yes || echo no)"
check "  each round on a new tunnel: four opens, four closes" "4 4" \
  "$(($(grep -c 'send-ssh-public-key' "$S/aws.calls") - sends_before)) $(($(grep -c -e '-O exit' "$S/ssh.calls") - exits_before))"
check "  the six copies and the 21 days said at the end" "1" "$(dr_lines '^the 6 demo copies on ridge are remade, each with its partner.s password, 21 days filled up to yesterday$')"
check "  no password in the log, the terminal, a call of aws, ssh or the node half" "0 0 0" "$(dr_seen "$DRPW1") $(dr_seen "$DRPW2") $(dr_seen "$DRPW3")"
# shellcheck disable=SC2016 # the script's source text is searched, not expanded
check "  the default between lines is 30 seconds" 1 "$(grep -c '^TICK=\${DEMO_REMAKE_TICK:-30}$' "$OPS_DIR/demo-remake.sh" || true)"

e2e_fresh dr-drop
GITHUB_ACTIONS='' e2e_run app.sh ridge
DR_LOGS=run2 FAKE_ROUNDS=3 FAKE_ROUND_MS=1000 FAKE_DROP_ROUND=2 dr_run "$DRTYPED"$'\n'"remake ridge" ridge
if [ "$RC" != 1 ]; then echo "  (the run's last lines:)"; tail -n 8 "$S/out"; fi
check "  a tunnel that drops in round 2 ends the run red, naming --go-on, with the exit 1" "1 1 1" \
  "$RC $(dr_lines '^error: the tunnel dropped') $(dr_lines 'ops/demo-remake.sh ridge --go-on')"
check "  the dropped round's own lines reach the log, so it says where the round stood" 1 "$(dr_lines '^stand-in: round 2 begins$')"
DR_LOGS=run3 FAKE_ROUNDS=3 dr_run '' ridge --go-on
check "  --go-on finishes the fill: exit 0, a third round, no new remake, no new question" "0 3 1 1 yes" \
  "$RC $(grep -c '^seed --round$' "$S/half.calls") $(grep -c '^remake $' "$S/half.calls") $(grep -c '^remake --check$' "$S/half.calls") $(grep -q 'Password for' "$S/out" && echo no || echo yes)"
check "  and --go-on needs no terminal and no typing" "yes" "$(grep -q 'refused' "$S/out" && echo no || echo yes)"

# A stop while a round opens its tunnel, once the copies are made (an AWS session that ended): it names --go-on.
e2e_fresh dr-open
GITHUB_ACTIONS='' e2e_run app.sh ridge
DR_LOGS=run4 FAKE_ROUNDS=3 FAKE_OPEN_FAILS_AFTER=1 dr_run "$DRTYPED"$'\n'"remake ridge" ridge
check "  a tunnel that cannot open for round 2 ends red (exit 1) and names --go-on, the copies being made" "1 1 1" \
  "$RC $(dr_lines '^error: the box does not answer') $(dr_lines '^the copies are made: fix that, then run ops/demo-remake.sh ridge --go-on$')"
check "  and no line says the run goes on after it has ended" 0 "$(grep -c 'the run goes on' "$OPS_DIR/demo-remake.sh" || true)"
# A last summary that counts a copy missing: no closing line, and the run ends red.
e2e_fresh dr-missing
GITHUB_ACTIONS='' e2e_run app.sh ridge
DR_LOGS=run5 FAKE_ROUNDS=1 FAKE_MISSING=1 dr_run "$DRTYPED"$'\n'"remake ridge" ridge
check "  a last round that counts a copy not on the service ends red, with no closing line" "1 1 0" \
  "$RC $(dr_lines '^error: the last round did not find every copy on the service') $(dr_lines '^the 6 demo copies on ridge are remade')"
# A password in a variable the caller exported under the name the script's locals use: bash 3.2 keeps the export flag
# of a local, so a child started while the script holds the password would receive it. The grep stand-in records
# the environment it is started with.
e2e_fresh dr-env
mkdir -p "$E2E/grepbin"
REALGREP=$(PATH=$BASE_PATH command -v grep)
# shellcheck disable=SC2016 # the stand-in's source text is written, not expanded
printf '#!/bin/bash\necho "$*" >>"${FAKE_STATE:?}/grep.calls"\n/usr/bin/env | %s -e "^pw=" -e "^again=" >>"${FAKE_STATE:?}/grep.env" || true\nexec %s "$@"\n' "$REALGREP" "$REALGREP" >"$E2E/grepbin/grep"
chmod +x "$E2E/grepbin/grep"
export pw=exported-by-the-caller again=exported-by-the-caller
DR_PATH="$E2E/grepbin:$PATH" DR_LOGS=env dr_run "$DRTYPED"$'\n'"yes please" ridge
unset pw again
check "  no password is in the environment of a process the script starts, the caller exporting pw and again (one search a password)" "0 3" \
  "$(cat "$S/grep.env" 2>/dev/null | grep -vc '=exported-by-the-caller$' || true) $(grep -c -e '-f /dev/stdin' "$S/grep.calls" || true)"

echo "== ops/stack.sh env, run whole on stand-ins for aws, gh and ssh (no value of an output in the log; --plan on an unchanged stack changes nothing)"
# A clone whose origin is named as GitHub's are, so the script reads the repository from it; the stack
# is described with the box's address and the deploy role's ARN, and its change set holds no change.
mkdir -p "$E2E/github.com/test-owner" "$E2E/stackbin"
git clone -q --bare "$E2E/origin.git" "$E2E/github.com/test-owner/test-repo.git"
git clone -q -b main "$E2E/github.com/test-owner/test-repo.git" "$E2E/stackrepo"
cat >"$E2E/stackbin/aws" <<'STANDIN'
#!/bin/bash
echo "aws $*" >>"${FAKE_STATE:?}/aws.calls"
case "$*" in
  *get-region-opt-status*) echo ENABLED ;;
  *"describe-stacks --stack-name credo-network"*) echo '{"Stacks":[{"StackName":"credo-network","StackStatus":"UPDATE_COMPLETE","Outputs":[{"OutputKey":"VpcId","OutputValue":"vpc-test"}]}]}' ;;
  *"describe-stacks"*)
    echo '{"Stacks":[{"StackName":"ridge","StackStatus":"UPDATE_COMPLETE","Parameters":[{"ParameterKey":"Repository","ParameterValue":"test-owner/test-repo"},{"ParameterKey":"SubjectPrefix","ParameterValue":"repo:test-owner/test-repo"}],"Outputs":[{"OutputKey":"BoxId","OutputValue":"i-test"},{"OutputKey":"BoxAddress","OutputValue":"10.9.8.7"},{"OutputKey":"Zone","OutputValue":"z"},{"OutputKey":"DeployRoleArn","OutputValue":"arn:aws:iam::000000000000:role/fake-deploy"},{"OutputKey":"AppAddress","OutputValue":"https://app.example.test"}]}]}' ;;
  *"wait change-set-create-complete"*) [ -z "${FAKE_CHANGESET:-}" ] || exit 0; exit 255 ;;
  *describe-change-set*) if [ -n "${FAKE_CHANGESET:-}" ]; then cat "$FAKE_CHANGESET"; else echo "The submitted information didn't contain changes. Submit different information to create a change set."; fi ;;
  *create-change-set* | *delete-change-set*) : ;;
  *send-ssh-public-key*) echo True ;;
  *) echo "stand-in aws: unknown: $*" >&2; exit 1 ;;
esac
STANDIN
cat >"$E2E/stackbin/gh" <<'STANDIN'
#!/bin/bash
echo "gh $*" >>"${FAKE_STATE:?}/gh.calls"
cat >/dev/null
case "$*" in
  *oidc/customization/sub*) echo '{"use_default":true}' ;;
  *"secret list"*) echo AWS_ROLE_ARN ;;
  *deployment-branch-policies*--jq*) echo main ;;
  *) : ;;
esac
STANDIN
printf '#!/bin/sh\ncat >/dev/null\nexit 0\n' >"$E2E/stackbin/ssh"
chmod +x "$E2E/stackbin/aws" "$E2E/stackbin/gh" "$E2E/stackbin/ssh"
stack_run() { # <state name> <args...>: stack.sh env ridge in the clone, its terminal output in the state's out file
  e2e_fresh "$1"
  shift
  RC=0
  (cd "$E2E/stackrepo" && PATH="$E2E/stackbin:$PATH" bash ops/stack.sh env ridge "$@") >"$S/out" 2>&1 </dev/null || RC=$?
}
stack_run stack-plan --plan
check "--plan on an unchanged stack ends there: exit 0 and 'nothing changed'" "0 1" "$RC $(grep -c '^--plan: nothing changed' "$S/out" || true)"
check "  and writes nothing to GitHub (its one gh call reads the OIDC subject), opens no box, prints no outputs" "0 0 0" \
  "$(grep -vc 'oidc/customization/sub' "$S/gh.calls" || true) $(grep -c 'send-ssh-public-key' "$S/aws.calls" || true) $(grep -c '^\[.*the outputs' "$S/out" || true)"
stack_run stack-whole
check "the whole run on an unchanged stack: exit 0, green" "0 1" "$RC $(grep -c '^== green' "$S/out" || true)"
check "  the box's private address and the role's ARN are in neither the log nor the terminal" 0 \
  "$(cat "$OPS_LOG_DIR"/*.log "$S/out" | grep -cF -e 10.9.8.7 -e 000000000000 || true)"
check "  the app's address is printed, and the log ends on no key" "1 1" \
  "$(grep -c '^  AppAddress = https://app.example.test' "$OPS_LOG_DIR"/*.log || true) $(grep -c '^ok   no key in this log' "$OPS_LOG_DIR"/*.log || true)"
check "  GitHub's environment was written (the run went past the outputs)" 1 "$(grep -c '^gh secret set AWS_ROLE_ARN' "$S/gh.calls" || true)"

# A change set with changes: the stand-in hands back a hand-written body (FAKE_CHANGESET), so the lines the
# operator reads before the irreversible act are the script's own.
FAKE_CHANGESET=$OPS_DIR/testdata/changeset-conditional.json stack_run stack-conditional --plan
check "a Conditional change refused: exit 1, REFUSED, and no change applied" "1 1 0" \
  "$RC $(grep -c '^REFUSED: this change set removes or replaces' "$S/out" || true) $(grep -c 'execute-change-set' "$S/aws.calls" || true)"
check "  and its refusal line names the property that carried it" 1 \
  "$(grep -c '^      Properties InstanceType requires-recreation=Conditionally evaluation=Dynamic$' "$S/out" || true)"
FAKE_CHANGESET=$OPS_DIR/testdata/changeset-conditional.json stack_run stack-conditional-taken --plan --take Box
check "  with Box taken the plan passes, exit 0, and the verdict names what was let through" "0 1 0" \
  "$RC $(grep -c 'nothing unsafe except what was taken: Box$' "$S/out" || true) $(grep -c 'no removal and no replacement' "$S/out" || true)"
FAKE_CHANGESET=$OPS_DIR/testdata/changeset-replaces.json stack_run stack-replaces-taken --plan --take Box
check "  with Box taken the removal of OldGroup, not taken, is still refused, naming only it" "1 1 0" \
  "$RC $(grep -c '^  OldGroup (AWS::EC2::SecurityGroup): Remove, replacement none$' "$S/out" || true) $(grep -c '^  Box (AWS::EC2::Instance): Modify, replacement' "$S/out" || true)"
FAKE_CHANGESET=$OPS_DIR/testdata/changeset-adds.json stack_run stack-adds --plan
check "  a change set that only adds and modifies keeps its old verdict" "0 1 0" \
  "$RC $(grep -c 'ok   no removal and no replacement' "$S/out" || true) $(grep -c 'except what was taken' "$S/out" || true)"

# A change carrying no Details key at all: the `?` on .Details[] in stack.sh keeps it from dying before the guard.
FAKE_CHANGESET=$OPS_DIR/testdata/changeset-nodetails.json stack_run stack-nodetails --plan
check "a change with no Details key still prints its change line and reaches a verdict" "0 1 1" \
  "$RC $(grep -c '^  Add Box (AWS::EC2::Instance) replacement=none$' "$S/out" || true) $(grep -c 'ok   no removal and no replacement' "$S/out" || true)"
# A blank --take names nothing yet would print as an authorisation: it is a usage error, first or after a good one.
stack_run stack-take-blank --plan --take ''
check "--take '' is refused as usage (exit 2) and reaches no verdict line" "2 0" \
  "$RC $(grep -cE '^(ok  |REFUSED|no changes)' "$S/out" || true)"
FAKE_CHANGESET=$OPS_DIR/testdata/changeset-conditional.json stack_run stack-take-blank-later --plan --take Box --take ''
check "  and so is a blank one after a good one" "2 0" \
  "$RC $(grep -cE '^(ok  |REFUSED|no changes)' "$S/out" || true)"

unset FAKE_LAYER4 APP_LOCAL_PORT APP_BUNDLE APP_UI_DIR

echo "== the walks page's deploy: Access's refusal, the folder's digest, the newest deploy (walks.yml reads them)"
# refuses_quiet <name> <text the refusal names> <command...>: refuses, and what the command says
# (standard output and error) names no address, no sign-in host and no dashboard link
refuses_quiet() {
  local name=$1 text=$2 out rc=0
  shift 2
  out=$( ("$@") 2>&1 ) || rc=$?
  if [ "$rc" = 1 ] && grep -qF -- "$text" <<<"$out" && ! grep -qE -- 'cloudflareaccess\.com|dash\.cloudflare\.com|://|pages\.dev|127\.0\.0\.1' <<<"$out"; then
    echo "  ok   $name"
  else
    echo "  FAIL $name: wanted a refusal naming '$text' and no address, got exit $rc: $out"
    fail=1
  fi
}
# answer <status> [location]: a server on a free loopback port that answers every fetch so; its
# address is left in ANSWER_URL
answer() {
  python3 -I -c '
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

status, location = int(sys.argv[1]), sys.argv[2]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(status)
        if location:
            self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, *args):
        pass

server = HTTPServer(("127.0.0.1", 0), Handler)
print(server.server_port, flush=True)
server.serve_forever()
' "$1" "${2:-}" >"$WORK/answer.port" &
  PID=$!
  for _ in $(seq 1 50); do
    [ -s "$WORK/answer.port" ] && break
    sleep 0.1
  done
  ANSWER_URL="http://127.0.0.1:$(cat "$WORK/answer.port")/"
}
stop_answer() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  PID=''
  rm -f "$WORK/answer.port"
}
REFUSED=$OPS_DIR/walks-refused.sh
answer 200
refuses_quiet "an address that answers an anonymous fetch with a page is not refused" "answered 200" bash "$REFUSED" "$ANSWER_URL"
stop_answer
answer 302 https://team.cloudflareaccess.com/cdn-cgi/access/login/x
passes "a redirect to a sign-in on cloudflareaccess.com is Access's refusal" bash "$REFUSED" "$ANSWER_URL"
check "  and it names neither the address nor the team" "refused: a redirect to Access's sign-in" "$(bash "$REFUSED" "$ANSWER_URL" 2>&1)"
stop_answer
answer 302 https://evilcloudflareaccess.com/login
refuses_quiet "a redirect to a look-alike host is not Access's refusal" "not to Access's sign-in" bash "$REFUSED" "$ANSWER_URL"
stop_answer
answer 302 https://example.com/login
refuses_quiet "a redirect elsewhere is not Access's refusal" "not to Access's sign-in" bash "$REFUSED" "$ANSWER_URL"
stop_answer
answer 403
refuses_quiet "a 403 is not Access's refusal" "answered 403" bash "$REFUSED" "$ANSWER_URL"
stop_answer
refuses_quiet "an address that gives no answer is not a refusal" "gave no answer" bash "$REFUSED" "http://127.0.0.1:9/"

DIGEST=$OPS_DIR/walks-digest.sh
mkdir "$WORK/page"
printf 'one' >"$WORK/page/index.html"
printf 'two!' >"$WORK/page/walks.json"
check "a folder's files are listed by name, each with its SHA-256 and bytes" \
  "7692c3ad3540bb803c020b3aee66cd8887123234ea0c6e7143c0add73ff431ed  3  index.html
a97b629a5b1da759586c3353a9bc284bf673970d8eca56e11e556b715c329614  4  walks.json" \
  "$(bash "$DIGEST" "$WORK/page")"
sum=$(bash "$DIGEST" --sum "$WORK/page")
check "the same files give the same sum" "$sum" "$(bash "$DIGEST" --sum "$WORK/page")"
printf 'twO!' >"$WORK/page/walks.json"
check "a file changed by one byte gives another sum" 1 "$([ "$sum" != "$(bash "$DIGEST" --sum "$WORK/page")" ] && echo 1 || echo 0)"
printf 'two!' >"$WORK/page/walks.json"
printf 'x' >"$WORK/page/extra.txt"
check "a file added gives another sum" 1 "$([ "$sum" != "$(bash "$DIGEST" --sum "$WORK/page")" ] && echo 1 || echo 0)"

SERVED=$OPS_DIR/walks-served.sh
commit=0123456789abcdef0123456789abcdef01234567
deploy() { # <environment> <commit's first seven> <address>
  jq -nc --arg e "$1" --arg s "$2" --arg d "$3" \
    '{Id: "id", Environment: $e, Branch: "main", Source: $s, Deployment: $d, Status: "ok", Build: "https://dash.cloudflare.com/ACCOUNT/pages/view/p/id"}'
}
served() { jq -s . | bash "$SERVED" "$commit" 2>&1; }
check "the newest production deploy that carries the commit gives its address, and nothing else" \
  "https://abc.p.pages.dev" "$({ deploy Production 0123456 https://abc.p.pages.dev; deploy Production 7654321 https://old.p.pages.dev; } | served)"
check "  a newer preview of another commit is passed over" \
  "https://abc.p.pages.dev" "$({ deploy Preview 7654321 https://pre.p.pages.dev; deploy Production 0123456 https://abc.p.pages.dev; } | served)"
refuses_quiet "a newest production deploy of another commit is refused, naming both" "carries commit 7654321, not 0123456" \
  bash -c "{ $(declare -f deploy); deploy Production 7654321 https://x.p.pages.dev; deploy Production 0123456 https://old.p.pages.dev; } | jq -s . | bash '$SERVED' '$commit'"
refuses_quiet "a project with no production deploy is refused" "no production deploy" \
  bash -c "{ $(declare -f deploy); deploy Preview 0123456 https://x.p.pages.dev; } | jq -s . | bash '$SERVED' '$commit'"
refuses_quiet "a deploy's commit too short to match is refused" "too short" \
  bash -c "{ $(declare -f deploy); deploy Production 0123 https://x.p.pages.dev; } | jq -s . | bash '$SERVED' '$commit'"

echo "== ops/full-run.sh's run lock, on a stand-in worktree and a stand-in walk/run.sh (nothing real is run)"
FR=$OPS_DIR/full-run.sh
FRW=$WORK/fr
mkdir -p "$FRW/nvm/versions/node/v0.0.1/bin" "$FRW/tree/walk/specs/x-snapshots" "$FRW/logs" "$FRW/pics"
printf '#!/bin/sh\necho v0.0.1\n' >"$FRW/nvm/versions/node/v0.0.1/bin/node"
chmod +x "$FRW/nvm/versions/node/v0.0.1/bin/node"
: >"$FRW/tree/walk/specs/x-snapshots/.keep"
cat >"$FRW/tree/walk/run.sh" <<'STUB'
#!/bin/bash
# the stand-in: records that it ran; STUB_SLEEP holds it; STUB_RED ends run 1 red
echo "ran $*" >>"$STUB_RAN"
[ -z "${STUB_SLEEP:-}" ] || { echo $$ >"$STUB_PID"; exec sleep 30; }
case " $* " in
  *" --bytes "*)
    echo "compare x: 0 raw, 0 byte, 0 moved, 0 new, 0 without a counterpart, 0 unreadable"
    ;;
  *)
    [ -z "${STUB_RED:-}" ] || { echo "== verdict: red: stand-in"; exit 1; }
    echo "  pictures and results in $STUB_PICS"
    [ -z "${STUB_EXTRA:-}" ] || printf '%s\n' "$STUB_EXTRA"
    ;;
esac
echo "== verdict: green"
echo "== done"
STUB
git -C "$FRW/tree" init -q -b piece
git -C "$FRW/tree" add -A
git -C "$FRW/tree" -c user.name=t -c user.email=t@t -c commit.gpgsign=false commit -q -m stand-in
FRLOCK=$FRW/.full-run-lock
fr() { # <args…>: the full run on the stand-ins, its text in $FRW/out, its exit in $FR_RC
  FR_RC=0
  NVM_DIR=$FRW/nvm OPS_LOG_DIR=$FRW/logs STUB_RAN=$FRW/ran STUB_PICS=$FRW/pics STUB_PID=$FRW/stubpid \
    bash "$FR" --worktree "$FRW/tree" --branch piece --walks a,b --node v0.0.1 --lock "$FRW/gate-lock" \
    --run-lock "$FRLOCK" --stem frtest "$@" >"$FRW/out" 2>&1 || FR_RC=$?
}
mkdir "$FRLOCK"
printf 'pid 4242 started 2026-01-02 03:04:05 +0000 for a,b\n' >"$FRLOCK/owner"
rm -f "$FRW/ran"
fr
check "a full run started while another holds the run lock is refused, exit 2" 2 "$FR_RC"
check "  the refusal names the owner" 1 "$(grep -c 'pid 4242 started 2026-01-02 03:04:05' "$FRW/out" || true)"
check "  and the command that clears it, which it never runs itself" 1 "$(grep -c "rm -rf '$FRLOCK'" "$FRW/out" || true)"
check "  nothing was run" none "$([ -e "$FRW/ran" ] && echo ran || echo none)"
check "  and the other's lock is as it was" "pid 4242 started 2026-01-02 03:04:05 +0000 for a,b" "$(cat "$FRLOCK/owner")"
rm -rf "$FRLOCK"
fr
check "a full run with no lock goes green, exit 0" 0 "$FR_RC"
check "  and the run lock is gone after it" gone "$([ -e "$FRLOCK" ] && echo there || echo gone)"
check "  both runs ran" 2 "$(cat "$FRW/ran" 2>/dev/null | wc -l | tr -d ' ')"
rm -f "$FRW/ran"
STUB_RED=1 fr
check "a red run 1 ends red, exit 1" 1 "$FR_RC"
check "  and the run lock is gone after it" gone "$([ -e "$FRLOCK" ] && echo there || echo gone)"
rm -f "$FRW/ran" "$FRW/stubpid"
fr_bg() {
  NVM_DIR=$FRW/nvm OPS_LOG_DIR=$FRW/logs STUB_RAN=$FRW/ran STUB_PICS=$FRW/pics STUB_PID=$FRW/stubpid STUB_SLEEP=1 \
    bash "$FR" --worktree "$FRW/tree" --branch piece --walks a,b --node v0.0.1 --lock "$FRW/gate-lock" \
    --run-lock "$FRLOCK" --stem frtest >"$FRW/out" 2>&1 &
  FRPID=$!
}
fr_bg
for _ in $(seq 1 100); do
  [ -s "$FRW/stubpid" ] && [ -s "$FRLOCK/owner" ] && break
  sleep 0.1
done
check "while it runs, the run lock names its owner's pid" 1 "$(grep -c '^pid [0-9][0-9]* started ' "$FRLOCK/owner" || true)"
holder=$(sed -n 's/^pid \([0-9]*\) .*/\1/p' "$FRLOCK/owner")
kill -TERM "$holder" "$(cat "$FRW/stubpid")" 2>/dev/null || true
FR_RC=0
wait "$FRPID" || FR_RC=$?
check "an interrupted run ends 130" 130 "$FR_RC"
check "  and the run lock is gone after it" gone "$([ -e "$FRLOCK" ] && echo there || echo gone)"
rm -f "$FRW/ran"
fr --check
check "--check passes, exit 0" 0 "$FR_RC"
check "  takes no run lock" gone "$([ -e "$FRLOCK" ] && echo there || echo gone)"
check "  and runs nothing" none "$([ -e "$FRW/ran" ] && echo ran || echo none)"
mkdir "$FRW/gate-lock"
fr
check "a held gate lock refuses a run, exit 2" 2 "$FR_RC"
check "  naming the gate lock" 1 "$(grep -c 'the gate lock .* is held' "$FRW/out" || true)"
check "  and the run lock was never taken" gone "$([ -e "$FRLOCK" ] && echo there || echo gone)"
mkdir "$FRLOCK"
printf 'pid 4242 started x for a,b\n' >"$FRLOCK/owner"
fr
check "with both held, the gate lock refuses first" 1 "$(grep -c 'the gate lock .* is held' "$FRW/out" || true)"
check "  and the other's run lock is left as it was" 1 "$(grep -c '^pid 4242' "$FRLOCK/owner" || true)"
rmdir "$FRW/gate-lock"
rm -rf "$FRLOCK"

# row 4: the verdict names what moved, what is new, and each named screen that moved nothing, read from the
# compare lines; --moved only asked (s1,s2,s3,s4,s5), and the counts still decide the exit
EXTRA='compare full-1 to the bases: a: 4 pictures, 2 moved, 1 new, 0 without a counterpart, 0 unreadable
  moved s1-en-1280.png: 5 px, shade 255, box 1,1 to 2,2 (named)
  moved s1-vi-390.png: 5 px, shade 255, box 1,1 to 2,2 (named)
  new s2-en-390.png
  named, not moved: s3
  named, no such screen: s4
result: green
compare full-1 to the bases: b: 2 pictures, 0 moved, 0 new, 0 without a counterpart, 0 unreadable
  named, not moved: s5
  named, no such screen: s4
result: green'
STUB_EXTRA=$EXTRA fr --moved s1,s2,s3,s4,s5
check "the verdict names the screen that moved" 1 "$(grep -c '^== verdict: green: .*moved 1 screen (s1)' "$FRW/out" || true)"
check "  the screen that is new" 1 "$(grep -c '^== verdict: green: .*new 1 screen (s2)' "$FRW/out" || true)"
check "  and the named screens that moved nothing, not the ones that do not exist" 1 \
  "$(grep -c '^== verdict: green: .*named but not moved 2 screens (s3, s5)' "$FRW/out" || true)"
check "  and an asked screen that is in no walk is said, not left to a diff" 1 "$(grep -c '^== verdict: green: .*asked but in no walk 1 screen (s4)' "$FRW/out" || true)"
check "  and the run still ends green on its counts, exit 0" 0 "$FR_RC"
fr --moved s1,s2
check "with nothing seen, the verdict says none for each" 1 "$(grep -c '^== verdict: green: .*moved none, new none, named but not moved none' "$FRW/out" || true)"

# ---- ops/gate.sh (docs/plans/2026-11-09-one-gate-command.md, cases 1 to 13 and the three that step 2 to 4 added)
# pnpm and uptime are stand-ins on PATH: pnpm logs its arguments to GATE_CALLS and exits 1 when they hold GATE_FAIL,
# uptime prints a file. The gate's lock, log folder and polling are the overrides its own header names, so no run
# touches the real .gate-lock or logs/, and none waits more than a couple of seconds.
echo "== ops/gate.sh (the five steps, the lock, the skips)"
GW=$WORK/gate
mkdir -p "$GW/bin"
cat >"$GW/bin/pnpm" <<'STUB'
#!/bin/sh
echo "$*" >>"$GATE_CALLS"
[ -z "${GATE_SLOW:-}" ] || sleep "$GATE_SLOW"
if [ -n "${GATE_FAIL:-}" ]; then
  case "$*" in *"$GATE_FAIL"*) exit 1 ;; esac
fi
exit 0
STUB
cat >"$GW/bin/uptime" <<'STUB'
#!/bin/sh
cat "$GATE_UPTIME_FILE"
STUB
chmod +x "$GW/bin/pnpm" "$GW/bin/uptime"
echo "14:00  up 1 day,  2:00, 3 users,  load averages: 1.00 1.00 1.00" >"$GW/load-ok"
echo "14:00  up 1 day,  2:00, 3 users,  load averages: 9.50 9.00 9.00" >"$GW/load-high"
echo "garbage" >"$GW/load-bad"
GN=0 GRC=0 GOUT='' GLOG='' GCALLS=''
# gate_run [VAR=value ...] -- <gate.sh arguments>: sets GRC, GOUT (the terminal), GLOG (the log), GCALLS (pnpm's calls)
gate_run() {
  local envs=()
  while [ "$1" != -- ]; do
    envs+=("$1")
    shift
  done
  shift
  GN=$((GN + 1))
  GCALLS=$GW/calls-$GN
  GOUT=$GW/out-$GN
  : >"$GCALLS"
  GRC=0
  env -u CI -u GATE_HOLDER PATH="$GW/bin:$BASE_PATH" OPS_LOG_DIR="$GW/logs-$GN" GATE_CALLS="$GCALLS" GATE_LOCK="$GW/lock" GATE_RUN_LOCK="$GW/runlock" \
    GATE_UPTIME_FILE="$GW/load-ok" GATE_POLL=1 GATE_WAIT_MAX=2 \
    ${envs[@]+"${envs[@]}"} bash "$OPS_DIR/gate.sh" "$@" >"$GOUT" 2>&1 || GRC=$?
  GLOG=$(find "$GW/logs-$GN" -name '*.log' 2>/dev/null | head -1 || true)
}
hits() { grep -cF -- "$2" "$1" || true; } # <file> <fixed text>: how many lines hold it
lastline() { tail -n 1 "$1"; }
seenre() { if grep -q -- "$1" "$2"; then echo 1; else echo 0; fi; } # <regex> <file>: 1 if any line matches

# case 1: five steps, each named with its result
gate_run -- shared
check "case 1: a package's gate exits 0" 0 "$GRC"
check "  prints five numbered steps" 5 "$(grep -c '^\[[1-5]/5\]' "$GOUT" || true)"
check "  and the verdict is green" 1 "$(hits "$GOUT" '== green')"
check "  and the log's last line is == exit 0" "== exit 0" "$(lastline "$GLOG")"
check "  and the summary names all five steps passed" "== steps: typecheck 0 eslint 0 prettier 0 test 0 knip 0" "$(grep '^== steps' "$GLOG")"
check "  and the typecheck ran on the package alone" 1 "$(hits "$GCALLS" '--filter @credo/shared run typecheck')"

# case 5: the test step is the package's own script
check "case 5: the test step calls the package's own test script" 1 "$(hits "$GCALLS" '--filter @credo/shared run test')"
check "  and gate.sh never spells vitest" 0 "$(grep -c vitest "$OPS_DIR/gate.sh" || true)"

# case 6: the repo-wide steps run once in a scoped call
check "case 6: eslint ran once" 1 "$(hits "$GCALLS" 'exec eslint')"
check "  and prettier once" 1 "$(hits "$GCALLS" 'exec prettier')"
check "  and knip once" 1 "$(hits "$GCALLS" 'exec knip')"

# cases 2 and 3: a red step stops nothing, and the exit line is 1, in each of the five positions
for pos in "typecheck|run typecheck" "eslint|exec eslint" "prettier|exec prettier" "test|run test" "knip|exec knip"; do
  name=${pos%%|*}
  pat=${pos#*|}
  gate_run GATE_FAIL="$pat" -- shared
  check "case 3: a red $name exits 1" 1 "$GRC"
  check "  the log ends == exit 1" "== exit 1" "$(lastline "$GLOG")"
  check "  the summary names $name as the red one" 1 "$(grep -c "^== steps:.* $name 1" "$GLOG" || true)"
  check "case 2: and all five steps still ran ($name red)" 5 "$(grep -c '^\[[1-5]/5\]' "$GLOG" || true)"
  check "  and the verdict is red" 1 "$(hits "$GLOG" '== red')"
done

# case 4 and the skip's own marker: a package with no test script is a named skip, shown as skip, not as a pass
gate_run -- walk
check "case 4: a package with no test script is a named skip" 1 "$(hits "$GLOG" 'skipped: @credo/walk has no test script')"
check "  and does not redden the run" 0 "$GRC"
check "  and the summary shows it as skip, not 0" 1 "$(grep -c '^== steps:.* test skip ' "$GLOG" || true)"
check "  and walk's test script was never called" 0 "$(hits "$GCALLS" '@credo/walk run test')"

# case 7: no package, every package's typecheck and test, none hiding the rest
gate_run -- 
check "case 7: the whole-tree call exits 0" 0 "$GRC"
check "  names six typecheck results" 6 "$(grep -c '^ok   typecheck @credo/' "$GLOG" || true)"
check "  and five test results" 5 "$(grep -c '^ok   test @credo/' "$GLOG" || true)"
check "  and the repo-wide steps once" 1 "$(hits "$GCALLS" 'exec knip')"
check "  and the skipped package shows beside the passes in the summary" 1 "$(grep -c '^== steps:.* test 0+1skipped ' "$GLOG" || true)"
gate_run GATE_FAIL="@credo/ui run typecheck" -- 
check "  and a red package typecheck does not stop the others (6 ran)" 6 "$(grep -c 'run typecheck' "$GCALLS" || true)"
check "  and the other five tests still ran" 5 "$(grep -c 'run test' "$GCALLS" || true)"
check "  and the red package is named" 1 "$(hits "$GLOG" 'RED  typecheck @credo/ui exit 1')"
gate_run -- a b
check "a call with two packages is a usage refusal, exit 2" 2 "$GRC"

# case 13: the verdict names the gate it is not
gate_run -- shared
check "case 13: the log names make check as c-storage's own gate" 1 "$(grep -c "make check in services/c-storage" "$GLOG" || true)"

# case 8: the load is waited for, and the wait is logged
gate_run GATE_UPTIME_FILE="$GW/load-high" -- shared
check "case 8: above the load ceiling it logs its wait" 1 "$(seenre '^waiting: one-minute load 9.50 is not under 8' "$GLOG")"
check "  and gives up with exit 1, no step run" 1 "$GRC"
check "  and took no lock" 0 "$([ -d "$GW/lock" ] && echo 1 || echo 0)"
check "  and ran no step" 0 "$(wc -l <"$GCALLS" | tr -d ' ')"
# a held lock names its owner
mkdir "$GW/lock"
echo "pid=99999 log=other-lane.log started=T" >"$GW/lock/owner"
gate_run -- shared
check "case 8: a held lock is waited for, naming its owner" 1 "$(seenre '^waiting: lock .* is held by: pid=99999 log=other-lane.log' "$GLOG")"
check "  and the run gives up with exit 1" 1 "$GRC"
check "  and ran no step" 0 "$(wc -l <"$GCALLS" | tr -d ' ')"
# the step-3 property that matters most: a giving-up run leaves a foreign lock exactly where it was
check "case 10b: a giving-up run leaves the foreign lock's owner as it was" "pid=99999 log=other-lane.log started=T" "$(cat "$GW/lock/owner")"
check "  and the lock itself" 1 "$([ -d "$GW/lock" ] && echo 1 || echo 0)"
# case 11: a nested call, whose holder is the lock's owner, does not take it, and the outer lock survives
echo "pid=4242 log=outer started=T" >"$GW/lock/owner"
gate_run GATE_HOLDER=4242 -- shared
check "case 11: a nested call runs the steps" 0 "$GRC"
check "  says it did not take the lock" 1 "$(hits "$GLOG" 'lock: not taken, held by the calling gate (pid 4242)')"
check "  and runs all five steps" 5 "$(grep -c '^\[[1-5]/5\]' "$GLOG" || true)"
check "  and the outer lock and its owner survive" "pid=4242 log=outer started=T" "$(cat "$GW/lock/owner")"
# a stale holder (not the owner) is not a nested call: it waits
gate_run GATE_HOLDER=1111 -- shared
check "case 11b: a holder that is not the owner waits like anyone" 1 "$(seenre '^waiting: lock' "$GLOG")"
# case 12: under CI there is no lock and no load wait, and the log says so, even with the lock held and the load high
gate_run CI=1 GATE_UPTIME_FILE="$GW/load-high" -- shared
check "case 12: under CI the gate runs green past a held lock and a high load" 0 "$GRC"
check "  and the log says it skipped both" 1 "$(hits "$GLOG" 'lock: skipped, CI is set')"
check "  and the foreign lock was left alone" "pid=4242 log=outer started=T" "$(cat "$GW/lock/owner")"
rm -f "$GW/lock/owner"
rmdir "$GW/lock"
# case 9: an unreadable load refuses rather than taking the lock
gate_run GATE_UPTIME_FILE="$GW/load-bad" -- shared
check "case 9: an unreadable uptime reading refuses, exit 1" 1 "$GRC"
check "  names why" 1 "$(grep -c "load could not be read from uptime" "$GLOG" || true)"
check "  and took no lock" 0 "$([ -d "$GW/lock" ] && echo 1 || echo 0)"
# case 10: the lock is released from the trap on a red, with its time and "free at the end"
gate_run GATE_FAIL="exec knip" -- shared
check "case 10: after a red the lock is gone" 0 "$([ -d "$GW/lock" ] && echo 1 || echo 0)"
check "  and the log says it was released and free at the end" 1 "$(grep -c "released [0-9:]*: lock free at the end: yes" "$GLOG" || true)"
check "  and the release is logged before the exit line" "== exit 1" "$(lastline "$GLOG")"
# case 10: and on a signal. The gate runs slowly under the stand-in; SIGTERM arrives during its first step.
GN=$((GN + 1))
GCALLS=$GW/calls-$GN
: >"$GCALLS"
env -u CI -u GATE_HOLDER PATH="$GW/bin:$BASE_PATH" OPS_LOG_DIR="$GW/logs-$GN" GATE_CALLS="$GCALLS" GATE_LOCK="$GW/lock" GATE_RUN_LOCK="$GW/runlock" \
  GATE_UPTIME_FILE="$GW/load-ok" GATE_SLOW=3 bash "$OPS_DIR/gate.sh" shared >"$GW/out-$GN" 2>&1 &
GPID=$!
for _ in $(seq 1 50); do
  [ -s "$GCALLS" ] && break
  sleep 0.2
done
kill -TERM "$GPID" 2>/dev/null || true
GRC=0
wait "$GPID" || GRC=$?
GLOG=$(find "$GW/logs-$GN" -name '*.log' | head -1)
check "case 10: a SIGTERM during a step exits 143" 143 "$GRC"
check "  and the lock is gone" 0 "$([ -d "$GW/lock" ] && echo 1 || echo 0)"
check "  and the log ends == exit 143" "== exit 143" "$(lastline "$GLOG")"

# M1: a package list that cannot be read refuses, it never runs nothing and says green
printf 'packages:\n' >"$GW/ws-empty.yaml"
printf 'packages:\n    - shared\n' >"$GW/ws-reformatted.yaml"
for ws in "$GW/ws-empty.yaml" "$GW/ws-reformatted.yaml" "$GW/ws-missing.yaml"; do
  gate_run GATE_WORKSPACE="$ws" -- 
  check "M1: an unreadable or empty package list ($(basename "$ws")) refuses, exit 1" 1 "$GRC"
  check "  names why" 1 "$(hits "$GLOG" 'no package could be read from')"
  check "  runs no step" 0 "$(wc -l <"$GCALLS" | tr -d ' ')"
  check "  and never says green" 0 "$(hits "$GLOG" '== green')"
  check "  and the log ends == exit 1" "== exit 1" "$(lastline "$GLOG")"
done
gate_run GATE_WORKSPACE="$GW/ws-missing.yaml" -- shared
check "M1: a named package does not read the list at all" 0 "$GRC"

# L2: a package.json that cannot be asked is a red, never the skip a missing script is
mkdir -p "$GW/badnode"
printf '#!/bin/sh\nexit 1\n' >"$GW/badnode/node"
chmod +x "$GW/badnode/node"
gate_run PATH="$GW/badnode:$GW/bin:$BASE_PATH" -- shared
check "L2: a node that fails is a red, exit 1" 1 "$GRC"
check "  names the package and the node exit" 1 "$(hits "$GLOG" 'RED  typecheck @credo/shared: could not read its scripts from package.json (node exit 1)')"
check "  and is not read as a skip" 0 "$(hits "$GLOG" 'has no typecheck script')"
check "  and the summary shows 1, not skip" 1 "$(grep -c '^== steps: typecheck 1 ' "$GLOG" || true)"
mkdir -p "$GW/badnode10"
printf '#!/bin/sh\nexit 10\n' >"$GW/badnode10/node"
chmod +x "$GW/badnode10/node"
gate_run PATH="$GW/badnode10:$GW/bin:$BASE_PATH" -- shared
check "R2: node's own reserved exit 10 is a red, not a plain no" 1 "$(hits "$GLOG" 'RED  typecheck @credo/shared: could not read its scripts from package.json (node exit 10)')"
gate_run PATH="$GW/bin:/usr/bin:/bin" -- shared
check "L2: node absent from PATH is a red naming node exit 127" 1 "$(seenre 'RED  typecheck @credo/shared: could not read its scripts from package.json (node exit 127)' "$GLOG")"
check "  and the run is red" 1 "$GRC"

# M2: the give-up refusal names the owner, says if its pid is alive, prints the one clearing command, clears nothing
mkdir "$GW/lock"
echo "pid=$$ log=other.log started=T" >"$GW/lock/owner"
gate_run -- shared
check "M2: the refusal names the owner" 1 "$(hits "$GLOG" "(owner: pid=$$ log=other.log started=T;")"
check "  says its pid is alive" 1 "$(hits "$GLOG" "pid $$ is still alive")"
check "R1: a live owner is waited for, so no rm -rf is printed" 0 "$(hits "$GLOG" "rm -rf")"
check "  and the refusal says to wait and clear nothing" 1 "$(hits "$GLOG" "That run is still going: wait for it")"
check "  and the lock is as it was" "pid=$$ log=other.log started=T" "$(cat "$GW/lock/owner")"
echo "pid=999999 log=other.log started=T" >"$GW/lock/owner"
gate_run -- shared
check "M2: a dead owner is said to be not alive" 1 "$(hits "$GLOG" "pid 999999 is not alive")"
check "R1: a dead owner gets the one command that clears it" 1 "$(hits "$GLOG" "clear it with: rm -rf '$GW/lock'")"
check "  and is not told to wait" 0 "$(hits "$GLOG" "wait for it")"
echo "no pid here" >"$GW/lock/owner"
gate_run -- shared
check "M2: an owner with no readable pid says so" 1 "$(hits "$GLOG" "its pid could not be read")"
check "R1: an unknown owner keeps the hedge and the clearing command" 1 "$(hits "$GLOG" "clear it with: rm -rf '$GW/lock'")"
rm -f "$GW/lock/owner"
rmdir "$GW/lock"

# M3: a full run's lock makes the gate wait, as ops/full-run.sh waits on nothing and refuses on the gate lock
mkdir "$GW/runlock"
echo "pid 999999 started T for walks a,b in /tree" >"$GW/runlock/owner"
gate_run -- shared
check "M3: a full run's lock is waited for, naming its owner" 1 "$(seenre '^waiting: a full run holds .*runlock: pid [0-9]* started T for walks a,b' "$GLOG")"
check "  and the gate lock was never taken" 0 "$([ -d "$GW/lock" ] && echo 1 || echo 0)"
check "  and no step ran" 0 "$(wc -l <"$GCALLS" | tr -d ' ')"
check "  and the give-up names the run lock's clearing command" 1 "$(hits "$GLOG" "clear it with: rm -rf '$GW/runlock'")"
check "  and the run lock is as it was" 1 "$([ -d "$GW/runlock" ] && echo 1 || echo 0)"
echo "pid $$ started T for walks a,b in /tree" >"$GW/runlock/owner"
gate_run -- shared
check "R1: a healthy full run (live pid) is not given the rm -rf" 0 "$(hits "$GLOG" "rm -rf")"
check "  and is told to wait" 1 "$(hits "$GLOG" "That run is still going: wait for it")"
gate_run CI=1 -- shared
check "M3: under CI the full run's lock is not waited for" 0 "$GRC"
# and when the full run ends while the gate waits, the gate goes on and takes its own lock
GN=$((GN + 1))
GCALLS=$GW/calls-$GN
: >"$GCALLS"
env -u CI -u GATE_HOLDER PATH="$GW/bin:$BASE_PATH" OPS_LOG_DIR="$GW/logs-$GN" GATE_CALLS="$GCALLS" GATE_LOCK="$GW/lock" GATE_RUN_LOCK="$GW/runlock" \
  GATE_UPTIME_FILE="$GW/load-ok" GATE_POLL=1 GATE_WAIT_MAX=30 bash "$OPS_DIR/gate.sh" shared >"$GW/out-$GN" 2>&1 &
GPID=$!
for _ in $(seq 1 50); do
  grep -qs 'waiting: a full run' "$GW"/logs-"$GN"/*.log && break
  sleep 0.2
done
rm -f "$GW/runlock/owner"
rmdir "$GW/runlock"
GRC=0
wait "$GPID" || GRC=$?
GLOG=$(find "$GW/logs-$GN" -name '*.log' | head -1)
check "M3: once the full run's lock goes the gate runs and is green" 0 "$GRC"
check "  having waited first" 1 "$(seenre '^waiting: a full run holds' "$GLOG")"
check "  and having taken and freed its own lock" 1 "$(grep -c 'lock free at the end: yes' "$GLOG" || true)"

# ---- the scripts' answer on an environment that may hold real data (docs/plans/2026-11-12-safe-scripts.md, cases 1 to 6)
echo "== every script that reaches an environment says what it does on production (INVENTED_ENVS, refuse_real, real_ok)"
# stance_of <script> → "ok", or what is wrong: exactly one call of refuse_real or real_ok, after log_start and before main_synced
stance_of() {
  awk '/^log_start /{ if (!l) l = NR } /^(refuse_real|real_ok) /{ c++; k = NR } /^main_synced( |$)/{ if (!m) m = NR }
    END { if (c == 1 && l && m && l < k && k < m) print "ok"; else print "calls " c + 0 ", log_start " l + 0 ", call " k + 0 ", main_synced " m + 0 }' "$1"
}
stance_bad=''
stance_n=0
for f in "$OPS_DIR"/*.sh; do
  grep -qE '^main_synced( |$)' "$f" || continue
  stance_n=$((stance_n + 1))
  r=$(stance_of "$f")
  [ "$r" = ok ] || stance_bad="$stance_bad $(basename "$f") ($r)"
done
check "1: every ops script that calls main_synced calls exactly one of refuse_real and real_ok, after log_start and before main_synced" "" "$stance_bad"
check "  and the glob finds scripts at all" 1 "$([ "$stance_n" -ge 10 ] && echo 1 || echo 0)"
check "2: the list of invented environments has one home" 1 "$(cat "$OPS_DIR"/*.sh | grep -c '^INVENTED_ENVS=' || true)"
check "  and it names ridge alone" 'INVENTED_ENVS="ridge"' "$(grep '^INVENTED_ENVS=' "$OPS_DIR/lib.sh")"
# stance_sub <marker value> [VAR=value…] -- <function> <args…>: in a subshell with the tests' marker and switches as the case sets them
stance_sub() {
  local marker=$1
  shift
  local sw=()
  while [ "$1" != -- ]; do sw+=("$1"); shift; done
  shift
  ( [ -n "$marker" ] || unset OPS_TESTS_RUNNING; unset RIDGE_SCRIPTS_DIR OPS_TEST_NO_TTY; for kv in ${sw[@]+"${sw[@]}"}; do export "${kv?}"; done; "$@" ) 2>&1
}
check "6: on an unlisted environment RIDGE_SCRIPTS_DIR is refused without the tests' marker" 1 "$(stance_sub '' RIDGE_SCRIPTS_DIR=/x -- real_ok crest why | grep -c 'RIDGE_SCRIPTS_DIR is set, and crest may hold real data' || true)"
check "  and so is OPS_TEST_NO_TTY" 1 "$(stance_sub '' OPS_TEST_NO_TTY=1 -- real_ok crest why | grep -c 'OPS_TEST_NO_TTY is set, and crest may hold real data' || true)"
check "  and with the marker set both pass" "ok   crest may hold real data; this script is safe there: why" "$(stance_sub 1 RIDGE_SCRIPTS_DIR=/x OPS_TEST_NO_TTY=1 -- real_ok crest why)"
check "  and on ridge they are not looked at, and nothing is printed" "" "$(stance_sub '' RIDGE_SCRIPTS_DIR=/x OPS_TEST_NO_TTY=1 -- real_ok ridge why)"
check "  refuse_real passes ridge and dies on another name, in the script's words" "|error: my words" "$(stance_sub 1 -- refuse_real ridge 'my words' || true)|$(stance_sub 1 -- refuse_real crest 'my words' || true)"
# the whole runs, in the scratch clone the tunnel's section made: the clone's ops/ is this tree's
e2e_fresh drill-other
e2e_run drill.sh crest
check "3: the drill on an unlisted environment refuses, naming why" "1 1" "$RC $(grep -c '^error: drill.sh holds the environments that keep invented data alone (ridge)' "$OPS_LOG_DIR"/*.log || true)"
check "  before any aws or box call" "gone gone" "$(file_state "$S/aws.calls") $(file_state "$S/ssh.calls")"
# shellcheck disable=SC2016 # the scripts' source text is searched, not expanded
check "4: the tunnel, the seed and the root password keep their words, now through refuse_real (their whole runs are the cases above)" "1 1 1" \
  "$(grep -c 'refuse_real "\$ENVNAME" "tunnel.sh holds ridge alone for now: another stack' "$OPS_DIR/tunnel.sh" || true) $(grep -c 'refuse_real "\$ENVNAME" "seed.sh seeds ridge alone: a client' "$OPS_DIR/seed.sh" || true) $(grep -c "refuse_real \"\\\$ENVNAME\" \"root-password.sh holds ridge's demo copies alone" "$OPS_DIR/root-password.sh" || true)"
stack_other() { # <state name> <env> <args…>: stack.sh env <env> in the stack clone, its terminal output in the state's out file
  e2e_fresh "$1"
  local env=$2
  shift 2
  RC=0
  (cd "$E2E/stackrepo" && PATH="$E2E/stackbin:$PATH" bash ops/stack.sh env "$env" "$@") >"$S/out" 2>&1 </dev/null || RC=$?
}
stack_other stack-crest crest --plan
check "5: a script that works prints its reason on an unlisted environment" 1 "$(grep -c '^ok   crest may hold real data; this script is safe there: a change set is shown first' "$S/out" || true)"
stack_other stack-ridge-stance ridge --plan
check "  and nothing new on ridge" 0 "$(grep -c 'may hold real data' "$S/out" || true)"

echo "== workflows_of names the workflows that reach an environment (the destroy and the remake switch those, never walks.yml)"
check "15: workflows_of ridge names ci.yml and seed.yml" "ci.yml seed.yml" "$(workflows_of ridge | tr '\n' ' ' | sed 's/ $//')"
check "  and an environment no workflow names gets nothing" "" "$(workflows_of nowhere)"
wf_odd_shape() { # <file body>: workflows_of ridge over a folder holding that one workflow file, "<exit> <the error names the file and the line>"
  local d=$WORK/wfodd rc=0 out
  rm -rf "$d"
  mkdir -p "$d/.github/workflows"
  printf '%b' "$1" >"$d/.github/workflows/odd.yml"
  out=$(REPO_DIR=$d workflows_of ridge 2>&1) || rc=$?
  echo "$rc $(grep -c "^error: odd.yml has an environment: line that is not the plain form.*(line 3:" <<<"$out" || true)"
}
check "25: a workflow naming its environment as a mapping stops workflows_of, naming the file and the line" "1 1" \
  "$(wf_odd_shape 'jobs:\n  d:\n    environment:\n      name: ridge\n')"
check "  a quoted name stops it the same way" "1 1" "$(wf_odd_shape 'jobs:\n  d:\n    environment: "ridge"\n')"
check "  a trailing comment stops it the same way" "1 1" "$(wf_odd_shape 'jobs:\n  d:\n    environment: ridge # the stage\n')"
check "  and the plain line, with comment lines about environments around it, is read" "0 odd.yml" \
  "$(d=$WORK/wfodd; rm -rf "$d"; mkdir -p "$d/.github/workflows"; printf 'jobs:\n  d:\n    # the environment: here is plain\n    environment: ridge\n' >"$d/.github/workflows/odd.yml"; rc=0; out=$(REPO_DIR=$d workflows_of ridge 2>&1) || rc=$?; echo "$rc $out")"

echo "== no file the ci workflow runs on its Ubuntu runner uses BSD sed's in-place form (GNU sed reads the empty suffix as the script)"
# ci.yml runs ops/*.sh, walk/*.sh and services/c-storage/scripts/*.sh (ShellCheck, the guards, the deploy) and make check
# in services/c-storage, on GNU sed: `-i` there takes its suffix attached, so a separate empty one is the script.
# The pattern is written so that this line does not match itself.
BSD_SED=$(grep -nE "sed( +-[A-Za-z]+)* +-[A-Za-z]*i +(''|\"\")" "$REPO_DIR"/ops/*.sh "$REPO_DIR"/walk/*.sh "$REPO_DIR"/services/c-storage/scripts/*.sh "$REPO_DIR"/services/c-storage/Makefile "$REPO_DIR"/.github/workflows/*.yml || true)
check "no sed -i with a separate empty suffix in a file the runner runs" "" "$BSD_SED"

echo "== ops/destroy.sh and ops/remake.sh, run whole once on stand-ins for aws, gh, bru and the four children (rows 8 and 18)"
# A clone whose origin is named as GitHub's are, holding this tree's ops/ and workflows, except that the
# four scripts the remake calls are stand-ins: each logs as the real one does, records its call and
# ends green, or red when FAKE_RED names it. The fixtures are parsed alone before any run.
CYC=$E2E/cycle
mkdir -p "$CYC/bin" "$CYC/fx" "$E2E/github.com/test-owner"
git init -q --bare "$E2E/github.com/test-owner/cycle-repo.git"
mkdir -p "$CYC/repo/.github"
cp -R "$OPS_DIR" "$CYC/repo/ops"
cp -R "$REPO_DIR/.github/workflows" "$CYC/repo/.github/workflows"
for child in stack release app check; do
  cat >"$CYC/repo/ops/$child.sh" <<'CHILD'
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib.sh"
name=$(basename "$0" .sh)
env=$1
[ "$name" != stack ] || env=$2
log_start "$name" "$env"
echo "$name.sh $*" >>"${FAKE_STATE:?}/children.calls"
[ "${FAKE_RED:-}" != "$name" ] || die "stand-in $name goes red"
echo "== green"
CHILD
done
git -C "$CYC/repo" init -q
git -C "$CYC/repo" remote add origin "$E2E/github.com/test-owner/cycle-repo.git"
git -C "$CYC/repo" add -A
git -C "$CYC/repo" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit -q -m main
git -C "$CYC/repo" push -q origin HEAD:refs/heads/main
# A second clone, with its own origin, whose lib.sh lists one more id a stack delete keeps, to show that an id
# no step of destroy.sh deletes stops it (row 22).
git init -q --bare "$E2E/github.com/test-owner/cycle-repo2.git"
cp -R "$CYC/repo" "$CYC/repo2"
rm -rf "$CYC/repo2/.git"
sed -i.bak 's/^DESTROY_BY_HAND="Box CopyBucket RecordsVolume UiBucket"$/DESTROY_BY_HAND="Box UiBucket CopyBucket RecordsVolume Archive"/' "$CYC/repo2/ops/lib.sh"
rm -f "$CYC/repo2/ops/lib.sh.bak"
git -C "$CYC/repo2" init -q
git -C "$CYC/repo2" remote add origin "$E2E/github.com/test-owner/cycle-repo2.git"
git -C "$CYC/repo2" add -A
git -C "$CYC/repo2" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit -q -m main
git -C "$CYC/repo2" push -q origin HEAD:refs/heads/main
FX=$CYC/fx
ACCT=123456789012
jq -nc '{StackSummaries: [{StackName: "ridge", StackStatus: "UPDATE_COMPLETE"}, {StackName: "credo-network", StackStatus: "UPDATE_COMPLETE"}, {StackName: "credo-github", StackStatus: "CREATE_COMPLETE"}]}' >"$FX/stacks.json"
jq -nc '{Stacks: [{StackName: "ridge", StackStatus: "UPDATE_COMPLETE", EnableTerminationProtection: false, Parameters: [{ParameterKey: "Env", ParameterValue: "ridge"}, {ParameterKey: "Network", ParameterValue: "credo-network"}, {ParameterKey: "Repository", ParameterValue: "test-owner/cycle-repo"}], Outputs: [{OutputKey: "BoxId", OutputValue: "i-0box"}]}]}' >"$FX/desc.json"
jq -nc --arg acct "$ACCT" '{StackResourceSummaries: [
  {ResourceType: "AWS::EC2::Subnet", LogicalResourceId: "Subnet", PhysicalResourceId: "subnet-0aaa", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::EC2::Instance", LogicalResourceId: "Box", PhysicalResourceId: "i-0box", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::EC2::SecurityGroup", LogicalResourceId: "BoxGroup", PhysicalResourceId: "sg-0box", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::EC2::SecurityGroup", LogicalResourceId: "BffGroup", PhysicalResourceId: "sg-0bff", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::Logs::LogGroup", LogicalResourceId: "BffLogs", PhysicalResourceId: "/aws/lambda/credo-ridge-bff", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::Logs::LogGroup", LogicalResourceId: "ApiLogs", PhysicalResourceId: "/aws/apigateway/credo-ridge", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::S3::Bucket", LogicalResourceId: "UiBucket", PhysicalResourceId: "ridge-uibucket-abc", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::IAM::Role", LogicalResourceId: "BffRole", PhysicalResourceId: "ridge-BffRole-1", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::IAM::Role", LogicalResourceId: "DeployRole", PhysicalResourceId: "ridge-DeployRole-1", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::Lambda::Function", LogicalResourceId: "Bff", PhysicalResourceId: ("arn:aws:lambda:ap-southeast-5:" + $acct + ":function:credo-ridge-bff"), ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::ApiGatewayV2::Api", LogicalResourceId: "Api", PhysicalResourceId: "api0", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::CloudFront::OriginAccessControl", LogicalResourceId: "UiAccess", PhysicalResourceId: "oac0", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::CloudFront::Function", LogicalResourceId: "UiRewrite", PhysicalResourceId: "credo-ridge-rewrite", ResourceStatus: "CREATE_COMPLETE"},
  {ResourceType: "AWS::CloudFront::Distribution", LogicalResourceId: "Distribution", PhysicalResourceId: "E0DIST", ResourceStatus: "CREATE_COMPLETE"}]}' >"$FX/res.json"
jq -nc '["AWS::EC2::Subnet", "AWS::EC2::Instance", "AWS::EC2::SecurityGroup", "AWS::Logs::LogGroup", "AWS::S3::Bucket", "AWS::IAM::Role", "AWS::Lambda::Function", "AWS::ApiGatewayV2::Api", "AWS::CloudFront::OriginAccessControl", "AWS::CloudFront::Function", "AWS::CloudFront::Distribution"]' >"$FX/types.json"
jq -nc '{State: {Name: "running"}, InstanceType: "t4g.nano", SubnetId: "subnet-0aaa", Tags: [{Key: "Env", Value: "ridge"}, {Key: "Name", Value: "credo-ridge"}], BlockDeviceMappings: [{DeviceName: "/dev/xvda", Ebs: {VolumeId: "vol-0root", DeleteOnTermination: false}}]} | {Reservations: [{Instances: [.]}]}' >"$FX/box.json"
jq -nc '[{id: "eni-1", d: "box interface", i: "i-0box"}, {id: "eni-2", d: "AWS Lambda VPC ENI-credo-ridge-bff", i: null}]' >"$FX/enis.json"
jq -nc '{Volumes: [{VolumeId: "vol-0root", State: "available", Attachments: []}]}' >"$FX/vol.json"
jq -nc '{Volumes: [{VolumeId: "vol-0rec", State: "in-use", Tags: [{Key: "Env", Value: "ridge"}, {Key: "Name", Value: "credo-ridge-records"}], Attachments: []}]}' >"$FX/recvol.json"
jq -nc '{Volumes: [{VolumeId: "vol-0orph", Size: 8, VolumeType: "gp3", Encrypted: true, CreateTime: "2026-11-08T00:00:00Z"}]}' >"$FX/orphans.json"
fx_bad=''
for f in "$FX"/*.json; do jq -e . "$f" >/dev/null 2>&1 || fx_bad="$fx_bad $(basename "$f")"; done
check "the stand-ins' fixtures all parse as JSON" "" "$fx_bad"
cat >"$CYC/bin/aws" <<'STANDIN'
#!/bin/bash
echo "aws $*" >>"${FAKE_STATE:?}/aws.calls"
FX=${FAKE_FX:?}
gone() { echo "An error occurred (NotFound) when calling the operation: 404 not found" >&2; exit 254; }
case "$*" in
  *"sts get-caller-identity"*) echo 123456789012 ;;
  *"describe-snapshots"*"volume-id,Values=vol-0rec"*"Snapshots[].SnapshotId"*) echo snap-0stack ;;
  *"describe-snapshots"*"volume-id,Values=vol-0rec"*) echo 0 ;;
  *"ec2 describe-volumes --volume-ids vol-0rec"*) if [ -e "$FAKE_STATE/stack.gone" ]; then echo "An error occurred (InvalidVolume.NotFound)" >&2; exit 254; fi; cat "$FX/recvol.json" ;;
  *"s3api head-bucket"*"ridge-copybucket-xyz"*) [ ! -e "$FAKE_STATE/copy.gone" ] || gone ;;
  *"s3api list-objects-v2"*"ridge-copybucket-xyz"*) if [ -e "$FAKE_STATE/copy.rm.done" ]; then echo 0; else echo 2; fi ;;
  *"s3 rm"*"ridge-copybucket-xyz"*) touch "$FAKE_STATE/copy.rm.done"; printf 'delete: s3://ridge-copybucket-xyz/Box/records/%s\n' 1 2 ;;
  *"s3api delete-bucket"*"ridge-copybucket-xyz"*) touch "$FAKE_STATE/copy.gone" ;;
  *"cloudformation list-stacks"*) cat "$FX/stacks.json" ;;
  *"cloudformation describe-stacks"*"--query"*) [ ! -e "$FAKE_STATE/stack.gone" ] || gone; echo UPDATE_COMPLETE ;;
  *"cloudformation describe-stacks"*) [ ! -e "$FAKE_STATE/stack.gone" ] || { echo "An error occurred (ValidationError): Stack with id ridge does not exist" >&2; exit 254; }; cat "$FX/desc.json" ;;
  *"list-stack-resources"*) cat "$FX/res.json" ;;
  *"get-template-summary"*) cat "$FX/types.json" ;;
  *"ec2 describe-instances"*"--filters"*) [ -e "$FAKE_STATE/box.gone" ] || echo i-0box ;;
  *"describe-instances --instance-ids"*"Tags[?Key"*) printf 'ridge\tsubnet-0aaa\n' ;;
  *"describe-instances --instance-ids"*"State.Name"*) if [ -e "$FAKE_STATE/box.gone" ]; then echo terminated; else echo running; fi ;;
  *"describe-instances --instance-ids"*) cat "$FX/box.json" ;;
  *"ec2 create-snapshot"*) echo snap-0keep ;;
  *"wait snapshot-completed"*) : ;;
  *"describe-snapshots --snapshot-ids"*) echo completed ;;
  *"ec2 describe-volumes --filters"*) cat "$FX/orphans.json" ;;
  *"describe-snapshots"*) echo 0 ;;
  *"describe-network-interfaces"*) cat "$FX/enis.json" ;;
  *"s3api head-bucket"*) [ ! -e "$FAKE_STATE/stack.gone" ] || gone ;;
  *"get-bucket-tagging"*) echo '{"TagSet":[{"Key":"Env","Value":"ridge"}]}' ;;
  *"get-bucket-versioning"*) echo None ;;
  *"s3api list-objects-v2"*)
    if [ -e "$FAKE_STATE/rm.done" ]; then
      [ -z "${FAKE_LIST_FAIL:-}" ] || { echo "An error occurred (AccessDenied) when calling the ListObjectsV2 operation: denied for arn:aws:iam::123456789012:role/x" >&2; exit 255; }
      echo 0
    else echo 3; fi ;;
  *"s3 rm"*) touch "$FAKE_STATE/rm.done"; printf 'delete: s3://ridge-uibucket-abc/f%s\n' 1 2; [ -n "${FAKE_RM_SHORT:-}" ] || echo 'delete: s3://ridge-uibucket-abc/f3' ;;
  *"logs describe-log-groups"*"length(@)"*) if [ -e "$FAKE_STATE/stack.gone" ]; then echo 0; else echo 1; fi ;;
  *"logs describe-log-groups"*"/aws/lambda/credo-ridge"*) echo /aws/lambda/credo-ridge-bff ;;
  *"logs describe-log-groups"*) echo /aws/apigateway/credo-ridge ;;
  *"ec2 terminate-instances"*) : ;;
  *"wait instance-terminated"*) touch "$FAKE_STATE/box.gone" ;;
  *"ec2 describe-volumes --volume-ids"*) if [ -e "$FAKE_STATE/vol.gone" ]; then echo "An error occurred (InvalidVolume.NotFound)" >&2; exit 254; fi; cat "$FX/vol.json" ;;
  *"wait volume-available"*) : ;;
  *"ec2 delete-volume"*) touch "$FAKE_STATE/vol.gone" ;;
  *"cloudformation delete-stack"*)
    [ -z "${FAKE_DELETE_DENIED:-}" ] || { echo "An error occurred (AccessDenied) when calling the DeleteStack operation: User: arn:aws:sts::123456789012:assumed-role/admin/me is not authorized to perform: cloudformation:DeleteStack" >&2; exit 254; } ;;
  *"wait stack-delete-complete"*) touch "$FAKE_STATE/stack.gone" ;;
  *"cloudfront get-distribution"* | *"lambda get-function"* | *"apigatewayv2 get-api"* | *"get-origin-access-control"* | *"cloudfront describe-function"* | *"iam get-role"* | *"describe-security-groups"* | *"describe-subnets"*) gone ;;
  *) echo "stand-in aws: unknown: $*" >&2; exit 1 ;;
esac
STANDIN
cat >"$CYC/bin/gh" <<'STANDIN'
#!/bin/bash
echo "gh $*" >>"${FAKE_STATE:?}/gh.calls"
case "$*" in
  "auth status"*) [ -z "${FAKE_GH_OUT:-}" ] || exit 1; exit 0 ;;
  "workflow list"*)
    for f in "$FAKE_STATE"/wf.*; do printf '%s %s\n' "${f##*/wf.}" "$(cat "$f")"; done |
      jq -R -s -c 'split("\n") | map(select(length > 0) | split(" ")) | map({name: .[0], path: (".github/workflows/" + .[0]), state: .[1]})' ;;
  "workflow disable "*) echo disabled_manually >"$FAKE_STATE/wf.$3" ;;
  "workflow enable "*) [ "${FAKE_ENABLE_FAIL:-}" != "$3" ] || { echo "HTTP 502: Bad gateway" >&2; exit 1; }; echo active >"$FAKE_STATE/wf.$3" ;;
  "run list"*) if [ -n "${FAKE_RUN:-}" ] && [[ "$*" == *in_progress* ]]; then echo '[{"databaseId":1,"workflowName":"ci","status":"in_progress","url":"https://example.test/run/1"}]'; elif [ -n "${FAKE_RUN_QUEUED:-}" ] && [[ "$*" == *queued* ]]; then echo '[{"databaseId":2,"workflowName":"seed","status":"queued","url":"https://example.test/run/2"}]'; elif [ -n "${FAKE_RUN_LATE:-}" ] && [[ "$*" == *in_progress* ]] && grep -q disabled_manually "$FAKE_STATE/wf.ci.yml"; then echo '[{"databaseId":3,"workflowName":"ci","status":"in_progress","url":"https://example.test/run/3"}]'; else echo '[]'; fi ;;
  *) echo "stand-in gh: unknown: $*" >&2; exit 1 ;;
esac
STANDIN
cat >"$CYC/bin/bru" <<'STANDIN'
#!/bin/sh
echo "${FAKE_BRU:-4.2.0}"
STANDIN
chmod +x "$CYC/bin/aws" "$CYC/bin/gh" "$CYC/bin/bru"
cycle_run() { # <state name> <initial workflow state> <typed text> <script> <args…>: the script whole in the clone; terminal output in $S/out
  local name=$1 wf=$2 typed=$3 f
  shift 3
  e2e_fresh "$name"
  export FAKE_FX=$FX
  for f in "$CYC"/repo/.github/workflows/*.yml; do echo "$wf" >"$S/wf.$(basename "$f")"; done
  RC=0
  (cd "$CYC/repo" && PATH="$CYC/bin:$PATH" RIDGE_SCRIPTS_DIR=/x OPS_TEST_NO_TTY=1 bash "ops/$1" "${@:2}") <<<"$typed" >"$S/out" 2>&1 || RC=$?
}
cycle_case() { # <state name> <initial workflow state> <typed text> <script> <args…>: as cycle_run, with CASE_FX (fixtures), CASE_SETUP (run in the state folder first), CASE_ENV (KEY=VALUE words) and CASE_NOTTY (set: no test switch)
  local name=$1 wf=$2 typed=$3 f
  shift 3
  e2e_fresh "$name"
  export FAKE_FX=${CASE_FX:-$FX}
  for f in "$CYC"/repo/.github/workflows/*.yml; do echo "$wf" >"$S/wf.$(basename "$f")"; done
  if [ -n "${CASE_SETUP:-}" ]; then (cd "$S" && eval "$CASE_SETUP"); fi
  RC=0
  (
    cd "$CYC/${CASE_REPO:-repo}"
    export PATH="$CYC/bin:$PATH" RIDGE_SCRIPTS_DIR=/x
    unset OPS_TEST_NO_TTY
    [ -n "${CASE_NOTTY:-}" ] || export OPS_TEST_NO_TTY=1
    for kv in ${CASE_ENV:-}; do export "${kv?}"; done
    bash "ops/$1" "${@:2}"
  ) <<<"$typed" >"$S/out" 2>&1 || RC=$?
}
cycle_run destroy-whole active ridge destroy.sh ridge
check "8: the destroy on a whole ridge: exit 0, its verdict, the log ending on its exit" "0 1 == exit 0" \
  "$RC $(grep -c '^== verdict: ridge is destroyed, ci.yml and seed.yml are off$' "$OPS_LOG_DIR"/*.log || true) $(tail -n 1 "$OPS_LOG_DIR"/*.log)"
check "  it deleted in the one-off's order: the box, its disk, the bucket's files, the stack" "wait instance-terminated,ec2 delete-volume,s3 rm,cloudformation delete-stack," \
  "$(grep -oE -e 'wait instance-terminated|ec2 delete-volume|s3 rm|cloudformation delete-stack' "$S/aws.calls" | tr '\n' ',')"
check "  ci.yml and seed.yml are off, walks.yml stays on, no workflow file is deleted" "disabled_manually disabled_manually active 3" \
  "$(cat "$S/wf.ci.yml") $(cat "$S/wf.seed.yml") $(cat "$S/wf.walks.yml") $(find "$CYC/repo/.github/workflows" -type f | wc -l | tr -d ' ')"
check "  the account id is in neither the log nor the terminal" 0 "$(cat "$OPS_LOG_DIR"/*.log "$S/out" | grep -cF "$ACCT" || true)"
check "  the bucket's three deletes were counted against the three files" 1 "$(grep -c '^   AWS reported 3 delete(s); 3 file(s) were counted before$' "$OPS_LOG_DIR"/*.log || true)"
echo "== the destroy's guards, each on its own case (rows 1 to 7 and 9 to 14)"
destroy_calls() { cat "$S/aws.calls" "$S/gh.calls" 2>/dev/null | grep -cE 'terminate-instances|delete-volume|s3 rm|delete-stack|delete-log-group|workflow disable|create-snapshot' || true; }
wf_states() { echo "$(cat "$S/wf.ci.yml") $(cat "$S/wf.seed.yml") $(cat "$S/wf.walks.yml")"; }
# rows 4, 9 and 13 read the whole run above (the state folder and logs of destroy-whole are still the current ones)
check "4: it disabled ci.yml and seed.yml, in that order, and nothing else" "gh workflow disable ci.yml,gh workflow disable seed.yml," \
  "$(grep '^gh workflow disable' "$S/gh.calls" | sed 's/ --repo.*//' | tr '\n' ',')"
check "  after the typed name, never before" "after" \
  "$(awk '/^   typed: /{t=NR} /^   disabling /{if(!d)d=NR} END{print (t&&d&&t<d)?"after":"not after"}' "$OPS_LOG_DIR"/*.log)"
check "  and it deleted no workflow file" 0 "$(grep -cE 'workflow delete|api .*DELETE|workflows/' "$S/gh.calls" || true)"
check "9: the account id is in neither the log nor the terminal, and the listing's twelve digits were hidden" "0 0 yes" \
  "$(grep -cF "$ACCT" "$OPS_LOG_DIR"/*.log || true) $(grep -cF "$ACCT" "$S/out" || true) $([ "$(grep -c '<12 digits>' "$OPS_LOG_DIR"/*.log || true)" -ge 1 ] && echo yes || echo no)"
check "13: without the switch no snapshot is taken" 0 "$(grep -c 'create-snapshot' "$S/aws.calls" || true)"

# walks is the one other environment a workflow names (walks.yml), so only the refusal itself, never the
# missing workflow file, can stop it before the first call
cycle_case destroy-walks active ridge destroy.sh walks
check "1: an environment but ridge is refused, in the script's words" "1 1" "$RC $(grep -c '^error: destroy.sh destroys ridge alone' "$S/out" || true)"
check "  before any aws or gh call" "gone gone" "$(file_state "$S/aws.calls") $(file_state "$S/gh.calls")"
CASE_NOTTY=1 cycle_case destroy-notty active ridge destroy.sh ridge
check "2: without a terminal it refuses, saying so" "1 1" "$RC $(grep -c '^error: no terminal on the input' "$S/out" || true)"
check "  and made no aws or gh call" "gone gone" "$(file_state "$S/aws.calls") $(file_state "$S/gh.calls")"
cycle_case destroy-wrong active nope destroy.sh ridge
check "3: a typed word other than ridge ends it, saying nothing was changed" "1 1" "$RC $(grep -c "^== STOPPED: the typed name was not 'ridge'" "$S/out" || true)"
check "  with no workflow disabled" "active active active" "$(wf_states)"
check "  and nothing deleted" 0 "$(destroy_calls)"
CASE_ENV=FAKE_RUN=1 cycle_case destroy-running active ridge destroy.sh ridge
check "5: a run in progress stops it before the name is asked" "1 1 0" "$RC $(grep -c '^== STOPPED: a workflow run is still in progress or queued' "$S/out" || true) $(grep -c '^   > ' "$S/out" || true)"
check "  with no workflow disabled and nothing deleted" "active active active 0" "$(wf_states) $(destroy_calls)"
CASE_ENV=FAKE_RUN_QUEUED=1 cycle_case destroy-queued active ridge destroy.sh ridge
check "  a queued run stops it the same way" "1 1 active active active 0" "$RC $(grep -c '^== STOPPED: a workflow run is still in progress or queued' "$S/out" || true) $(wf_states) $(destroy_calls)"
FX6=$CYC/fx-strange
cp -R "$FX" "$FX6"
jq -c '.StackResourceSummaries += [{ResourceType: "AWS::SNS::Topic", LogicalResourceId: "Odd", PhysicalResourceId: "odd", ResourceStatus: "CREATE_COMPLETE"}]' "$FX/res.json" >"$FX6/res.json"
CASE_FX=$FX6 cycle_case destroy-strange active ridge destroy.sh ridge
check "6: a type origin/main's env.yml does not declare is refused, naming it" "1 1" "$RC $(grep -c '^== STOPPED: the stack holds resources of a type env.yml does not declare: AWS::SNS::Topic Odd' "$S/out" || true)"
check "  with nothing destroyed and no workflow disabled" "0 active active active" "$(destroy_calls) $(wf_states)"
FX7=$CYC/fx-env
cp -R "$FX" "$FX7"
jq -c '.Stacks[0].Parameters |= map(if .ParameterKey == "Env" then .ParameterValue = "crest" else . end)' "$FX/desc.json" >"$FX7/desc.json"
CASE_FX=$FX7 cycle_case destroy-env active ridge destroy.sh ridge
check "7: a stack whose Env parameter is not ridge is refused" "1 1" "$RC $(grep -c "^== STOPPED: stack ridge has parameter Env='crest', not 'ridge'" "$S/out" || true)"
check "  with nothing destroyed and no workflow disabled" "0 active active active" "$(destroy_calls) $(wf_states)"
CASE_ENV=FAKE_LIST_FAIL=1 cycle_case destroy-listfail active ridge destroy.sh ridge
check "10: a failed read of the bucket after emptying stops before the stack delete" "1 0" "$RC $(grep -c 'cloudformation delete-stack' "$S/aws.calls" || true)"
check "  and AWS's own words are in the log, the account id not" "1 0" "$(grep -c 'AccessDenied' "$OPS_LOG_DIR"/*.log || true) $(cat "$OPS_LOG_DIR"/*.log "$S/out" | grep -cF "$ACCT" || true)"
CASE_ENV=FAKE_RM_SHORT=1 cycle_case destroy-short active ridge destroy.sh ridge
check "11: two deletes against three files counted stops before the stack delete, saying so" "1 1 0" \
  "$RC $(grep -c '^== STOPPED: bucket ridge-uibucket-abc: 2 delete(s) reported against 3 file(s) counted before' "$S/out" || true) $(grep -c 'cloudformation delete-stack' "$S/aws.calls" || true)"
FX12=$CYC/fx-nostack
cp -R "$FX" "$FX12"
jq -nc '{StackSummaries: [{StackName: "credo-network", StackStatus: "UPDATE_COMPLETE"}, {StackName: "credo-github", StackStatus: "CREATE_COMPLETE"}]}' >"$FX12/stacks.json"
CASE_FX=$FX12 CASE_SETUP='touch box.gone' cycle_case destroy-nostack active ridge destroy.sh ridge
check "12: with no stack and no ridge box it ends 0 on its own verdict, the log ending on its exit" "0 1 == exit 0" \
  "$RC $(grep -c "^== verdict: ridge's stack and box were already gone" "$OPS_LOG_DIR"/*.log || true) $(tail -n 1 "$OPS_LOG_DIR"/*.log)"
check "  it lists the unattached disk, asks no name and changes no workflow" "1 0 active active active" \
  "$(grep -c 'vol-0orph' "$S/out" || true) $(grep -c '^   > ' "$S/out" || true) $(wf_states)"
check "  and deletes nothing" 0 "$(destroy_calls)"
CASE_ENV=RIDGE_KEEP_DISK_SNAPSHOT=1 cycle_case destroy-keep active ridge destroy.sh ridge
check "13: RIDGE_KEEP_DISK_SNAPSHOT=1 takes one snapshot, before the box goes, and the run ends 0" "0 create-snapshot,terminate-instances," \
  "$RC $(grep -oE -e 'create-snapshot|terminate-instances' "$S/aws.calls" | tr '\n' ',')"
CASE_ENV=RIDGE_KEEP_DISK_SNAPSHOT=2 cycle_case destroy-keep2 active ridge destroy.sh ridge
check "  a value but 0 or 1 is refused before any call" "1 1 gone" "$RC $(grep -c '^error: RIDGE_KEEP_DISK_SNAPSHOT must be 0 or 1' "$S/out" || true) $(file_state "$S/aws.calls")"
FX21=$CYC/fx-repo
cp -R "$FX" "$FX21"
jq -c '.Stacks[0].Parameters |= map(if .ParameterKey == "Repository" then .ParameterValue = "someone-else/other-repo" else . end)' "$FX/desc.json" >"$FX21/desc.json"
CASE_FX=$FX21 cycle_case destroy-repo active ridge destroy.sh ridge
check "21: a stack whose Repository parameter is another repository's is refused before the name is asked, saying nothing was destroyed" "1 1 0" \
  "$RC $(grep -c "^== STOPPED: stack ridge has Repository parameter 'someone-else/other-repo', but this clone's origin is 'test-owner/cycle-repo'.* Nothing was destroyed\.$" "$S/out" || true) $(grep -c '^   > ' "$S/out" || true)"
check "  with nothing destroyed and no workflow disabled" "0 active active active" "$(destroy_calls) $(wf_states)"
FX21B=$CYC/fx-repo-empty
cp -R "$FX" "$FX21B"
jq -c '.Stacks[0].Parameters |= map(select(.ParameterKey != "Repository"))' "$FX/desc.json" >"$FX21B/desc.json"
CASE_FX=$FX21B cycle_case destroy-repo-empty active ridge destroy.sh ridge
check "  a stack with no Repository parameter is refused the same way" "1 1 0" "$RC $(grep -c "^== STOPPED: stack ridge has Repository parameter 'empty'" "$S/out" || true) $(destroy_calls)"
FX22=$CYC/fx-repo2
cp -R "$FX" "$FX22"
jq -c '.Stacks[0].Parameters |= map(if .ParameterKey == "Repository" then .ParameterValue = "test-owner/cycle-repo2" else . end)' "$FX/desc.json" >"$FX22/desc.json"
CASE_FX=$FX22 CASE_REPO=repo2 cycle_case destroy-byhand active ridge destroy.sh ridge
check "22: an id the list names that no step deletes stops it before the name is asked, naming the id" "1 1 0 0" \
  "$RC $(grep -c '^== STOPPED: DESTROY_BY_HAND (ops/lib.sh) lists Archive, and no step of this script deletes it\. Nothing was destroyed' "$S/out" || true) $(grep -c '^   > ' "$S/out" || true) $(destroy_calls)"
CASE_ENV=FAKE_RUN_LATE=1 cycle_case destroy-late active ridge destroy.sh ridge
check "23: a run that starts after the workflows go off stops it before any delete, and the stop says the two are off and how to turn them on" "1 1 disabled_manually disabled_manually active 0 1" \
  "$RC $(grep -c '^== STOPPED: a workflow run is still in progress or queued' "$S/out" || true) $(wf_states) $(grep -cE 'terminate-instances|delete-volume|s3 rm|delete-stack' "$S/aws.calls" || true) $(grep -c '^-- This run stopped after the workflows (ci.yml and seed.yml) were switched off, and they are still off\..*ops/remake.sh ridge\.$' "$OPS_LOG_DIR"/*.log || true)"
CASE_ENV=FAKE_DELETE_DENIED=1 cycle_case destroy-denied active ridge destroy.sh ridge
check "  a command failing under set -e after the disable says so too, and AWS's words are kept" "nonzero 1 1" \
  "$([ "$RC" != 0 ] && echo nonzero || echo "$RC") $(grep -c 'AccessDenied' "$OPS_LOG_DIR"/*.log || true) $(grep -c '^-- This run stopped after the workflows (ci.yml and seed.yml) were switched off' "$OPS_LOG_DIR"/*.log || true)"
check "24: and the account id AWS quoted in that error is in neither the log nor the terminal" "0 0" \
  "$(grep -cF "$ACCT" "$OPS_LOG_DIR"/*.log || true) $(grep -cF "$ACCT" "$S/out" || true)"
check "  and a run that finished says nothing of the kind" 0 "$(cat "$E2E"/logs-destroy-whole/*.log | grep -c 'This run stopped after the workflows' || true)"
# unlisted_keepers <template json> <the destroy's list>: every resource a stack delete keeps, and every bucket, that the list lacks
unlisted_keepers() {
  jq -r --arg list "$2" '.Resources | to_entries[]
    | select((.value.DeletionPolicy // "" | IN("Retain", "RetainExceptOnCreate", "Snapshot")) or .value.Type == "AWS::S3::Bucket")
    | .key | select(. as $k | ($list | split(" ") | index($k)) == null)' "$1" | tr '\n' ' ' | sed 's/ $//'
}
BY_HAND_LIST=$DESTROY_BY_HAND
check "14: the template's keepers read as JSON are the box, the copy bucket, the records disk and the UI bucket (so the list below is read from something)" "Box CopyBucket RecordsVolume UiBucket" "$(unlisted_keepers "$WORK/env.json" "")"
check "  every env.yml resource a stack delete keeps, and every bucket, is in the destroy's list" "" "$(unlisted_keepers "$WORK/env.json" "$BY_HAND_LIST")"
jq '.Resources.ArchiveBucket = {Type: "AWS::S3::Bucket", DeletionPolicy: "Retain"} | .Resources.ArchiveVolume = {Type: "AWS::EC2::Volume", DeletionPolicy: "Snapshot"}' "$WORK/env.json" >"$WORK/env-more.json"
check "  and a template with one more retained bucket and one more snapshotted volume added names both" "ArchiveBucket ArchiveVolume" "$(unlisted_keepers "$WORK/env-more.json" "$BY_HAND_LIST")"

# a ridge that holds the copy: the stack also lists the copy bucket and the records disk, which the box has attached
FXC=$CYC/fx-copy
cp -R "$FX" "$FXC"
jq -c '.StackResourceSummaries += [{ResourceType: "AWS::S3::Bucket", LogicalResourceId: "CopyBucket", PhysicalResourceId: "ridge-copybucket-xyz", ResourceStatus: "CREATE_COMPLETE"}, {ResourceType: "AWS::EC2::Volume", LogicalResourceId: "RecordsVolume", PhysicalResourceId: "vol-0rec", ResourceStatus: "CREATE_COMPLETE"}]' "$FX/res.json" >"$FXC/res.json"
jq -c '. += ["AWS::EC2::Volume"]' "$FX/types.json" >"$FXC/types.json"
jq -c '.Reservations[0].Instances[0].BlockDeviceMappings += [{DeviceName: "/dev/sdf", Ebs: {VolumeId: "vol-0rec", DeleteOnTermination: false}}]' "$FX/box.json" >"$FXC/box.json"
CASE_FX=$FXC cycle_case destroy-copy active ridge destroy.sh ridge
check "8b: the destroy on a ridge that holds the copy: exit 0, then the order: the box, the root disk, the UI bucket's files, the copy bucket's files and the bucket, the stack" "0 wait instance-terminated,ec2 delete-volume,s3 rm,s3 rm,s3api delete-bucket,cloudformation delete-stack," \
  "$RC $(grep -oE -e 'wait instance-terminated|ec2 delete-volume|s3 rm|s3api delete-bucket|cloudformation delete-stack' "$S/aws.calls" | tr '\n' ',')"
check "  the records disk is never deleted by hand: only the root disk is, and the stack delete's snapshot of it is read back" "1 0 1" \
  "$(grep -c 'delete-volume --volume-id vol-0root' "$S/aws.calls" || true) $(grep -c 'delete-volume --volume-id vol-0rec' "$S/aws.calls" || true) $(grep -c '^   read back: the snapshot(s) of the records disk, kept until you delete them: snap-0stack$' "$S/out" || true)"
check "  the copy bucket's two deletes were counted against its two files, and it is read back as gone (after its delete, and again at the last read)" "1 2" \
  "$(grep -c '^   AWS reported 2 delete(s); 2 file(s) were counted before$' "$S/out" || true) $(grep -c '^   read back: bucket ridge-copybucket-xyz is gone$' "$S/out" || true)"
check "  and the words no longer say the records are one file on the root disk with no copy" "0 0" \
  "$(grep -c 'one SQLite file on the box.s root disk' "$S/out" || true) $(grep -c 'holds no backup and no copy job' "$S/out" || true)"
FXD=$CYC/fx-disks
cp -R "$FXC" "$FXD"
jq -c '.Reservations[0].Instances[0].BlockDeviceMappings += [{DeviceName: "/dev/sdg", Ebs: {VolumeId: "vol-0stray", DeleteOnTermination: false}}]' "$FXC/box.json" >"$FXD/box.json"
CASE_FX=$FXD cycle_case destroy-stray active ridge destroy.sh ridge
check "  a box with a disk beyond its root and the records disk is refused before the name is asked, nothing destroyed" "1 1 0 0" \
  "$RC $(grep -c '^== STOPPED: box i-0box has attached disks other than its root disk and the stack.s records disk (vol-0stray)' "$S/out" || true) $(grep -c '^   > ' "$S/out" || true) $(grep -cE 'terminate-instances|delete-volume|s3 rm|delete-bucket|delete-stack' "$S/aws.calls" || true)"
FXE=$CYC/fx-copyname
cp -R "$FXC" "$FXE"
jq -c '(.StackResourceSummaries[] | select(.LogicalResourceId == "CopyBucket") | .PhysicalResourceId) = "someone-elses-bucket"' "$FXC/res.json" >"$FXE/res.json"
CASE_FX=$FXE cycle_case destroy-copyname active ridge destroy.sh ridge
check "  a copy bucket not named as ridge's stack names it is refused before the name is asked, nothing destroyed" "1 1 0 0" \
  "$RC $(grep -c "^== STOPPED: the copy bucket is named 'someone-elses-bucket', not ridge-copybucket-<random>" "$S/out" || true) $(grep -c '^   > ' "$S/out" || true) $(grep -cE 'terminate-instances|delete-volume|s3 rm|delete-bucket|delete-stack' "$S/aws.calls" || true)"

cycle_run remake-whole disabled_manually '' remake.sh ridge
check "18: the remake on a stack that is down: exit 0, ending == green then == exit 0" "0 == green == exit 0" \
  "$RC $(tail -n 2 "$OPS_LOG_DIR"/*-remake-ridge.log | tr '\n' ' ' | sed 's/ $//')"
check "  it ran the stack, the release, the app and the check, in that order" "stack.sh env ridge,release.sh ridge,app.sh ridge,check.sh ridge," \
  "$(tr '\n' ',' <"$S/children.calls")"
check "  and turned the two workflows on, read back active, walks.yml untouched" "active active disabled_manually" \
  "$(cat "$S/wf.ci.yml") $(cat "$S/wf.seed.yml") $(cat "$S/wf.walks.yml")"
check "  its log holds its own lines only: four steps named with their logs, one == green, no child's line" "4 1 0" \
  "$(grep -c '^-- step [1-4]/5: ops/.* ended with exit 0; its log: .*-ridge.log$' "$OPS_LOG_DIR"/*-remake-ridge.log || true) $(grep -c '^== green$' "$OPS_LOG_DIR"/*-remake-ridge.log || true) $(grep -c 'stand-in' "$OPS_LOG_DIR"/*-remake-ridge.log || true)"

check "20: its closing says ridge holds no operator and no demo copy, and gives the operator's command as the next step" "1 1" \
  "$(grep -c '^== ridge is remade from main and checked. It is empty: it holds no operator and no demo copy.$' "$OPS_LOG_DIR"/*-remake-ridge.log || true) $(grep -cE '^ +cd .* && bash .*/ops/operator.sh ridge$' "$OPS_LOG_DIR"/*-remake-ridge.log || true)"
echo "== the remake's guards, each on its own case (rows 16, 17 and 19)"
remake_calls() { cat "$S/aws.calls" "$S/gh.calls" "$S/children.calls" 2>/dev/null | grep -cE 'stack.sh|release.sh|app.sh|check.sh|workflow enable|cloudformation|get-caller' || true; }
cycle_case remake-crest disabled_manually '' remake.sh crest
check "16: an environment but ridge is refused, in the script's words" "1 1" "$RC $(grep -c '^error: remake.sh remakes ridge alone' "$S/out" || true)"
check "  before any call, a child's or gh's or aws's" "0 gone gone" "$(remake_calls) $(file_state "$S/aws.calls") $(file_state "$S/gh.calls")"
CASE_ENV=FAKE_GH_OUT=1 cycle_case remake-nogh disabled_manually '' remake.sh ridge
check "17: gh not logged in is refused, saying so, before the first step" "1 1 0" "$RC $(grep -c '^error: gh is not logged in' "$S/out" || true) $(remake_calls)"
CASE_ENV=FAKE_BRU=3.0.0 cycle_case remake-nobru disabled_manually '' remake.sh ridge
check "  a Bruno CLI of another version is refused the same way" "1 1 0" "$RC $(grep -c '^error: needs Bruno CLI 4.2.0, found 3.0.0' "$S/out" || true) $(remake_calls)"
CASE_ENV=RIDGE_SCRIPTS_DIR= cycle_case remake-nopnpm disabled_manually '' remake.sh ridge
check "  pnpm install not done is refused the same way" "1 1 0" "$RC $(grep -c '^error: needs pnpm install done' "$S/out" || true) $(remake_calls)"
CASE_ENV=FAKE_RED=release cycle_case remake-red disabled_manually '' remake.sh ridge
check "19: a red at the release stops it there: the app and the check never ran" "1 stack.sh env ridge,release.sh ridge," "$RC $(tr '\n' ',' <"$S/children.calls")"
check "  the workflows stay off and none was enabled" "disabled_manually disabled_manually disabled_manually 0" "$(wf_states) $(cat "$S/gh.calls" 2>/dev/null | grep -c 'workflow enable' || true)"
check "  and the log's last two lines name the step, then the exit" "1 == exit 1" \
  "$(tail -n 2 "$OPS_LOG_DIR"/*-remake-ridge.log | grep -c '^== stopped at step 2/5, ops/release.sh (exit 1)' || true) $(tail -n 1 "$OPS_LOG_DIR"/*-remake-ridge.log)"
CASE_ENV=FAKE_ENABLE_FAIL=seed.yml cycle_case remake-enablefail disabled_manually '' remake.sh ridge
check "26: a gh enable that fails on seed.yml after ci.yml ends it on the stop line naming step 5 and the workflows, with ci.yml on and seed.yml off" "1 1 active disabled_manually" \
  "$RC $(tail -n 2 "$OPS_LOG_DIR"/*-remake-ridge.log | grep -c '^== stopped at step 5/5, the workflows: seed.yml: gh could not enable it' || true) $(cat "$S/wf.ci.yml") $(cat "$S/wf.seed.yml")"
check "  and the log ends on its exit" "== exit 1" "$(tail -n 1 "$OPS_LOG_DIR"/*-remake-ridge.log)"
check "27: the Bruno version is declared once, in lib.sh, and neither check.sh nor remake.sh sets its own" "1 0" \
  "$(grep -c '^WANT_BRUNO=' "$OPS_DIR/lib.sh") $(cat "$OPS_DIR/check.sh" "$OPS_DIR/remake.sh" | grep -c '^[[:space:]]*WANT_BRUNO=' || true)"

[ "$fail" = 0 ] || { echo "ops/test.sh: FAILURES"; exit 1; }
echo "ops/test.sh: all checks passed"
