#!/usr/bin/env bash
# ops/site-password.sh
# Sets the password of the walks page and the docs site: reads it with no echo, twice to confirm, from a
# terminal, or one line from the standard input when that is not a terminal; then writes only its hash, one
# SHA-256 of "credo-site-gate:" and the password (visual/site/gate.ts's GATE_PREFIX), into
# ops/site-password.sha256 of the tree this script sits in, replacing what was there. The password reaches the
# hash on a pipe from bash's builtin printf, never argv, a file, a here-string or the screen. It touches no
# other file and never commits or pushes: a new password takes effect once the file is committed and pushed.
# SITE_PASSWORD_FILE names another file (a test's). Run again to change the password, always in pre-merge's worktree.
set -euo pipefail

PREFIX='credo-site-gate:'
FILE=${SITE_PASSWORD_FILE:-$(cd "$(dirname "$0")" && pwd)/site-password.sha256}

[ $# -eq 0 ] || {
  echo "usage: ops/site-password.sh" >&2
  exit 2
}

# sha256: the digest of the standard input
sha256() {
  if command -v sha256sum >/dev/null; then sha256sum; else shasum -a 256; fi | cut -d ' ' -f 1
}

password=''
if [ -t 0 ]; then
  confirm=''
  IFS= read -r -s -p 'New password: ' password
  echo >&2
  IFS= read -r -s -p 'Type it again: ' confirm
  echo >&2
  [ "$password" = "$confirm" ] || {
    echo "== refused: the two entries differ; nothing was written" >&2
    exit 2
  }
else
  IFS= read -r password || [ -n "$password" ] || true
fi
[ -n "$password" ] || {
  echo "== refused: the password is empty; nothing was written" >&2
  exit 2
}

hash=$(printf '%s' "$PREFIX$password" | sha256)
unset password confirm
printf '%s\n' "$hash" >"$FILE"
echo "== wrote the password's hash to $FILE"
echo "== done: run in pre-merge's worktree (cd <the credo root>/pre-merge); the machine then commits this file alone, checks both sites, moves main and hands you the push; the new password takes effect once both workflows publish. This script commits and pushes nothing."
