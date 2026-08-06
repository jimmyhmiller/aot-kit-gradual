#include <stdint.h>
#include <stddef.h>
#include <stdio.h>

int aot_gc_configure(size_t, int);
int64_t aot_gc_enter1(int64_t (*)(int64_t), int64_t);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_verifications(void);
uint64_t aot_gc_moves(void);
uint64_t aot_gc_allocations(void);
extern int64_t kernel(int64_t limit);

int main(int argc, char **argv) {
  int stress = argc > 1;
  if (!aot_gc_configure(4096, stress)) return 2;
  int64_t two = aot_gc_enter1(kernel, 2);
  int64_t five = aot_gc_enter1(kernel, 5);
  uint64_t collections = aot_gc_collections();
  uint64_t verifications = aot_gc_verifications();
  uint64_t moves = aot_gc_moves();
  uint64_t allocations = aot_gc_allocations();
  /* Each invocation allocates two shared cells and three materialized closure environments.
     Ten across both calls distinguishes the native environment ABI from cell-only lowering. */
  if (two != 301020 || five != 601920 || allocations != 10 ||
      (stress && (collections == 0 || collections != verifications || moves == 0))) {
    fprintf(stderr, "B09 native mismatch: limit2=%lld limit5=%lld alloc=%llu gc=%llu/%llu moves=%llu\n",
      (long long)two, (long long)five, (unsigned long long)allocations,
      (unsigned long long)collections, (unsigned long long)verifications,
      (unsigned long long)moves);
    return 1;
  }
  printf("result=%lld collections=%llu moves=%llu\n", (long long)five,
    (unsigned long long)collections, (unsigned long long)moves);
  return 0;
}
