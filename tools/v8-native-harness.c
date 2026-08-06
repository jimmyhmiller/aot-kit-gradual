#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

extern int64_t kernel(void);
int aot_gc_configure(size_t capacity, int stress);
int64_t aot_gc_enter(int64_t (*entry)(void));
uint64_t aot_gc_collections(void);
uint64_t aot_gc_moves(void);

int main(int argc, char **argv) {
  size_t capacity = argc > 1 ? (size_t)strtoull(argv[1], NULL, 10) : 64u * 1024u * 1024u;
  int stress = argc > 2 ? atoi(argv[2]) != 0 : 0;
  if (!aot_gc_configure(capacity, stress)) return 2;
  int64_t result = aot_gc_enter(kernel);
  printf("result=%" PRId64 " collections=%" PRIu64 " moves=%" PRIu64 "\n",
         result, aot_gc_collections(), aot_gc_moves());
  return 0;
}
