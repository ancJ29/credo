#!/usr/bin/env bash
# ops/seed.sh <env>
# Brings every demo copy that exists on <env> up to yesterday: the first fill of a fresh copy, then
# each missed day, through the BFF's own code run here over a tunnel (scripts/src/demo/apply.ts,
# by ridge_cli seed), so every rule of the product holds and each event is stamped on its own day.
# It makes no client and no password: the human makes each copy at /operator (docs/plans/2026-10-29-demo-seed.md).
#   In order: main and this commit; the stack; the tunnel; the box's disk, memory and swap, which
#   must be above the release's floor; /health, which must name this very commit, since records
#   written by one commit's code are read by another's BFF; then the seed, with the keys read from
#   the box and masked first. Nothing is written before /health has passed.
# Runs each morning in GitHub's job (.github/workflows/seed.yml), and by hand from a worktree at main
# while Actions is down, or for a copy just made. Needs pnpm install done and layer four.
# Ridge alone: a client's stack must never receive demo data. Expected length: about a minute, a few
# minutes for a first fill of six copies.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ $# -eq 1 ] || {
  echo "usage: ops/seed.sh <env>" >&2
  exit 2
}
ENVNAME=$1
STEPS=5
# Neither the local stack's port (3181), the check's (3191), the tunnel's (3192), the deploy's
# (3193) nor the operator's (3194).
LOCAL_PORT=${SEED_LOCAL_PORT:-3195}

log_start seed "$ENVNAME"
mkwork

step "ridge alone, main, and this commit"
[ "$ENVNAME" = ridge ] || die "seed.sh seeds ridge alone: a client's stack must never receive demo data"
main_synced
sha=$(git -C "$REPO_DIR" rev-parse HEAD)
git -C "$REPO_DIR" merge-base --is-ancestor "$sha" origin/main || die "$sha is not a commit of main: only main is seeded"
# The seed runs the code in this tree, so this tree must be the commit /health is asked to name.
git -C "$REPO_DIR" diff --quiet HEAD || die "this tree differs from $sha: the seed would run code /health cannot name"
command -v node >/dev/null || die "needs node on PATH, with pnpm install done"
[ -d "$REPO_DIR/scripts/node_modules" ] || [ -n "${RIDGE_SCRIPTS_DIR:-}" ] || die "needs pnpm install done, for the seed's code"
echo "commit: $sha"

step "the stack, and the tunnel"
stack_load "$ENVNAME"
[ -n "$STACK_JSON" ] || die "stack $ENVNAME does not exist"
app_load || die "$ENVNAME's stack holds no layer four yet: ops/stack.sh env $ENVNAME first"
refuse_taken_port "$LOCAL_PORT" "free it, or set SEED_LOCAL_PORT"
box_open "$ENVNAME" "$LOCAL_PORT" || die "the box does not answer through the endpoint, or 127.0.0.1:$LOCAL_PORT could not be bound"

step "the box's disk, memory and swap, read first"
box_floor

step "/health names this commit"
body=$(curl -fsS -m 5 "http://127.0.0.1:$LOCAL_PORT/health" || true)
running=$(build_of "$body")
[ -n "$running" ] && [ "$running" != dev ] || die "/health names no commit (answered: ${body:-nothing}): nothing was written"
[ "$running" = "$sha" ] || die "/health names $running, not $sha: nothing was written; the seed runs when ridge runs this commit"
ok "/health names $sha"

step "the seed"
read_keys
box test -e /etc/c-storage/bff.env || die "the box holds no bff.env: the first app deploy makes the BFF's service (ops/app.sh $ENVNAME)"
bff_env_read
INTERNAL_ACCESS_KEY=$INTERNAL_KEY SERVICE_CODE=$SERVICE_CODE SERVICE_ACCESS_KEY=$SERVICE_ACCESS_KEY C_STORAGE_URL=http://127.0.0.1:$LOCAL_PORT \
  ridge_cli seed || die "the seed stopped: the lines above name the copy and why"
echo "seeded $sha"
