#!/usr/bin/env bash
# ops/app.sh <env> [<sha>]
# Ships the BFF's bundle to <env>'s one function and the UI's files to its one bucket: code only, as
# the deploy role's rights go (docs/plans/2026-10-28-ridge-app.md#layer-four). The deploy job runs it
# after ops/release.sh, and so can the human while GitHub Actions is down, or after a key changed on the
# box (the function holds a copy of the BFF's keys, set again at every run).
#   In order: reads the keys from the box's files, and the front door's from the distribution, and masks them first; makes sure of the BFF's
#   service in c-storage, on each box the stack holds (the home box's, then the others' in turn, so STORAGE_BOXES can be written); sets the function's environment from a 0600 file that is deleted at once
#   (APP_ORIGIN is the app's address: a passkey is bound to it); then sends the bundle and compares the
#   function's CodeSha256 with the one sent; only then sets the function's description to the commit;
#   sends the UI's files, index.html last, with the commit in its metadata.
#   In the job: APP_BUNDLE (the bundle's index.js) and APP_UI_DIR (the UI's built folder) name what the
#   job built from the commit it runs on, before it took the role. By hand: builds <sha> (main's tip
#   when none) in a throwaway worktree, without the AWS session; a sha main lacks is refused.
#   Until the stack holds layer four (the plan's step 15) it ends 0, saying so, and sends nothing.
# Run from a worktree whose ops/ is origin/main's. Expected length: about 2 minutes in the job.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -ge 1 ] && [ $# -le 2 ] || {
  echo "usage: ops/app.sh <env> [<sha>]" >&2
  exit 2
}
ENVNAME=$1
STEPS=7
# Neither the local stack's port (3181), the check's (3191) nor the tunnel's (3192).
LOCAL_PORT=${APP_LOCAL_PORT:-3193}

log_start app "$ENVNAME"
mkwork
real_ok "$ENVNAME" "it ships main's commits alone, never backwards, and changes nothing else"

cleanup_extra() {
  rm -f "$WORK/bff-env.json"
  git -C "$REPO_DIR" worktree remove --force "$WORK/src" >/dev/null 2>&1 || true
}

step "the commit, which main must hold"
main_synced
if [ -n "${APP_BUNDLE:-}" ]; then
  [ -f "$APP_BUNDLE" ] || die "APP_BUNDLE $APP_BUNDLE does not exist"
  [ -f "${APP_UI_DIR:-}/index.html" ] || die "APP_UI_DIR holds no index.html"
  sha=$(git -C "$REPO_DIR" rev-parse HEAD)
else
  sha=$(git -C "$REPO_DIR" rev-parse --verify -q "${2:-origin/main}^{commit}") || die "'${2:-origin/main}' is not a commit"
fi
git -C "$REPO_DIR" merge-base --is-ancestor "$sha" origin/main || die "$sha is not a commit of main: only main is released"
echo "commit: $sha"

step "the stack's layer four"
stack_load "$ENVNAME"
[ -n "$STACK_JSON" ] || die "stack $ENVNAME does not exist"
if ! app_load; then
  echo "skipped: $ENVNAME's stack holds no layer four yet; nothing was sent (ops/stack.sh env $ENVNAME makes it)"
  exit 0
fi
ok "the function, its bucket and the app's address are named by the stack"

step "the bundle and the UI's files"
if [ -n "${APP_BUNDLE:-}" ]; then
  bundle=$APP_BUNDLE
  ui=$APP_UI_DIR
else
  echo "building $sha in a throwaway worktree, without the AWS session"
  git -C "$REPO_DIR" worktree add -q --detach "$WORK/src" "$sha"
  build_app "$WORK/src" "$sha"
  bundle=$WORK/src/bff/dist/index.js
  ui=$WORK/src/ui/dist/app
fi
[ -f "$bundle" ] || die "no bundle at $bundle"
[ -f "$ui/index.html" ] || die "the UI's folder holds no index.html"
# The Services status page compares the builds of the app, the BFF and c-storage: a bundle or a UI built
# without the commit would read "dev" on ridge for good, on either path (the job's or build_app's).
grep -qF -- "$sha" "$bundle" || die "the bundle carries no $sha: it was built without CREDO_BUILD"
grep -rqF --include='*.js' -- "$sha" "$ui" || die "the UI's scripts carry no $sha: it was built without CREDO_BUILD"
rm -f "$WORK/bff.zip"
# The handler is index.handler, so the file is index.js at the zip's top.
cp "$bundle" "$WORK/index.js"
(cd "$WORK" && zip -q -X bff.zip index.js)
want_code=$(openssl dgst -sha256 -binary "$WORK/bff.zip" | base64)
echo "bundle: $(wc -c <"$bundle" | tr -d ' ') bytes; UI: $(find "$ui" -type f | wc -l | tr -d ' ') files"

step "the tunnel to $ENVNAME's box, and what the function already runs"
refuse_taken_port "$LOCAL_PORT" "free it, or set APP_LOCAL_PORT"
box_open "$ENVNAME" "$LOCAL_PORT" || die "the box does not answer through the endpoint, or 127.0.0.1:$LOCAL_PORT could not be bound"
echo "box: $BOX_ID"
# ridge never moves backwards: a function that runs a commit with this one as a strict ancestor is left as it is
running_description() {
  printf '{"buildVersion":"%s"}' "$(aws lambda get-function-configuration --function-name "$BFF_NAME" --query Description --output text)"
}
if superseded "$ENVNAME" "$sha" running_description; then
  echo "nothing sent: $sha is behind what $ENVNAME runs"
  exit 0
fi

step "the keys, from the box's files"
read_keys
# bff.env is made once, as keys.env is: the BFF's service code, and a key for it, root's alone.
bff_env_make
bff_env_read
# The activity log's address and write key, from the box's own files (lib.sh's audit_read): refused by name before
# anything is sent when the box has none.
audit_read
# The door's key is read from the distribution, its one home, so the function's copy is what the door sends.
front_door_key_read "$DISTRIBUTION_ID"

step "the BFF's service in c-storage"
# The super-admin key reaches this one command's environment, and nothing the function holds.
registered=$(INTERNAL_ACCESS_KEY=$INTERNAL_KEY X_SUPER_ADMIN_KEY=$ADMIN_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY \
  C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT ridge_cli register) || die "the BFF's service could not be made sure of"
echo "$registered"
# The boxes the stack holds beyond the home box: each opened in turn, its service made sure of and its keys read, before
# anything of the function's is set, so one that does not answer stops the run with the function as it was. They are
# handed to the back end in STORAGE_BOXES, in the settings below.
other_boxes_read "$ENVNAME" "$LOCAL_PORT"
if [ -n "$STORAGE_BOXES_JSON" ]; then ok "the back end is handed $(jq -r 'keys | join(", ")' <<<"$STORAGE_BOXES_JSON") beside the home box"; fi

step "the BFF: settings, then code, then the description"
# Settings go first, so the new code never runs for a moment on the old environment. The environment
# goes in from a 0600 file, never a command line; the file is deleted at once (lib.sh's bff_settings_set, which
# the key script writes alike). The VPC settings are sent each time: the role may change settings only when it
# names the subnet and group.
bff_vpc=$(bff_vpc) # the same in both settings calls
bff_wait=$BFF_WAIT # seconds each of the function's three updates may take
bff_settings_set "$FRONT_DOOR_KEY"
ok "the function's environment is set, the file deleted"
aws lambda update-function-code --function-name "$BFF_NAME" --zip-file "fileb://$WORK/bff.zip" --query LastUpdateStatus --output text >/dev/null
lambda_wait "$BFF_NAME" "$bff_wait"
got_code=$(aws lambda get-function-configuration --function-name "$BFF_NAME" --query CodeSha256 --output text)
[ "$got_code" = "$want_code" ] || die "the function runs code of checksum $got_code, sent as $want_code"
ok "the function's CodeSha256 is the one sent"
# The description names the commit, and the seed and the never-backwards rule read it as the commit
# that runs: it is written only once the code is known to be there.
aws lambda update-function-configuration --function-name "$BFF_NAME" --description "$sha" \
  --vpc-config "$bff_vpc" --query LastUpdateStatus --output text >/dev/null
lambda_wait "$BFF_NAME" "$bff_wait"
ok "the function's description names the commit"

step "the UI's files, index.html last"
# Every file but index.html is named by its hash: kept a year. index.html is read again at each visit,
# and carries the commit, which the check reads back through CloudFront.
aws s3 cp "$ui/" "s3://$UI_BUCKET/" --recursive --exclude index.html \
  --cache-control 'public, max-age=31536000, immutable' --only-show-errors
aws s3 cp "$ui/index.html" "s3://$UI_BUCKET/index.html" \
  --cache-control no-cache --content-type 'text/html; charset=utf-8' --metadata "commit=$sha" --only-show-errors
echo "shipped $sha"
