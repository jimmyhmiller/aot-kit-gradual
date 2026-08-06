#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include "js-value.h"
#include "js-value.h"

extern uint64_t kernel(void);
uint64_t aot_gc_enter(uint64_t (*)(void));
int aot_gc_configure(size_t, int);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_moves(void);

int main(int argc, char **argv) {
  int stress = argc > 1;
  if (!aot_gc_configure(4096, stress)) return 2;
  AotJsValue answer = aot_gc_enter(kernel);
  if (answer != aot_js_box_int(42) ||
      (stress && (aot_gc_collections() == 0 || aot_gc_moves() == 0))) {
    fprintf(stderr, "B11 native prototype mismatch: value=0x%016llx gc=%llu moves=%llu\n",
            (unsigned long long)answer,
            (unsigned long long)aot_gc_collections(),
            (unsigned long long)aot_gc_moves());
    return 3;
  }
  return 0;
}
