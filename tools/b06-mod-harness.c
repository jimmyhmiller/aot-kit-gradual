#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

extern double kernel(double, double);

static uint64_t bits(double value) {
  uint64_t result;
  memcpy(&result, &value, sizeof(result));
  return result;
}

struct row { double a, b; uint64_t expected; };

int main(void) {
  static const struct row rows[] = {
    {5.5, 2.0, UINT64_C(0x3ff8000000000000)},
    {-4.0, 2.0, UINT64_C(0x8000000000000000)},
    {1.0, 0.0, UINT64_C(0x7ff8000000000000)},
    {INFINITY, 2.0, UINT64_C(0x7ff8000000000000)},
    {7.0, INFINITY, UINT64_C(0x401c000000000000)},
    {-5.0, 2.0, UINT64_C(0xbff0000000000000)},
  };
  for (unsigned i = 0; i < sizeof(rows) / sizeof(rows[0]); ++i) {
    uint64_t got = bits(kernel(rows[i].a, rows[i].b));
    if (got != rows[i].expected) {
      fprintf(stderr, "B06 remainder row %u got %016llx expected %016llx\n",
              i, (unsigned long long)got, (unsigned long long)rows[i].expected);
      return 1;
    }
  }
  return 0;
}
