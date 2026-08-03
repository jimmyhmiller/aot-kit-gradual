#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

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

static uint64_t elapsed_ns(struct timespec before, struct timespec after) {
  return (uint64_t)(after.tv_sec - before.tv_sec) * 1000000000ull +
         (uint64_t)(after.tv_nsec - before.tv_nsec);
}

int main(int argc, char **argv) {
  if (argc != 4) return 2;
  int depth = atoi(argv[1]);
  int stress = atoi(argv[2]);
  int verify_heap = atoi(argv[3]);
  if (depth < 4 || depth > 21) return 3;
  size_t capacity = depth >= 18 ? (size_t)256 * 1024 * 1024 : (size_t)8 * 1024 * 1024;
  if (!aot_gc_configure(capacity, stress)) return 4;
  struct timespec before, after;
  clock_gettime(CLOCK_MONOTONIC_RAW, &before);
  int64_t *object = aot_gc_enter1(kernel, depth);
  clock_gettime(CLOCK_MONOTONIC_RAW, &after);
  if (!object) return 5;
  int64_t *fields = object + 1;
  int64_t expected_allocations = tree_check(depth + 1) + tree_check(depth) + 1;
  if (fields[0] != depth + 1 || fields[1] != tree_check(depth + 1)) return 10;
  for (int slot = 0; slot < 9; ++slot) {
    int work_depth = 4 + slot * 2;
    int base = 2 + slot * 3;
    if (fields[base] != work_depth) return 11;
    int64_t iterations = work_depth <= depth ? pow2i(depth - work_depth + 4) : 0;
    int64_t check = iterations * tree_check(work_depth);
    expected_allocations += check;
    if (fields[base + 1] != iterations || fields[base + 2] != check) return 12;
  }
  if (fields[29] != depth || fields[30] != tree_check(depth)) return 13;
  uint64_t collections = aot_gc_collections();
  uint64_t verifications = aot_gc_verifications();
  if (aot_gc_allocations() != (uint64_t)expected_allocations) return 16;
  if (aot_gc_bytes_allocated() != (uint64_t)(expected_allocations - 1) * 24u + 256u) return 17;
  if (stress && aot_gc_slow_paths() != aot_gc_allocations()) return 18;
  if (stress && (collections == 0 || collections != verifications)) return 14;
  if (verify_heap && collections != verifications) return 15;
  for (int i = 0; i < 31; ++i) printf("%s%lld", i ? " " : "", (long long)fields[i]);
  printf(" | allocations=%llu bytes=%llu collections=%llu verifications=%llu moves=%llu slow=%llu copied=%llu promoted=%llu peak=%llu frames=%llu gc_ns=%llu runtime_ns=%llu\n",
         (unsigned long long)aot_gc_allocations(),
         (unsigned long long)aot_gc_bytes_allocated(),
         (unsigned long long)collections, (unsigned long long)verifications,
         (unsigned long long)aot_gc_moves(), (unsigned long long)aot_gc_slow_paths(),
         (unsigned long long)aot_gc_copied_bytes(),
         (unsigned long long)aot_gc_promoted_bytes(),
         (unsigned long long)aot_gc_peak_live_heap(),
         (unsigned long long)aot_gc_maximum_frames(),
         (unsigned long long)aot_gc_nanoseconds(),
         (unsigned long long)elapsed_ns(before, after));
  return 0;
}
