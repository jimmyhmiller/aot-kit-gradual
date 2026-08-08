#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

node tools/b11-node-oracle.mjs > "$tmp/node.txt"
cmp tests/b11-node-oracle.txt "$tmp/node.txt"
for mutation in OWN_ONLY OMIT_MUTATION; do
  "env" "AOT_B11_$mutation=1" node tools/b11-node-oracle.mjs > "$tmp/$mutation.txt"
  if cmp -s "$tmp/node.txt" "$tmp/$mutation.txt"; then
    echo "$mutation Node falsification did not change the witness" >&2
    exit 1
  fi
done

tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
link_flags=()  # Coil.toml [link] supplies these; the compiler applies them to every build

for smoke in property constructor prototype-index prototype; do
  coil build "tools/typescript-native-b11-$smoke-smoke.coil" \
    -o "$tmp/$smoke" "${link_flags[@]}" >/dev/null
  "$tmp/$smoke"
done

coil test tests/jsobject-test.coil >/dev/null
coil test tests/b11-ideal-test.coil >/dev/null
coil test tests/eval-test.coil >/dev/null
coil test tests/backend-native-gc-test.coil >/dev/null

coil build tools/emit-b11-property-object.coil -o "$tmp/property-emitter" \
  "${link_flags[@]}" >/dev/null
for seed in 11140 11141 11142; do
  for registers in 8 1; do
    "$tmp/property-emitter" "$registers" "$seed" > "$tmp/property-$seed-$registers.o"
    xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
      tools/b11-property-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
      "$tmp/property-$seed-$registers.o" -o "$tmp/property-$seed-$registers"
    "$tmp/property-$seed-$registers"
    "$tmp/property-$seed-$registers" stress
  done
done

coil build tools/emit-b11-prototype-object.coil -o "$tmp/prototype-emitter" >/dev/null
for registers in 8 1; do
  "$tmp/prototype-emitter" "$registers" 11150 > "$tmp/prototype-$registers.o"
  xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
    tools/b11-prototype-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
    "$tmp/prototype-$registers.o" -o "$tmp/prototype-$registers"
  "$tmp/prototype-$registers"
  "$tmp/prototype-$registers" stress
done

coil build tools/emit-b11-property-barrier-object.coil -o "$tmp/barrier-emitter" >/dev/null
"$tmp/barrier-emitter" > "$tmp/barrier.o"
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  tools/b11-property-barrier-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmp/barrier.o" -o "$tmp/barrier"
"$tmp/barrier"
set +e
"$tmp/barrier" omit-barrier >/dev/null 2>&1
omitted_status=$?
set -e
test "$omitted_status" -ne 0

echo "B11 semantics: own storage, transitions, mutation, lookup, shadowing, missing undefined"
echo "B11 prototypes: constructor linkage, inherited lookup, cycles rejected"
echo "B11 native matrix: normal, register pressure, moving GC, prototype/property side edges"
echo "B11 falsifications: own-only lookup, omitted mutation, omitted generational barrier"
echo "B11 gate green"
