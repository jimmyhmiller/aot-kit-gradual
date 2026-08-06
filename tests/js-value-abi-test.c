#include "../tools/js-value.h"

static int require(int condition, int code) { return condition ? 0 : code; }

int main(void) {
  AotJsValue tags[] = {
    AOT_JS_NAN, AOT_JS_UNDEFINED, AOT_JS_NULL, AOT_JS_BOOLEAN,
    AOT_JS_INTEGER, AOT_JS_STRING, AOT_JS_REF, AOT_JS_FUNCTION
  };
  for (unsigned i = 0; i < sizeof(tags) / sizeof(tags[0]); ++i)
    if (require(aot_js_tagged(tags[i]), 10 + (int)i)) return 10 + (int)i;
  if (!aot_js_tagged(AOT_JS_OBJECT | 8) || !aot_js_tagged(AOT_JS_ARRAY | 8) ||
      !aot_js_tagged(AOT_JS_CLOSURE | 8) || !aot_js_tagged(AOT_JS_REGEXP | 8)) return 20;
  if (!aot_js_managed(AOT_JS_OBJECT | 8) || !aot_js_managed(AOT_JS_ARRAY | 8) ||
      !aot_js_managed(AOT_JS_CLOSURE | 8) || !aot_js_managed(AOT_JS_REGEXP | 8)) return 21;
  if (aot_js_managed(AOT_JS_STRING | 8) || aot_js_managed(AOT_JS_FUNCTION | 8)) return 22;
  if (!aot_js_reference(AOT_JS_STRING | 8) || !aot_js_reference(AOT_JS_FUNCTION | 8)) return 23;
  if (aot_js_well_formed(AOT_JS_RESERVED_0) || aot_js_well_formed(UINT64_C(0xffff000000000000))) return 24;
  if (aot_js_well_formed(AOT_JS_OBJECT) || aot_js_well_formed(AOT_JS_ARRAY | 3)) return 25;
  if (aot_js_well_formed(AOT_JS_UNDEFINED | 1) || aot_js_well_formed(AOT_JS_BOOLEAN | 2)) return 26;
  if (aot_js_unbox_int(aot_js_box_int(AOT_JS_INT_MIN)) != AOT_JS_INT_MIN ||
      aot_js_unbox_int(aot_js_box_int(AOT_JS_INT_MAX)) != AOT_JS_INT_MAX) return 27;
  if (aot_js_truthy(AOT_JS_UNDEFINED) || aot_js_truthy(AOT_JS_NULL) ||
      aot_js_truthy(AOT_JS_NAN) || aot_js_truthy(AOT_JS_NEGATIVE_ZERO)) return 28;
  if (aot_js_truthy(AOT_JS_STRING)) return 31;
  if (!aot_js_truthy(AOT_JS_BOOLEAN | 1) || !aot_js_truthy(AOT_JS_OBJECT | 8)) return 29;
  if (!aot_js_strict_equal(0, AOT_JS_NEGATIVE_ZERO) ||
      aot_js_strict_equal(AOT_JS_NAN, AOT_JS_NAN)) return 30;
  union { double number; uint64_t bits; } three = {3.0}, fraction = {3.5};
  if (!aot_js_strict_equal(aot_js_box_int(3), three.bits) ||
      !aot_js_strict_equal(three.bits, aot_js_box_int(3)) ||
      aot_js_strict_equal(aot_js_box_int(3), fraction.bits)) return 32;
  if (!aot_js_strict_equal(AOT_JS_OBJECT | 8, 8) ||
      !aot_js_strict_equal(8, AOT_JS_OBJECT | 8) ||
      aot_js_strict_equal(AOT_JS_OBJECT | 8, 16)) return 33;
  return 0;
}
