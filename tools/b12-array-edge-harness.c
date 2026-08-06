#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include "js-value.h"

extern uint64_t kernel(void);
uint64_t aot_gc_enter(uint64_t (*)(void));
int aot_gc_configure(size_t, int);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_moves(void);
uint64_t aot_gc_barriers(void);
void aot_gc_disable_barrier_for_test(void);
void aot_gc_disable_array_scan_for_test(void);

int main(int argc, char **argv) {
  int omit_scan = argc > 1 && strcmp(argv[1], "omit-scan") == 0;
  int omit_barrier = argc > 1 && strcmp(argv[1], "omit-barrier") == 0;
  if (!aot_gc_configure(4096, 1)) return 2;
  if (omit_scan) aot_gc_disable_array_scan_for_test();
  if (omit_barrier) aot_gc_disable_barrier_for_test();
  AotJsValue answer = aot_gc_enter(kernel);
  if (answer != aot_js_box_int(33) || aot_gc_collections() == 0 ||
      aot_gc_moves() == 0 || (!omit_barrier && !omit_scan && aot_gc_barriers() == 0)) {
    fprintf(stderr, "B12 array edge mismatch: 0x%016llx gc=%llu moves=%llu barriers=%llu\n",
            (unsigned long long)answer,
            (unsigned long long)aot_gc_collections(),
            (unsigned long long)aot_gc_moves(),
            (unsigned long long)aot_gc_barriers());
    return 3;
  }
  return 0;
}
