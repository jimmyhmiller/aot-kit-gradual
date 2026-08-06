#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

task_dir=$(mktemp -d)
trap 'rm -rf "$task_dir"' EXIT

node tools/b13-node-oracle.mjs > "$task_dir/node.txt"
cmp tests/b13-node-oracle.txt "$task_dir/node.txt"
for mutation in NUMERIC_ADD CHARCODE_ZERO; do
  "env" "AOT_B13_$mutation=1" node tools/b13-node-oracle.mjs > "$task_dir/$mutation.txt"
  if cmp -s "$task_dir/node.txt" "$task_dir/$mutation.txt"; then
    echo "$mutation falsification did not change the Node witness" >&2
    exit 1
  fi
done

tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
link_flags=(--link-flag "-Wl,-force_load,$archive" --link-flag -framework \
  --link-flag CoreFoundation --link-flag -framework --link-flag Security)
coil build tools/typescript-native-b13-string-smoke.coil -o "$task_dir/string-smoke" \
  "${link_flags[@]}" >/dev/null
"$task_dir/string-smoke"

coil test tests/jsstring-test.coil >/dev/null
coil test tests/b13-ideal-test.coil >/dev/null

coil build tools/emit-b12-array-object.coil -o "$task_dir/string-emitter" \
  "${link_flags[@]}" >/dev/null
for seed in 11340 11341 11342; do
  for registers in 8 1; do
    object="$task_dir/string-$seed-$registers.o"
    binary="$task_dir/string-$seed-$registers"
    "$task_dir/string-emitter" "$registers" "$seed" 14 > "$object"
    xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
      tools/b13-string-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
      "$object" -o "$binary"
    "$binary"
    "$binary" stress
  done
done

# Conversion/radix boundaries are kept in a straight-line native witness so constant
# truth values cannot disappear behind CFG folding.
for registers in 8 1; do
  object="$task_dir/boundary-$registers.o"
  binary="$task_dir/boundary-$registers"
  "$task_dir/string-emitter" "$registers" 11349 16 > "$object"
  xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
    tools/b13-boundary-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
    "$object" -o "$binary"
  "$binary"
done

for registers in 8 1; do
  object="$task_dir/float-string-$registers.o"
  binary="$task_dir/float-string-$registers"
  "$task_dir/string-emitter" "$registers" 11349 17 > "$object"
  xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
    tools/b13-boundary-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
    "$object" -o "$binary"
  "$binary" 3
done

xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  tools/b13-string-abi-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$object" -o "$task_dir/string-abi"
"$task_dir/string-abi"

# Native falsifications exercise the implementation, not only the Node witness.
"$task_dir/string-emitter" 8 11350 15 > "$task_dir/numeric-add-mutant.o"
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  tools/b13-string-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$task_dir/numeric-add-mutant.o" -o "$task_dir/numeric-add-mutant"
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer -DAOT_B13_CHARCODE_ZERO \
  tools/b13-string-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$object" -o "$task_dir/charcode-mutant"
set +e
"$task_dir/numeric-add-mutant" >/dev/null 2>&1
numeric_status=$?
"$task_dir/charcode-mutant" >/dev/null 2>&1
charcode_status=$?
set -e
test "$numeric_status" -ne 0
test "$charcode_status" -ne 0

# The capability latch deliberately keeps this gate red until B13 evidence is present.
node -e 'const c=require("./workflow/contracts/B13.json"); process.exit(c.implementationComplete ? 0 : 1)'

echo "B13 gate green"
