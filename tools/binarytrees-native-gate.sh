#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

depth=4
stress=0
verify_heap=0
seed=0
registers=10
seed_count=1
typescript_frontend=0
while (($#)); do
  case "$1" in
    --depth) depth="$2"; shift 2 ;;
    --stress) stress=1; shift ;;
    --verify-heap) verify_heap=1; shift ;;
    --seed) seed="$2"; shift 2 ;;
    --seed-count) seed_count="$2"; shift 2 ;;
    --registers) registers="$2"; shift 2 ;;
    --typescript) typescript_frontend=1; shift ;;
    *) echo "usage: tools/binarytrees-native-gate.sh [--depth N] [--stress] [--verify-heap] [--seed N] [--seed-count N] [--registers N] [--typescript]" >&2; exit 2 ;;
  esac
done

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

if ((typescript_frontend)); then
  node tools/generate-typescript-binarytrees.mjs --emitter "$tmpdir/emitter.coil"
  archive=$(tools/build-typescript-go-bridge.sh)
  coil build "$tmpdir/emitter.coil" -o "$tmpdir/emitter" \
    --link-flag "-Wl,-force_load,$archive" \
    --link-flag -framework --link-flag CoreFoundation \
    --link-flag -framework --link-flag Security >/dev/null
else
  coil build tools/emit-binarytrees-object.coil -o "$tmpdir/emitter" >/dev/null
fi

cat > "$tmpdir/harness.c" <<'EOF'
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>

#ifndef AOT_TYPESCRIPT_FRONTEND
#define AOT_TYPESCRIPT_FRONTEND 0
#endif

int aot_gc_configure(size_t, int);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_verifications(void);
uint64_t aot_gc_moves(void);
uint64_t aot_gc_slow_paths(void);
uint64_t aot_gc_allocations(void);
uint64_t aot_gc_bytes_allocated(void);
uint64_t aot_gc_copied_bytes(void);
uint64_t aot_gc_promoted_bytes(void);
uint64_t aot_gc_peak_live_heap(void);
uint64_t aot_gc_maximum_frames(void);
uint64_t aot_gc_nanoseconds(void);
extern int64_t *kernel(int64_t);
int64_t *aot_gc_enter1(int64_t *(*)(int64_t), int64_t);

static int64_t pow2i(int n) {
  int64_t value = 1;
  while (n-- > 0) value *= 2;
  return value;
}

static int64_t tree_check(int depth) { return pow2i(depth + 1) - 1; }

int main(int argc, char **argv) {
  if (argc != 4) return 2;
  int depth = atoi(argv[1]);
  int stress = atoi(argv[2]);
  int verify_heap = atoi(argv[3]);
  if (depth < 4 || depth > 21) return 3;
  size_t capacity = depth >= 18 ? (size_t)256 * 1024 * 1024 : (size_t)8 * 1024 * 1024;
  if (!aot_gc_configure(capacity, stress)) return 4;
  int64_t *object = aot_gc_enter1(kernel, depth);
  if (!object) return 5;
  int64_t *fields = object + 1;
  /* The product TypeScript frontend materializes a function object and prototype object for each
     of this benchmark's six declarations before entering main. They are observable runtime
     allocations and therefore belong in the exact GC accounting. */
  int64_t bootstrap_allocations = AOT_TYPESCRIPT_FRONTEND ? 12 : 0;
  int64_t expected_allocations =
    tree_check(depth + 1) + tree_check(depth) + 1 + bootstrap_allocations;
  if (fields[0] != depth + 1 || fields[1] != tree_check(depth + 1)) {
    fprintf(stderr, "stretch mismatch got depth=%lld check=%lld expected depth=%d check=%lld\n",
            (long long)fields[0], (long long)fields[1], depth + 1,
            (long long)tree_check(depth + 1));
    return 10;
  }
  for (int slot = 0; slot < 9; ++slot) {
    int work_depth = 4 + slot * 2;
    int base = 2 + slot * 3;
    if (fields[base] != work_depth) return 11;
    int64_t iterations = work_depth <= depth ? pow2i(depth - work_depth + 4) : 0;
    int64_t check = iterations * tree_check(work_depth);
    expected_allocations += check;
    if (fields[base + 1] != iterations || fields[base + 2] != check) {
      fprintf(stderr, "work mismatch depth=%d got iterations=%lld check=%lld expected=%lld/%lld\n",
              work_depth, (long long)fields[base + 1], (long long)fields[base + 2],
              (long long)iterations, (long long)check);
      return 12;
    }
  }
  if (fields[29] != depth || fields[30] != tree_check(depth)) {
    fprintf(stderr, "long-lived mismatch got depth=%lld check=%lld expected=%d/%lld collections=%llu moves=%llu slow=%llu\n",
            (long long)fields[29], (long long)fields[30], depth,
            (long long)tree_check(depth), (unsigned long long)aot_gc_collections(),
            (unsigned long long)aot_gc_moves(), (unsigned long long)aot_gc_slow_paths());
    return 13;
  }
  uint64_t collections = aot_gc_collections();
  uint64_t verifications = aot_gc_verifications();
  if (aot_gc_allocations() != (uint64_t)expected_allocations) {
    fprintf(stderr, "allocation mismatch got=%llu expected=%lld\n",
            (unsigned long long)aot_gc_allocations(), (long long)expected_allocations);
    return 16;
  }
  uint64_t expected_bytes =
    (uint64_t)(expected_allocations - bootstrap_allocations - 1) * 24u + 256u +
    (uint64_t)bootstrap_allocations * 8u;
  if (aot_gc_bytes_allocated() != expected_bytes)
    return 17;
  if (stress && aot_gc_slow_paths() != aot_gc_allocations()) return 18;
  if (stress && (collections == 0 || collections != verifications)) return 14;
  if (verify_heap && collections != verifications) return 15;
  for (int i = 0; i < 31; ++i) printf("%s%lld", i ? " " : "", (long long)fields[i]);
  printf(" | allocations=%llu bytes=%llu collections=%llu verifications=%llu moves=%llu slow=%llu copied=%llu promoted=%llu peak=%llu frames=%llu gc_ns=%llu\n",
         (unsigned long long)aot_gc_allocations(),
         (unsigned long long)aot_gc_bytes_allocated(),
         (unsigned long long)collections, (unsigned long long)verifications,
         (unsigned long long)aot_gc_moves(), (unsigned long long)aot_gc_slow_paths(),
         (unsigned long long)aot_gc_copied_bytes(),
         (unsigned long long)aot_gc_promoted_bytes(),
         (unsigned long long)aot_gc_peak_live_heap(),
         (unsigned long long)aot_gc_maximum_frames(),
         (unsigned long long)aot_gc_nanoseconds());
  return 0;
}
EOF

last_output=""
for ((ordinal = 0; ordinal < seed_count; ++ordinal)); do
  current_seed=$((seed + ordinal))
  "$tmpdir/emitter" "$current_seed" "$registers" > "$tmpdir/binarytrees.o"
  text_hex=$(xcrun llvm-objdump --section-headers "$tmpdir/binarytrees.o" | awk '$2 == "__text" { print $3 }')
  code_size=$((16#$text_hex))
  xcrun clang -arch arm64 -O1 -fno-omit-frame-pointer \
    -DAOT_TYPESCRIPT_FRONTEND="$typescript_frontend" \
    "$tmpdir/harness.c" tools/native-gc-runtime.c tools/native-gc-trampoline.S \
    "$tmpdir/binarytrees.o" -o "$tmpdir/binarytrees"
  last_output=$("$tmpdir/binarytrees" "$depth" "$stress" "$verify_heap")
  last_output="$last_output code_size=$code_size"
done

if ((seed_count == 1)); then
  printf '%s\n' "$last_output"
else
  printf 'native seed matrix: depth=%d seeds=%d..%d registers=%d\n' \
    "$depth" "$seed" "$((seed + seed_count - 1))" "$registers"
fi
