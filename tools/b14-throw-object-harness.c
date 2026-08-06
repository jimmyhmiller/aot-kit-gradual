#include <stdint.h>
#include "js-value.h"
extern uint64_t kernel(void);
uint64_t aot_gc_enter(uint64_t (*)(void));
int aot_gc_configure(uint64_t, int);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_moves(void);
int main(void) {
  if (!aot_gc_configure(4096, 1)) return 2;
  uint64_t answer = aot_gc_enter(kernel);
#ifdef EXPECT_SWALLOW
  return aot_js_managed(answer) && aot_gc_collections() > 0 && aot_gc_moves() > 0 ? 0 : 3;
#else
  (void)answer;
  return 4;
#endif
}
