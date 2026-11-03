#!/bin/bash
# ops/pages-preview.sh (--folder <dir> | --worktree <dir> --sub <path>) --branch <preview-branch> [--commit <sha>] [--stem <log-name>]
# The one body of every Cloudflare Pages PREVIEW deploy: sends a static folder to the project as a preview at a branch,
# never production, and checks that the preview's two addresses refuse a visitor without Access. Called by
# ops/walks-preview.sh (the walks page) and by hand (any worktree's committed folder). Runs from any worktree.
#
# Parameters (the shape of the two cases):
#   --folder <dir>      a folder on disk, sent as it is (such as a built walks page); it needs an index.html
#   --worktree <dir> --sub <path>   a worktree's folder <path> as committed at its HEAD, sent by git archive; a dirty
#                       tree is refused; uncommitted files are not sent. Exactly one of --folder and --worktree.
#   --branch <name>     the preview branch (its alias address is <branch>.<project>.pages.dev); never the production branch
#   --commit <sha>      the commit shown on the deployment; --worktree takes it from the HEAD (default for --folder: unknown)
#   --stem <name>       the log's name, logs/<YYYYMMDD-HHMM>-<stem>.log in the credo root (default pages-preview)
# Set first (names only here, values are yours, never read aloud or logged):
#   CLOUDFLARE_PAGES_PROJECT   the Pages project's name
#   CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID   the workflow's pair; or a wrangler login (wrangler login) instead of both
#   CLOUDFLARE_PAGES_PRODUCTION_BRANCH   only when the project's production branch is not main
#
# What it does, in order:
#   1 refusals (each "== refused: <why>", exit 2, nothing deployed): a bad or missing parameter; the folder or its
#     index.html is missing; the worktree is dirty or lacks <path>/index.html at HEAD; the project's name or the credential is
#     absent (named, no value printed); the branch equals the production branch; no node 26, npm, curl, jq or tar; the
#     preview address answers a visitor instead of refusing; then, with wrangler installed, the project named is not in the
#     account these credentials reach (a read of wrangler's project list, never its "create it?" question).
#   2 deploy: wrangler 4.151.0 (pinned as in the workflow, installed into a temp folder) pages deploy of the folder at
#     --branch. The two addresses are printed on this terminal only (the log masks Pages names).
#   3 after the upload: both addresses must refuse a visitor (a redirect to cloudflareaccess.com, as ops/walks-refused.sh
#     judges it). If one answers the page: a loud FAIL line and the command that takes it down.
#   4 a verdict line naming every failure, then "== done". Exit: 0 good, 1 a failure, 2 refused.
# What it changes: ONE preview deployment on Cloudflare Pages; the logs folder; a temp folder (removed). Nothing in git,
#   any worktree (a worktree is only read), or production.
# Look for: "== project found", "== deployed", the two addresses, "refused: a redirect to Access's sign-in" twice,
#   "== verdict: good", "== done". Expected length: about 1 to 2 minutes.
set -uo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
logdir="${OPS_LOG_DIR:-$root/logs}"
wrangler_ver=4.151.0
wrangler_before=2026-10-14T05:50:43.466Z

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

folder='' tree='' sub='' branch='' pcommit='' stem=pages-preview
while [ $# -gt 0 ]; do
  case "$1" in
    --folder | --worktree | --sub | --branch | --commit | --stem)
      [ $# -ge 2 ] || refuse "$1 needs a value"
      case "$1" in
        --folder) folder=$2 ;;
        --worktree) tree=$2 ;;
        --sub) sub=$2 ;;
        --branch) branch=$2 ;;
        --commit) pcommit=$2 ;;
        --stem) stem=$2 ;;
      esac
      shift 2
      ;;
    *) refuse "unknown parameter $1 (see the top of ops/pages-preview.sh)" ;;
  esac
done
case "$stem" in '' | *[!A-Za-z0-9._-]*) refuse "--stem has characters a file name should not" ;; esac
log="$logdir/$(date +%Y%m%d-%H%M)-$stem.log"
mkdir -p "$logdir" 2>/dev/null || refuse "cannot make the logs folder"
exec > >(tee -ai "$log") 2>&1

say "$stem — $(date '+%Y-%m-%d %H:%M:%S %z')"

# The script's own inputs, unset first; the credential names are read from the environment AFTER this, so they are kept.
tok="${CLOUDFLARE_API_TOKEN:-}"
acct="${CLOUDFLARE_ACCOUNT_ID:-}"
project="${CLOUDFLARE_PAGES_PROJECT:-}"
prod_branch="${CLOUDFLARE_PAGES_PRODUCTION_BRANCH:-main}"
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_PAGES_PROJECT CLOUDFLARE_PAGES_PRODUCTION_BRANCH \
  CLOUDFLARE_API_KEY CLOUDFLARE_EMAIL CLOUDFLARE_ENV WRANGLER_LOG WRANGLER_SEND_METRICS NODE_OPTIONS \
  NPM_CONFIG_PREFIX NPM_CONFIG_USERCONFIG GIT_DIR GIT_WORK_TREE

# ---- 1 refusals ----
[ -n "$branch" ] || refuse "--branch is required"
case "$branch" in *[!A-Za-z0-9._/-]*) refuse "the branch has characters a branch name does not" ;; esac
if [ -n "$folder" ] && [ -n "$tree" ]; then refuse "give --folder or --worktree, not both"; fi
if [ -z "$folder" ] && [ -z "$tree" ]; then refuse "give --folder <dir> or --worktree <dir> --sub <path>"; fi
dirty_flag=true
if [ -n "$folder" ]; then
  [ -d "$folder" ] || refuse "the folder is not there: $folder"
  [ -f "$folder/index.html" ] || refuse "$folder has no index.html"
  say "folder: $(basename "$folder")"
else
  [ -n "$sub" ] || refuse "--worktree needs --sub <path>"
  case "$sub" in /* | *..*) refuse "--sub is a path inside the worktree" ;; esac
  command -v git >/dev/null 2>&1 || refuse "git is not on the PATH"
  [ -d "$tree" ] || refuse "the worktree $tree is not there"
  dirty=$(git -C "$tree" status --porcelain 2>/dev/null) || refuse "cannot read the state of $tree"
  [ -z "$dirty" ] || refuse "the worktree has uncommitted or untracked changes ($(printf '%s\n' "$dirty" | wc -l | tr -d ' ') paths): commit them first"
  git -C "$tree" cat-file -e "HEAD:$sub/index.html" 2>/dev/null || refuse "$sub/index.html is not in the committed HEAD of the worktree"
  pcommit=$(git -C "$tree" rev-parse HEAD 2>/dev/null)
  dirty_flag=false
  say "worktree folder: $sub at commit ${pcommit:0:12} (committed HEAD; uncommitted files are not sent)"
fi

[ -n "$project" ] || refuse "CLOUDFLARE_PAGES_PROJECT is not set (the Pages project's name)"
[ "$branch" != "$prod_branch" ] || refuse "the deploy would land on the production branch ($prod_branch)"
if [ -n "$tok" ] && [ -n "$acct" ]; then
  say "credential: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are set (not shown)"
elif [ -n "$tok" ] || [ -n "$acct" ]; then
  refuse "only one of CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID is set: set both, or neither and use wrangler login"
elif [ -s "$HOME/Library/Preferences/.wrangler/config/default.toml" ] || [ -s "$HOME/.wrangler/config/default.toml" ]; then
  say "credential: no token variables; wrangler's own login file is there (not read)"
else
  refuse "no Cloudflare credential: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or run wrangler login"
fi
for c in node npm curl jq tar; do command -v "$c" >/dev/null 2>&1 || refuse "$c is not on the PATH"; done
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
work=$(mktemp -d "${TMPDIR:-/tmp}/pages-preview.XXXXXX") || refuse "cannot make a temp folder"
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

# The project must exist in the account these credentials reach: a read, never wrangler's question about creating it.
say "2/4 the project named is in the account these credentials reach"
"$wr" pages project list --json >"$work/projects.out" 2>"$work/projects.err" </dev/null
prc=$?
if [ "$prc" -ne 0 ] || ! jq -e . "$work/projects.out" >/dev/null 2>&1; then
  mask <"$work/projects.err" | tail -n 5
  refuse "wrangler could not list the account's Pages projects with these credentials (exit $prc): check the token and account id, or wrangler login"
fi
if ! jq -e --arg p "$project" '[.. | strings] | index($p) != null' "$work/projects.out" >/dev/null 2>&1; then
  refuse "the project named is not in the account these credentials reach (check CLOUDFLARE_PAGES_PROJECT)"
fi
say "project found"

if [ -n "$tree" ]; then
  # The folder as committed, nothing else.
  mkdir -p "$work/site"
  git -C "$tree" archive HEAD "$sub" | tar -x -C "$work/site" || refuse "cannot export $sub from the committed HEAD"
  folder="$work/site/$sub"
  [ -f "$folder/index.html" ] || refuse "the export has no index.html"
fi

failures=""
say "2/4 deploy $(basename "$folder") to the project, branch $branch"
"$wr" pages deploy "$folder" --project-name "$project" --branch "$branch" --commit-hash "${pcommit:-unknown}" --commit-dirty="$dirty_flag" \
  >"$work/deploy.out" 2>&1 </dev/null
drc=$?
mask <"$work/deploy.out"
if [ "$drc" -ne 0 ]; then
  say "verdict: bad: wrangler pages deploy exited $drc (nothing deployed, or not known to be)"
  say "done"
  exit 1
fi
dep_url=$(grep -o 'https://[A-Za-z0-9-]*\.[A-Za-z0-9-]*\.pages\.dev' "$work/deploy.out" | grep -v "^https://$label\." | head -n 1)
[ -n "$dep_url" ] || dep_url=$(grep -o 'https://[A-Za-z0-9-]*\.[A-Za-z0-9-]*\.pages\.dev' "$work/deploy.out" | head -n 1)
say "deployed ${pcommit:+commit ${pcommit:0:12}}"
tty_line "  deployment address: ${dep_url:-not found}"
tty_line "  branch alias address: ${alias_url%/}"
echo "  (both addresses shown on the terminal only)"
[ -n "$dep_url" ] || failures="$failures; the deployment's address was not found in wrangler's output"

# The deployment's id, for the take-down command: the newest preview deploy on this branch.
depid=$("$wr" pages deployment list --project-name "$project" --environment preview --json 2>/dev/null </dev/null |
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
