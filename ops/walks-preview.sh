#!/bin/bash
# ops/walks-preview.sh [built-folder]
# Puts a locally built walks page on Cloudflare Pages as a PREVIEW deploy at the branch its own build line names
# (walks.json, "build":{"branch":…}), never production. Main and the project's production branch are refused.
# Production stays what CI builds from main. Runs from any worktree. The deploy itself is ops/pages-preview.sh's.
#
# Usage: ops/walks-preview.sh [built-folder]  (default: the newest folder under walks/ in the credo root whose name
#   does not end in -changes; the credo root is derived from git)
# Set first, as the workflow's deploy job does (names only here, values are yours, never read aloud or logged):
#   CLOUDFLARE_PAGES_PROJECT   the Pages project's name (the workflow's secret of that name)
#   CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID   the workflow's pair; or a wrangler login (wrangler login) instead of both
#   CLOUDFLARE_PAGES_PRODUCTION_BRANCH   only when the project's production branch is not main
#
# What it does: the walks-only checks below (each "== refused: <why>", exit 2), then ops/pages-preview.sh --folder <it> --branch <the
#   build line's branch>, which refuses the rest (project, credential, tools, production branch, an open address), deploys, probes
#   and gives the verdict: see its header. Log: logs/<YYYYMMDD-HHMM>-walks-preview.log in the credo root.
#   Walks-only refusals: the folder is missing or has no index.html; the page's own build line is unreadable or names main.
# Look for: "== deployed", the two addresses, "refused: a redirect to Access's sign-in" twice, "== verdict: good", "== done".
set -uo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
refuse() {
  echo "== refused: $1"
  exit 2
}

folder="${1:-}"
if [ -z "$folder" ]; then
  # shellcheck disable=SC2010  # a built folder's name is a stamp and a commit, never odd characters
  folder=$(ls -dt "$root"/walks/*/ 2>/dev/null | grep -v -- '-changes/$' | head -n 1)
  folder="${folder%/}"
fi
[ -n "$folder" ] && [ -d "$folder" ] || refuse "no built folder (none under $root/walks/, or the argument is not a folder)"
[ -f "$folder/index.html" ] || refuse "$folder has no index.html"

# The build line sits in the page's data as "build":{"branch":"<b>","commit":"<c>","changed":<bool>...}.
bline=$(grep -o '"build":{"branch":"[^"]*","commit":"[^"]*","changed":[a-z]*' "$folder/index.html" | head -n 1)
branch=$(printf '%s' "$bline" | sed -n 's/.*"branch":"\([^"]*\)".*/\1/p')
pcommit=$(printf '%s' "$bline" | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p')
[ -n "$branch" ] || refuse "the page's build line is not readable in $folder/index.html"
[ "$branch" != main ] || refuse "the build line names main: a preview is never main's"
case "$bline" in *'"changed":true'*) echo "== note: the page was built with uncommitted changes" ;; esac
echo "== build line: branch $branch, commit $pcommit"

exec bash "$OPS_DIR/pages-preview.sh" --folder "$folder" --branch "$branch" --commit "$pcommit" --stem walks-preview
