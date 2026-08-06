#include <math.h>
#include <stdint.h>
#include <stdio.h>

#ifndef MODE
#define MODE 0
#endif

#if MODE < 14
extern double kernel(double a, double b);
#else
extern int64_t kernel(double a, double b);
#endif

static int64_t bits(double value) {
  union { double number; int64_t bits; } encoded = { .number = value };
  return encoded.bits;
}

int main(void) {
#if MODE == 0
  printf("tag-max-plus-one|number|%lld\n", (long long)bits(kernel(140737488355327.0, 1.0)));
#elif MODE == 1
  printf("max-safe-plus-two|number|%lld\n", (long long)bits(kernel(9007199254740991.0, 2.0)));
#elif MODE == 2
  printf("large-add|number|%lld\n", (long long)bits(kernel(5e18, 5e18)));
#elif MODE == 3
  printf("mixed-add|number|%lld\n", (long long)bits(kernel(1.0, 0.5)));
#elif MODE == 4
  printf("zero-times-negative|number|%lld\n", (long long)bits(kernel(0.0, -1.0)));
#elif MODE == 5
  printf("zero-div-negative|number|%lld\n", (long long)bits(kernel(0.0, -1.0)));
#elif MODE == 6
  printf("negative-zero-times-negative|number|%lld\n", (long long)bits(kernel(-0.0, -1.0)));
#elif MODE == 7
  printf("one-div-zero|number|%lld\n", (long long)bits(kernel(1.0, 0.0)));
#elif MODE == 8
  printf("one-div-negative-zero|number|%lld\n", (long long)bits(kernel(1.0, -0.0)));
#elif MODE == 9
  printf("zero-div-zero|number|%lld\n", (long long)bits(kernel(0.0, 0.0)));
#elif MODE == 10
  printf("infinity-minus-infinity|number|%lld\n", (long long)bits(kernel(INFINITY, INFINITY)));
#elif MODE == 11
  printf("infinity-times-zero|number|%lld\n", (long long)bits(kernel(INFINITY, 0.0)));
#elif MODE == 12
  printf("negate-negative-zero|number|%lld\n", (long long)bits(kernel(-0.0, 0.0)));
#elif MODE == 13
  printf("half|number|%lld\n", (long long)bits(kernel(1.0, 2.0)));
#elif MODE == 14
  printf("nan-strict-equal|bool|%lld\n", (long long)kernel(NAN, NAN));
#elif MODE == 15
  printf("signed-zero-strict-equal|bool|%lld\n", (long long)kernel(0.0, -0.0));
#elif MODE == 16
  printf("nan-less-than-one|bool|%lld\n", (long long)kernel(NAN, 1.0));
#else
  printf("negative-infinity-less-than-infinity|bool|%lld\n",
         (long long)kernel(-INFINITY, INFINITY));
#endif
  return 0;
}
