#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

extern int64_t kernel(void);
int aot_gc_configure(size_t capacity, int stress);
int64_t aot_gc_enter(int64_t (*entry)(void));

static uint64_t monotonic_ns(void) {
  struct timespec value;
  if (clock_gettime(CLOCK_MONOTONIC_RAW, &value) != 0) exit(3);
  return (uint64_t)value.tv_sec * UINT64_C(1000000000) + (uint64_t)value.tv_nsec;
}

int main(int argc, char **argv) {
  int samples = argc > 1 ? atoi(argv[1]) : 9;
  int iterations = argc > 2 ? atoi(argv[2]) : 1;
  size_t capacity = argc > 3 ? (size_t)strtoull(argv[3], NULL, 10) : 512u * 1024u * 1024u;
  if (samples < 1 || iterations < 1 || !aot_gc_configure(capacity, 0)) return 2;
  for (int sample = 0; sample < samples; ++sample) {
    int64_t result = 0;
    uint64_t before = monotonic_ns();
    for (int iteration = 0; iteration < iterations; ++iteration)
      result ^= aot_gc_enter(kernel);
    uint64_t elapsed = monotonic_ns() - before;
    printf("sample=%d runtime_ns=%" PRIu64 " per_iteration_ns=%.3f result=%" PRId64 "\n",
           sample, elapsed, (double)elapsed / iterations, result);
  }
  return 0;
}
