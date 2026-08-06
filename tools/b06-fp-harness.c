#include <math.h>
#include <stdint.h>
#include <stdio.h>

#ifndef MODE
#define MODE 0
#endif

#if MODE == 7
extern double kernel(double, double);
#else
extern int64_t kernel(double, double);
#endif

static uint32_t to_u32(double value) {
  if (!isfinite(value) || value == 0) return 0;
  double residue = fmod(trunc(value), 4294967296.0);
  if (residue < 0) residue += 4294967296.0;
  return (uint32_t)residue;
}

static int64_t expected(double a, double b) {
  uint32_t ua = to_u32(a), ub = to_u32(b), count = ub & 31;
  switch (MODE) {
    case 0: return (int32_t)(ua & ub);
    case 1: return (int32_t)(ua | ub);
    case 2: return (int32_t)(ua ^ ub);
    case 3: return (int32_t)(ua << count);
    case 4: return (int32_t)ua >> count;
    case 5: return ua >> count;
    default: return (int32_t)~ua;
  }
}

int main(void) {
  static const double values[] = {
    NAN, INFINITY, -INFINITY, 0.0, -0.0, 1.9, -1.9,
    2147483647.9, 2147483648.0, 4294967295.0, 4294967296.0,
    4294967297.0, -4294967297.0, 9007199254740991.0
  };
  size_t count = sizeof(values) / sizeof(values[0]);
  for (size_t i = 0; i < count; i++) {
    double a = values[i], b = values[(i + 5) % count];
#if MODE == 7
    double got = kernel(a, b), want = fmod(a, b);
    if (!((isnan(got) && isnan(want)) ||
          (got == want && (!signbit(got) == !signbit(want))))) {
      fprintf(stderr, "B06 FP modulo case %zu got %.17g expected %.17g\n", i, got, want);
      return 1;
    }
#else
    int64_t got = kernel(a, b), want = expected(a, b);
    if (got != want) {
      fprintf(stderr, "B06 FP mode %d case %zu got %lld expected %lld\n",
              MODE, i, (long long)got, (long long)want);
      return 1;
    }
#endif
  }
  return 0;
}
