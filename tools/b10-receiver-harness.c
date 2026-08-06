#include <stdint.h>
#include <stddef.h>
#include <stdio.h>

int aot_gc_configure(size_t, int);
int64_t aot_gc_enter(int64_t (*)(void));
uint64_t aot_gc_collections(void);
uint64_t aot_gc_verifications(void);
uint64_t aot_gc_moves(void);
uint64_t aot_gc_allocations(void);
extern int64_t kernel(void);

int main(int argc, char **argv) {
  int stress = argc > 1;
  if (!aot_gc_configure(4096, stress)) return 2;
  int64_t answer = aot_gc_enter(kernel);
  uint64_t collections = aot_gc_collections();
  uint64_t verifications = aot_gc_verifications();
  uint64_t moves = aot_gc_moves();
  uint64_t allocations = aot_gc_allocations();
  if (answer != 421711 || allocations < 4 ||
      (stress && (collections == 0 || collections != verifications || moves == 0))) {
    fprintf(stderr, "B10 native mismatch: answer=%lld alloc=%llu gc=%llu/%llu moves=%llu\n",
      (long long)answer, (unsigned long long)allocations, (unsigned long long)collections,
      (unsigned long long)verifications, (unsigned long long)moves);
    return 1;
  }
  return 0;
}
