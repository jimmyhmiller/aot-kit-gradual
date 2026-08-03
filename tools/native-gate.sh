#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

coil build tools/emit-kernel-object.coil -o "$tmpdir/emitter" >/dev/null
"$tmpdir/emitter" > "$tmpdir/kernel.o"

file "$tmpdir/kernel.o" | grep -q 'Mach-O 64-bit object arm64'
xcrun llvm-objdump -d "$tmpdir/kernel.o" > "$tmpdir/disassembly.txt"
grep -q 'add' "$tmpdir/disassembly.txt"
grep -q 'mul' "$tmpdir/disassembly.txt"
grep -q 'ret' "$tmpdir/disassembly.txt"

cat > "$tmpdir/harness.c" <<'EOF'
#include <stdio.h>
#include <stdint.h>
extern int64_t kernel(void);
int main(void) {
  int64_t value = kernel();
  printf("%lld\n", (long long)value);
  return value == 84 ? 0 : 1;
}
EOF

xcrun clang -arch arm64 "$tmpdir/harness.c" "$tmpdir/kernel.o" -o "$tmpdir/kernel"
test "$("$tmpdir/kernel")" = 84
echo "arm64 Mach-O linked and executed; kernel returned 84"
