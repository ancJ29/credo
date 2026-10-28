#!/usr/bin/env bash
# ops/walks-refused.sh <url>
# Exits 0 only when an anonymous fetch of <url> is refused the way Cloudflare Access refuses it: a
# redirect to a sign-in on a cloudflareaccess.com address. Any page (a 200), any other redirect and
# no answer at all exit 1, naming the status alone: the workflow runs this on a secret address and
# a team name, which neither is printed. Held by the guards in ops/test.sh.
set -euo pipefail

[ $# -eq 1 ] || {
  echo "usage: ops/walks-refused.sh <url>" >&2
  exit 2
}

out=$(curl -sS -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "$1" 2>/dev/null) || {
  echo "error: the address gave no answer" >&2
  exit 1
}
code=${out%% *}
location=${out#* }
host=${location#*://}
host=${host%%/*}
host=${host%%:*}

case "$code" in
  30[1278]) ;;
  *)
    echo "error: an anonymous fetch was answered $code, not refused" >&2
    exit 1
    ;;
esac
case "$host" in
  ?*.cloudflareaccess.com) echo "refused: a redirect to Access's sign-in" ;;
  *)
    echo "error: an anonymous fetch was redirected ($code), but not to Access's sign-in" >&2
    exit 1
    ;;
esac
