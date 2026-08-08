#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

node tools/b12-node-oracle.mjs > "$tmp/node.txt"
cmp tests/b12-node-oracle.txt "$tmp/node.txt"
for mutation in DISABLE_GROWTH OMIT_ELEMENT_SCAN; do
  "env" "AOT_B12_$mutation=1" node tools/b12-node-oracle.mjs > "$tmp/$mutation.txt"
  if cmp -s "$tmp/node.txt" "$tmp/$mutation.txt"; then
    echo "$mutation Node falsification did not change the witness" >&2
    exit 1
  fi
done

tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
link_flags=()  # Coil.toml [link] supplies these; the compiler applies them to every build
coil build tools/typescript-native-b12-index-smoke.coil -o "$tmp/index" \
  "${link_flags[@]}" >/dev/null
"$tmp/index" > "$tmp/index.txt"
grep -q 'status=0 arrays=1 elements=1' "$tmp/index.txt"
coil build tools/typescript-native-b12-array-smoke.coil -o "$tmp/array" \
  "${link_flags[@]}" >/dev/null
"$tmp/array"

coil test tests/jsarray-test.coil >/dev/null
coil test tests/b12-ideal-test.coil >/dev/null

coil build tools/emit-b12-array-object.coil -o "$tmp/array-emitter" \
  "${link_flags[@]}" >/dev/null
for seed in 11220 11221 11222; do
  for registers in 8 1; do
    object="$tmp/array-$seed-$registers.o"
    binary="$tmp/array-$seed-$registers"
    "$tmp/array-emitter" "$registers" "$seed" > "$object"
    xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
      tools/b12-array-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
      "$object" -o "$binary"
    "$binary"
    "$binary" stress
    set +e
    "$binary" disable-growth >/dev/null 2>&1
    growth_status=$?
    set -e
    test "$growth_status" -ne 0
  done
done

for spec in "2 raw:3" "3 30" "4 undefined" "5 2" "6 raw:3" \
            "7 20" "8 21" "9 22" "10 array" "11 true" "12 null" "13 30"; do
  read -r mode expected <<< "$spec"
  for registers in 8 1; do
    object="$tmp/array-mode-$mode-$registers.o"
    binary="$tmp/array-mode-$mode-$registers"
    "$tmp/array-emitter" "$registers" "$((11230 + mode))" "$mode" > "$object"
    xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
      tools/b12-array-builtins-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
      "$object" -o "$binary"
    "$binary" "$expected"
    "$binary" "$expected" stress
  done
done

"$tmp/array-emitter" 8 11230 1 > "$tmp/array-edge.o"
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  tools/b12-array-edge-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmp/array-edge.o" -o "$tmp/array-edge"
"$tmp/array-edge"
set +e
"$tmp/array-edge" omit-scan >/dev/null 2>&1
scan_status=$?
"$tmp/array-edge" omit-barrier >/dev/null 2>&1
barrier_status=$?
set -e
test "$scan_status" -ne 0
test "$barrier_status" -ne 0

# The capability latch deliberately keeps this gate red until native array evidence is present.
node -e 'const c=require("./workflow/contracts/B12.json"); process.exit(c.implementationComplete ? 0 : 1)'

echo "B12 gate green"
