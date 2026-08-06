#include <math.h>
#include <stdint.h>
#include <stdio.h>

extern int64_t kernel(double value);

int main(void) {
#ifdef PRINT_MATRIX
  printf("nan-truthy|bool|%lld\n", (long long)kernel(NAN));
  printf("negative-zero-truthy|bool|%lld\n", (long long)kernel(-0.0));
  printf("infinity-truthy|bool|%lld\n", (long long)kernel(INFINITY));
  return 0;
#else
  if (kernel(NAN) != 0) return 1;
  if (kernel(-0.0) != 0) return 2;
  if (kernel(INFINITY) != 1) return 3;
  return 0;
#endif
}
