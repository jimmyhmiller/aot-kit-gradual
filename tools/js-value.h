#ifndef AOT_JS_VALUE_H
#define AOT_JS_VALUE_H

#include <stdint.h>

typedef uint64_t AotJsValue;
enum {
  AOT_JS_STRING_NEW = 0,
  AOT_JS_STRING_SET_UNIT = 1,
  AOT_JS_STRING_LENGTH = 2,
  AOT_JS_STRING_EQUAL = 3,
  AOT_JS_STRING_CONCAT = 4,
  AOT_JS_STRING_CHAR_CODE = 5,
  AOT_JS_STRING_SUBSTRING = 6,
  AOT_JS_STRING_SUBSTR = 7,
  AOT_JS_STRING_SLICE = 8,
  AOT_JS_STRING_CHAR_AT = 9,
  AOT_JS_STRING_FROM_INT = 10,
  AOT_JS_STRING_FROM_BOOL = 11,
  AOT_JS_STRING_FROM_NULL = 12,
  AOT_JS_STRING_FROM_UNDEFINED = 13,
  AOT_JS_STRING_PARSE_INT = 14,
  AOT_JS_STRING_IS_NAN = 15,
  AOT_JS_STRING_SPLIT = 16,
  AOT_JS_STRING_IS_NAN_VALUE = 17,
  AOT_JS_STRING_FROM_CODE_UNIT = 18,
  AOT_JS_STRING_FROM_INT_RADIX = 19,
  AOT_JS_STRING_FROM_DOUBLE_BITS = 20,
  AOT_JS_STRING_TO_LOWER_ASCII = 21,
  AOT_JS_STRING_TO_UPPER_ASCII = 22,
  AOT_JS_STRING_INDEX_OF = 23,
  AOT_JS_STRING_COMPARE = 24,
  AOT_JS_STRING_FROM_VALUE = 25,
  AOT_JS_VALUE_STRICT_EQUAL = 26,
  AOT_JS_VALUE_TRUTHY = 27,
  /* ToNumber and ToIntegerOrInfinity, mirroring `ev-to-number-value` and `ev-to-integer` in
     src/eval.coil. They are value-level rather than string-level ops and are dispatched before the
     string record is looked up, like STRICT_EQUAL and TRUTHY. */
  AOT_JS_VALUE_TO_NUMBER = 28,
  AOT_JS_VALUE_TO_INTEGER = 29,
  AOT_JS_STRING_PARSE_FLOAT = 30
};
enum {
  AOT_JS_BUILTIN_ABS = 0, AOT_JS_BUILTIN_FLOOR = 1, AOT_JS_BUILTIN_CEIL = 2,
  AOT_JS_BUILTIN_ROUND = 3, AOT_JS_BUILTIN_EXP = 4, AOT_JS_BUILTIN_LOG = 5,
  AOT_JS_BUILTIN_SIN = 6, AOT_JS_BUILTIN_COS = 7, AOT_JS_BUILTIN_TAN = 8,
  AOT_JS_BUILTIN_ASIN = 9, AOT_JS_BUILTIN_ACOS = 10, AOT_JS_BUILTIN_ATAN = 11,
  AOT_JS_BUILTIN_SQRT = 12, AOT_JS_BUILTIN_POW = 13, AOT_JS_BUILTIN_MAX = 14,
  AOT_JS_BUILTIN_MIN = 15, AOT_JS_BUILTIN_RANDOM = 16
};
#define AOT_JS_TAG_MASK UINT64_C(0xffff000000000000)
#define AOT_JS_PAYLOAD_MASK UINT64_C(0x0000ffffffffffff)
#define AOT_JS_NAN UINT64_C(0x7ff8000000000000)
#define AOT_JS_UNDEFINED UINT64_C(0x7ff9000000000000)
#define AOT_JS_NULL UINT64_C(0x7ffa000000000000)
#define AOT_JS_BOOLEAN UINT64_C(0x7ffb000000000000)
#define AOT_JS_INTEGER UINT64_C(0x7ffc000000000000)
#define AOT_JS_OBJECT UINT64_C(0x7ffd000000000000)
#define AOT_JS_STRING UINT64_C(0x7ffe000000000000)
#define AOT_JS_REF UINT64_C(0x7fff000000000000)
#define AOT_JS_ARRAY UINT64_C(0xfff8000000000000)
#define AOT_JS_FUNCTION UINT64_C(0xfff9000000000000)
#define AOT_JS_CLOSURE UINT64_C(0xfffa000000000000)
#define AOT_JS_REGEXP UINT64_C(0xfffb000000000000)
#define AOT_JS_RESERVED_0 UINT64_C(0xfffc000000000000)
#define AOT_JS_NEGATIVE_ZERO UINT64_C(0x8000000000000000)
#define AOT_JS_INT_MIN INT64_C(-140737488355328)
#define AOT_JS_INT_MAX INT64_C(140737488355327)

static inline uint64_t aot_js_tag(AotJsValue value) { return value & AOT_JS_TAG_MASK; }
static inline uintptr_t aot_js_payload(AotJsValue value) { return (uintptr_t)(value & AOT_JS_PAYLOAD_MASK); }
static inline int aot_js_managed(AotJsValue value) {
  uint64_t tag = aot_js_tag(value);
#ifdef AOT_JS_FALSIFY_OBJECT_TAG
  return tag == AOT_JS_STRING || tag == AOT_JS_ARRAY || tag == AOT_JS_CLOSURE || tag == AOT_JS_REGEXP;
#else
  return tag == AOT_JS_OBJECT || tag == AOT_JS_ARRAY || tag == AOT_JS_CLOSURE || tag == AOT_JS_REGEXP;
#endif
}
static inline int aot_js_tagged(AotJsValue value) {
  uint64_t tag = aot_js_tag(value);
  return (tag >= AOT_JS_NAN && tag <= AOT_JS_REF) ||
         (tag >= AOT_JS_ARRAY && tag <= AOT_JS_REGEXP);
}
static inline int aot_js_reference(AotJsValue value) {
  uint64_t tag = aot_js_tag(value);
  return aot_js_managed(value) || tag == AOT_JS_STRING || tag == AOT_JS_FUNCTION;
}
static inline AotJsValue aot_js_with_payload(AotJsValue value, uintptr_t payload) {
  return aot_js_tag(value) | ((uint64_t)payload & AOT_JS_PAYLOAD_MASK);
}
static inline AotJsValue aot_js_box_int(int64_t value) {
  return AOT_JS_INTEGER | ((uint64_t)value & AOT_JS_PAYLOAD_MASK);
}
static inline int64_t aot_js_unbox_int(AotJsValue value) {
  uint64_t payload = value & AOT_JS_PAYLOAD_MASK;
  return (int64_t)((payload & UINT64_C(0x0000800000000000)) ? payload | AOT_JS_TAG_MASK : payload);
}
static inline int aot_js_well_formed(AotJsValue value) {
  uint64_t tag = aot_js_tag(value), payload = value & AOT_JS_PAYLOAD_MASK;
  if (tag == AOT_JS_UNDEFINED || tag == AOT_JS_NULL || tag == AOT_JS_NAN) return payload == 0;
  if (tag == AOT_JS_BOOLEAN) return payload <= 1;
  if (tag >= UINT64_C(0xfffc000000000000)) return 0;
  if (aot_js_managed(value)) return payload != 0 && (payload & 7u) == 0;
  return 1;
}
static inline int aot_js_truthy(AotJsValue value) {
  uint64_t tag = aot_js_tag(value), payload = value & AOT_JS_PAYLOAD_MASK;
  if (tag == AOT_JS_UNDEFINED || tag == AOT_JS_NULL || tag == AOT_JS_NAN) return 0;
  if (tag == AOT_JS_BOOLEAN) return payload != 0;
  if (tag == AOT_JS_INTEGER) return aot_js_unbox_int(value) != 0;
  if (tag == AOT_JS_STRING) return payload != 0;
  if (aot_js_reference(value)) return 1;
  return value != 0 && value != AOT_JS_NEGATIVE_ZERO;
}
static inline int aot_js_strict_equal(AotJsValue left, AotJsValue right) {
  if (left == AOT_JS_NAN || right == AOT_JS_NAN) return 0;
  if (aot_js_managed(left) && !aot_js_tagged(right) &&
      aot_js_payload(left) == (uintptr_t)right) return 1;
  if (aot_js_managed(right) && !aot_js_tagged(left) &&
      (uintptr_t)left == aot_js_payload(right)) return 1;
  if ((left == 0 || left == AOT_JS_NEGATIVE_ZERO) &&
      (right == 0 || right == AOT_JS_NEGATIVE_ZERO)) return 1;
  uint64_t left_tag = aot_js_tag(left), right_tag = aot_js_tag(right);
  if (left_tag == AOT_JS_INTEGER && !aot_js_tagged(right)) {
    union { uint64_t bits; double number; } decoded = {right};
    return (double)aot_js_unbox_int(left) == decoded.number;
  }
  if (right_tag == AOT_JS_INTEGER && !aot_js_tagged(left)) {
    union { uint64_t bits; double number; } decoded = {left};
    return decoded.number == (double)aot_js_unbox_int(right);
  }
  return left == right;
}

/* `a` and `b` are operation-specific raw operands; `value` is the third
   operand used by literal initialization and three-argument range methods.
   String results are raw, aligned nonmoving pointers. */
AotJsValue aot_js_string(uintptr_t a, int64_t b,
                         AotJsValue value, uint64_t operation);
AotJsValue aot_js_array(uintptr_t owner, int64_t index,
                        AotJsValue value, uint64_t operation);

#endif
