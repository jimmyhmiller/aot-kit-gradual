#include "js-value.h"

#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

extern uint64_t kernel(void);
uint64_t aot_gc_enter(uint64_t (*)(void));
int aot_gc_configure(size_t, int);

int main(int argc, char **argv) {
  if (!aot_gc_configure(32, 0)) return 2;
  uint64_t answer = aot_gc_enter(kernel);
  uint64_t expected = argc > 1 ? strtoull(argv[1], NULL, 10) : 204;
  if (answer != expected) {
    fprintf(stderr, "B13 boundary mismatch: %llu\n", (unsigned long long)answer);
    return 3;
  }
  return 0;
}
