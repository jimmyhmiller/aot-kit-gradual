#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifndef MODE
#define MODE 0
#endif

#if MODE >= 8
extern double kernel(int64_t a, int64_t b);
#elif MODE < 5
#if MODE == 0
extern double kernel(double a, int64_t b);
#else
extern double kernel(double a, double b);
#endif
#else
extern int64_t kernel(double a, double b);
#endif

int main(void) {
#if MODE == 0
  double result = kernel(1.25, 3);
  double expected = 4.25;
  const char *name = "mixed-add";
#elif MODE == 1
  double result = kernel(7.5, 2.0), expected = 5.5;
  const char *name = "subtract";
#elif MODE == 2
  double result = kernel(1.5, -2.0), expected = -3.0;
  const char *name = "multiply";
#elif MODE == 3
  double result = kernel(7.0, 2.0), expected = 3.5;
  const char *name = "divide";
#elif MODE == 4
  double result = kernel(-0.0, 0.0);
  double expected = -0.0;
  const char *name = "negative-zero";
#elif MODE == 5
  int64_t result = kernel(NAN, NAN), expected = 0;
  const char *name = "nan-equal";
#elif MODE == 6
  int64_t result = kernel(NAN, 1.0), expected = 0;
  const char *name = "nan-less-than";
#elif MODE == 7
  int64_t result = kernel(-0.0, 0.0), expected = 1;
  const char *name = "signed-zero-less-equal";
#elif MODE == 8
  double result = kernel(1, 2), expected = 0.5;
  const char *name = "int-division";
#else
  double result = kernel(140737488355327LL, 1), expected = 140737488355328.0;
  const char *name = "tagged-overflow";
#endif
#if MODE < 5 || MODE >= 8
#ifdef PRINT_RESULT
  union { double number; int64_t bits; } encoded = { .number = result };
  printf("%s|number|%lld\n", name, (long long)encoded.bits);
#endif
  return memcmp(&result, &expected, sizeof(result)) == 0 ? 0 : 1;
#else
#ifdef PRINT_RESULT
  printf("%s|bool|%lld\n", name, (long long)result);
#endif
  return result == expected ? 0 : 1;
#endif
}
