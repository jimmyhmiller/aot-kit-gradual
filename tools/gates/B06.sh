#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

coil test tests/jsint32-test.coil >/dev/null
coil test tests/b06-ideal-test.coil >/dev/null
coil test tests/backend-liveness-test.coil >/dev/null

coil build tools/b06-ideal-matrix.coil -o "$tmp/ideal-matrix" >/dev/null
"$tmp/ideal-matrix" 0 > "$tmp/raw-ideal.txt"
"$tmp/ideal-matrix" 1 > "$tmp/optimized-ideal.txt"
node tools/js-int32-oracle.mjs > "$tmp/node.txt"
cmp tests/js-int32-oracle.txt "$tmp/node.txt"
cmp "$tmp/node.txt" "$tmp/raw-ideal.txt"
cmp "$tmp/node.txt" "$tmp/optimized-ideal.txt"

AOT_B06_DROP_SHIFT_MASK=1 node tools/js-int32-oracle.mjs > "$tmp/no-mask.txt"
AOT_B06_SIGNED_USHR=1 node tools/js-int32-oracle.mjs > "$tmp/signed-ushr.txt"
if cmp -s "$tmp/node.txt" "$tmp/no-mask.txt"; then
  echo "shift-mask falsification did not change the Node witness" >&2
  exit 1
fi
if cmp -s "$tmp/node.txt" "$tmp/signed-ushr.txt"; then
  echo "unsigned-shift falsification did not change the Node witness" >&2
  exit 1
fi

coil build tools/emit-b06-int-object.coil -o "$tmp/int-emitter" >/dev/null
for registers in 8 1; do
  for mode in 0 1 2 3 4 5 6; do
    "$tmp/int-emitter" "$mode" "$registers" > "$tmp/int-$registers-$mode.o"
    xcrun clang -arch arm64 -DMODE="$mode" tools/b06-int-harness.c \
      "$tmp/int-$registers-$mode.o" -o "$tmp/int-$registers-$mode"
    "$tmp/int-$registers-$mode"
  done
done

coil build tools/emit-b06-coercion-object.coil -o "$tmp/coercion-emitter" >/dev/null
for registers in 8 1; do
  for mode in 0 1 2 3; do
    "$tmp/coercion-emitter" "$mode" "$registers" > "$tmp/coercion-$registers-$mode.o"
    xcrun clang -arch arm64 -DMODE="$mode" tools/b06-coercion-harness.c \
      "$tmp/coercion-$registers-$mode.o" -o "$tmp/coercion-$registers-$mode"
    "$tmp/coercion-$registers-$mode"
  done
  "$tmp/coercion-emitter" 4 "$registers" > "$tmp/mod-$registers.o"
  xcrun clang -arch arm64 tools/b06-mod-harness.c \
    "$tmp/mod-$registers.o" -o "$tmp/mod-$registers"
  "$tmp/mod-$registers"
done

"$tmp/coercion-emitter" 1 8 1 > "$tmp/falsified-mask.o"
xcrun clang -arch arm64 -DMODE=1 tools/b06-coercion-harness.c \
  "$tmp/falsified-mask.o" -o "$tmp/falsified-mask"
"$tmp/coercion-emitter" 3 8 2 > "$tmp/falsified-ushr.o"
xcrun clang -arch arm64 -DMODE=3 tools/b06-coercion-harness.c \
  "$tmp/falsified-ushr.o" -o "$tmp/falsified-ushr"
set +e
"$tmp/falsified-mask" >/dev/null 2>&1
mask_status=$?
"$tmp/falsified-ushr" >/dev/null 2>&1
ushr_status=$?
set -e
test "$mask_status" -ne 0
test "$ushr_status" -ne 0

node tests/frontend-ir-test.mjs >/dev/null
tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
coil build tools/typescript-native-bitwise-graph-smoke.coil \
  -o "$tmp/native-bitwise" \
  --link-flag "-Wl,-force_load,$archive" \
  --link-flag -framework --link-flag CoreFoundation \
  --link-flag -framework --link-flag Security >/dev/null
"$tmp/native-bitwise" > "$tmp/native-bitwise.txt"
node tests/frontend-native-bitwise-exact-graph-test.mjs "$tmp/native-bitwise.txt" >/dev/null

echo "negative operand/result class: MI-I32FROMFP verifier rejected both corruptions"
echo "negative frontend form: malformed compound lvalue rejected with FE_UNSUPPORTED"
echo "falsification shift-mask: removing the five-bit boundary changed native and Node results"
echo "falsification unsigned-shift: sign extension changed native and Node results"
echo "B06 gate green"
