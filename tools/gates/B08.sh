#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

node tests/frontend-ir-test.mjs >/dev/null
node tools/b08-node-oracle.mjs > "$tmp/node.txt"
cmp tests/b08-node-oracle.txt "$tmp/node.txt"
AOT_B08_REDIRECT_INNER_EXIT=1 node tools/b08-node-oracle.mjs > "$tmp/redirected-node.txt"
if cmp -s "$tmp/node.txt" "$tmp/redirected-node.txt"; then
  echo "redirected-target falsification did not change the Node witness" >&2
  exit 1
fi

tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
link_flags=(--link-flag "-Wl,-force_load,$archive" --link-flag -framework \
  --link-flag CoreFoundation --link-flag -framework --link-flag Security)

node tools/typescript-js-abi.mjs --verify >/dev/null
coil build tools/b08-ideal-matrix.coil -o "$tmp/ideal" "${link_flags[@]}" >/dev/null
"$tmp/ideal" > "$tmp/ideal.txt"
cmp tests/b08-ideal-oracle.txt "$tmp/ideal.txt"

for smoke in index do loop switch memory graph; do
  coil build "tools/typescript-native-b08-$smoke-smoke.coil" -o "$tmp/$smoke" "${link_flags[@]}" >/dev/null
  "$tmp/$smoke" > "$tmp/$smoke.txt"
done
node tests/frontend-native-b08-graph-test.mjs "$tmp/graph.txt" >/dev/null

coil build tools/typescript-native-b08-negative.coil -o "$tmp/negative" "${link_flags[@]}" >/dev/null
"$tmp/negative" > "$tmp/negative.txt"
grep -q 'outside=1 missing=1 nonloop=1 duplicate=1' "$tmp/negative.txt"
coil test tests/verify-test.coil >/dev/null
coil test tests/backend-motion-test.coil >/dev/null

coil build tools/emit-b08-control-object.coil -o "$tmp/emitter" "${link_flags[@]}" >/dev/null
for seed in 8400 8401 8402; do
  for registers in 8 1; do
    "$tmp/emitter" "$registers" 0 "$seed" > "$tmp/control-$seed-$registers.o"
    xcrun clang -arch arm64 tools/b08-control-harness.c tools/native-gc-runtime.c \
      "$tmp/control-$seed-$registers.o" \
      -o "$tmp/control-$seed-$registers"
    "$tmp/control-$seed-$registers"
  done
done

"$tmp/emitter" 8 1 8400 > "$tmp/redirected.o"
xcrun clang -arch arm64 tools/b08-control-harness.c tools/native-gc-runtime.c \
  "$tmp/redirected.o" -o "$tmp/redirected"
set +e
"$tmp/redirected" >/dev/null 2>&1
redirected_status=$?
set -e
test "$redirected_status" -ne 0

echo "negative illegal targets: FE_TARGET/FE-CODE-INVALID-TARGET covers four lexical classes"
echo "negative dead Phi arms: verifier rejects mismatched Region/Phi arity and ownership"
echo "falsification redirected target: inner switch break redirected to outer loop changed Node and native"
echo "B08 gate green"
