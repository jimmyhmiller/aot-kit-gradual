#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

task_dir=$(mktemp -d)
trap 'rm -rf "$task_dir"' EXIT

node tools/b14-node-oracle.mjs > "$task_dir/node.txt"
cmp tests/b14-node-oracle.txt "$task_dir/node.txt"
AOT_B14_PERTURB_SQRT=1 node tools/b14-node-oracle.mjs > "$task_dir/sqrt-mutant.txt"
if cmp -s "$task_dir/node.txt" "$task_dir/sqrt-mutant.txt"; then
  echo "perturbed sqrt did not change the Node witness" >&2
  exit 1
fi

tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
link_flags=(--link-flag "-Wl,-force_load,$archive" --link-flag -framework \
  --link-flag CoreFoundation --link-flag -framework --link-flag Security)

coil build tools/typescript-native-b14-builtin-smoke.coil -o "$task_dir/ideal-smoke" \
  "${link_flags[@]}" >/dev/null
"$task_dir/ideal-smoke"
coil build tools/typescript-native-b14-negative.coil -o "$task_dir/negative" \
  "${link_flags[@]}" >/dev/null
test "$("$task_dir/negative")" = "status=3 code=1007 node=5"
coil test tests/jsbuiltin-test.coil >/dev/null
coil test tests/b14-ideal-test.coil >/dev/null

xcrun clang -arch arm64 -O1 tools/b14-builtin-abi-harness.c \
  tools/native-gc-runtime.c tools/native-gc-trampoline.S -o "$task_dir/abi"
"$task_dir/abi" >/dev/null

coil build tools/emit-b12-array-object.coil -o "$task_dir/emitter" \
  "${link_flags[@]}" >/dev/null
for seed in 11430 11431 11432; do
  for registers in 8 1; do
    object="$task_dir/builtin-$seed-$registers.o"
    binary="$task_dir/builtin-$seed-$registers"
    "$task_dir/emitter" "$registers" "$seed" 18 > "$object"
    xcrun clang -arch arm64 -O1 tools/b14-native-harness.c \
      tools/native-gc-runtime.c tools/native-gc-trampoline.S "$object" -o "$binary"
    "$binary"
  done
done

"$task_dir/emitter" 1 11433 18 > "$task_dir/sqrt.o"
xcrun clang -arch arm64 -O1 -DAOT_B14_PERTURB_SQRT tools/b14-native-harness.c \
  tools/native-gc-runtime.c tools/native-gc-trampoline.S "$task_dir/sqrt.o" \
  -o "$task_dir/sqrt-mutant"
set +e
"$task_dir/sqrt-mutant" >/dev/null 2>&1
sqrt_code=$?
set -e
test "$sqrt_code" -ne 0

"$task_dir/emitter" 1 11434 20 > "$task_dir/throw.o"
xcrun clang -arch arm64 -O1 tools/b14-throw-object-harness.c \
  tools/native-gc-runtime.c tools/native-gc-trampoline.S "$task_dir/throw.o" \
  -o "$task_dir/throw"
xcrun clang -arch arm64 -O1 -DAOT_B14_SWALLOW_THROW -DEXPECT_SWALLOW \
  tools/b14-throw-object-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$task_dir/throw.o" -o "$task_dir/throw-mutant"
set +e
"$task_dir/throw" 2>"$task_dir/throw.err"
throw_code=$?
set -e
test "$throw_code" -eq 70
test "$(cat "$task_dir/throw.err")" = "uncaught JavaScript throw"
"$task_dir/throw-mutant"

# Capability latch remains red until all B14 evidence and project regressions are complete.
node -e 'const c=require("./workflow/contracts/B14.json"); process.exit(c.implementationComplete ? 0 : 1)'

echo "B14 gate green"
