#include <stdint.h>
#include <string.h>
extern double kernel(void);
int main(void) { double got = kernel(), expected = 3.0; return memcmp(&got, &expected, 8) != 0; }
