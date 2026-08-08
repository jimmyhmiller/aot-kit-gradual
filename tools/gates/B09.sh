#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

node tools/b09-node-oracle.mjs > "$tmp/node.txt"
cmp tests/b09-node-oracle.txt "$tmp/node.txt"
AOT_B09_CAPTURE_BY_VALUE=1 node tools/b09-node-oracle.mjs > "$tmp/by-value-node.txt"
if cmp -s "$tmp/node.txt" "$tmp/by-value-node.txt"; then
  echo "capture-by-value Node falsification did not change the witness" >&2
  exit 1
fi

tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
link_flags=()  # Coil.toml [link] supplies these; the compiler applies them to every build

coil build tools/typescript-native-b09-index-smoke.coil -o "$tmp/index" "${link_flags[@]}" >/dev/null
"$tmp/index" > "$tmp/index.txt"
grep -q 'functions=5 captures=3 owners=1,2 mutable=1,1' "$tmp/index.txt"

coil build tools/typescript-native-b09-ideal-smoke.coil -o "$tmp/ideal" "${link_flags[@]}" >/dev/null
"$tmp/ideal"
coil build tools/typescript-native-b09-negative.coil -o "$tmp/frontend-negative" "${link_flags[@]}" >/dev/null
"$tmp/frontend-negative" > "$tmp/frontend-negative.txt"
grep -q 'cross-target=4 leaked-name=2' "$tmp/frontend-negative.txt"

coil test tests/b09-closure-contract-test.coil >/dev/null
coil test tests/eval-test.coil >/dev/null
coil test tests/backend-call-test.coil >/dev/null
coil test tests/backend-native-gc-test.coil >/dev/null

coil build tools/emit-b09-closure-object.coil -o "$tmp/emitter" "${link_flags[@]}" >/dev/null
for seed in 9400 9401 9402; do
  for registers in 8 1; do
    "$tmp/emitter" "$registers" 0 "$seed" > "$tmp/closure-$seed-$registers.o"
    xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
      tools/b09-closure-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
      "$tmp/closure-$seed-$registers.o" -o "$tmp/closure-$seed-$registers"
    "$tmp/closure-$seed-$registers"
    "$tmp/closure-$seed-$registers" stress
  done
done

"$tmp/emitter" 8 1 9400 > "$tmp/by-value.o"
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  tools/b09-closure-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmp/by-value.o" -o "$tmp/by-value"
set +e
"$tmp/by-value" >/dev/null 2>&1
by_value_status=$?
set -e
test "$by_value_status" -ne 0

echo "B09 negatives: VERR-CALL-ARITY/TAG/TARGETS/CLOSURE-LAYOUT and lexical FE errors"
echo "B09 native matrix: normal, register pressure, forced moving GC, three seeds"
echo "B09 falsification: capture-by-value changes Node and fails native witness"
echo "B09 gate green"
