#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

tmpdir=$(mktemp -d)
if [[ -n "${AOT_KEEP_NATIVE_GC_TMP:-}" ]]; then
  echo "native GC artifacts: $tmpdir" >&2
else
  trap 'rm -rf "$tmpdir"' EXIT
fi

coil build tools/emit-native-gc-object.coil -o "$tmpdir/emitter" >/dev/null
coil build tools/emit-native-gc-field-object.coil -o "$tmpdir/field-emitter" >/dev/null
coil build tools/emit-native-gc-argument-object.coil -o "$tmpdir/argument-emitter" >/dev/null
coil build tools/emit-native-gc-recursive-object.coil -o "$tmpdir/recursive-emitter" >/dev/null
coil build tools/emit-native-gc-barrier-object.coil -o "$tmpdir/barrier-emitter" >/dev/null
"$tmpdir/emitter" > "$tmpdir/program.o"
"$tmpdir/field-emitter" > "$tmpdir/field-program.o"
"$tmpdir/argument-emitter" > "$tmpdir/argument-program.o"
"$tmpdir/recursive-emitter" > "$tmpdir/recursive-program.o"
"$tmpdir/barrier-emitter" > "$tmpdir/barrier-program.o"
xcrun llvm-objdump -r "$tmpdir/program.o" | grep -q '_aot_alloc_slow'
xcrun llvm-objdump --section-headers "$tmpdir/program.o" | grep -q '__aot_stackmap'

cat > "$tmpdir/harness.c" <<'EOF'
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
int aot_gc_configure(size_t, int);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_verifications(void);
uint64_t aot_gc_moves(void);
uint64_t aot_gc_slow_paths(void);
extern int64_t kernel(void);
int64_t aot_gc_enter(int64_t (*)(void));
int main(int argc, char **argv) {
  int stress = argc > 1;
  if (!aot_gc_configure(4096, stress)) return 2;
  int64_t value = aot_gc_enter(kernel);
  uint64_t collections = aot_gc_collections();
  uint64_t verifications = aot_gc_verifications();
  uint64_t moves = aot_gc_moves();
  uint64_t slow_paths = aot_gc_slow_paths();
  printf("%lld %llu %llu %llu %llu\n", (long long)value,
         (unsigned long long)collections, (unsigned long long)verifications,
         (unsigned long long)moves, (unsigned long long)slow_paths);
  if (value != 41) return 3;
  if (stress && (collections == 0 || collections != verifications || moves < 1)) return 4;
  return 0;
}
EOF

xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  "$tmpdir/harness.c" tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmpdir/program.o" -o "$tmpdir/program"
test "$("$tmpdir/program")" = "41 0 0 0 0"
test "$("$tmpdir/program" stress)" = "41 2 2 1 2"
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  "$tmpdir/harness.c" tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmpdir/field-program.o" -o "$tmpdir/field-program"
field_out=$("$tmpdir/field-program" stress)
test "$(printf '%s' "$field_out" | cut -d' ' -f1)" = 41
test "$(printf '%s' "$field_out" | cut -d' ' -f2)" = 4
test "$(printf '%s' "$field_out" | cut -d' ' -f3)" = 4
test "$(printf '%s' "$field_out" | cut -d' ' -f4)" -ge 3
test "$(printf '%s' "$field_out" | cut -d' ' -f5)" = 4
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  "$tmpdir/harness.c" tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmpdir/argument-program.o" -o "$tmpdir/argument-program"
argument_out=$("$tmpdir/argument-program" stress)
test "$(printf '%s' "$argument_out" | cut -d' ' -f1)" = 41
test "$(printf '%s' "$argument_out" | cut -d' ' -f2)" = 2
test "$(printf '%s' "$argument_out" | cut -d' ' -f4)" -ge 1
test "$(printf '%s' "$argument_out" | cut -d' ' -f5)" = 2

cat > "$tmpdir/oom-harness.c" <<'EOF'
#include <stdint.h>
#include <stddef.h>
int aot_gc_configure(size_t, int);
extern int64_t kernel(void);
int64_t aot_gc_enter(int64_t (*)(void));
int main(void) {
  if (!aot_gc_configure(8, 0)) return 2;
  (void)aot_gc_enter(kernel);
  return 3;
}
EOF
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  "$tmpdir/oom-harness.c" tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmpdir/program.o" -o "$tmpdir/oom-program"
set +e
"$tmpdir/oom-program"
oom_status=$?
set -e
test "$oom_status" = 86

cat > "$tmpdir/recursive-harness.c" <<'EOF'
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
int aot_gc_configure(size_t, int);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_verifications(void);
uint64_t aot_gc_moves(void);
uint64_t aot_gc_slow_paths(void);
extern int64_t kernel(void);
int64_t aot_gc_enter(int64_t (*)(void));
int main(void) {
  if (!aot_gc_configure(4096, 1)) return 2;
  int64_t value = aot_gc_enter(kernel);
  uint64_t collections = aot_gc_collections();
  uint64_t verifications = aot_gc_verifications();
  uint64_t moves = aot_gc_moves();
  uint64_t slow_paths = aot_gc_slow_paths();
  printf("%lld %llu %llu %llu %llu\n", (long long)value,
         (unsigned long long)collections, (unsigned long long)verifications,
         (unsigned long long)moves, (unsigned long long)slow_paths);
  return value == 5050 && collections == 101 && verifications == 101 &&
         moves == 199 && slow_paths == 101 ? 0 : 3;
}
EOF
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  "$tmpdir/recursive-harness.c" tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmpdir/recursive-program.o" -o "$tmpdir/recursive-program"
test "$("$tmpdir/recursive-program")" = "5050 101 101 199 101"

cat > "$tmpdir/barrier-harness.c" <<'EOF'
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
int aot_gc_configure(size_t, int);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_verifications(void);
uint64_t aot_gc_promotions(void);
uint64_t aot_gc_barriers(void);
extern int64_t kernel(void);
int64_t aot_gc_enter(int64_t (*)(void));
int main(void) {
  if (!aot_gc_configure(4096, 1)) return 2;
  int64_t value = aot_gc_enter(kernel);
  printf("%lld %llu %llu %llu %llu\n", (long long)value,
         (unsigned long long)aot_gc_collections(),
         (unsigned long long)aot_gc_verifications(),
         (unsigned long long)aot_gc_promotions(),
         (unsigned long long)aot_gc_barriers());
  return 0;
}
EOF
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  "$tmpdir/barrier-harness.c" tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmpdir/barrier-program.o" -o "$tmpdir/barrier-program"
test "$("$tmpdir/barrier-program")" = "41 5 5 1 1"

cat > "$tmpdir/omitted-barrier-harness.c" <<'EOF'
#include <stdint.h>
#include <stddef.h>
int aot_gc_configure(size_t, int);
void aot_gc_disable_barrier_for_test(void);
extern int64_t kernel(void);
int64_t aot_gc_enter(int64_t (*)(void));
int main(void) {
  if (!aot_gc_configure(4096, 1)) return 2;
  aot_gc_disable_barrier_for_test();
  (void)aot_gc_enter(kernel);
  return 3;
}
EOF
xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
  "$tmpdir/omitted-barrier-harness.c" tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  "$tmpdir/barrier-program.o" -o "$tmpdir/omitted-barrier-program"
set +e
"$tmpdir/omitted-barrier-program"
omitted_barrier_status=$?
set -e
test "$omitted_barrier_status" = 86

echo "compiled fast allocation, promotion, recursive roots, and old-to-young barriers verified; OOM and omitted barriers trapped"
