#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>

extern int64_t kernel(void);
int64_t aot_gc_enter(int64_t (*)(void));
int aot_gc_configure(size_t, int);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_moves(void);
uint64_t aot_gc_barriers(void);
void aot_gc_disable_barrier_for_test(void);

int main(int argc, char **argv) {
  int omit = argc > 1 && strcmp(argv[1], "omit-barrier") == 0;
  if (!aot_gc_configure(4096, 1)) return 2;
  if (omit) aot_gc_disable_barrier_for_test();
  int64_t answer = aot_gc_enter(kernel);
  if (answer != 41 || aot_gc_collections() == 0 || aot_gc_moves() == 0 ||
      (!omit && aot_gc_barriers() == 0)) {
    fprintf(stderr, "B11 property barrier mismatch: value=%lld gc=%llu moves=%llu barriers=%llu\n",
            (long long)answer, (unsigned long long)aot_gc_collections(),
            (unsigned long long)aot_gc_moves(), (unsigned long long)aot_gc_barriers());
    return 3;
  }
  return 0;
}
