#include <stdint.h>
#include "js-value.h"

extern int64_t kernel(int64_t);

int main(int argc, char **argv) {
  (void)argv;
  int64_t value = (int64_t)(argc > 1 ? AOT_JS_BOOLEAN | 2 : aot_js_box_int(7));
  (void)kernel(value);
  return 99;
}
