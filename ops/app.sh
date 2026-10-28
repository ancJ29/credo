#!/usr/bin/env bash
# ops/app.sh <env> [<sha>]
# Ships the BFF's bundle to <env>'s one function and the UI's files to its one bucket: code only, as
# the deploy role's rights go (docs/plans/2026-10-28-ridge-app.md#layer-four). The deploy job runs it
# after ops/release.sh, and so can the human while GitHub Actions is down, or after a key changed on the
# box (the function holds a copy of the BFF's keys, set again at every run).
#   In order: reads the keys from the box's files and masks them first; makes sure of the BFF's
#   service in c-storage; sends the bundle and compares the function's CodeSha256 with the one sent;
#   sets the function's environment from a 0600 file that is deleted at once, and its description to
#   the commit; sends the UI's files, index.html last, with the commit in its metadata.
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
  (cd "$WORK/src" && clean pnpm install --frozen-lockfile && clean pnpm --filter @credo/bff bundle && clean pnpm --filter @credo/ui build)
  bundle=$WORK/src/bff/dist/index.js
  ui=$WORK/src/ui/dist/app
fi
[ -f "$bundle" ] || die "no bundle at $bundle"
[ -f "$ui/index.html" ] || die "the UI's folder holds no index.html"
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
box sudo bash -s <<'REMOTE'
set -euo pipefail
f=/etc/c-storage/bff.env
if [ -e "$f" ]; then
  echo "bff.env: present, left as it is"
else
  umask 077
  tmp=$(mktemp /etc/c-storage/.bff.XXXXXX)
  printf 'SERVICE_CODE=bff\nSERVICE_ACCESS_KEY=%s\n' "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" >"$tmp"
  chown root:root "$tmp"
  chmod 0600 "$tmp"
  mv "$tmp" "$f"
  echo "bff.env: made"
fi
stat -c 'bff.env: mode %a, owner %U' "$f"
REMOTE
bff_env_read
storage_url=http://$BOX_LISTEN_ADDR:$BOX_PORT

step "the BFF's service in c-storage"
# The super-admin key reaches this one command's environment, and nothing the function holds.
registered=$(INTERNAL_ACCESS_KEY=$INTERNAL_KEY X_SUPER_ADMIN_KEY=$ADMIN_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY \
  C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT ridge_cli register) || die "the BFF's service could not be made sure of"
echo "$registered"

step "the BFF: code, then settings"
aws lambda update-function-code --function-name "$BFF_NAME" --zip-file "fileb://$WORK/bff.zip" --query LastUpdateStatus --output text >/dev/null
lambda_wait "$BFF_NAME" 120
got_code=$(aws lambda get-function-configuration --function-name "$BFF_NAME" --query CodeSha256 --output text)
[ "$got_code" = "$want_code" ] || die "the function runs code of checksum $got_code, sent as $want_code"
ok "the function's CodeSha256 is the one sent"
# The environment goes in from a 0600 file, never a command line; the file is deleted at once. The VPC
# settings are sent each time: the role may change settings only when it names the subnet and group.
(
  umask 077
  INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=$storage_url \
    jq -n '{Variables: {C_STORAGE_URL: env.C_STORAGE_URL, INTERNAL_ACCESS_KEY: env.INTERNAL_ACCESS_KEY, SERVICE_CODE: env.SERVICE_CODE, SERVICE_ACCESS_KEY: env.SERVICE_ACCESS_KEY}}' \
    >"$WORK/bff-env.json"
)
aws lambda update-function-configuration --function-name "$BFF_NAME" --description "$sha" \
  --vpc-config "SubnetIds=$SUBNET_ID,SecurityGroupIds=$BFF_GROUP" --environment "file://$WORK/bff-env.json" \
  --query LastUpdateStatus --output text >/dev/null
rm -f "$WORK/bff-env.json"
lambda_wait "$BFF_NAME" 120
ok "the function's environment and description are set, the file deleted"

step "the UI's files, index.html last"
# Every file but index.html is named by its hash: kept a year. index.html is read again at each visit,
# and carries the commit, which the check reads back through CloudFront.
aws s3 cp "$ui/" "s3://$UI_BUCKET/" --recursive --exclude index.html \
  --cache-control 'public, max-age=31536000, immutable' --only-show-errors
aws s3 cp "$ui/index.html" "s3://$UI_BUCKET/index.html" \
  --cache-control no-cache --content-type 'text/html; charset=utf-8' --metadata "commit=$sha" --only-show-errors
echo "shipped $sha"
