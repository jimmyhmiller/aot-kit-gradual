#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

extern int64_t kernel();
int aot_gc_configure(size_t, int);
int64_t aot_gc_enter(int64_t (*)(void));
int64_t aot_gc_enter1(int64_t (*)(int64_t), int64_t);
uint64_t aot_gc_collections(void);
uint64_t aot_gc_moves(void);

int main(int argc, char **argv) {
  if (argc != 5) return 2;
  int64_t input = strtoll(argv[1], NULL, 10);
  int stress = atoi(argv[2]) != 0;
  int warmup = atoi(argv[3]) != 0;
  int has_argument = atoi(argv[4]) != 0;
  if (!aot_gc_configure(4096, stress)) return 3;
  if (warmup) (void)aot_gc_enter1((int64_t (*)(int64_t))kernel, 2);
  int64_t result = has_argument
    ? aot_gc_enter1((int64_t (*)(int64_t))kernel, input)
    : aot_gc_enter((int64_t (*)(void))kernel);
  printf("result=%" PRId64 " collections=%" PRIu64 " moves=%" PRIu64 "\n",
         result, aot_gc_collections(), aot_gc_moves());
  return 0;
}
