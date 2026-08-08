#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

node tools/b07-node-oracle.mjs > "$tmp/node.txt"
cmp tests/b07-node-oracle.txt "$tmp/node.txt"
AOT_B07_EAGER_BRANCHES=1 node tools/b07-node-oracle.mjs > "$tmp/eager.txt"
AOT_B07_DUPLICATE_RECEIVER=1 node tools/b07-node-oracle.mjs > "$tmp/duplicate.txt"
if cmp -s "$tmp/node.txt" "$tmp/eager.txt"; then
  echo "eager-branch falsification did not change the evaluation-order matrix" >&2
  exit 1
fi
if cmp -s "$tmp/node.txt" "$tmp/duplicate.txt"; then
  echo "duplicate-receiver falsification did not change the evaluation-order matrix" >&2
  exit 1
fi

node tests/frontend-ir-test.mjs >/dev/null
coil test tests/backend-phi-test.coil >/dev/null
coil test tests/backend-liveness-test.coil >/dev/null

tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
link=()  # Coil.toml [link] supplies these; the compiler applies them to every build

coil build tools/b07-ideal-matrix.coil -o "$tmp/ideal" "${link[@]}" >/dev/null
"$tmp/ideal" > "$tmp/ideal.txt"
cmp tests/b07-ideal-oracle.txt "$tmp/ideal.txt"

coil build tools/typescript-native-b07-update-smoke.coil -o "$tmp/update" "${link[@]}" >/dev/null
coil build tools/typescript-native-b07-property-smoke.coil -o "$tmp/property" "${link[@]}" >/dev/null
coil build tools/typescript-native-b07-branch-smoke.coil -o "$tmp/branch-graph" "${link[@]}" >/dev/null
"$tmp/update" > "$tmp/update-graph.txt"
"$tmp/property" > "$tmp/property-graph.txt"
"$tmp/branch-graph" > "$tmp/branch-graph.txt"
grep -q 'Store#' "$tmp/property-graph.txt"
grep -q 'Phi' "$tmp/branch-graph.txt"

coil build tools/emit-b07-branch-object.coil -o "$tmp/emitter" "${link[@]}" >/dev/null
for registers in 8 1; do
  "$tmp/emitter" "$registers" > "$tmp/branch-$registers.o"
  xcrun clang -arch arm64 tools/b07-branch-harness.c \
    "$tmp/branch-$registers.o" -o "$tmp/branch-$registers"
  "$tmp/branch-$registers"
done

echo "negative malformed-lvalue: normalized frontend rejected literal assignment/update targets"
echo "negative corrupt-merge: backend Phi verifier suite rejected slot/source corruption"
echo "falsification eager-branch: eager RHS/arms changed the checked Node matrix"
echo "falsification duplicate-receiver: repeated lvalue receiver changed the checked Node matrix"
echo "B07 gate green"
