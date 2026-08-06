#include <stdint.h>

#ifndef MODE
#define MODE 0
#endif

extern double kernel(void);

int main(void) {
  union { double number; uint64_t bits; } result = { .number = kernel() };
  static const uint64_t expected[] = {
    UINT64_C(0), UINT64_C(0x8000000000000000),
    UINT64_C(0x7ff0000000000000), UINT64_C(0x7ff8000000000000)
  };
  return result.bits == expected[MODE] ? 0 : 1;
}
