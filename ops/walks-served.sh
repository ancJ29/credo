#!/usr/bin/env bash
# ops/walks-served.sh <commit>
# Reads `wrangler pages deployment list --json` on the standard input and prints the address of the
# project's newest production deploy, when that deploy carries <commit>. Nothing else of the list
# is printed: its Build links hold the account's id. Held by the guards in ops/test.sh.
set -euo pipefail

[ $# -eq 1 ] || {
  echo "usage: ops/walks-served.sh <commit>" >&2
  exit 2
}

# The list is newest first; Source is the commit's first seven characters.
newest=$(jq -r '
  [.[] | select(.Environment == "Production")][0]
  | if . == null then "none" else "\(.Source | tostring) \(.Deployment)" end
')
source=${newest%% *}
address=${newest#* }

[ "$source" != none ] || {
  echo "error: the project has no production deploy" >&2
  exit 1
}
case "$1" in
  "$source"*) [ "${#source}" -ge 7 ] || { echo "error: the deploy's commit is too short to match" >&2; exit 1; } ;;
  *)
    echo "error: the newest production deploy carries commit $source, not ${1:0:7}" >&2
    exit 1
    ;;
esac
echo "$address"
