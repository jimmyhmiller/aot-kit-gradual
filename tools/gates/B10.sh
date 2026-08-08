#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

node tools/b10-node-oracle.mjs > "$tmp/node.txt"
cmp tests/b10-node-oracle.txt "$tmp/node.txt"
for mutation in OMIT_RECEIVER DUPLICATE_RECEIVER; do
  "env" "AOT_B10_$mutation=1" node tools/b10-node-oracle.mjs > "$tmp/$mutation-node.txt"
  if cmp -s "$tmp/node.txt" "$tmp/$mutation-node.txt"; then
    echo "$mutation Node falsification did not change the witness" >&2
    exit 1
  fi
done

tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
link_flags=()  # Coil.toml [link] supplies these; the compiler applies them to every build

node tools/typescript-js-abi.mjs --verify >/dev/null
coil build tools/typescript-native-b10-index-smoke.coil -o "$tmp/index" "${link_flags[@]}" >/dev/null
"$tmp/index" > "$tmp/index.txt"
grep -q 'status=0 functions=3 add-params=1 ctor-params=1 receivers=1,1' "$tmp/index.txt"

coil build tools/typescript-native-b10-receiver-smoke.coil -o "$tmp/receiver" "${link_flags[@]}" >/dev/null
"$tmp/receiver"
for mutation in 1 2; do
  set +e
  "$tmp/receiver" "$mutation" >/dev/null 2>&1
  mutation_status=$?
  set -e
  test "$mutation_status" -ne 0
done

coil build tools/typescript-native-b10-constructor-smoke.coil -o "$tmp/constructor" "${link_flags[@]}" >/dev/null
"$tmp/constructor"
coil build tools/typescript-native-b10-negative.coil -o "$tmp/frontend-negative" "${link_flags[@]}" >/dev/null
"$tmp/frontend-negative" > "$tmp/frontend-negative.txt"
grep -q 'constructor-layout=1005 method-layout=1006' "$tmp/frontend-negative.txt"

coil test tests/b10-receiver-contract-test.coil >/dev/null
coil test tests/eval-test.coil >/dev/null
coil test tests/backend-call-test.coil >/dev/null
coil test tests/backend-native-gc-test.coil >/dev/null

coil build tools/emit-b10-receiver-object.coil -o "$tmp/emitter" "${link_flags[@]}" >/dev/null
for seed in 10300 10301 10302; do
  for registers in 8 1; do
    "$tmp/emitter" "$registers" 0 "$seed" > "$tmp/receiver-$seed-$registers.o"
    xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
      tools/b10-receiver-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
      "$tmp/receiver-$seed-$registers.o" -o "$tmp/receiver-$seed-$registers"
    "$tmp/receiver-$seed-$registers"
    "$tmp/receiver-$seed-$registers" stress
  done
done

set +e
"$tmp/emitter" 8 1 10300 > "$tmp/omitted.o" 2>/dev/null
omitted_status=$?
set -e
if test "$omitted_status" -eq 0; then
  xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
    tools/b10-receiver-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
    "$tmp/omitted.o" -o "$tmp/omitted"
  set +e
  "$tmp/omitted" >/dev/null 2>&1
  omitted_status=$?
  set -e
fi
test "$omitted_status" -ne 0

echo "B10 semantics: receiver-once, detached call, explicit this, constructor return selection"
echo "B10 negatives: missing/scalar receiver ABI and frontend receiver/constructor layouts"
echo "B10 native matrix: normal, register pressure, forced moving GC, three seeds"
echo "B10 falsifications: omitted and duplicate receiver evaluation fail focused witnesses"
echo "B10 gate green"
