#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "js-value.h"

int aot_gc_configure(size_t, int);

static uintptr_t make_string(const uint16_t *units, size_t length) {
  uintptr_t string = (uintptr_t)aot_js_string(0, (int64_t)length, 0,
                                               AOT_JS_STRING_NEW);
  if (aot_js_tag((AotJsValue)string) == AOT_JS_UNDEFINED) return 0;
  for (size_t i = 0; i < length; ++i)
    if ((uintptr_t)aot_js_string(string, (int64_t)i, units[i],
                                 AOT_JS_STRING_SET_UNIT) != string) return 0;
  return string;
}

static int fail(int code, const char *message) {
  fprintf(stderr, "B13 string ABI failure %d: %s\n", code, message);
  return code;
}

int main(void) {
  static const uint16_t left_units[] = {'A', 0xd83d, 0xde00, 'Z'};
  static const uint16_t right_units[] = {'A', 0xd83d, 0xde00, 'Z'};
  static const uint16_t suffix_units[] = {'!', '!'};
  static const uint16_t parse_units[] = {' ', ' ', '-', '1', 'f', ' ', 'x'};
  static const uint16_t bad_number_units[] = {'1', '2', 'x'};
  static const uint16_t pixels_units[] = {'5', ',', '5'};
  static const uint16_t comma_units[] = {','};
  if (!aot_gc_configure(4096, 1)) return fail(2, "GC setup");
  uintptr_t left = make_string(left_units, 4);
  uintptr_t right = make_string(right_units, 4);
  uintptr_t suffix = make_string(suffix_units, 2);
  if (!left || !right || !suffix) return fail(3, "literal initialization");
  if (aot_js_string(left, 0, 0, AOT_JS_STRING_LENGTH) != 4)
    return fail(4, "UTF-16 length");
  if (aot_js_string(left, (int64_t)right, 0, AOT_JS_STRING_EQUAL) != 1)
    return fail(5, "content equality");
  if (aot_js_string(left, 1, 0, AOT_JS_STRING_CHAR_CODE) != 0xd83d ||
      aot_js_string(left, 4, 0, AOT_JS_STRING_CHAR_CODE) != AOT_JS_NAN)
    return fail(6, "code-unit bounds");
  if (aot_js_string(left, 0, 'x', AOT_JS_STRING_SET_UNIT) != AOT_JS_UNDEFINED)
    return fail(7, "post-initialization mutation was accepted");
  uintptr_t joined = (uintptr_t)aot_js_string(left, (int64_t)suffix, 0,
                                               AOT_JS_STRING_CONCAT);
  if (aot_js_string(joined, 0, 0, AOT_JS_STRING_LENGTH) != 6 ||
      aot_js_string(joined, 5, 0, AOT_JS_STRING_CHAR_CODE) != '!')
    return fail(8, "concatenation");
  uintptr_t substring = (uintptr_t)aot_js_string(joined, 4, 1,
                                                  AOT_JS_STRING_SUBSTRING);
  if (aot_js_string(substring, 0, 0, AOT_JS_STRING_LENGTH) != 3 ||
      aot_js_string(substring, 0, 0, AOT_JS_STRING_CHAR_CODE) != 0xd83d)
    return fail(9, "substring normalization");
  AotJsValue boxed = AOT_JS_STRING | left;
  if (aot_js_string((uintptr_t)boxed, 0, 0, AOT_JS_STRING_LENGTH) != 4 ||
      aot_js_managed(boxed))
    return fail(10, "boxed nonmoving provenance");
  uintptr_t parse = make_string(parse_units, 7);
  uintptr_t bad_number = make_string(bad_number_units, 3);
  uintptr_t empty = make_string(NULL, 0);
  if ((int64_t)aot_js_string(parse, 16, 0, AOT_JS_STRING_PARSE_INT) != -31 ||
      aot_js_string(bad_number, 0, 0, AOT_JS_STRING_IS_NAN) != 1 ||
      aot_js_string(empty, 0, 0, AOT_JS_STRING_IS_NAN) != 0)
    return fail(11, "parseInt/isNaN conversion");
  uintptr_t pixels = make_string(pixels_units, 3);
  uintptr_t comma = make_string(comma_units, 1);
  uintptr_t owner = (uintptr_t)calloc(1, 8);
  if (!owner || aot_js_string(pixels, (int64_t)comma, owner,
                              AOT_JS_STRING_SPLIT) != owner ||
      aot_js_array(owner, 0, 0, 3) != 2)
    return fail(12, "plain split length");
  AotJsValue second = aot_js_array(owner, 1, 0, 1);
  if (aot_js_tag(second) != AOT_JS_STRING ||
      aot_js_string((uintptr_t)second, 10, 0, AOT_JS_STRING_PARSE_INT) != 5)
    return fail(13, "plain split element");
  free((void *)owner);
  return 0;
}
