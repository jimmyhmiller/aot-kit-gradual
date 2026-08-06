#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

node tests/frontend-native-product-test.mjs
tools/typescript-binarytrees-gate.sh --quick >/dev/null

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf 'broken native bridge' > "$tmp/libaot_typescript.a"
if AOT_TYPESCRIPT_ARCHIVE="$tmp/libaot_typescript.a" node tools/aot-compile.mjs \
  tests/typescript/annotated-add.ts --output "$tmp/graph" >"$tmp/broken.out" 2>&1; then exit 1; fi
grep -Eq 'native frontend driver build failed|file format not recognized|archive member' "$tmp/broken.out"
echo "falsification broken-native-bridge: product compilation failed"

echo "B02 gate green"
