#!/usr/bin/env bash
# Builds the design sync's library of credo's parts: the ES bundle and its stylesheet by Vite,
# the declarations by tsc, into dist/ (gitignored). Run from anywhere.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"
rm -rf dist
"$here/../../ui/node_modules/.bin/vite" build --config vite.config.ts
"$here/../../node_modules/.bin/tsc" -p tsconfig.json || echo "tsc reported errors (see above)"
echo "export * from './types/.design-sync/lib/entry';" > dist/index.d.ts
ls dist
