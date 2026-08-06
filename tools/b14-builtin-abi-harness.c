#include <stdint.h>
#include <stdio.h>
#include "js-value.h"

extern AotJsValue aot_js_builtin(AotJsValue, AotJsValue, uint64_t);
uint64_t kernel(void) { return 0; }
static uint64_t bits(double value) { union { double d; uint64_t u; } x = {value}; return x.u; }

int main(void) {
  AotJsValue nine = AOT_JS_INTEGER | 9;
  AotJsValue two = AOT_JS_INTEGER | 2;
  AotJsValue ten = AOT_JS_INTEGER | 10;
  if (aot_js_builtin(nine, AOT_JS_UNDEFINED, AOT_JS_BUILTIN_SQRT) != bits(3.0)) return 1;
  if (aot_js_builtin(two, ten, AOT_JS_BUILTIN_POW) != bits(1024.0)) return 2;
  if (aot_js_builtin(bits(-0.5), AOT_JS_UNDEFINED, AOT_JS_BUILTIN_ROUND) != bits(-0.0)) return 3;
  if (aot_js_builtin(bits(-0.0), bits(0.0), AOT_JS_BUILTIN_MIN) != bits(-0.0)) return 4;
  puts("B14 builtin ABI green");
  return 0;
}
