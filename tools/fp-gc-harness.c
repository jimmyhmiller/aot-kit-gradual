#include <stddef.h>
#include <stdint.h>

int aot_gc_configure(size_t, int);
uint64_t aot_gc_collections(void);
extern double kernel(double);
double aot_gc_enter_fp1(double (*)(double), double);

int main(void) {
  if (!aot_gc_configure(4096, 1)) return 2;
  double result = aot_gc_enter_fp1(kernel, 1.25);
  return result == 4.25 && aot_gc_collections() >= 1 ? 0 : 3;
}
