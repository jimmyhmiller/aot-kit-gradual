#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

extern int64_t kernel(int64_t);
int aot_gc_configure(size_t, int);
int64_t aot_gc_enter1(int64_t (*)(int64_t), int64_t);

static uint64_t elapsed_ns(struct timespec before, struct timespec after) {
  return (uint64_t)(after.tv_sec - before.tv_sec) * 1000000000ull +
         (uint64_t)(after.tv_nsec - before.tv_nsec);
}

int main(int argc, char **argv) {
  if (argc != 3) return 2;
  int64_t input = strtoll(argv[1], NULL, 10);
  int repeats = atoi(argv[2]);
  if (repeats < 1) return 3;
  if (!aot_gc_configure(64u * 1024u * 1024u, 0)) return 4;
  int64_t result = 0;
  struct timespec before, after;
  clock_gettime(CLOCK_MONOTONIC_RAW, &before);
  for (int i = 0; i < repeats; ++i) result = aot_gc_enter1(kernel, input);
  clock_gettime(CLOCK_MONOTONIC_RAW, &after);
  printf("result=%" PRId64 " runtime_ns=%" PRIu64 "\n", result, elapsed_ns(before, after));
  return 0;
}
