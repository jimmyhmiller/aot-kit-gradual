#include <stdint.h>
#include <stdio.h>

#ifndef MODE
#define MODE 0
#endif

extern int64_t kernel(int64_t, int64_t);

static int32_t i32(uint32_t value) { return (int32_t)value; }

int main(void) {
  int64_t a = MODE == 7 ? -17 : -2147483649LL;
  int64_t b = MODE == 7 ? 5 : 36;
  int64_t expected;
  uint32_t ua = (uint32_t)a, ub = (uint32_t)b, count = ub & 31;
  switch (MODE) {
    case 0: expected = i32(ua & ub); break;
    case 1: expected = i32(ua | ub); break;
    case 2: expected = i32(ua ^ ub); break;
    case 3: expected = i32(ua << count); break;
    case 4: expected = i32(ua) >> count; break;
    case 5: expected = ua >> count; break;
    case 6: expected = i32(~ua); break;
    default: expected = i32((uint32_t)a) % i32((uint32_t)b); break;
  }
  int64_t got = kernel(a, b);
  if (got != expected) {
    fprintf(stderr, "B06 mode %d got %lld expected %lld\n", MODE,
            (long long)got, (long long)expected);
    return 1;
  }
  return 0;
}
