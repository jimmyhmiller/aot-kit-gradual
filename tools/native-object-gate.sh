#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

coil build tools/emit-multifunction-object.coil -o "$tmpdir/emit-chain" >/dev/null
coil build tools/emit-recursive-object.coil -o "$tmpdir/emit-recursive" >/dev/null
coil build tools/emit-allocation-object.coil -o "$tmpdir/emit-allocation" >/dev/null

check_object() {
  local emitter=$1
  local expected=$2
  local seed=$3
  local stem=$4
  local object="$tmpdir/$stem-$seed.o"
  local binary="$tmpdir/$stem-$seed"

  "$emitter" "$seed" > "$object"
  file "$object" | grep -q 'Mach-O 64-bit object arm64'
  xcrun llvm-nm -m "$object" > "$tmpdir/symbols.txt"
  grep -q 'external _kernel' "$tmpdir/symbols.txt"
  test "$(grep -c '_aot_' "$tmpdir/symbols.txt")" -eq 2
  xcrun llvm-objdump -d "$object" > "$tmpdir/disassembly.txt"
  test "$(grep -c $'\tbl\t' "$tmpdir/disassembly.txt")" -ge 2
  xcrun llvm-objdump --section-headers "$object" > "$tmpdir/sections.txt"
  grep -q '__aot_stackmap' "$tmpdir/sections.txt"
  grep -q '__aot_layout' "$tmpdir/sections.txt"

  cat > "$tmpdir/harness.c" <<'EOF'
#include <stdint.h>
#include <stdio.h>
extern int64_t kernel(void);
int main(void) {
  int64_t result = kernel();
  printf("%lld\n", (long long)result);
  return result == EXPECTED ? 0 : 1;
}
EOF
  sed "s/EXPECTED/$expected/" "$tmpdir/harness.c" > "$tmpdir/harness-$stem-$seed.c"
  xcrun clang -arch arm64 "$tmpdir/harness-$stem-$seed.c" "$object" -o "$binary"
  test "$("$binary")" = "$expected"
}

for seed in 0 1 2; do
  check_object "$tmpdir/emit-chain" 42 "$seed" chain
  check_object "$tmpdir/emit-recursive" 1 "$seed" recursive
done

"$tmpdir/emit-allocation" > "$tmpdir/allocation.o"
xcrun llvm-nm -m "$tmpdir/allocation.o" | grep -q 'undefined.*external _aot_alloc_slow'
xcrun llvm-objdump -r "$tmpdir/allocation.o" | grep -q 'ARM64_RELOC_BRANCH26.*_aot_alloc_slow'
cat > "$tmpdir/allocation-harness.c" <<'EOF'
#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>
void *aot_alloc_slow(int64_t size, int64_t shape) {
  int64_t *result = calloc(1, (size_t)size);
  if (result) result[0] = shape;
  return result;
}
extern int64_t *kernel(void);
int main(void) {
  int64_t *result = kernel();
  int ok = result && result[0] == 1 && result[1] == 5;
  printf("%lld\n", result ? (long long)result[1] : -1LL);
  free(result);
  return ok ? 0 : 1;
}
EOF
xcrun clang -arch arm64 "$tmpdir/allocation-harness.c" "$tmpdir/allocation.o" \
  -o "$tmpdir/allocation"
test "$("$tmpdir/allocation")" = 5

echo "six call layouts and one external allocation relocation linked and executed"
