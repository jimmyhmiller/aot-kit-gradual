#include <stdint.h>
#include <stdio.h>

extern int64_t kernel(int64_t);

int main(void) {
  const int64_t flags[] = {0, 1};
  const int64_t expected[] = {206, 26};
  for (unsigned i = 0; i < 2; ++i) {
    int64_t got = kernel(flags[i]);
    if (got != expected[i]) {
      fprintf(stderr, "B07 flag %lld got %lld expected %lld\n",
              (long long)flags[i], (long long)got, (long long)expected[i]);
      return 1;
    }
  }
  return 0;
}
