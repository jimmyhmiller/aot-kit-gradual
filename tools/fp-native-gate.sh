#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

coil build tools/emit-fp-object.coil -o "$tmp/emitter" >/dev/null
coil build tools/emit-fp-constant-object.coil -o "$tmp/constant-emitter" >/dev/null
coil build tools/emit-fp-call-object.coil -o "$tmp/call-emitter" >/dev/null
coil build tools/emit-fp-gc-object.coil -o "$tmp/gc-emitter" >/dev/null
coil build tools/emit-fp-phi-object.coil -o "$tmp/phi-emitter" >/dev/null
coil build tools/emit-fp-truth-object.coil -o "$tmp/truth-emitter" >/dev/null
coil build tools/emit-fp-matrix-object.coil -o "$tmp/matrix-emitter" >/dev/null
coil build tools/emit-fp-stack-call-object.coil -o "$tmp/stack-call-emitter" >/dev/null
: > "$tmp/native-matrix.txt"
for mode in 0 1 2 3 4 5 6 7 8; do
  "$tmp/emitter" "$mode" > "$tmp/fp-$mode.o"
  xcrun clang -arch arm64 -DMODE="$mode" -DPRINT_RESULT tools/fp-native-harness.c \
    "$tmp/fp-$mode.o" -o "$tmp/fp-$mode"
  "$tmp/fp-$mode" >> "$tmp/native-matrix.txt"
done
node tools/fp-native-oracle.mjs > "$tmp/node-matrix.txt"
cmp tests/fp-native-oracle.txt "$tmp/node-matrix.txt"
cmp tests/fp-native-oracle.txt "$tmp/native-matrix.txt"
for registers in 10 1; do
  "$tmp/call-emitter" "$registers" > "$tmp/call-$registers.o"
  xcrun clang -arch arm64 -DMODE=0 tools/fp-native-harness.c \
    "$tmp/call-$registers.o" -o "$tmp/call-$registers"
  "$tmp/call-$registers"
done
xcrun llvm-objdump -d "$tmp/call-10.o" > "$tmp/call-live.txt"
grep -q $'\tstr\td8' "$tmp/call-live.txt"
grep -q $'\tldr\td8' "$tmp/call-live.txt"
for registers in 8 1; do
  "$tmp/phi-emitter" "$registers" > "$tmp/phi-$registers.o"
  xcrun clang -arch arm64 tools/fp-phi-harness.c "$tmp/phi-$registers.o" -o "$tmp/phi-$registers"
  "$tmp/phi-$registers"
done
for mode in 0 1 2 3; do
  "$tmp/constant-emitter" "$mode" > "$tmp/constant-$mode.o"
  xcrun clang -arch arm64 -DMODE="$mode" tools/fp-constant-harness.c \
    "$tmp/constant-$mode.o" -o "$tmp/constant-$mode"
  "$tmp/constant-$mode"
done
"$tmp/emitter" 0 1 > "$tmp/fp-pressure.o"
xcrun clang -arch arm64 -DMODE=0 tools/fp-native-harness.c \
  "$tmp/fp-pressure.o" -o "$tmp/fp-pressure"
"$tmp/fp-pressure"
xcrun llvm-objdump -d "$tmp/fp-pressure.o" > "$tmp/pressure.txt"
grep -q $'\tstr\td' "$tmp/pressure.txt"
grep -q $'\tldr\td' "$tmp/pressure.txt"
xcrun llvm-objdump -d "$tmp/fp-0.o" > "$tmp/mixed.txt"
grep -q $'\tscvtf\td' "$tmp/mixed.txt"
grep -q $'\tfadd\td' "$tmp/mixed.txt"
xcrun llvm-objdump -d "$tmp/fp-6.o" > "$tmp/unordered.txt"
grep -q $'\tfcmp\td' "$tmp/unordered.txt"

"$tmp/gc-emitter" > "$tmp/fp-gc.o"
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  tools/fp-gc-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  tools/fp-gc-trampoline.S \
  "$tmp/fp-gc.o" -o "$tmp/fp-gc"
"$tmp/fp-gc"

"$tmp/truth-emitter" > "$tmp/fp-truth.o"
xcrun clang -arch arm64 tools/fp-truth-harness.c "$tmp/fp-truth.o" -o "$tmp/fp-truth"
"$tmp/fp-truth"
xcrun llvm-objdump -d "$tmp/fp-truth.o" > "$tmp/truth.txt"
grep -q $'\tfcmp\td' "$tmp/truth.txt"

: > "$tmp/full-native-matrix.txt"
for mode in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17; do
  "$tmp/matrix-emitter" "$mode" > "$tmp/matrix-$mode.o"
  xcrun clang -arch arm64 -DMODE="$mode" tools/fp-matrix-harness.c \
    "$tmp/matrix-$mode.o" -o "$tmp/matrix-$mode"
  "$tmp/matrix-$mode" >> "$tmp/full-native-matrix.txt"
done
xcrun clang -arch arm64 -DPRINT_MATRIX tools/fp-truth-harness.c \
  "$tmp/fp-truth.o" -o "$tmp/fp-truth-matrix"
"$tmp/fp-truth-matrix" >> "$tmp/full-native-matrix.txt"
cmp tests/js-number-oracle.txt "$tmp/full-native-matrix.txt"

: > "$tmp/full-pressure-matrix.txt"
for mode in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17; do
  "$tmp/matrix-emitter" "$mode" 1 > "$tmp/matrix-pressure-$mode.o"
  xcrun clang -arch arm64 -DMODE="$mode" tools/fp-matrix-harness.c \
    "$tmp/matrix-pressure-$mode.o" -o "$tmp/matrix-pressure-$mode"
  "$tmp/matrix-pressure-$mode" >> "$tmp/full-pressure-matrix.txt"
done
"$tmp/fp-truth-matrix" >> "$tmp/full-pressure-matrix.txt"
cmp tests/js-number-oracle.txt "$tmp/full-pressure-matrix.txt"

for mode in 0 1; do
  "$tmp/stack-call-emitter" "$mode" > "$tmp/stack-call-$mode.o"
  xcrun clang -arch arm64 tools/fp-stack-call-harness.c \
    "$tmp/stack-call-$mode.o" -o "$tmp/stack-call-$mode"
  "$tmp/stack-call-$mode"
done
xcrun llvm-objdump -d "$tmp/stack-call-0.o" > "$tmp/stack-call-fp.txt"
xcrun llvm-objdump -d "$tmp/stack-call-1.o" > "$tmp/stack-call-gpr.txt"
grep -q $'\tstr\td30, \[sp\]' "$tmp/stack-call-fp.txt"
grep -q $'\tstr\tx15, \[sp\]' "$tmp/stack-call-gpr.txt"

"$tmp/emitter" 0 1 1 > "$tmp/falsified-reload.o"
xcrun clang -arch arm64 -DMODE=0 tools/fp-native-harness.c \
  "$tmp/falsified-reload.o" -o "$tmp/falsified-reload"
set +e
"$tmp/falsified-reload"
reload_status=$?
set -e
test "$reload_status" -ne 0
echo "falsification FP-reload: deleting the reload changed the native result"

"$tmp/emitter" 6 8 2 > "$tmp/falsified-unordered.o"
xcrun clang -arch arm64 -DMODE=6 tools/fp-native-harness.c \
  "$tmp/falsified-unordered.o" -o "$tmp/falsified-unordered"
set +e
"$tmp/falsified-unordered"
unordered_status=$?
set -e
test "$unordered_status" -ne 0
echo "falsification unordered-NaN: integer signed-less-than changed NaN ordering"

echo "FP semantics, constants, calls, Phis, allocation safepoints, and forced spills executed natively"
