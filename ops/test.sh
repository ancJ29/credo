#!/usr/bin/env bash
# The ops job's guards, run with no AWS, each on hand-written input: the change-set filter, the
# choice between creating and updating a stack, an update's refusal to move the repository, the
# deploy role's trust and the subject GitHub issues, the check that ops/ is main's (by hand, and in
# the deploy job), the box's floor, the keys' checksum, wait_build's retry, the proof of a Bruno run,
# the credentials bru never holds, the log's exit code after a signal, the workflow's deploy job,
# layer four's template (env.yml read as JSON through Ruby: rows 22, 25, 26, 29, 30 and 32 of
# docs/plans/2026-10-28-ridge-app.md, each with the template broken one way, and the CloudFront
# Function run under Node) and its change set, the shared helpers (the port, the forward that
# cannot bind, /health naming a commit of main, the keys file's mode), ops/tunnel.sh and check.sh's port refusal run whole on stand-ins for aws and
# ssh (every way the tunnel ends), and the release's checks of /health against the real c-storage
# binary, built here with several stamps and without one (it needs Go): the build it waits for, and
# the newer build it must never overwrite.
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

# trust_guard <template>: dies unless the deploy role's trust reads SubjectPrefix, not the repository
# shellcheck disable=SC2016 # the template's literal text
trust_guard() {
  grep -qxF -- '                token.actions.githubusercontent.com:sub: !Sub ${SubjectPrefix}:environment:${Env}' "$1" ||
    die "the trust's sub is not \${SubjectPrefix}:environment:\${Env}"
  ! grep -qF 'StringLike' "$1" || die "the trust uses StringLike, which takes wildcards"
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
awk '!done && /^ *StringEquals:$/ {sub(/StringEquals/, "StringLike"); done = 1} {print}' "$OPS_DIR/env.yml" >"$WORK/env-like.yml"
refuses "a trust that matches with StringLike is refused" "StringLike" trust_guard "$WORK/env-like.yml"
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
  want='cloudformation:DescribeStacks ec2-instance-connect:OpenTunnel ec2-instance-connect:SendSSHPublicKey ec2:DescribeInstanceConnectEndpoints ec2:DescribeInstances ec2:DescribeInternetGateways ec2:DescribeSecurityGroups ec2:DescribeSubnets ec2:DescribeVpcs ec2:GetSecurityGroupsForVpc lambda:GetFunctionConfiguration lambda:UpdateFunctionCode lambda:UpdateFunctionConfiguration s3:GetBucketPolicy s3:GetBucketPublicAccessBlock s3:PutObject '
  [ "$got" = "$want" ] || die "the deploy role's actions are not the wanted ones: $got"
  must "$1" "a lambda action reaches a function other than Bff" \
    '[.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action | tostring | contains("lambda:")) | .Resource] | all(. == {"Fn::GetAtt":["Bff","Arn"]})'
  must "$1" "an s3 action reaches a bucket other than UiBucket" \
    '[.Resources.DeployRole.Properties.Policies[0].PolicyDocument.Statement[] | select(.Action | tostring | contains("s3:")) | .Resource | tostring] | all(contains("UiBucket"))'
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

# box_port_guard <stack.sh>: dies unless the stack's parameters take BoxPort, for a creation and an update, from the unit's port
# shellcheck disable=SC2016 # jq programs and the template's text, in single quotes
box_port_guard() {
  [ "$(grep -c '^ *add_param BoxPort "\$BOX_PORT"$' "$1" || true)" = 1 ] || die "stack.sh does not pass BoxPort from the unit's port"
  grep -B2 '^ *add_param BoxPort' "$1" | grep -q '^ *add_param Env ' || die "BoxPort is not passed beside Env, on both paths"
}
passes "stack.sh passes BoxPort from the unit's port, on a creation and on an update" box_port_guard "$OPS_DIR/stack.sh"
grep -v 'add_param BoxPort' "$OPS_DIR/stack.sh" >"$WORK/stack-noport.sh"
refuses "  a stack.sh that forgets the port is refused" "does not pass BoxPort" box_port_guard "$WORK/stack-noport.sh"

echo "== the update on ridge adds layer four and modifies the deploy role in place (a change set as describe-change-set shows it)"
# adds_and_one_modify <change set> <template json>: dies unless every resource the template gained is an
# Add, the one Modify is DeployRole, in place, and the guard names nothing
adds_and_one_modify() {
  local seen gained old='Box BoxGroup DeployRole Subnet SubnetRoutes'
  seen=$(jq -r '[.Changes[].ResourceChange | select(.Action == "Add") | .LogicalResourceId] | sort | join(" ")' "$1")
  gained=$(jq -r --arg old "$old" '[.Resources | keys[] | select(. as $k | ($old | split(" ") | index($k)) | not)] | sort | join(" ")' "$2")
  [ "$seen" = "$gained" ] || die "the change set adds '$seen', the template gained '$gained'"
  seen=$(jq -r '[.Changes[].ResourceChange | select(.Action != "Add") | "\(.Action) \(.LogicalResourceId) \(.Replacement // "none")"] | join(",")' "$1")
  [ "$seen" = "Modify DeployRole False" ] || die "the change set's other changes are not a Modify of DeployRole in place: $seen"
  [ -z "$(jq -r --argjson take '[]' -f "$OPS_DIR/unsafe-changes.jq" "$1")" ] || die "the guard names a change in it"
}
passes "layer four's change set is adds and a Modify of DeployRole in place, and the guard passes" \
  adds_and_one_modify "$OPS_DIR/testdata/changeset-app.json" "$WORK/env.json"
refuses "  a template resource the change set lacks is refused" "the template gained" \
  adds_and_one_modify "$OPS_DIR/testdata/changeset-app.json" "$(mut '.Resources.Extra = {"Type":"AWS::SNS::Topic"}')"
refuses "  a box that would be replaced is not that update" "not a Modify of DeployRole in place" \
  adds_and_one_modify "$(jq -c '.Changes += [{"Type":"Resource","ResourceChange":{"Action":"Modify","LogicalResourceId":"Box","ResourceType":"AWS::EC2::Instance","Replacement":"True","Scope":["Properties"],"Details":[]}}]' "$OPS_DIR/testdata/changeset-app.json" >"$WORK/cs-box.json"; echo "$WORK/cs-box.json")" "$WORK/env.json"

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

# a scratch checkout for what writes into the Bruno collection's folder: the real ignore rule, copied
KR=$WORK/kr
mkdir -p "$KR/c-storage/bruno/environments"
git -C "$KR" init -q
cp "$REPO_DIR/c-storage/bruno/environments/.gitignore" "$KR/c-storage/bruno/environments/.gitignore"
ENVS=$KR/c-storage/bruno/environments
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

echo "== the workflow's deploy job (a push to main only, never under act, one at a time, the account id masked; the app's gate and ship: rows 28 and 34)"
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
  need "    if: github.event_name == 'push' && github.ref == 'refs/heads/main'"
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
  [ -n "$rel" ] && [ -n "$app" ] && [ -n "$chk" ] && [ "$rel" -lt "$app" ] && [ "$app" -lt "$chk" ] || missing="${missing}[release.sh, then app.sh, then check.sh] "
  # The builds (third-party code) run before the role is taken.
  role=$(grep -nF 'uses: aws-actions/configure-aws-credentials' <<<"$block" | head -n 1 | cut -d: -f1)
  bld=$(grep -nF 'pnpm --filter @credo/bff bundle' <<<"$block" | head -n 1 | cut -d: -f1)
  [ -n "$role" ] && [ -n "$bld" ] && [ "$bld" -lt "$role" ] || missing="${missing}[the app's build before the role is taken] "
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
sed 's#^        id: release$#        id: released#' "$WORKFLOW" >"$WORK/wf-id.yml"
refuses "  a release step the later steps cannot read is refused" "id: release" deploy_guards "$WORK/wf-id.yml"
awk '/Build the BFF.s bundle and the UI/ {skip = 1} skip && /^      # The arm64 binary/ {skip = 0} !skip' "$WORKFLOW" >"$WORK/wf-nobuild.yml"
refuses "  an app that is not built before the role is taken is refused" "the app's build before the role" deploy_guards "$WORK/wf-nobuild.yml"

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
  "$(sed -n 's/^  - name: //p' "$REPO_DIR/c-storage/bruno/environments/local.yml")" "$(sed -n 's/^  - name: //p' "$kenv")"
check "  with this run's port, keys, service code and access key" \
  "http://127.0.0.1:3192 internalkey0 adminkey0 tunnel-x accesskey0" \
  "$(awk '$1 == "value:" {printf "%s%s", sep, $2; sep = " "} END {print ""}' "$kenv" | sed 's/ sample-record$//')"
rm -f "$kenv"
printf 'the committed one\n' >"$ENVS/local.yml"
refuses "a path git does not ignore (the committed local.yml) is refused" "git does not ignore c-storage/bruno/environments/local.yml" \
  kr bruno_env_write "$ENVS/local.yml" 3192 tunnel-x accesskey0
check "  and the file it would have replaced is untouched" "the committed one" "$(cat "$ENVS/local.yml")"
rm -f "$ENVS/local.yml"
# Under act the worktree is copied into a container, and its .git file names a folder of the machine
# it came from: git reads nothing there, and every path would read as kept.
if git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  check "the real repository ignores ridge-tunnel.yml and ridge.yml, not local.yml" "ignored ignored kept" \
    "$(for n in ridge-tunnel ridge local; do if git -C "$REPO_DIR" check-ignore -q "c-storage/bruno/environments/$n.yml"; then printf 'ignored '; else printf 'kept '; fi; done | sed 's/ $//')"
else
  echo "  == skipped: the repository's .git cannot be read here (a worktree copied from another machine), so its ignore rule is not read; GitHub's run reads it"
fi
check "check.sh writes its environment through that writer alone" "1 0" \
  "$(grep -c 'bruno_env_write' "$OPS_DIR/check.sh" || true) $(grep -c 'cat >' "$OPS_DIR/check.sh" || true)"

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
check "a path git does not ignore: the run fails, naming it" "1 1" "$rc $(grep -c 'git does not ignore c-storage/bruno/environments/local.yml' "$WORK"/logs/*.log || true)"
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
mkdir -p "$E2E/fakebin" "$E2E/repo/c-storage/bruno/environments"
tport=$(free_port)
cport=$(free_port)
cp -R "$OPS_DIR" "$E2E/repo/ops"
cp "$REPO_DIR/c-storage/bruno/environments/.gitignore" "$E2E/repo/c-storage/bruno/environments/.gitignore"
echo 'info: {}' >"$E2E/repo/c-storage/bruno/opencollection.yml"
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
  *"send-ssh-public-key"*) echo True ;;
  *"lambda update-function-code"*)
    cp "$(arg_after --zip-file | sed 's#^fileb://##')" "$S/code.zip"
    openssl dgst -sha256 -binary "$S/code.zip" | base64 >"$S/code.sha"
    echo 1 >"$S/inprogress"
    echo Successful ;;
  *"lambda update-function-configuration"*)
    envfile=$(arg_after --environment | sed 's#^file://##')
    echo "$envfile" >"$S/envfile.path"
    python3 -I -c 'import os,sys; print(oct(os.stat(sys.argv[1]).st_mode & 0o777)[2:])' "$envfile" >"$S/envfile.mode"
    cp "$envfile" "$S/envfile.seen"
    arg_after --description >"$S/description"
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
esac
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
KEYS=$E2E/repo/c-storage/bruno/environments/ridge-tunnel.yml
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
mv "$E2E/repo/c-storage/bruno/environments/.gitignore" "$E2E/not-ignored.off"
e2e_run tunnel.sh ridge
mv "$E2E/not-ignored.off" "$E2E/repo/c-storage/bruno/environments/.gitignore"
check "a keys file git does not ignore stops the run" "1 1" "$RC $(grep -c '^error: git does not ignore c-storage/bruno/environments/ridge-tunnel.yml' "$OPS_LOG_DIR"/*.log || true)"
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

fn='{"VpcConfig":{"SubnetIds":["subnet-test"],"SecurityGroupIds":["sg-bff"]},"Description":"abc","Environment":{"Variables":{"C_STORAGE_URL":"u","INTERNAL_ACCESS_KEY":"k","SERVICE_CODE":"c","SERVICE_ACCESS_KEY":"a"}}}'
check "the function sits in ridge's subnet under the BFF's group alone" yes "$(function_network_verdict "$fn" subnet-test sg-bff)"
check "  another subnet is refused" no "$(function_network_verdict "$fn" subnet-other sg-bff)"
check "  a second group is refused" no "$(function_network_verdict "$(jq -c '.VpcConfig.SecurityGroupIds += ["sg-box"]' <<<"$fn")" subnet-test sg-bff)"
check "  a function out of the VPC is refused" no "$(function_network_verdict "$(jq -c '.VpcConfig = {SubnetIds: [], SecurityGroupIds: []}' <<<"$fn")" subnet-test sg-bff)"
check "the function holds the four variables" "$BFF_ENV_NAMES" "$(function_env_names "$fn")"
check "  and the super-admin key among them is seen" "C_STORAGE_URL,INTERNAL_ACCESS_KEY,SERVICE_ACCESS_KEY,SERVICE_CODE,X_SUPER_ADMIN_KEY" \
  "$(function_env_names "$(jq -c '.Environment.Variables.X_SUPER_ADMIN_KEY = "z"' <<<"$fn")")"
check "  a function with no environment is seen" "" "$(function_env_names '{}')"

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
    def reply(self, status, body=b'', ctype='application/json', cached=False):
        self.send_response(status)
        self.send_header('content-type', ctype)
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
        self.reply(404, b'{}')
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
cport_edge=$(free_port)
check "  an address that answers nothing is red, and the address is not in what is printed" "no" \
  "$( (REDS=''; edge_reads "http://127.0.0.1:$cport_edge" check-t x y 2>&1 | grep -c "127.0.0.1:$cport_edge" | sed 's/^0$/no/'))"

echo "== ops/app.sh run whole, on stand-ins for aws and ssh (rows 27, 28, 30, 31)"
FAKE_APP_PORT=$(free_port)
export FAKE_APP=http://127.0.0.1:$FAKE_APP_PORT FAKE_API=http://api-test-host.invalid:9
APP_LOCAL=$(free_port)
export APP_LOCAL_PORT=$APP_LOCAL
mkdir -p "$E2E/ui/assets"
echo 'exports.handler = async () => ({});' >"$E2E/index.js"
echo '<div id="root"></div>' >"$E2E/ui/index.html"
echo 'body{}' >"$E2E/ui/assets/index-abc123.css"
export APP_BUNDLE=$E2E/index.js APP_UI_DIR=$E2E/ui
app_sha=$e2e_sha
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
check "  the settings go first, then the code, then the UI's files with index.html last" yes \
  "$([ "$(line_of 'lambda update-function-configuration')" -lt "$(line_of 'lambda update-function-code')" ] &&
    [ "$(line_of 'lambda update-function-code')" -lt "$(line_of 's3 cp .*--exclude index.html')" ] &&
    [ "$(line_of 's3 cp .*--exclude index.html')" -lt "$(line_of 's3 cp .*index.html --cache-control no-cache')" ] && echo yes || echo no)"
check "  the zip holds the bundle as index.js, and its checksum was compared" "$(cksum <"$E2E/index.js")" "$(unzip -p "$S/code.zip" index.js | cksum)"
check "  the settings carry the commit as the description, and ridge's subnet and the BFF's group" "$app_sha subnet-test sg-0bff" \
  "$(cat "$S/description") $(sed -n 's/^SubnetIds=\([^,]*\),SecurityGroupIds=\(.*\)$/\1 \2/p' "$S/vpc")"
check "  the environment file was 0600 when aws read it, and is gone" "600 gone" "$(cat "$S/envfile.mode") $(file_state "$(cat "$S/envfile.path")")"
check "  and it was gone by the next aws call, not left until the run's end" gone "$(file_state "$S/envfile.kept")"
check "  it names the four variables, and the super-admin key is not among them" "C_STORAGE_URL,INTERNAL_ACCESS_KEY,SERVICE_ACCESS_KEY,SERVICE_CODE 0" \
  "$(jq -r '.Variables | keys | join(",")' "$S/envfile.seen") $(grep -c "$FAKE_AKEY" "$S/envfile.seen" || true)"
check "  and holds the box's private address for c-storage" "http://10.20.30.40:$BOX_PORT" "$(jq -r .Variables.C_STORAGE_URL "$S/envfile.seen")"
check "  the UI's files other than index.html are kept a year, index.html is read again with the commit in its metadata" "1 1 1" \
  "$(grep -c "immutable" "$S/aws.calls" || true) $(grep -c "index.html --cache-control no-cache.*--metadata commit=$app_sha" "$S/aws.calls" || true) $(grep -c 's3://ui-test-bucket/ --recursive' "$S/aws.calls" || true)"
check "  no key is in the log or on the terminal, apart from GitHub's mask lines" "0 0" "$(cat "$OPS_LOG_DIR"/*.log | grep -cE "$FAKE_IKEY|$FAKE_AKEY|$FAKE_SKEY" || true) $(grep -vE '^::add-mask::' "$S/out" | grep -cE "$FAKE_IKEY|$FAKE_AKEY|$FAKE_SKEY" || true)" 
check "  each key was masked first" 3 "$(grep -cE "^::add-mask::($FAKE_IKEY|$FAKE_AKEY|$FAKE_SKEY)\$" "$S/out" || true)"
check "  the app's address and the API's are masked, and print nowhere" "1 1 0" \
  "$(grep -cF "::add-mask::$FAKE_APP" "$S/out" || true) $(grep -cF "::add-mask::api-test-host.invalid:9" "$S/out" || true) $(cat "$OPS_LOG_DIR"/*.log | grep -cE "127.0.0.1:$FAKE_APP_PORT|api-test-host" || true)"
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

echo "== ops/operator.sh (row 19: the operator's first password is shown on the terminal and in no log)"
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
check "the BFF's service exists on the box, for the operator's account to be written with it" 0 "$RC"
export OPS_LOG_DIR=$E2E/logs-operator-pty
pty_run operator.sh ridge
pw=$(sed -n 's/^.*the operator is operator, first password \([A-Za-z0-9_-]*\).*$/\1/p' "$S/out" | tr -d '\r' | head -n 1)
check "the operator is made, and its first password shown on the terminal once" "0 16 1" \
  "$RC ${#pw} $(grep -c "first password $pw" "$S/out" || true)"
check "  the log holds the account made and no password" "1 0" \
  "$(grep -c '^operator operator made' "$OPS_LOG_DIR"/*.log || true) $(cat "$OPS_LOG_DIR"/*.log | grep -cF -e "$pw" || true)"
check "  and the log's search for it ran" 1 "$(grep -c '^ok   no key in this log' "$OPS_LOG_DIR"/*.log || true)"
export OPS_LOG_DIR=$E2E/logs-operator-pty2
pty_run operator.sh ridge
check "a second run refuses to make it over, and shows no password" "1 0" \
  "$RC $(grep -c 'first password' "$S/out" || true)"
export OPS_LOG_DIR=$E2E/logs-operator-pty3
pty_run operator.sh ridge --replace
pw2=$(sed -n 's/^.*first password \([A-Za-z0-9_-]*\).*$/\1/p' "$S/out" | tr -d '\r' | head -n 1)
check "--replace gives a new password" "0 yes" "$RC $([ -n "$pw2" ] && [ "$pw2" != "$pw" ] && echo yes || echo no)"
export OPS_LOG_DIR=$E2E/logs-operator-pipe
e2e_run operator.sh ridge
check "without a terminal it refuses, and writes no account" "1 1 0" \
  "$RC $(grep -c 'needs a terminal to show the password on' "$OPS_LOG_DIR"/*.log || true) $(grep -c 'first password' "$S/out" || true)"
rc=0
out=$(GITHUB_ACTIONS=true bash "$E2E/repo/ops/operator.sh" ridge 2>&1) || rc=$?
check "in GitHub's job it refuses before anything else" "1 1" "$rc $(grep -c "never in a job's log" <<<"$out" || true)"

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
  *"wait change-set-create-complete"*) exit 255 ;;
  *describe-change-set*) echo "The submitted information didn't contain changes. Submit different information to create a change set." ;;
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

unset FAKE_LAYER4 APP_LOCAL_PORT APP_BUNDLE APP_UI_DIR

[ "$fail" = 0 ] || { echo "ops/test.sh: FAILURES"; exit 1; }
echo "ops/test.sh: all checks passed"
