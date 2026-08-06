#include <stdint.h>
#include <string.h>
extern double kernel(void);
double aot_gc_enter(double (*)(void));
int aot_gc_configure(uint64_t, int);
int main(void) {
  if (!aot_gc_configure(4096, 0)) return 2;
  double got = aot_gc_enter(kernel);
  uint64_t expected = UINT64_C(0x4044fe5f40780000);
  return memcmp(&got, &expected, 8) != 0;
}
