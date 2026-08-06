#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

extern int64_t kernel(int64_t);
int aot_gc_configure(size_t, int);
int64_t aot_gc_enter(int64_t (*)(void));

static int64_t benchmark_input;
static int benchmark_repeats;

static int64_t run_benchmark(void) {
  int32_t result = 0;
  for (int i = 0; i < benchmark_repeats; ++i)
    result ^= (int32_t)kernel(benchmark_input + i);
  return result;
}

static uint64_t elapsed_ns(struct timespec before, struct timespec after) {
  return (uint64_t)(after.tv_sec - before.tv_sec) * 1000000000ull +
         (uint64_t)(after.tv_nsec - before.tv_nsec);
}

int main(int argc, char **argv) {
  if (argc != 3) return 2;
  benchmark_input = strtoll(argv[1], NULL, 10);
  benchmark_repeats = atoi(argv[2]);
  if (benchmark_repeats < 1) return 3;
  if (!aot_gc_configure(64u * 1024u * 1024u, 0)) return 4;
  struct timespec before, after;
  clock_gettime(CLOCK_MONOTONIC_RAW, &before);
  int64_t result = aot_gc_enter(run_benchmark);
  clock_gettime(CLOCK_MONOTONIC_RAW, &after);
  printf("result=%" PRId64 " runtime_ns=%" PRIu64 "\n", result, elapsed_ns(before, after));
  return 0;
}
