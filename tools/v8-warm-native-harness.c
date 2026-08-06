#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

extern int64_t kernel(void);
int aot_gc_configure(size_t capacity, int stress);
int64_t aot_gc_enter(int64_t (*entry)(void));

static uint64_t now_ns(void) {
  struct timespec value;
  clock_gettime(CLOCK_MONOTONIC_RAW, &value);
  return (uint64_t)value.tv_sec * 1000000000ull + (uint64_t)value.tv_nsec;
}

int main(int argc, char **argv) {
  if (argc != 5) return 2;
  int warmups = atoi(argv[1]);
  int samples = atoi(argv[2]);
  int iterations = atoi(argv[3]);
  size_t capacity = (size_t)strtoull(argv[4], NULL, 10);
  if (warmups < 0 || samples < 1 || iterations < 1) return 3;
  if (!aot_gc_configure(capacity, 0)) return 4;

  int64_t result = 0;
  for (int i = 0; i < warmups; ++i) result = aot_gc_enter(kernel);
  for (int sample = 0; sample < samples; ++sample) {
    uint64_t before = now_ns();
    for (int i = 0; i < iterations; ++i) result = aot_gc_enter(kernel);
    uint64_t elapsed = now_ns() - before;
    printf("sample=%d runtime_ns=%" PRIu64 " per_iteration_ns=%.3f result=%" PRId64 "\n",
           sample, elapsed, (double)elapsed / (double)iterations, result);
  }
  return result == 0 ? 0 : 5;
}
