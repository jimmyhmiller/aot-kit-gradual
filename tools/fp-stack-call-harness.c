#include <stdint.h>

extern double kernel(void);

int main(void) {
  return kernel() == 136.0 ? 0 : 1;
}
