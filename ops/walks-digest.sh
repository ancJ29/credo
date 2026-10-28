#!/usr/bin/env bash
# ops/walks-digest.sh [--sum] <folder>
# Lists each file of <folder> as "<SHA-256>  <bytes>  <name>", sorted by name; with --sum, prints
# the SHA-256 of that list alone, which the build job hands to the deploy job to compare. Held by
# the guards in ops/test.sh.
set -euo pipefail

sum=0
if [ "${1:-}" = "--sum" ]; then
  sum=1
  shift
fi
[ $# -eq 1 ] && [ -d "$1" ] || {
  echo "usage: ops/walks-digest.sh [--sum] <folder>" >&2
  exit 2
}

# sha256 [file]: the digest of the file, or of the standard input
sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi | cut -d ' ' -f 1
}

list() {
  local name
  cd "$1"
  find . -type f | LC_ALL=C sort | while IFS= read -r name; do
    name=${name#./}
    printf '%s  %s  %s\n' "$(sha256 "$name")" "$(wc -c <"$name" | tr -d ' ')" "$name"
  done
}

if [ "$sum" = 1 ]; then list "$1" | sha256; else list "$1"; fi
