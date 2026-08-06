#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

extern int64_t kernel(void);
int aot_gc_configure(size_t, int);
int64_t aot_gc_enter(int64_t (*)(void));
uint64_t aot_gc_collections(void);
uint64_t aot_gc_moves(void);

int main(int argc, char **argv) {
  int stress = argc > 1;
  /* Five simultaneously live depth-four trees exceed the generic 4 KiB conformance semispace. */
  if (!aot_gc_configure(16384, stress)) return 2;
  int64_t result = aot_gc_enter(kernel);
  printf("result=%" PRId64 " collections=%" PRIu64 " moves=%" PRIu64 "\n",
         result, aot_gc_collections(), aot_gc_moves());
  return 0;
}
