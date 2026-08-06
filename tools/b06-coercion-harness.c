#include <math.h>
#include <stdint.h>
#include <stdio.h>

#ifndef MODE
#define MODE 0
#endif

extern int64_t kernel(double, double);

struct row { double a, b; int64_t expected[4]; };

int main(void) {
  static const struct row rows[] = {
    {NAN, 0.0, {-1, 0, 0, 0}},
    {INFINITY, 1.0, {-1, 0, 0, 0}},
    {-INFINITY, 1.0, {-1, 0, 0, 0}},
    {-0.0, 0.0, {-1, 0, 0, 0}},
    {3.9, 33.0, {-4, 6, 1, 1}},
    {-3.9, 33.0, {2, -6, -2, 2147483646}},
    {2147483648.0, 0.0, {2147483647, -2147483648LL, -2147483648LL, 2147483648LL}},
    {4294967297.75, 0.0, {-2, 1, 1, 1}},
    {-4294967297.75, 0.0, {0, -1, -1, 4294967295LL}},
  };
  for (unsigned i = 0; i < sizeof(rows) / sizeof(rows[0]); ++i) {
    int64_t got = kernel(rows[i].a, rows[i].b);
    if (got != rows[i].expected[MODE]) {
      fprintf(stderr, "B06 coercion mode %d row %u got %lld expected %lld\n",
              MODE, i, (long long)got, (long long)rows[i].expected[MODE]);
      return 1;
    }
  }
  return 0;
}
