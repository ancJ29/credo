#!/bin/bash
# ops/legacy-capture.sh --url <the legacy app's address> --screens <file> --tunnel-seed-from <file> [--out <dir>] [--stem <log name>] [--check]
# Signs in to the LEGACY app as a client's root and takes one picture of each screen a screens file names, at the PC
# width (1280x800) and on a phone (Playwright's emulated iPhone, since the legacy picks its phone frame by device, not
# by width), for setting beside the new app's walks pictures. OPENING screens only: it navigates and reads, clicks a
# tab or a list row to open it, and never saves, submits, deletes or switches anything. Meant for non-production data.
# Run it in YOUR terminal (it opens a headless Chromium); the screens file's first user is walk/legacy-screens/employees.screens.
#
# Parameters:
#   --url <address>    the legacy app's address, such as https://host (no path). Given on your command line only: never
#                      written into any file, never printed or logged by this script.
#   --screens <file>   one screen a line (name, pc or both, route, options); the format is at the top of walk/legacy-capture.ts
#   --tunnel-seed-from <file>
#                      a legacy source file (the old repo's workspace/shared/kits/src/crypt.ts) holding the constant
#                      SCRAMBLE_SEED = '<value>'; the value is read from it at run time and goes to the Node script as
#                      the third stdin line. It is never written into this repo, printed or logged; the file is read-only.
#   --out <dir>        where the pictures go (default <credo root>/captures/<YYYYMMDD-HHMM>-legacy-<screens file name>/, outside
#                      git); must be new or empty, and not inside the repo
#   --stem <name>      the log's name, logs/<YYYYMMDD-HHMM>-<stem>.log in the credo root (default legacy-capture)
#   --check            the refusals and the screens file parsed, then stop: no prompt, no browser, nothing written but the log
#
# The credential: it asks at its prompt for the root's name (shown as you type) and password (not shown), and hands
# them, with the tunnel seed, to the Node script on a pipe from the shell builtin printf: never an argument, an environment variable, a file
# or a here-string (bash 3.2 writes those to disk). Neither value is printed or logged; the sign-in step's failure
# is a fixed text; no trace, video or HAR is recorded (they keep typed values). The pictures show the data on screen.
#
# What it does, in order:
#   1 refusals (each "== refused: <why>", exit 2, nothing opened): a bad or missing parameter; the screens file is not
#     there or does not parse; the seed file is not there or holds no SCRAMBLE_SEED value; no Node 26; the pictures' folder is inside the repo or not empty; (without --check) no
#     terminal to ask on, or an empty name or password.
#   2 the screens parsed and listed (--check stops here).
#   3 the capture: <screen>-pc.png, <screen>-phone.png, and calls.json (each screen's API calls as METHOD /path, ids as
#     :id, no query, no body; after the sign-in every call that is not a read is aborted, listed under "blocked").
#   4 a verdict line naming every screen that failed, then "== done". Exit: 0 good, 1 a failure, 2 refused.
# What it changes: the pictures folder and the log. Nothing in git, any worktree, or the legacy app (it only reads).
# Language: the legacy's default (no language is set in the browser).
# Look for: "== screens file parsed", "== pc: signed in", "== <screen>-pc: picture taken" lines, "== verdict: good",
#   "== done". Expected length: about 1 to 3 minutes for the employee screens.
set -uo pipefail

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
root=$(dirname "$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)")
logdir="${OPS_LOG_DIR:-$root/logs}"

say() { echo "== $*"; }
refuse() {
  echo "== refused: $1"
  exit 2
}

main() {
  local url='' screens='' seedfile='' seed='' out='' stem=legacy-capture check=no
  while [ $# -gt 0 ]; do
    case "$1" in
      --check)
        check=yes
        shift
        ;;
      --url | --screens | --tunnel-seed-from | --out | --stem)
        [ $# -ge 2 ] || refuse "$1 needs a value"
        case "$1" in
          --url) url=$2 ;;
          --screens) screens=$2 ;;
          --tunnel-seed-from) seedfile=$2 ;;
          --out) out=$2 ;;
          --stem) stem=$2 ;;
        esac
        shift 2
        ;;
      *) refuse "unknown parameter $1 (see the top of ops/legacy-capture.sh)" ;;
    esac
  done
  say "legacy-capture — $(date '+%Y-%m-%d %H:%M:%S %z')"

  # ---- 1 refusals ----
  # The address is checked, never printed.
  [ -n "$url" ] || refuse "--url is required (the legacy app's address, such as https://host)"
  case "$url" in
    http://* | https://*) ;;
    *) refuse "--url starts with https:// (or http://)" ;;
  esac
  case "${url#*://}" in
    '' | */* | *' '*) refuse "--url is the address alone, such as https://host, no path" ;;
  esac
  [ -n "$screens" ] || refuse "--screens <file> is required"
  [ -f "$screens" ] || refuse "the screens file is not there: $screens"
  screens="$(cd "$(dirname "$screens")" && pwd)/$(basename "$screens")"
  [ -n "$seedfile" ] || refuse "--tunnel-seed-from <file> is required (the legacy's crypt.ts)"
  [ -f "$seedfile" ] || refuse "the tunnel seed file is not there: $seedfile"
  # The value is the text between the first pair of single quotes on the SCRAMBLE_SEED line; held in a variable only.
  seed=$(grep -m1 -E "SCRAMBLE_SEED[[:space:]]*=[[:space:]]*'" "$seedfile" 2>/dev/null) || seed=''
  seed=${seed#*\'}
  seed=${seed%%\'*}
  [ -n "$seed" ] || refuse "no SCRAMBLE_SEED value was found in the tunnel seed file"
  case "$stem" in '' | *[!A-Za-z0-9._-]*) refuse "--stem has characters a file name should not" ;; esac
  for c in node git; do command -v "$c" >/dev/null 2>&1 || refuse "$c is not on the PATH"; done
  [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" = 26 ] || refuse "node on the PATH is not v26"
  [ -f "$REPO_DIR/walk/legacy-capture.ts" ] || refuse "walk/legacy-capture.ts is not in this worktree"
  [ -d "$REPO_DIR/walk/node_modules/@playwright/test" ] || refuse "walk has no installed @playwright/test (pnpm install --offline --frozen-lockfile)"
  if [ -z "$out" ]; then
    out="$root/captures/$(date +%Y%m%d-%H%M)-legacy-$(basename "$screens" | sed -e 's/\.[^.]*$//')"
  fi
  case "$out" in /*) ;; *) refuse "--out is an absolute path" ;; esac
  case "$out/" in "$REPO_DIR"/*) refuse "--out is inside the repo: pictures stay outside git" ;; esac
  if [ -e "$out" ] && { [ ! -d "$out" ] || [ -n "$(ls -A "$out" 2>/dev/null)" ]; }; then
    refuse "the pictures' folder is there and not empty: $out"
  fi

  # ---- 2 the screens file, parsed by the Node script's own parser (no browser) ----
  say "1/3 the screens file"
  (cd "$REPO_DIR/walk" && node legacy-capture.ts --screens "$screens" --check) || {
    say "verdict: bad: the screens file did not parse"
    say "done"
    exit 2
  }
  say "pictures will go to: $out"
  if [ "$check" = yes ]; then
    seed=''
    say "tunnel seed: found in the file (not shown)"
    say "check only: no prompt, no browser, nothing written"
    say "done"
    exit 0
  fi

  # ---- the credential, asked here, sent on a pipe ----
  { : </dev/tty && : >/dev/tty; } 2>/dev/null || refuse "no terminal to ask the root's name and password on"
  local name='' pass=''
  printf 'The legacy root name: ' >/dev/tty
  IFS= read -r name </dev/tty
  printf 'The legacy root password (not shown): ' >/dev/tty
  IFS= read -rs pass </dev/tty
  printf '\n' >/dev/tty
  if [ -z "$name" ] || [ -z "$pass" ]; then
    name='' pass='' seed=''
    refuse "the name or the password was empty"
  fi

  # ---- 3 the capture ----
  say "2/3 capture (a headless browser; the credential goes to it on a pipe)"
  # DEBUG=pw:protocol would print the typed password (its CDP message) into the log; NODE_OPTIONS could load code.
  set +x
  printf '%s\n%s\n%s\n' "$name" "$pass" "$seed" | (
    unset DEBUG DEBUG_FILE PWDEBUG NODE_OPTIONS
    cd "$REPO_DIR/walk" && node legacy-capture.ts --url "$url" --screens "$screens" --out "$out"
  )
  local rc=${PIPESTATUS[1]}
  name='' pass='' seed=''
  unset name pass seed

  # ---- 4 finish ----
  say "3/3 finish"
  if [ "$rc" -eq 0 ]; then
    say "verdict: good: every picture taken; they and calls.json are in $out"
    say "done"
    exit 0
  fi
  say "verdict: bad: the capture ended with exit $rc (the lines above name each screen that failed)"
  say "done"
  exit 1
}

# The log's name needs --stem before the refusals can write: read it out of the arguments here.
logstem=legacy-capture
prev=''
for a in "$@"; do
  [ "$prev" = --stem ] && logstem=$a
  prev=$a
done
case "$logstem" in '' | *[!A-Za-z0-9._-]*) logstem=legacy-capture ;; esac
mkdir -p "$logdir" 2>/dev/null || {
  echo "== refused: cannot make the logs folder"
  exit 2
}
LOG="$logdir/$(date +%Y%m%d-%H%M)-$logstem.log"
main "$@" 2>&1 | tee -ai "$LOG"
rc=${PIPESTATUS[0]}
echo "== exit $rc" >>"$LOG"
exit "$rc"
