#include <stdint.h>
#include <stdio.h>

extern int64_t kernel(int64_t limit);

int main(void) {
  int64_t two = kernel(2), three = kernel(3);
  if (two != 1292 || three != 129393) {
    fprintf(stderr, "B08 native mismatch: limit2=%lld limit3=%lld\n",
      (long long)two, (long long)three);
    return 1;
  }
  return 0;
}
