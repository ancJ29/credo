#!/bin/bash
# ops/walks-preview.sh [built-folder]
# Puts a locally built walks page on Cloudflare Pages as a PREVIEW deploy at the branch its own build line names
# (walks.json, "build":{"branch":…}), never production. Main and the project's production branch are refused.
# Production stays what CI builds from main. Runs from any worktree.
#
# Usage: ops/walks-preview.sh [built-folder]  (default: the newest folder under walks/ in the credo root whose name
#   does not end in -changes; the credo root is derived from git)
# Set first, as the workflow's deploy job does (names only here, values are yours, never read aloud or logged):
#   CLOUDFLARE_PAGES_PROJECT   the Pages project's name (the workflow's secret of that name)
#   CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID   the workflow's pair; or a wrangler login (wrangler login) instead of both
#   CLOUDFLARE_PAGES_PRODUCTION_BRANCH   only when the project's production branch is not main
#
# What it does, in order:
#   1 refusals (each "== refused: <why>", exit 2, nothing done): the folder is missing or has no index.html; the page's own
#     build line is unreadable or names main or the production branch; the project's name or the credential is
#     absent (named, no value printed); no node 26, npm, curl or jq; the preview address answers a visitor instead of
#     refusing (an address that does not exist yet is said so, and step 3 checks it).
#   2 deploy: wrangler 4.151.0 (pinned as in the workflow, installed into a temp folder) pages deploy of that folder,
#     --branch <the build line's branch>. Prints the deployment's own address and the branch alias address.
#   3 after the upload: both addresses must refuse a visitor without Access (a redirect to cloudflareaccess.com, as
#     ops/walks-refused.sh judges it). If one answers the page: a loud FAIL line and the one command that takes it down.
#   4 a verdict line naming every failure, then "== done". Exit: 0 good, 1 a failure, 2 refused.
# What it changes: ONE preview deployment on Cloudflare Pages; the logs folder; a temp folder (removed). Nothing in git,
#   any worktree, or production.
# The two addresses are printed on this terminal only (the log masks Pages names; the project's name stays out of it).
# Look for: "== deployed", the two addresses, "refused: a redirect to Access's sign-in" twice, "== verdict: good", "== done".
# Expected length: about 1 to 2 minutes (wrangler install ~20 s, upload ~10-30 s, the checks seconds).
set -uo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
stem=walks-preview
root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
logdir="${OPS_LOG_DIR:-$root/logs}"
log="$logdir/$(date +%Y%m%d-%H%M)-$stem.log"
wrangler_ver=4.151.0
wrangler_before=2026-10-14T05:50:43.466Z

mkdir -p "$logdir" 2>/dev/null || {
  echo "== refused: cannot make the logs folder"
  exit 2
}
exec > >(tee -ai "$log") 2>&1

# The mask: every wrangler/curl line passes it before the screen or the log. Every 32-hex id (an account id), Pages names,
# token-like strings (long base64/hex/underscore runs, Bearer values), and key/secret/token/password values.
mask() {
  LC_ALL=C sed -l -E \
    -e 's/[0-9a-fA-F]{32}/<id32>/g' \
    -e 's/(Bearer|bearer) +[A-Za-z0-9._~+\/=-]+/\1 <masked>/g' \
    -e 's/(gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/<token>/g' \
    -e 's/[A-Za-z0-9_-]{40,}/<token>/g' \
    -e 's/[A-Za-z0-9-]+\.[A-Za-z0-9-]+\.pages\.dev/<deploy>.<project>.pages.dev/g' \
    -e 's/[A-Za-z0-9-]+\.pages\.dev/<project>.pages.dev/g' \
    -e 's/([Kk][Ee][Yy]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Tt][Oo][Kk][Ee][Nn]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd])([A-Za-z_]*)(["'\'']? *[=:] *)("[^"]*"|[^ ]+)/\1\2\3<masked>/g'
}
say() { echo "== $*"; }
refuse() {
  echo "== refused: $1"
  exit 2
}
# Shown on the terminal only (never in the log).
tty_line() { { echo "$*" >/dev/tty; } 2>/dev/null || echo "  (no terminal to show it on)"; }

say "$stem — $(date '+%Y-%m-%d %H:%M:%S %z')"

# The script's own inputs, unset first; the credential names are read from the environment AFTER this, so they are kept.
tok="${CLOUDFLARE_API_TOKEN:-}"
acct="${CLOUDFLARE_ACCOUNT_ID:-}"
project="${CLOUDFLARE_PAGES_PROJECT:-}"
prod_branch="${CLOUDFLARE_PAGES_PRODUCTION_BRANCH:-main}"
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_PAGES_PROJECT CLOUDFLARE_PAGES_PRODUCTION_BRANCH CLOUDFLARE_API_KEY CLOUDFLARE_EMAIL \
  CLOUDFLARE_ENV WRANGLER_LOG WRANGLER_SEND_METRICS NODE_OPTIONS NPM_CONFIG_PREFIX NPM_CONFIG_USERCONFIG

# ---- 1 refusals ----
folder="${1:-}"
if [ -z "$folder" ]; then
  # shellcheck disable=SC2010  # a built folder's name is a stamp and a commit, never odd characters
  folder=$(ls -dt "$root"/walks/*/ 2>/dev/null | grep -v -- '-changes/$' | head -n 1)
  folder="${folder%/}"
fi
[ -n "$folder" ] && [ -d "$folder" ] || refuse "no built folder (none under $root/walks/, or the argument is not a folder)"
[ -f "$folder/index.html" ] || refuse "$folder has no index.html"
say "folder: $(basename "$folder")"

# The build line sits in the page's data as "build":{"branch":"<b>","commit":"<c>","changed":<bool>...}.
bline=$(grep -o '"build":{"branch":"[^"]*","commit":"[^"]*","changed":[a-z]*' "$folder/index.html" | head -n 1)
branch=$(printf '%s' "$bline" | sed -n 's/.*"branch":"\([^"]*\)".*/\1/p')
pcommit=$(printf '%s' "$bline" | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p')
[ -n "$branch" ] || refuse "the page's build line is not readable in $folder/index.html"
case "$branch" in *[!A-Za-z0-9._/-]*) refuse "the build line's branch has characters a branch name does not" ;; esac
[ "$branch" != main ] || refuse "the build line names main: a preview is never main's"
[ "$branch" != "$prod_branch" ] || refuse "the build line names the production branch ($prod_branch)"
case "$bline" in *'"changed":true'*) say "note: the page was built with uncommitted changes" ;; esac
say "build line: branch $branch, commit $pcommit"

[ -n "$project" ] || refuse "CLOUDFLARE_PAGES_PROJECT is not set (the Pages project's name)"
if [ -n "$tok" ] && [ -n "$acct" ]; then
  say "credential: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are set (not shown)"
elif [ -n "$tok" ] || [ -n "$acct" ]; then
  refuse "only one of CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID is set: set both, or neither and use wrangler login"
elif [ -s "$HOME/Library/Preferences/.wrangler/config/default.toml" ] || [ -s "$HOME/.wrangler/config/default.toml" ]; then
  say "credential: no token variables; wrangler's own login file is there (not read)"
else
  refuse "no Cloudflare credential: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or run wrangler login"
fi
for c in node npm curl jq; do command -v "$c" >/dev/null 2>&1 || refuse "$c is not on the PATH"; done
[ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" = 26 ] || refuse "node on the PATH is not v26 (the workflow's)"

# probe <url>: 0 refused as Access refuses (a redirect to *.cloudflareaccess.com), 1 answers or redirects elsewhere,
# 3 nothing there (no answer, or 404), as ops/walks-refused.sh judges it. Prints the status only, never the address.
probe() {
  local out code location host
  out=$(curl -sS -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "$1" 2>/dev/null) || {
    echo "  no answer from the address"
    return 3
  }
  code=${out%% *}
  location=${out#* }
  host=${location#*://}
  host=${host%%/*}
  host=${host%%:*}
  case "$code" in
    404 | 000)
      echo "  the address gave $code: nothing there yet"
      return 3
      ;;
    30[1278]) ;;
    *)
      echo "  an anonymous fetch was answered $code, not refused"
      return 1
      ;;
  esac
  case "$host" in
    ?*.cloudflareaccess.com)
      echo "  refused: a redirect to Access's sign-in"
      return 0
      ;;
    *)
      echo "  an anonymous fetch was redirected ($code), but not to Access's sign-in"
      return 1
      ;;
  esac
}

# Pages' alias label for a branch: lower case, anything but a letter or digit a dash, at most 28 characters.
label=$(printf '%s' "$branch" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9]/-/g' | cut -c1-28 | sed -e 's/-*$//')
alias_url="https://$label.$project.pages.dev/"
say "before: the preview address refuses a visitor"
probe "$alias_url"
rc=$?
case "$rc" in
  0) ;;
  3) say "the preview address does not exist yet; step 3 checks it after the upload" ;;
  *) refuse "the preview address answers a visitor without Access (turn Access on for previews in the project first)" ;;
esac

# ---- 2 deploy ----
work=$(mktemp -d "${TMPDIR:-/tmp}/walks-preview.XXXXXX") || refuse "cannot make a temp folder"
trap 'rm -rf "$work"' EXIT
say "2/4 install wrangler $wrangler_ver into a temp folder"
npm install --prefix "$work/wrangler" --ignore-scripts --no-audit --no-fund --before="$wrangler_before" "wrangler@$wrangler_ver" 2>&1 | mask
[ -x "$work/wrangler/node_modules/.bin/wrangler" ] || {
  say "verdict: bad: wrangler did not install"
  say "done"
  exit 1
}
wr="$work/wrangler/node_modules/.bin/wrangler"

# The credential goes to wrangler through its environment only: never read, echoed or put on a command line.
if [ -n "$tok" ]; then
  export CLOUDFLARE_API_TOKEN="$tok" CLOUDFLARE_ACCOUNT_ID="$acct"
fi
unset tok acct
export WRANGLER_SEND_METRICS=false CI=1

failures=""
say "2/4 deploy $(basename "$folder") to the project, branch $branch"
"$wr" pages deploy "$folder" --project-name "$project" --branch "$branch" --commit-hash "${pcommit:-unknown}" --commit-dirty=true \
  >"$work/deploy.out" 2>&1
drc=$?
mask <"$work/deploy.out"
if [ "$drc" -ne 0 ]; then
  say "verdict: bad: wrangler pages deploy exited $drc (nothing deployed, or not known to be)"
  say "done"
  exit 1
fi
dep_url=$(grep -o 'https://[A-Za-z0-9-]*\.[A-Za-z0-9-]*\.pages\.dev' "$work/deploy.out" | grep -v "^https://$label\." | head -n 1)
[ -n "$dep_url" ] || dep_url=$(grep -o 'https://[A-Za-z0-9-]*\.[A-Za-z0-9-]*\.pages\.dev' "$work/deploy.out" | head -n 1)
say "deployed"
tty_line "  deployment address: ${dep_url:-not found}"
tty_line "  branch alias address: ${alias_url%/}"
echo "  (both addresses shown on the terminal only)"
[ -n "$dep_url" ] || failures="$failures; the deployment's address was not found in wrangler's output"

# The deployment's id, for the take-down command: the newest preview deploy on this branch.
depid=$("$wr" pages deployment list --project-name "$project" --environment preview --json 2>/dev/null |
  jq -r --arg b "$branch" '[.[] | select((.Branch // "") == $b)][0].Id // empty' 2>/dev/null)
case "$depid" in *[!0-9a-fA-F-]*) depid="" ;; esac

# ---- 3 after the upload ----
say "3/4 both addresses refuse a visitor"
bad=""
for u in "${dep_url:+$dep_url/}" "$alias_url"; do
  [ -n "$u" ] || continue
  # An Access policy may take a few seconds to cover a new deployment: one retry after 10 s.
  probe "$u" >"$work/p.out"
  prc=$?
  if [ "$prc" -ne 0 ]; then
    sleep 10
    probe "$u" >"$work/p.out"
    prc=$?
  fi
  cat "$work/p.out"
  if [ "$prc" -ne 0 ]; then
    bad="$bad $u"
    echo "!!!! FAIL: an address ANSWERS the page without Access (or does not refuse as Access does) !!!!"
    tty_line "!!!! FAIL: $u"
    failures="$failures; an address does not refuse a visitor"
  fi
done
if [ -n "$bad" ]; then
  echo "!!!! Take the deployment down with this command (shown on the terminal; it holds the project's name):"
  if [ -n "$depid" ]; then
    tty_line "  CI=1 $wr pages deployment delete $depid --project-name $project --force"
  else
    tty_line "  CI=1 $wr pages deployment list --project-name $project --environment preview   (find its id), then"
    tty_line "  CI=1 $wr pages deployment delete <id> --project-name $project --force"
  fi
  tty_line "  (the wrangler path above is a temp folder removed at exit: install again with npx wrangler@$wrangler_ver, same arguments)"
fi

# ---- 4 finish ----
say "4/4 finish"
if [ -z "$failures" ]; then
  say "verdict: good: preview deployed at branch $branch, both addresses refuse a visitor"
  say "done"
  exit 0
fi
say "verdict: bad:${failures#;}"
say "done"
exit 1
