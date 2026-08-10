#include <stdint.h>
#include <inttypes.h>
#include <stddef.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <stdio.h>
#include "js-value.h"

extern const uint8_t aot_text_start[] __asm("section$start$__TEXT$__text");
extern const uint8_t aot_kernel[] __asm("_kernel");
extern const uint8_t aot_stackmaps[] __asm("section$start$__DATA$__aot_stackmap");
extern const uint8_t aot_layouts[] __asm("section$start$__DATA$__aot_layout");

typedef struct {
  uint32_t owner, code_start, code_size, frame_size;
  uint64_t callee_mask;
  uint32_t callee_count, reserved;
} FunctionRec;
typedef struct {
  uint32_t pc, owner, instruction, root_first, root_count, op;
} SiteRec;
typedef struct { uint32_t vreg, kind, location_kind, location; } RootRec;
typedef struct {
  uint32_t shape, size, alignment, field_count;
  uint64_t reference_bitmap, boxed_bitmap;
} LayoutRec;

static uint8_t *spaces[2];
static size_t capacity;
static size_t used;
static uint8_t *old_space;
static size_t old_capacity;
static size_t old_used;
static size_t collection_old_boundary;
static int active_space;
static int stress_mode;
static uint64_t collections;
static uint64_t verifications;
static uint64_t oom_count;
static uint64_t moves;
static uint64_t slow_paths;
static uint64_t promotions;
static uint64_t copied_bytes;
static uint64_t promoted_bytes;
static uint64_t peak_live_heap;
static uint64_t maximum_frames;
static uint64_t gc_nanoseconds;
static int barrier_disabled;
static int array_scan_disabled;
static int array_growth_disabled;

typedef struct {
  uintptr_t owner;
  uintptr_t prototype;
} JsObjectRec;
typedef struct {
  uintptr_t owner;
  uint64_t name;
  AotJsValue value;
} JsPropertyRec;
typedef struct {
  uintptr_t owner;
  size_t length, capacity;
  AotJsValue *elements;
  uint8_t *present;
} JsArrayRec;
typedef struct {
  size_t length;
  uint16_t *units;
  size_t initialized;
} JsStringRec;

static JsObjectRec *js_objects;
static size_t js_objects_len, js_objects_cap;
#define JS_OBJECT_CACHE_SIZE 65536u
static uint32_t js_object_cache[JS_OBJECT_CACHE_SIZE];
static JsPropertyRec *js_properties;
static size_t js_properties_len, js_properties_cap;
#define JS_PROPERTY_CACHE_SIZE 65536u
static uint32_t js_property_cache[JS_PROPERTY_CACHE_SIZE];
static int js_property_cache_complete;
#ifdef AOT_DEBUG_PROPERTY_LOOP
static uint64_t debug_property_cache_hits, debug_property_cache_misses;
static uint64_t debug_object_cache_hits, debug_object_cache_misses;
#endif
static JsArrayRec *js_arrays;
static size_t js_arrays_len, js_arrays_cap;
static uint32_t js_array_cache[JS_OBJECT_CACHE_SIZE];
static JsStringRec **js_strings;
static size_t js_strings_len, js_strings_cap;
static JsStringRec *js_string_lookup(uintptr_t raw);

static int reserve_records(void **records, size_t *record_cap, size_t needed, size_t width) {
  if (needed <= *record_cap) return 1;
  size_t next_cap = *record_cap ? *record_cap * 2 : 32;
  while (next_cap < needed) next_cap *= 2;
  void *next = realloc(*records, next_cap * width);
  if (!next) return 0;
  *records = next; *record_cap = next_cap;
  return 1;
}

static JsObjectRec *js_object(uintptr_t owner, int create) {
  size_t slot = (size_t)((owner >> 3) & (JS_OBJECT_CACHE_SIZE - 1));
  uint32_t cached = js_object_cache[slot];
  if (cached && cached <= js_objects_len && js_objects[cached - 1].owner == owner)
  {
#ifdef AOT_DEBUG_PROPERTY_LOOP
    ++debug_object_cache_hits;
#endif
    return &js_objects[cached - 1];
  }
#ifdef AOT_DEBUG_PROPERTY_LOOP
  ++debug_object_cache_misses;
#endif
  for (size_t i = js_objects_len; i > 0; --i)
    if (js_objects[i - 1].owner == owner) {
      js_object_cache[slot] = (uint32_t)i;
      return &js_objects[i - 1];
    }
  if (!create || !owner ||
      !reserve_records((void **)&js_objects, &js_objects_cap,
                       js_objects_len + 1, sizeof(*js_objects))) return NULL;
  js_objects[js_objects_len] = (JsObjectRec){owner, 0};
  js_object_cache[slot] = (uint32_t)(js_objects_len + 1);
  return &js_objects[js_objects_len++];
}

static uint64_t js_property_key_hash(AotJsValue key) {
  JsStringRec *string = js_string_lookup((uintptr_t)key);
  if (!string) return (uint64_t)key;
  uint64_t hash = UINT64_C(1469598103934665603);
  for (size_t i = 0; i < string->length; ++i) {
    hash ^= string->units[i];
    hash *= UINT64_C(1099511628211);
  }
  return hash;
}

static int js_property_key_equal(AotJsValue left, AotJsValue right) {
  JsStringRec *a = js_string_lookup((uintptr_t)left);
  JsStringRec *b = js_string_lookup((uintptr_t)right);
  if (!a || !b) return left == right;
  return a->length == b->length &&
         (!a->length || memcmp(a->units, b->units, a->length * sizeof(*a->units)) == 0);
}

static size_t js_property_hash(uintptr_t owner, AotJsValue key) {
  return (size_t)(((owner >> 3) ^
                   (js_property_key_hash(key) * UINT64_C(11400714819323198485))) &
                  (JS_PROPERTY_CACHE_SIZE - 1));
}

static int js_property_cache_insert(size_t index) {
  JsPropertyRec *property = &js_properties[index];
  size_t slot = js_property_hash(property->owner, property->name);
  for (size_t probe = 0; probe < JS_PROPERTY_CACHE_SIZE; ++probe) {
    if (!js_property_cache[slot]) {
      js_property_cache[slot] = (uint32_t)(index + 1);
      return 1;
    }
    slot = (slot + 1) & (JS_PROPERTY_CACHE_SIZE - 1);
  }
  js_property_cache_complete = 0;
  return 0;
}

static void js_property_cache_rebuild(void) {
  memset(js_property_cache, 0, sizeof(js_property_cache));
  js_property_cache_complete = 1;
  for (size_t i = 0; i < js_properties_len; ++i)
    if (js_properties[i].owner && !js_property_cache_insert(i)) break;
}

static JsPropertyRec *js_own_property(uintptr_t owner, AotJsValue key) {
  size_t slot = js_property_hash(owner, key);
  for (size_t probe = 0; probe < JS_PROPERTY_CACHE_SIZE; ++probe) {
    uint32_t cached = js_property_cache[slot];
    if (!cached) break;
    if (cached <= js_properties_len) {
      JsPropertyRec *property = &js_properties[cached - 1];
      if (property->owner == owner && js_property_key_equal(property->name, key)) {
#ifdef AOT_DEBUG_PROPERTY_LOOP
        ++debug_property_cache_hits;
#endif
        return property;
      }
    }
    slot = (slot + 1) & (JS_PROPERTY_CACHE_SIZE - 1);
  }
#ifdef AOT_DEBUG_PROPERTY_LOOP
  ++debug_property_cache_misses;
#endif
  if (js_property_cache_complete) return NULL;
  for (size_t i = js_properties_len; i > 0; --i)
    if (js_properties[i - 1].owner == owner &&
        js_property_key_equal(js_properties[i - 1].name, key)) {
      return &js_properties[i - 1];
    }
  return NULL;
}

static void js_write_barrier(uintptr_t owner, uintptr_t target);

static JsArrayRec *js_array(uintptr_t owner, int create) {
  size_t slot = (size_t)((owner >> 3) & (JS_OBJECT_CACHE_SIZE - 1));
  uint32_t cached = js_array_cache[slot];
  if (cached && cached <= js_arrays_len && js_arrays[cached - 1].owner == owner)
    return &js_arrays[cached - 1];
  for (size_t i = js_arrays_len; i > 0; --i)
    if (js_arrays[i - 1].owner == owner) {
      js_array_cache[slot] = (uint32_t)i;
      return &js_arrays[i - 1];
    }
  if (!create || !owner ||
      !reserve_records((void **)&js_arrays, &js_arrays_cap,
                       js_arrays_len + 1, sizeof(*js_arrays))) return NULL;
  js_arrays[js_arrays_len] = (JsArrayRec){owner, 0, 0, NULL, NULL};
  js_array_cache[slot] = (uint32_t)(js_arrays_len + 1);
  return &js_arrays[js_arrays_len++];
}

/* Generated code normally boxes managed references before crossing a dynamic
   JavaScript storage boundary. Representation joins can nevertheless expose a
   raw GC pointer (for example, a method parameter reached through both raw and
   boxed call sites). Canonicalize it at the ABI boundary so arrays and named
   properties never retain two bit representations for the same JS object. */
static AotJsValue js_canonical_stored_value(AotJsValue value);

static int js_array_reserve(JsArrayRec *array, size_t needed) {
  if (needed <= array->capacity) return 1;
  if (array_growth_disabled) return 0;
  size_t next = array->capacity ? array->capacity * 2 : 4;
  while (next < needed) next *= 2;
  AotJsValue *elements = malloc(next * sizeof(*elements));
  uint8_t *present = calloc(next, sizeof(*present));
  if (!elements || !present) { free(elements); free(present); return 0; }
  for (size_t i = 0; i < next; ++i) elements[i] = AOT_JS_UNDEFINED;
  if (array->capacity) {
    memcpy(elements, array->elements, array->capacity * sizeof(*elements));
    memcpy(present, array->present, array->capacity * sizeof(*present));
  }
  free(array->elements); free(array->present);
  array->elements = elements; array->present = present; array->capacity = next;
  return 1;
}

static JsStringRec *js_string_lookup(uintptr_t raw) {
  if (aot_js_tag((AotJsValue)raw) == AOT_JS_STRING)
    raw = aot_js_payload((AotJsValue)raw);
  for (size_t i = 0; i < js_strings_len; ++i)
    if ((uintptr_t)js_strings[i] == raw) return js_strings[i];
  return NULL;
}

static JsStringRec *js_string_new(size_t length) {
  if (!reserve_records((void **)&js_strings, &js_strings_cap,
                       js_strings_len + 1, sizeof(*js_strings))) return NULL;
  JsStringRec *string = calloc(1, sizeof(*string));
  if (!string) return NULL;
  string->units = length ? calloc(length, sizeof(*string->units)) : NULL;
  if (length && !string->units) { free(string); return NULL; }
  string->length = length;
  js_strings[js_strings_len++] = string;
  return string;
}

static JsStringRec *js_string_window(const JsStringRec *source,
                                     size_t start, size_t end) {
  if (!source || start > end || end > source->length) return NULL;
  JsStringRec *result = js_string_new(end - start);
  if (!result) return NULL;
  if (end > start)
    memcpy(result->units, source->units + start,
           (end - start) * sizeof(*result->units));
  result->initialized = result->length;
  return result;
}

static JsStringRec *js_string_ascii(const char *text) {
  size_t length = strlen(text);
  JsStringRec *result = js_string_new(length);
  if (!result) return NULL;
  for (size_t i = 0; i < length; ++i) result->units[i] = (uint8_t)text[i];
  result->initialized = length;
  return result;
}

static JsStringRec *js_string_int_radix(int64_t value, int64_t radix) {
  if (radix < 2 || radix > 36) return NULL;
  char reverse[66];
  char text[67];
  size_t length = 0;
  uint64_t magnitude = value < 0 ? (uint64_t)(-(value + 1)) + 1 : (uint64_t)value;
  do {
    unsigned digit = (unsigned)(magnitude % (uint64_t)radix);
    reverse[length++] = (char)(digit < 10 ? '0' + digit : 'a' + digit - 10);
    magnitude /= (uint64_t)radix;
  } while (magnitude);
  size_t at = 0;
  if (value < 0) text[at++] = '-';
  while (length) text[at++] = reverse[--length];
  text[at] = '\0';
  return js_string_ascii(text);
}

static size_t js_string_clamp(int64_t value, size_t length) {
  if (value <= 0) return 0;
  return (uint64_t)value >= length ? length : (size_t)value;
}

static double js_builtin_number(AotJsValue value) {
  union { uint64_t bits; double number; } decoded = { .bits = value };
  uint64_t tag = value & AOT_JS_TAG_MASK;
  if (tag == AOT_JS_INTEGER) {
    int64_t payload = (int64_t)(value & AOT_JS_PAYLOAD_MASK);
    if (payload & (INT64_C(1) << 47)) payload |= (int64_t)AOT_JS_TAG_MASK;
    return (double)payload;
  }
  if (tag == AOT_JS_BOOLEAN) return (double)(value & 1);
  if (tag == AOT_JS_NULL) return 0.0;
  if (aot_js_tagged(value)) return NAN;
  return decoded.number;
}

static AotJsValue js_builtin_bits(double number) {
  union { double number; uint64_t bits; } encoded = { .number = number };
  return isnan(number) ? AOT_JS_NAN : encoded.bits;
}

AotJsValue aot_js_builtin(AotJsValue a, AotJsValue b, uint64_t operation) {
  double x = js_builtin_number(a), y = js_builtin_number(b), result = NAN;
  switch (operation) {
    case AOT_JS_BUILTIN_ABS: result = fabs(x); break;
    case AOT_JS_BUILTIN_FLOOR: result = floor(x); break;
    case AOT_JS_BUILTIN_CEIL: result = ceil(x); break;
    case AOT_JS_BUILTIN_ROUND: {
      /* NOT floor(x + 0.5). At 0.49999999999999994, the largest double below a half, the SUM
         rounds up to exactly 1.0 and that form answers 1 where the spec answers 0. Comparing the
         fraction against a half never forms the sum. src/jsbuiltin.coil had the identical bug —
         which is the point: a differential test between two hand-written implementations cannot
         see a defect present in both. Node found it. */
      if (x < 0.0 && x >= -0.5) { result = -0.0; break; }
      double f = floor(x);
      result = (x - f) >= 0.5 ? f + 1.0 : f;
      break;
    }
    case AOT_JS_BUILTIN_EXP: result = exp(x); break;
    case AOT_JS_BUILTIN_LOG: result = log(x); break;
    case AOT_JS_BUILTIN_SIN: result = sin(x); break;
    case AOT_JS_BUILTIN_COS: result = cos(x); break;
    case AOT_JS_BUILTIN_TAN: result = tan(x); break;
    case AOT_JS_BUILTIN_ASIN: result = asin(x); break;
    case AOT_JS_BUILTIN_ACOS: result = acos(x); break;
    case AOT_JS_BUILTIN_ATAN: result = atan(x); break;
    case AOT_JS_BUILTIN_SQRT:
      result = sqrt(x);
#ifdef AOT_B14_PERTURB_SQRT
      result += 1.0;
#endif
      break;
    case AOT_JS_BUILTIN_POW: result = pow(x, y); break;
    case AOT_JS_BUILTIN_MAX:
      result = isnan(x) || isnan(y) ? NAN : x > y ? x : y > x ? y
             : signbit(x) ? y : x; break;
    case AOT_JS_BUILTIN_MIN:
      result = isnan(x) || isnan(y) ? NAN : x < y ? x : y < x ? y
             : signbit(x) ? x : y; break;
    case AOT_JS_BUILTIN_RANDOM: {
      static uint32_t seed = 49734321u;
      seed = (seed + UINT32_C(0x7ed55d16)) + (seed << 12);
      seed = (seed ^ UINT32_C(0xc761c23c)) ^ (seed >> 19);
      seed = (seed + UINT32_C(0x165667b1)) + (seed << 5);
      seed = (seed + UINT32_C(0xd3a2646c)) ^ (seed << 9);
      seed = (seed + UINT32_C(0xfd7046c5)) + (seed << 3);
      seed = (seed ^ UINT32_C(0xb55a4f09)) ^ (seed >> 16);
      result = (double)(seed & UINT32_C(0x0fffffff)) / 268435456.0;
      break;
    }
  }
  return js_builtin_bits(result);
}

/* Canonical immutable UTF-16 string ABI. Mutation exists only for operation 1
   while a freshly-created literal is being initialized, and every slot may be
   written exactly once. All observable operations reject incomplete records. */

/* ToNumber and ToIntegerOrInfinity, mirroring src/eval.coil's `ev-to-number-value` and
   `ev-to-integer` exactly — the interpreter and this runtime are two implementations of one
   semantics, and tools/jsl-gate.sh compares both against the same Node table.

   StringToNumber uses the same rule the interpreter does: the token is trimmed, an empty string is
   +0, `Infinity` is spelled exactly that way, the three integer prefixes take no sign, and anything
   else must be a StrDecimalLiteral before strtod sees it. The gate matters — strtod accepts "nan",
   "inf", "0x1p3" and trailing junk that JavaScript does not. */
static double aot_js_string_to_number(const JsStringRec *rec) {
  size_t lo = 0, hi = rec->length;
  while (lo < hi && (rec->units[lo] == ' ' || (rec->units[lo] >= 9 && rec->units[lo] <= 13))) ++lo;
  while (hi > lo && (rec->units[hi - 1] == ' ' || (rec->units[hi - 1] >= 9 && rec->units[hi - 1] <= 13))) --hi;
  size_t n = hi - lo;
  if (n == 0) return 0.0;
  static const char *inf_names[3] = {"Infinity", "+Infinity", "-Infinity"};
  for (int k = 0; k < 3; ++k) {
    size_t len = strlen(inf_names[k]);
    if (n != len) continue;
    size_t i = 0;
    while (i < n && rec->units[lo + i] == (uint16_t)inf_names[k][i]) ++i;
    if (i == n) return k == 2 ? -INFINITY : INFINITY;
  }
  if (n > 2 && rec->units[lo] == '0') {
    int radix = 0;
    uint16_t p = rec->units[lo + 1];
    if (p == 'x' || p == 'X') radix = 16;
    else if (p == 'o' || p == 'O') radix = 8;
    else if (p == 'b' || p == 'B') radix = 2;
    if (radix) {
      double acc = 0.0;
      for (size_t i = lo + 2; i < hi; ++i) {
        uint16_t c = rec->units[i];
        int d = (c >= '0' && c <= '9') ? c - '0'
              : (c >= 'a' && c <= 'z') ? c - 'a' + 10
              : (c >= 'A' && c <= 'Z') ? c - 'A' + 10 : 99;
        if (d >= radix) return NAN;
        acc = acc * radix + d;
      }
      return acc;
    }
  }
  /* StrDecimalLiteral gate: [+-]? ( digits ('.' digits?)? | '.' digits ) ([eE] [+-]? digits)? */
  size_t i = 0, intd = 0, frac = 0;
  if (i < n && (rec->units[lo + i] == '+' || rec->units[lo + i] == '-')) ++i;
  while (i < n && rec->units[lo + i] >= '0' && rec->units[lo + i] <= '9') { ++intd; ++i; }
  if (i < n && rec->units[lo + i] == '.') {
    ++i;
    while (i < n && rec->units[lo + i] >= '0' && rec->units[lo + i] <= '9') { ++frac; ++i; }
  }
  if (intd + frac == 0) return NAN;
  if (i < n && (rec->units[lo + i] == 'e' || rec->units[lo + i] == 'E')) {
    ++i;
    if (i < n && (rec->units[lo + i] == '+' || rec->units[lo + i] == '-')) ++i;
    size_t expd = 0;
    while (i < n && rec->units[lo + i] >= '0' && rec->units[lo + i] <= '9') { ++expd; ++i; }
    if (expd == 0) return NAN;
  }
  if (i != n) return NAN;
  char buf[64];
  if (n >= sizeof buf) return NAN;
  for (size_t k = 0; k < n; ++k) buf[k] = (char)rec->units[lo + k];
  buf[n] = '\0';
  return strtod(buf, NULL);
}

/* Every value's ToNumber, as a double. `ok` is cleared for the cases the spec throws on: symbols,
   bigints and objects needing ToPrimitive. Reporting that rather than inventing a number is the
   same choice `ev-to-number-value` makes with EV-TYPE. */
static double aot_js_to_number_double(AotJsValue v, int *ok) {
  *ok = 1;
  uint64_t tag = aot_js_tag(v);
  if (tag == AOT_JS_UNDEFINED) return NAN;
  if (tag == AOT_JS_NULL) return 0.0;
  if (tag == AOT_JS_BOOLEAN) return aot_js_payload(v) ? 1.0 : 0.0;
  if (tag == AOT_JS_INTEGER) return (double)aot_js_unbox_int(v);
  if (tag == AOT_JS_NAN) return NAN;
  if (tag == AOT_JS_STRING) {
    JsStringRec *rec = js_string_lookup(aot_js_payload(v));
    if (!rec) { *ok = 0; return NAN; }
    return aot_js_string_to_number(rec);
  }
  if (!aot_js_tagged(v)) {
    union { uint64_t bits; double number; } decoded = {v};
    return decoded.number;
  }
  *ok = 0;
  return NAN;
}

static AotJsValue aot_js_number_result(double d) {
  if (d != d) return AOT_JS_NAN;
  if (d >= -9007199254740992.0 && d <= 9007199254740992.0 && d == (double)(int64_t)d) {
    int64_t t = (int64_t)d;
    if (t >= AOT_JS_INT_MIN && t <= AOT_JS_INT_MAX) return aot_js_box_int(t);
  }
  union { double number; uint64_t bits; } encoded = {d};
  return (AotJsValue)encoded.bits;
}

AotJsValue aot_js_string(uintptr_t a, int64_t b,
                         AotJsValue value, uint64_t operation) {
  if (operation == AOT_JS_VALUE_TO_NUMBER || operation == AOT_JS_VALUE_TO_INTEGER) {
    int ok = 0;
    double d = aot_js_to_number_double((AotJsValue)a, &ok);
    if (!ok) {
      fprintf(stderr, "aot_js_string: ToNumber on a value requiring ToPrimitive\n");
      abort();
    }
    if (operation == AOT_JS_VALUE_TO_NUMBER) return aot_js_number_result(d);
    if (d != d) return aot_js_box_int(0);
    if (d == INFINITY || d == -INFINITY) return aot_js_number_result(d);
    double t = d < 0 ? ceil(d) : floor(d);
    return aot_js_number_result(t);
  }
  if (operation == AOT_JS_VALUE_STRICT_EQUAL) {
#ifdef AOT_DEBUG_VALUE_EQUAL
    static uint64_t debug_equality_calls;
    if (debug_equality_calls++ < 256)
      fprintf(stderr, "value-equality left=%016" PRIxPTR " right=%016" PRIx64 " result=%d\n",
              a, (uint64_t)b, aot_js_strict_equal((AotJsValue)a, (AotJsValue)b));
#endif
    return (AotJsValue)aot_js_strict_equal((AotJsValue)a, (AotJsValue)b);
  }
  if (operation == AOT_JS_VALUE_TRUTHY)
    return (AotJsValue)aot_js_truthy((AotJsValue)a);
  if (operation == 200) {
#ifdef AOT_B14_SWALLOW_THROW
    return (AotJsValue)a;
#else
#ifdef AOT_DEBUG_THROW
    fprintf(stderr, "uncaught JavaScript throw value=0x%016" PRIxPTR "\n", a);
    uintptr_t thrown_owner = aot_js_payload((AotJsValue)a);
    for (size_t i = 0; i < js_properties_len; ++i) {
      if (js_properties[i].owner != thrown_owner) continue;
      AotJsValue property_value = js_properties[i].value;
      fprintf(stderr, " property name=%" PRIu64 " value=0x%016" PRIx64,
              js_properties[i].name, property_value);
      if (aot_js_tag(property_value) == AOT_JS_STRING) {
        JsStringRec *string = js_string_lookup(aot_js_payload(property_value));
        if (string) {
          fputs(" text=", stderr);
          for (size_t j = 0; j < string->length; ++j)
            fputc(string->units[j] < 128 ? (char)string->units[j] : '?', stderr);
        }
      }
      fputc('\n', stderr);
    }
#else
    (void)a;
    fputs("uncaught JavaScript throw\n", stderr);
#endif
    (void)b; (void)value;
    fflush(stderr);
    exit(70);
#endif
  }
  if (operation >= 100 && operation < 117)
    return aot_js_builtin((AotJsValue)a, (AotJsValue)b, operation - 100);
  if (operation == AOT_JS_STRING_NEW) {
    JsStringRec *result = js_string_new(b < 0 ? 0 : (size_t)b);
    return result ? (AotJsValue)(uintptr_t)result : AOT_JS_UNDEFINED;
  }
  if (operation == AOT_JS_STRING_FROM_INT) {
    char text[32];
    snprintf(text, sizeof(text), "%lld", (long long)(int64_t)a);
    JsStringRec *result = js_string_ascii(text);
    return result ? (AotJsValue)(uintptr_t)result : AOT_JS_UNDEFINED;
  }
  if (operation == AOT_JS_STRING_FROM_CODE_UNIT) {
    JsStringRec *result = js_string_new(1);
    if (!result) return AOT_JS_UNDEFINED;
    result->units[0] = (uint16_t)a;
    result->initialized = 1;
    return (AotJsValue)(uintptr_t)result;
  }
  if (operation == AOT_JS_STRING_FROM_INT_RADIX) {
    JsStringRec *result = js_string_int_radix((int64_t)a, b);
    return result ? (AotJsValue)(uintptr_t)result : AOT_JS_UNDEFINED;
  }
  if (operation == AOT_JS_STRING_FROM_DOUBLE_BITS) {
    union { uint64_t bits; double number; } decoded = { .bits = (uint64_t)a };
    char text[64];
    if (isnan(decoded.number)) {
      strcpy(text, "NaN");
    } else if (isinf(decoded.number)) {
      strcpy(text, signbit(decoded.number) ? "-Infinity" : "Infinity");
    } else if (decoded.number == 0.0) {
      strcpy(text, "0");
    } else {
      snprintf(text, sizeof(text), "%.17g", decoded.number);
      char *exponent = strchr(text, 'e');
      if (exponent && (exponent[1] == '+' || exponent[1] == '-') && exponent[2] == '0')
        memmove(exponent + 2, exponent + 3, strlen(exponent + 3) + 1);
    }
    JsStringRec *result = js_string_ascii(text);
    return result ? (AotJsValue)(uintptr_t)result : AOT_JS_UNDEFINED;
  }
  if (operation == AOT_JS_STRING_FROM_BOOL ||
      operation == AOT_JS_STRING_FROM_NULL ||
      operation == AOT_JS_STRING_FROM_UNDEFINED) {
    const char *text = operation == AOT_JS_STRING_FROM_BOOL
                         ? (a ? "true" : "false")
                         : operation == AOT_JS_STRING_FROM_NULL ? "null" : "undefined";
    JsStringRec *result = js_string_ascii(text);
    return result ? (AotJsValue)(uintptr_t)result : AOT_JS_UNDEFINED;
  }
  if (operation == AOT_JS_STRING_FROM_VALUE) {
    AotJsValue input = (AotJsValue)a;
    JsStringRec *existing = js_string_lookup((uintptr_t)input);
    if (existing) return (AotJsValue)(uintptr_t)existing;
    uint64_t tag = aot_js_tag(input);
    if (tag == AOT_JS_STRING) return (AotJsValue)aot_js_payload(input);
    if (tag == AOT_JS_UNDEFINED || tag == AOT_JS_NULL || tag == AOT_JS_BOOLEAN ||
        tag == AOT_JS_INTEGER || tag == AOT_JS_NAN) {
      if (tag == AOT_JS_INTEGER) return aot_js_string((uintptr_t)aot_js_unbox_int(input), 0, 0,
                                                      AOT_JS_STRING_FROM_INT);
      if (tag == AOT_JS_BOOLEAN) return aot_js_string((uintptr_t)aot_js_payload(input), 0, 0,
                                                      AOT_JS_STRING_FROM_BOOL);
      if (tag == AOT_JS_NULL) return aot_js_string(0, 0, 0, AOT_JS_STRING_FROM_NULL);
      if (tag == AOT_JS_UNDEFINED) return aot_js_string(0, 0, 0, AOT_JS_STRING_FROM_UNDEFINED);
      JsStringRec *nan = js_string_ascii("NaN");
      return nan ? (AotJsValue)(uintptr_t)nan : AOT_JS_UNDEFINED;
    }
    if (!aot_js_tagged(input))
      return aot_js_string((uintptr_t)input, 0, 0, AOT_JS_STRING_FROM_DOUBLE_BITS);
    JsStringRec *object = js_string_ascii("[object Object]");
    return object ? (AotJsValue)(uintptr_t)object : AOT_JS_UNDEFINED;
  }
  if (operation == AOT_JS_STRING_IS_NAN_VALUE) {
    uint64_t exponent = (uint64_t)a & UINT64_C(0x7ff0000000000000);
    uint64_t fraction = (uint64_t)a & UINT64_C(0x000fffffffffffff);
    return (AotJsValue)a == AOT_JS_NAN ||
           (exponent == UINT64_C(0x7ff0000000000000) && fraction != 0);
  }
  JsStringRec *left = js_string_lookup(a);
  if (!left) return AOT_JS_UNDEFINED;
  if (operation == AOT_JS_STRING_SET_UNIT) {
    if (b < 0 || (size_t)b >= left->length || (size_t)b != left->initialized ||
        value > UINT16_MAX) return AOT_JS_UNDEFINED;
    left->units[b] = (uint16_t)value;
    ++left->initialized;
    return (AotJsValue)(uintptr_t)left;
  }
  if (left->initialized != left->length) return AOT_JS_UNDEFINED;
  if (operation == AOT_JS_STRING_LENGTH) return (AotJsValue)left->length;
  if (operation == AOT_JS_STRING_TO_LOWER_ASCII ||
      operation == AOT_JS_STRING_TO_UPPER_ASCII) {
    JsStringRec *result = js_string_window(left, 0, left->length);
    if (!result) return AOT_JS_UNDEFINED;
    for (size_t i = 0; i < result->length; ++i) {
      uint16_t unit = result->units[i];
      if (operation == AOT_JS_STRING_TO_LOWER_ASCII && unit >= 'A' && unit <= 'Z')
        result->units[i] = (uint16_t)(unit + ('a' - 'A'));
      if (operation == AOT_JS_STRING_TO_UPPER_ASCII && unit >= 'a' && unit <= 'z')
        result->units[i] = (uint16_t)(unit - ('a' - 'A'));
    }
    return (AotJsValue)(uintptr_t)result;
  }
  if (operation == AOT_JS_STRING_PARSE_FLOAT) {
    size_t start = 0;
    while (start < left->length && (left->units[start] == ' ' ||
           (left->units[start] >= 9 && left->units[start] <= 13))) ++start;
    size_t at = start;
    int negative = 0;
    if (at < left->length && (left->units[at] == '+' || left->units[at] == '-')) {
      negative = left->units[at] == '-'; ++at;
    }
    static const char infinity[] = "Infinity";
    int is_infinity = at + 8 <= left->length;
    for (size_t i = 0; is_infinity && i < 8; ++i)
      if (left->units[at + i] != (uint16_t)infinity[i]) is_infinity = 0;
    if (is_infinity) return js_builtin_bits(negative ? -INFINITY : INFINITY);

    size_t int_digits = 0, frac_digits = 0;
    while (at < left->length && left->units[at] >= '0' && left->units[at] <= '9') {
      ++at; ++int_digits;
    }
    if (at < left->length && left->units[at] == '.') {
      ++at;
      while (at < left->length && left->units[at] >= '0' && left->units[at] <= '9') {
        ++at; ++frac_digits;
      }
    }
    if (!int_digits && !frac_digits) return AOT_JS_NAN;
    size_t mantissa_end = at;
    if (at < left->length && (left->units[at] == 'e' || left->units[at] == 'E')) {
      size_t exponent = at++;
      if (at < left->length && (left->units[at] == '+' || left->units[at] == '-')) ++at;
      size_t exponent_digits = at;
      while (at < left->length && left->units[at] >= '0' && left->units[at] <= '9') ++at;
      if (at == exponent_digits) at = exponent;
    } else {
      at = mantissa_end;
    }
    size_t length = at - start;
    char *text = malloc(length + 1);
    if (!text) return AOT_JS_NAN;
    for (size_t i = 0; i < length; ++i) text[i] = (char)left->units[start + i];
    text[length] = 0;
    char *end = NULL;
    double result = strtod(text, &end);
    free(text);
    return end ? js_builtin_bits(result) : AOT_JS_NAN;
  }
  if (operation == AOT_JS_STRING_PARSE_INT) {
    int64_t radix = b == 0 ? 10 : b, sign = 1, parsed = 0;
    size_t at = 0, digits = 0;
    while (at < left->length && (left->units[at] == ' ' ||
           (left->units[at] >= 9 && left->units[at] <= 13))) ++at;
    if (at < left->length && (left->units[at] == '+' || left->units[at] == '-')) {
      if (left->units[at] == '-') sign = -1;
      ++at;
    }
    if ((b == 0 || radix == 16) && at + 1 < left->length &&
        left->units[at] == '0' && (left->units[at + 1] == 'x' || left->units[at + 1] == 'X')) {
      radix = 16; at += 2;
    }
    if (radix < 2 || radix > 36) return AOT_JS_NAN;
    while (at < left->length) {
      uint16_t unit = left->units[at];
      int64_t digit = unit >= '0' && unit <= '9' ? unit - '0'
                      : unit >= 'A' && unit <= 'Z' ? 10 + unit - 'A'
                      : unit >= 'a' && unit <= 'z' ? 10 + unit - 'a' : -1;
      if (digit < 0 || digit >= radix) break;
      parsed = parsed * radix + digit; ++digits; ++at;
    }
    return digits ? (AotJsValue)(sign * parsed) : AOT_JS_NAN;
  }
  if (operation == AOT_JS_STRING_IS_NAN) {
    size_t at = 0, digits = 0;
    int dot = 0;
    while (at < left->length && (left->units[at] == ' ' ||
           (left->units[at] >= 9 && left->units[at] <= 13))) ++at;
    if (at < left->length && (left->units[at] == '+' || left->units[at] == '-')) ++at;
    while (at < left->length) {
      uint16_t unit = left->units[at];
      if (unit >= '0' && unit <= '9') { ++digits; ++at; continue; }
      if (unit == '.' && !dot) { dot = 1; ++at; continue; }
      break;
    }
    while (at < left->length && (left->units[at] == ' ' ||
           (left->units[at] >= 9 && left->units[at] <= 13))) ++at;
    return at != left->length || (left->length != 0 && digits == 0);
  }
  if (operation == AOT_JS_STRING_SPLIT) {
    JsStringRec *delimiter = js_string_lookup((uintptr_t)b);
    uintptr_t owner = (uintptr_t)value;
    if (aot_js_managed(value)) owner = aot_js_payload(value);
    JsArrayRec *array = js_array(owner, 1);
    if (!array)
      return AOT_JS_UNDEFINED;
    for (size_t i = 0; i < array->length; ++i) {
      array->present[i] = 0; array->elements[i] = AOT_JS_UNDEFINED;
    }
    array->length = 0;
    if (b == 0) {
      if (!js_array_reserve(array, 1)) return AOT_JS_UNDEFINED;
      array->elements[0] = AOT_JS_STRING | (uintptr_t)left;
      array->present[0] = 1;
      array->length = 1;
      return (AotJsValue)owner;
    }
    if (!delimiter || delimiter->initialized != delimiter->length)
      return AOT_JS_UNDEFINED;
    size_t start = 0, at = 0;
    while (delimiter->length ? at + delimiter->length <= left->length
                             : at < left->length) {
      int match = delimiter->length == 0 ||
                  !memcmp(left->units + at, delimiter->units,
                          delimiter->length * sizeof(*left->units));
      if (!match) { ++at; continue; }
      size_t end = delimiter->length ? at : at + 1;
      size_t piece_start = delimiter->length ? start : at;
      JsStringRec *piece = js_string_window(left, piece_start, end);
      if (!piece || !js_array_reserve(array, array->length + 1)) return AOT_JS_UNDEFINED;
      array->elements[array->length] = AOT_JS_STRING | (uintptr_t)piece;
      array->present[array->length++] = 1;
      at += delimiter->length ? delimiter->length : 1;
      start = at;
    }
    if (delimiter->length) {
      JsStringRec *piece = js_string_window(left, start, left->length);
      if (!piece || !js_array_reserve(array, array->length + 1)) return AOT_JS_UNDEFINED;
      array->elements[array->length] = AOT_JS_STRING | (uintptr_t)piece;
      array->present[array->length++] = 1;
    }
    return (AotJsValue)owner;
  }
  JsStringRec *right = js_string_lookup((uintptr_t)b);
  if (operation == AOT_JS_STRING_INDEX_OF) {
    if (!right || right->initialized != right->length) return (AotJsValue)-1;
    int64_t requested = (int64_t)value;
    size_t start = requested <= 0 ? 0 : (uint64_t)requested > left->length
                                      ? left->length : (size_t)requested;
    if (right->length == 0) return (AotJsValue)start;
    for (size_t at = start; at + right->length <= left->length; ++at)
      if (!memcmp(left->units + at, right->units,
                  right->length * sizeof(*left->units))) return (AotJsValue)at;
    return (AotJsValue)-1;
  }
  if (operation == AOT_JS_STRING_COMPARE) {
    if (!right || right->initialized != right->length) return 0;
    size_t common = left->length < right->length ? left->length : right->length;
    for (size_t at = 0; at < common; ++at) {
      if (left->units[at] < right->units[at]) return (AotJsValue)-1;
      if (left->units[at] > right->units[at]) return (AotJsValue)1;
    }
    return left->length < right->length ? (AotJsValue)-1
         : left->length > right->length ? (AotJsValue)1 : 0;
  }
  if (operation == AOT_JS_STRING_EQUAL) {
    if (!right || right->initialized != right->length) return 0;
    return left->length == right->length &&
           (!left->length || !memcmp(left->units, right->units,
                                     left->length * sizeof(*left->units)));
  }
  if (operation == AOT_JS_STRING_CONCAT) {
    if (!right || right->initialized != right->length) return AOT_JS_UNDEFINED;
    JsStringRec *result = js_string_new(left->length + right->length);
    if (!result) return AOT_JS_UNDEFINED;
    if (left->length) memcpy(result->units, left->units,
                             left->length * sizeof(*left->units));
    if (right->length) memcpy(result->units + left->length, right->units,
                              right->length * sizeof(*right->units));
    result->initialized = result->length;
    return (AotJsValue)(uintptr_t)result;
  }
  if (operation == AOT_JS_STRING_CHAR_CODE)
    return b < 0 || (size_t)b >= left->length
#ifdef AOT_B13_CHARCODE_ZERO
             ? 0
#else
             ? AOT_JS_NAN
#endif
             : left->units[b];
  if (operation == AOT_JS_STRING_CHAR_AT) {
    size_t at = b < 0 ? left->length : (size_t)b;
    return (AotJsValue)(uintptr_t)js_string_window(left, at < left->length ? at : left->length,
                                                   at < left->length ? at + 1 : left->length);
  }
  int64_t raw_end = (int64_t)value;
  size_t start = 0, end = 0;
  if (operation == AOT_JS_STRING_SUBSTRING) {
    start = js_string_clamp(b, left->length);
    end = js_string_clamp(raw_end, left->length);
    if (start > end) { size_t swap = start; start = end; end = swap; }
  } else if (operation == AOT_JS_STRING_SUBSTR) {
    int64_t raw_start = b < 0 ? (int64_t)left->length + b : b;
    start = js_string_clamp(raw_start, left->length);
    size_t count = raw_end <= 0 ? 0 : (size_t)raw_end;
    end = count > left->length - start ? left->length : start + count;
  } else if (operation == AOT_JS_STRING_SLICE) {
    int64_t raw_start = b < 0 ? (int64_t)left->length + b : b;
    raw_end = raw_end < 0 ? (int64_t)left->length + raw_end : raw_end;
    start = js_string_clamp(raw_start, left->length);
    end = js_string_clamp(raw_end, left->length);
    if (end < start) end = start;
  } else return AOT_JS_UNDEFINED;
  JsStringRec *result = js_string_window(left, start, end);
  return result ? (AotJsValue)(uintptr_t)result : AOT_JS_UNDEFINED;
}

/* Canonical native dense-array ABI. The owner may be raw or boxed. Operation 0
   marks an allocation, 1 loads, 2 stores, 3 reads raw length, 4 resizes, and 5 copies.
   Missing elements read as undefined; resize truncation clears presence. */
AotJsValue aot_js_array(uintptr_t owner, int64_t index,
                        AotJsValue value, uint64_t operation) {
  if (aot_js_managed((AotJsValue)owner)) owner = aot_js_payload((AotJsValue)owner);
  if (!owner) return AOT_JS_UNDEFINED;
  JsArrayRec *array = js_array(owner, operation == 0 || operation == 2 || operation == 4);
#ifdef AOT_DEBUG_ARRAY
  static uint64_t debug_array_calls;
  uint64_t debug_array_call = ++debug_array_calls;
  size_t debug_array_before = array ? array->length : 0;
#endif
  if (operation == 0)
    return array ? (AotJsValue)owner : AOT_JS_UNDEFINED;
  if (!array) return operation == 3 ? aot_js_box_int(0) : AOT_JS_UNDEFINED;
  if (operation == 1) {
    AotJsValue result = index >= 0 && (size_t)index < array->length && array->present[index]
                          ? array->elements[index] : AOT_JS_UNDEFINED;
#ifdef AOT_DEBUG_ARRAY
    if (debug_array_call <= UINT64_C(20000))
      fprintf(stderr, "array call=%" PRIu64 " op=load owner=%" PRIxPTR
                      " index=%" PRId64 " length=%zu result=%" PRIx64 "\n",
              debug_array_call, owner, index, array->length, result);
#endif
    return result;
  }
  if (operation == 2) {
    value = js_canonical_stored_value(value);
    if (index < 0 || !aot_js_well_formed(value) ||
        !js_array_reserve(array, (size_t)index + 1)) return AOT_JS_UNDEFINED;
    array->elements[index] = value; array->present[index] = 1;
    if ((size_t)index >= array->length) array->length = (size_t)index + 1;
    if (aot_js_managed(value)) js_write_barrier(owner, aot_js_payload(value));
#ifdef AOT_DEBUG_ARRAY
    if (debug_array_call <= UINT64_C(20000))
      fprintf(stderr, "array call=%" PRIu64 " op=store owner=%" PRIxPTR
                      " index=%" PRId64 " before=%zu after=%zu value=%" PRIx64 "\n",
              debug_array_call, owner, index, debug_array_before, array->length, value);
#endif
    return value;
  }
  if (operation == 3) {
#ifdef AOT_DEBUG_ARRAY
    if (debug_array_call <= UINT64_C(20000))
      fprintf(stderr, "array call=%" PRIu64 " op=length owner=%" PRIxPTR
                      " length=%zu\n", debug_array_call, owner, array->length);
#endif
    return (AotJsValue)array->length;
  }
  if (operation == 4) {
    size_t next = index < 0 ? 0 : (size_t)index;
    if (!js_array_reserve(array, next)) return AOT_JS_UNDEFINED;
    if (next < array->length)
      for (size_t i = next; i < array->length; ++i) {
        array->present[i] = 0; array->elements[i] = AOT_JS_UNDEFINED;
      }
    array->length = next;
#ifdef AOT_DEBUG_ARRAY
    if (debug_array_call <= UINT64_C(20000))
      fprintf(stderr, "array call=%" PRIu64 " op=resize owner=%" PRIxPTR
                      " requested=%" PRId64 " before=%zu after=%zu ordered=%" PRIx64 "\n",
              debug_array_call, owner, index, debug_array_before, array->length, value);
#endif
    return aot_js_box_int((int64_t)next);
  }
  if (operation == 5) {
    uintptr_t result_owner = (uintptr_t)value;
    if (aot_js_managed(value)) result_owner = aot_js_payload(value);
    JsArrayRec *result = js_array(result_owner, 0);
    if (!result || index < 0) return AOT_JS_UNDEFINED;
    for (size_t j = 0; j < result->length; ++j) {
      size_t source_index = (size_t)index + j;
      result->present[j] = 0; result->elements[j] = AOT_JS_UNDEFINED;
      if (source_index < array->length && array->present[source_index]) {
        result->present[j] = 1;
        result->elements[j] = array->elements[source_index];
        if (aot_js_managed(result->elements[j]))
          js_write_barrier(result_owner, aot_js_payload(result->elements[j]));
      }
    }
    return (AotJsValue)result_owner;
  }
  return AOT_JS_UNDEFINED;
}

static int js_property_array_index(AotJsValue key, int64_t *out) {
  JsStringRec *string = js_string_lookup((uintptr_t)key);
  if (!string || !string->length) return 0;
  if (string->length > 1 && string->units[0] == '0') return 0;
  uint64_t value = 0;
  for (size_t i = 0; i < string->length; ++i) {
    uint16_t unit = string->units[i];
    if (unit < '0' || unit > '9') return 0;
    value = value * 10 + (uint64_t)(unit - '0');
    if (value >= UINT64_C(4294967295)) return 0;
  }
  *out = (int64_t)value;
  return 1;
}

/* Canonical native PropertyKey ABI. `name` is a runtime string key (and later a Symbol), so
   compile-time names and computed names use the same content-based table. Operation 0 loads through the prototype
   chain, 1 stores an own boxed value, 2 installs a raw managed prototype, and
   3 tests presence through the prototype chain without conflating undefined with absence,
   4 deletes an own configurable property, and 5 tests prototype-chain identity.
   The runtime owns string records for the duration of the compilation unit. */
AotJsValue aot_js_property(uintptr_t owner, uint64_t name,
                           AotJsValue value, uint64_t operation) {
  if (aot_js_managed((AotJsValue)owner)) owner = aot_js_payload((AotJsValue)owner);
  if (!owner) return AOT_JS_UNDEFINED;
  int64_t array_index = 0;
  JsArrayRec *indexed_array = js_array(owner, 0);
  if (indexed_array && js_property_array_index((AotJsValue)name, &array_index)) {
    if (operation == 0) return aot_js_array(owner, array_index, value, 1);
    if (operation == 1) return aot_js_array(owner, array_index, value, 2);
    if (operation == 3)
      return (size_t)array_index < indexed_array->length && indexed_array->present[array_index];
    if (operation == 4) {
      if ((size_t)array_index < indexed_array->length) {
        indexed_array->present[array_index] = 0;
        indexed_array->elements[array_index] = AOT_JS_UNDEFINED;
      }
      return 1;
    }
  }
#ifdef AOT_DEBUG_PROPERTY_LOOP
  static size_t debug_property_events;
  static size_t debug_strength_events;
  static uint64_t debug_property_calls;
  if ((++debug_property_calls % UINT64_C(100000)) == 0)
    fprintf(stderr, "property progress calls=%" PRIu64 " op=%" PRIu64 " name=%" PRIu64
                    " owner=%" PRIxPTR " objects=%zu properties=%zu phit=%" PRIu64
                    " pmiss=%" PRIu64 " ohit=%" PRIu64 " omiss=%" PRIu64 "\n",
            debug_property_calls, operation, name, owner, js_objects_len, js_properties_len,
            debug_property_cache_hits, debug_property_cache_misses,
            debug_object_cache_hits, debug_object_cache_misses);
  if ((name == 16 || name == 20) && debug_property_events++ < 512)
    fprintf(stderr, "property op=%" PRIu64 " name=%" PRIu64
                    " owner=%" PRIxPTR " value=%016" PRIx64 "\n",
            operation, name, owner, value);
  if ((name == 2 || name == 8 || name == 18 || name == 22 || name == 26 || name == 27 || name == 28 || name == 38) && debug_strength_events++ < 2048)
    fprintf(stderr, "strength-property op=%" PRIu64 " name=%" PRIu64
                    " owner=%" PRIxPTR " value=%016" PRIx64 "\n",
            operation, name, owner, value);
#endif
  if (operation == 0) {
    uintptr_t cursor = owner;
    for (size_t depth = 0; cursor && depth <= js_objects_len; ++depth) {
      JsPropertyRec *property = js_own_property(cursor, name);
      if (property) {
#ifdef AOT_DEBUG_PROPERTY_LOOP
        if (name == 16 || name == 20)
          fprintf(stderr, "property result name=%" PRIu64 " owner=%" PRIxPTR
                          " cursor=%" PRIxPTR " result=%016" PRIx64 "\n",
                  name, owner, cursor, property->value);
#endif
#ifdef AOT_DEBUG_PROPERTY_LOOP
        if ((name == 2 || name == 8 || name == 18 || name == 22 || name == 26 || name == 27 || name == 28 || name == 38) && debug_strength_events < 2048)
          fprintf(stderr, "strength-result name=%" PRIu64 " owner=%" PRIxPTR
                          " cursor=%" PRIxPTR " result=%016" PRIx64 "\n",
                  name, owner, cursor, property->value);
#endif
        return property->value;
      }
      JsObjectRec *object = js_object(cursor, 0);
      cursor = object ? object->prototype : 0;
    }
    return AOT_JS_UNDEFINED;
  }
  if (operation == 3) {
    uintptr_t cursor = owner;
    for (size_t depth = 0; cursor && depth <= js_objects_len; ++depth) {
      if (js_own_property(cursor, name)) return 1;
      JsObjectRec *object = js_object(cursor, 0);
      cursor = object ? object->prototype : 0;
    }
    return 0;
  }
  if (operation == 4) {
    JsPropertyRec *property = js_own_property(owner, name);
    if (property) {
      property->owner = 0;
      js_property_cache_rebuild();
    }
    return 1;
  }
  if (operation == 5) {
    uintptr_t target = (uintptr_t)value;
    if (aot_js_managed(value)) target = aot_js_payload(value);
    JsObjectRec *record = js_object(owner, 0);
    uintptr_t cursor = record ? record->prototype : 0;
    for (size_t depth = 0; cursor && depth <= js_objects_len; ++depth) {
      if (cursor == target) return 1;
      record = js_object(cursor, 0);
      cursor = record ? record->prototype : 0;
    }
    return 0;
  }
  if (operation == 1) {
    value = js_canonical_stored_value(value);
    if (!aot_js_well_formed(value) || !js_object(owner, 1)) return AOT_JS_UNDEFINED;
    JsPropertyRec *property = js_own_property(owner, name);
    if (!property) {
      if (!reserve_records((void **)&js_properties, &js_properties_cap,
                           js_properties_len + 1, sizeof(*js_properties)))
        return AOT_JS_UNDEFINED;
      property = &js_properties[js_properties_len++];
      *property = (JsPropertyRec){owner, name, AOT_JS_UNDEFINED};
      js_property_cache_insert(js_properties_len - 1);
    }
    property->value = value;
    if (aot_js_managed(value)) js_write_barrier(owner, aot_js_payload(value));
    return value;
  }
  if (operation == 2) {
    uintptr_t prototype = (uintptr_t)value;
    JsObjectRec *object = js_object(owner, 1);
    if (!object || prototype == owner) return AOT_JS_UNDEFINED;
    uintptr_t cursor = prototype;
    for (size_t depth = 0; cursor && depth <= js_objects_len; ++depth) {
      if (cursor == owner) return AOT_JS_UNDEFINED;
      JsObjectRec *parent = js_object(cursor, 0);
      cursor = parent ? parent->prototype : 0;
    }
    object->prototype = prototype;
    js_write_barrier(owner, prototype);
    return (AotJsValue)prototype;
  }
  return AOT_JS_UNDEFINED;
}

typedef struct {
  uint8_t *cursor;
  uint8_t *limit;
  uint64_t stress;
  uint8_t *old_start;
  uint8_t *old_end;
  uint8_t *young_start;
  uint8_t *young_end;
  uint64_t remembered_dirty;
  uint64_t barrier_hits;
  uint64_t allocations;
  uint64_t bytes_allocated;
} AotGcThread;

/* x28 points here while generated code is running. Keep the layout in lockstep
   with the three fixed offsets emitted by backend_aarch64.coil. */
AotGcThread aot_gc_thread_state;

static AotJsValue js_canonical_stored_value(AotJsValue value) {
  if (aot_js_tagged(value)) return value;
  uintptr_t pointer = (uintptr_t)value;
  int in_young = aot_gc_thread_state.young_start &&
                 pointer >= (uintptr_t)aot_gc_thread_state.young_start &&
                 pointer < (uintptr_t)aot_gc_thread_state.young_end;
  int in_old = aot_gc_thread_state.old_start &&
               pointer >= (uintptr_t)aot_gc_thread_state.old_start &&
               pointer < (uintptr_t)aot_gc_thread_state.old_end;
#ifdef AOT_DEBUG_ARRAY
  static uint64_t debug_canonical_calls;
  if (!aot_js_tagged(value) && debug_canonical_calls++ < 32)
    fprintf(stderr, "canonical value=%" PRIx64 " young=%p..%p old=%p..%p in=%d/%d\n",
            value, aot_gc_thread_state.young_start, aot_gc_thread_state.young_end,
            aot_gc_thread_state.old_start, aot_gc_thread_state.old_end, in_young, in_old);
#endif
  if ((!in_young && !in_old) || (pointer & 7u)) return value;
  return (js_array(pointer, 0) ? AOT_JS_ARRAY : AOT_JS_OBJECT) |
         (AotJsValue)pointer;
}

static int js_old_to_young(uintptr_t owner, uintptr_t target) {
  return owner >= (uintptr_t)aot_gc_thread_state.old_start &&
         owner < (uintptr_t)aot_gc_thread_state.old_end &&
         target >= (uintptr_t)aot_gc_thread_state.young_start &&
         target < (uintptr_t)aot_gc_thread_state.young_end;
}

static void js_write_barrier(uintptr_t owner, uintptr_t target) {
  if (!barrier_disabled && js_old_to_young(owner, target)) {
    aot_gc_thread_state.remembered_dirty = 1;
    ++aot_gc_thread_state.barrier_hits;
  }
}

static uint32_t u32(const uint8_t *p) { uint32_t v; memcpy(&v, p, 4); return v; }
static const FunctionRec *functions(void) { return (const FunctionRec *)(aot_stackmaps + 24); }
static uint32_t function_count(void) { return u32(aot_stackmaps + 16); }
static uint32_t site_count(void) { return u32(aot_stackmaps + 8); }
static uint32_t root_count(void) { return u32(aot_stackmaps + 12); }
static const SiteRec *sites(void) {
  return (const SiteRec *)(aot_stackmaps + 24 + function_count() * sizeof(FunctionRec));
}
static const RootRec *roots(void) {
  return (const RootRec *)((const uint8_t *)sites() + site_count() * sizeof(SiteRec));
}
static uint32_t layout_count(void) { return u32(aot_layouts + 8); }
static const LayoutRec *layouts(void) { return (const LayoutRec *)(aot_layouts + 16); }

static const LayoutRec *layout_for(uint64_t shape) {
  const LayoutRec *table = layouts();
  for (uint32_t i = 0; i < layout_count(); ++i) if (table[i].shape == shape) return &table[i];
  return NULL;
}

static const FunctionRec *function_for(uint32_t owner) {
  const FunctionRec *table = functions();
  for (uint32_t i = 0; i < function_count(); ++i) if (table[i].owner == owner) return &table[i];
  return NULL;
}

typedef struct { uintptr_t old_addr, new_addr; } Forward;
static Forward *forwarded;
static size_t forwarded_len, forwarded_cap;
static uint8_t *from_start, *from_end, *to_start;
static size_t to_used;

typedef struct { uintptr_t addr; uint8_t age; } YoungAge;
static YoungAge *young_ages;
static size_t young_ages_len, young_ages_cap;
static YoungAge *next_ages;
static size_t next_ages_len, next_ages_cap;

static size_t forward_hash(uintptr_t address) {
  uint64_t value = (uint64_t)(address >> 3);
  value ^= value >> 33; value *= 0xff51afd7ed558ccdull;
  value ^= value >> 33; value *= 0xc4ceb9fe1a85ec53ull;
  value ^= value >> 33;
  return (size_t)value;
}

static int forward_resize(size_t next_capacity) {
  Forward *next = calloc(next_capacity, sizeof(Forward));
  if (!next) return 0;
  for (size_t i = 0; i < forwarded_cap; ++i) {
    if (!forwarded[i].old_addr) continue;
    size_t slot = forward_hash(forwarded[i].old_addr) & (next_capacity - 1);
    while (next[slot].old_addr) slot = (slot + 1) & (next_capacity - 1);
    next[slot] = forwarded[i];
  }
  free(forwarded); forwarded = next; forwarded_cap = next_capacity;
  return 1;
}

static uintptr_t forward_lookup(uintptr_t address) {
  if (!forwarded_cap) return 0;
  size_t slot = forward_hash(address) & (forwarded_cap - 1);
  while (forwarded[slot].old_addr) {
    if (forwarded[slot].old_addr == address) return forwarded[slot].new_addr;
    slot = (slot + 1) & (forwarded_cap - 1);
  }
  return 0;
}

static int forward_insert(uintptr_t old_address, uintptr_t new_address) {
  if (!forwarded_cap && !forward_resize(1024)) return 0;
  if ((forwarded_len + 1) * 10 >= forwarded_cap * 7 &&
      !forward_resize(forwarded_cap * 2)) return 0;
  size_t slot = forward_hash(old_address) & (forwarded_cap - 1);
  while (forwarded[slot].old_addr) slot = (slot + 1) & (forwarded_cap - 1);
  forwarded[slot] = (Forward){old_address, new_address};
  ++forwarded_len;
  return 1;
}

static void forward_clear(void) {
  if (forwarded_cap) memset(forwarded, 0, forwarded_cap * sizeof(Forward));
  forwarded_len = 0;
}

static uint8_t age_for(uintptr_t addr) {
  if (!young_ages_cap) return 0;
  size_t slot = forward_hash(addr) & (young_ages_cap - 1);
  while (young_ages[slot].addr) {
    if (young_ages[slot].addr == addr) return young_ages[slot].age;
    slot = (slot + 1) & (young_ages_cap - 1);
  }
  return 0;
}

static int age_resize(YoungAge **table, size_t *table_capacity, size_t next_capacity) {
  YoungAge *next = calloc(next_capacity, sizeof(YoungAge));
  if (!next) return 0;
  for (size_t i = 0; i < *table_capacity; ++i) {
    if (!(*table)[i].addr) continue;
    size_t slot = forward_hash((*table)[i].addr) & (next_capacity - 1);
    while (next[slot].addr) slot = (slot + 1) & (next_capacity - 1);
    next[slot] = (*table)[i];
  }
  free(*table); *table = next; *table_capacity = next_capacity;
  return 1;
}

static int remember_age(uintptr_t addr, uint8_t age) {
  if (!next_ages_cap && !age_resize(&next_ages, &next_ages_cap, 1024)) return 0;
  if ((next_ages_len + 1) * 10 >= next_ages_cap * 7 &&
      !age_resize(&next_ages, &next_ages_cap, next_ages_cap * 2)) return 0;
  size_t slot = forward_hash(addr) & (next_ages_cap - 1);
  while (next_ages[slot].addr) slot = (slot + 1) & (next_ages_cap - 1);
  next_ages[slot] = (YoungAge){addr, age};
  ++next_ages_len;
  return 1;
}

static uintptr_t relocate(uintptr_t value) {
  if (value >= (uintptr_t)old_space && value < (uintptr_t)(old_space + old_used)) return value;
  if (!value || value < (uintptr_t)from_start || value >= (uintptr_t)from_end) return value;
  uintptr_t prior = forward_lookup(value);
  if (prior) return prior;
  const LayoutRec *layout = layout_for(*(uint64_t *)value);
  if (!layout || layout->size == 0) return 0;
  uint8_t age = age_for(value);
  int promote = age >= 1;
  if (promote ? old_used + layout->size > old_capacity
              : to_used + layout->size > capacity) return 0;
  uintptr_t moved = promote ? (uintptr_t)(old_space + old_used)
                            : (uintptr_t)(to_start + to_used);
  memcpy((void *)moved, (void *)value, layout->size);
  copied_bytes += layout->size;
  if (promote) {
    old_used += (layout->size + 7u) & ~7u;
    ++promotions;
    promoted_bytes += layout->size;
  } else {
    to_used += (layout->size + 7u) & ~7u;
    if (!remember_age(moved, (uint8_t)(age + 1))) return 0;
  }
  if (!forward_insert(value, moved)) return 0;
  ++moves;
  return moved;
}

static int relocate_boxed(uintptr_t *slot) {
  AotJsValue value = (AotJsValue)*slot;
  if (!aot_js_well_formed(value)) return 0;
  if (!aot_js_managed(value)) return 1;
  uintptr_t payload = aot_js_payload(value);
  if (!payload || (payload & 7u)) return 0;
  uintptr_t moved = relocate(payload);
  if (!moved) return 0;
  *slot = (uintptr_t)aot_js_with_payload(value, moved);
  return 1;
}

static int side_owner_live(uintptr_t *owner) {
  if (*owner >= (uintptr_t)old_space && *owner < (uintptr_t)(old_space + old_used)) return 1;
  if (*owner >= (uintptr_t)to_start && *owner < (uintptr_t)(to_start + to_used)) return 1;
  if (*owner < (uintptr_t)from_start || *owner >= (uintptr_t)from_end) return 0;
  uintptr_t moved = forward_lookup(*owner);
  if (!moved) return 0;
  *owner = moved;
  return 1;
}

/* Side-table owners are weak, while prototype and property values are strong
   only when their owner survived. Processing repeats with heap scanning because
   a prototype/property edge can discover another object that owns more edges. */
static int relocate_side_edges(int scan_old_side, int *next_remembered_dirty) {
  for (size_t i = 0; i < js_objects_len; ++i) {
    JsObjectRec *object = &js_objects[i];
    if (!side_owner_live(&object->owner) || !object->prototype) continue;
    if (!scan_old_side && object->owner >= (uintptr_t)old_space &&
        object->owner < (uintptr_t)(old_space + collection_old_boundary)) continue;
    uintptr_t moved = relocate(object->prototype);
    if (!moved) return 0;
    object->prototype = moved;
    if (object->owner >= (uintptr_t)old_space &&
        object->owner < (uintptr_t)(old_space + old_used) &&
        moved >= (uintptr_t)to_start && moved < (uintptr_t)(to_start + capacity))
      *next_remembered_dirty = 1;
  }
  for (size_t i = 0; i < js_properties_len; ++i) {
    JsPropertyRec *property = &js_properties[i];
    if (!side_owner_live(&property->owner)) continue;
    if (!scan_old_side && property->owner >= (uintptr_t)old_space &&
        property->owner < (uintptr_t)(old_space + collection_old_boundary)) continue;
    if (!relocate_boxed((uintptr_t *)&property->value)) return 0;
    if (aot_js_managed(property->value)) {
      uintptr_t target = aot_js_payload(property->value);
      if (property->owner >= (uintptr_t)old_space &&
          property->owner < (uintptr_t)(old_space + old_used) &&
          target >= (uintptr_t)to_start && target < (uintptr_t)(to_start + capacity))
        *next_remembered_dirty = 1;
    }
  }
  for (size_t i = 0; i < js_arrays_len; ++i) {
    JsArrayRec *array = &js_arrays[i];
    if (!side_owner_live(&array->owner)) continue;
    if (!scan_old_side && array->owner >= (uintptr_t)old_space &&
        array->owner < (uintptr_t)(old_space + collection_old_boundary)) continue;
    if (array_scan_disabled) continue;
    for (size_t j = 0; j < array->length; ++j) {
      if (!array->present[j]) continue;
      if (!relocate_boxed((uintptr_t *)&array->elements[j])) return 0;
      if (aot_js_managed(array->elements[j])) {
        uintptr_t target = aot_js_payload(array->elements[j]);
        if (array->owner >= (uintptr_t)old_space &&
            array->owner < (uintptr_t)(old_space + old_used) &&
            target >= (uintptr_t)to_start && target < (uintptr_t)(to_start + capacity))
          *next_remembered_dirty = 1;
      }
    }
  }
  return 1;
}

static void discard_dead_side_records(void) {
  memset(js_object_cache, 0, sizeof(js_object_cache));
  memset(js_array_cache, 0, sizeof(js_array_cache));
  size_t out = 0;
  for (size_t i = 0; i < js_objects_len; ++i) {
    if (!side_owner_live(&js_objects[i].owner)) continue;
    js_objects[out++] = js_objects[i];
  }
  js_objects_len = out; out = 0;
  for (size_t i = 0; i < js_properties_len; ++i) {
    if (!side_owner_live(&js_properties[i].owner)) continue;
    js_properties[out++] = js_properties[i];
  }
  js_properties_len = out;
  js_property_cache_rebuild();
  out = 0;
  for (size_t i = 0; i < js_arrays_len; ++i) {
    if (!side_owner_live(&js_arrays[i].owner)) {
      free(js_arrays[i].elements); free(js_arrays[i].present); continue;
    }
    js_arrays[out++] = js_arrays[i];
  }
  js_arrays_len = out;
}

static const SiteRec *site_for(void *return_pc) {
  uintptr_t unit_base = (uintptr_t)aot_kernel - functions()[0].code_start;
  uintptr_t offset = (uintptr_t)return_pc - unit_base;
  const SiteRec *table = sites();
  for (uint32_t i = 0; i < site_count(); ++i) if (table[i].pc == offset) return &table[i];
  return NULL;
}

static int verify_heap(void) {
  for (uint32_t generation = 0; generation < 2; ++generation) {
    uint8_t *base = generation == 0 ? spaces[active_space] : old_space;
    size_t bytes = generation == 0 ? used : old_used;
    size_t cursor = 0;
    while (cursor < bytes) {
      const LayoutRec *layout = layout_for(*(uint64_t *)(base + cursor));
      if (!layout || !layout->size || cursor + layout->size > bytes) return 0;
      if (layout->reference_bitmap & layout->boxed_bitmap) return 0;
      for (uint32_t i = 0; i < layout->field_count && i < 64; ++i) {
        uint64_t bit = 1ull << i;
        uintptr_t value = *(uintptr_t *)(base + cursor + 8 + i * 8);
        uintptr_t ref = value;
        if (layout->boxed_bitmap & bit) {
          if (!aot_js_well_formed((AotJsValue)value)) return 0;
          if (!aot_js_managed((AotJsValue)value)) continue;
          ref = aot_js_payload((AotJsValue)value);
        } else if (!(layout->reference_bitmap & bit)) continue;
        int young = ref >= (uintptr_t)spaces[active_space] &&
                    ref < (uintptr_t)(spaces[active_space] + used);
        int old = ref >= (uintptr_t)old_space && ref < (uintptr_t)(old_space + old_used);
        if (ref && !young && !old) return 0;
      }
      cursor += (layout->size + 7u) & ~7u;
    }
    if (cursor != bytes) return 0;
  }
  for (size_t i = 0; i < js_objects_len; ++i) {
    uintptr_t values[2] = {js_objects[i].owner, js_objects[i].prototype};
    for (size_t j = 0; j < 2; ++j) {
      uintptr_t ref = values[j];
      if (!ref && j == 1) continue;
      int young = ref >= (uintptr_t)spaces[active_space] &&
                  ref < (uintptr_t)(spaces[active_space] + used);
      int old = ref >= (uintptr_t)old_space && ref < (uintptr_t)(old_space + old_used);
      if (!young && !old) return 0;
    }
  }
  for (size_t i = 0; i < js_properties_len; ++i) {
    uintptr_t owner = js_properties[i].owner;
    int owner_young = owner >= (uintptr_t)spaces[active_space] &&
                      owner < (uintptr_t)(spaces[active_space] + used);
    int owner_old = owner >= (uintptr_t)old_space && owner < (uintptr_t)(old_space + old_used);
    if ((!owner_young && !owner_old) || !aot_js_well_formed(js_properties[i].value)) return 0;
    if (aot_js_managed(js_properties[i].value)) {
      uintptr_t ref = aot_js_payload(js_properties[i].value);
      int young = ref >= (uintptr_t)spaces[active_space] &&
                  ref < (uintptr_t)(spaces[active_space] + used);
      int old = ref >= (uintptr_t)old_space && ref < (uintptr_t)(old_space + old_used);
      if (!young && !old) return 0;
    }
  }
  for (size_t i = 0; i < js_arrays_len; ++i) {
    uintptr_t owner = js_arrays[i].owner;
    int owner_young = owner >= (uintptr_t)spaces[active_space] &&
                      owner < (uintptr_t)(spaces[active_space] + used);
    int owner_old = owner >= (uintptr_t)old_space && owner < (uintptr_t)(old_space + old_used);
    if ((!owner_young && !owner_old) || js_arrays[i].length > js_arrays[i].capacity) {
      fprintf(stderr, "array verify owner/cap failed i=%zu owner=%p len=%zu cap=%zu\n",
              i, (void *)owner, js_arrays[i].length, js_arrays[i].capacity);
      return 0;
    }
    for (size_t j = 0; j < js_arrays[i].length; ++j) {
      if (!js_arrays[i].present[j]) continue;
      AotJsValue value = js_arrays[i].elements[j];
      if (!aot_js_well_formed(value)) {
        fprintf(stderr, "array verify malformed element i=%zu j=%zu value=%llx\n",
                i, j, (unsigned long long)value);
        return 0;
      }
      if (aot_js_managed(value)) {
        uintptr_t ref = aot_js_payload(value);
        int young = ref >= (uintptr_t)spaces[active_space] &&
                    ref < (uintptr_t)(spaces[active_space] + used);
        int old = ref >= (uintptr_t)old_space && ref < (uintptr_t)(old_space + old_used);
        if (!young && !old) {
          fprintf(stderr, "array verify stale element i=%zu j=%zu value=%llx ref=%p\n",
                  i, j, (unsigned long long)value, (void *)ref);
          return 0;
        }
      }
    }
  }
  ++verifications;
  return 1;
}

static int relocate_site_roots(const SiteRec *site, uint8_t *frame_sp,
                               uintptr_t **register_slots) {
  const RootRec *root_table = roots();
  for (uint32_t i = 0; i < site->root_count; ++i) {
    const RootRec *root = &root_table[site->root_first + i];
    uintptr_t *slot = NULL;
    if (root->location_kind == 0 && root->location >= 19 && root->location <= 28)
      slot = register_slots[root->location - 19];
    else if (root->location_kind == 1)
      slot = (uintptr_t *)(frame_sp + root->location);
    if (!slot) return 0;
    if (root->kind == 1) {
      uintptr_t moved = relocate(*slot);
      if (*slot && !moved) return 0;
      *slot = moved;
    } else if (root->kind == 2) {
      if (!relocate_boxed(slot)) return 0;
    } else if (root->kind != 3) return 0;
  }
  return 1;
}

static int collect_impl(void *context, uint8_t *caller_sp, void *return_pc) {
  if (aot_gc_thread_state.cursor >= spaces[active_space] &&
      aot_gc_thread_state.cursor <= spaces[active_space] + capacity)
    used = (size_t)(aot_gc_thread_state.cursor - spaces[active_space]);
  const SiteRec *site = site_for(return_pc);
  if (!site) return 0;
  from_start = spaces[active_space]; from_end = from_start + used;
  to_start = spaces[1 - active_space]; to_used = 0; forward_clear();
  next_ages_len = 0;
  if (next_ages_cap) memset(next_ages, 0, next_ages_cap * sizeof(YoungAge));
  size_t old_before = old_used;
  collection_old_boundary = old_before;
  uintptr_t *register_slots[10];
  for (uint32_t r = 0; r < 10; ++r)
    register_slots[r] = (uintptr_t *)((uint8_t *)context + r * 8);
  if (!relocate_site_roots(site, caller_sp, register_slots)) return 0;

  uint8_t *frame_sp = caller_sp;
  uint32_t owner = site->owner;
  uint64_t walked_frames = 1;
  for (uint32_t depth = 0; depth < 256; ++depth) {
    const FunctionRec *function = function_for(owner);
    if (!function || function->frame_size < 16) return 0;
    uint32_t rank = 0;
    for (uint32_t reg = 19; reg <= 28; ++reg) {
      if (!(function->callee_mask & (1ull << reg))) continue;
      register_slots[reg - 19] = (uintptr_t *)(frame_sp + 16 + rank * 8);
      ++rank;
    }
    uint8_t *older_sp = (uint8_t *)(uintptr_t)*(uint64_t *)(frame_sp + 0);
    void *older_pc = (void *)(uintptr_t)*(uint64_t *)(frame_sp + 8);
    const SiteRec *older_site = site_for(older_pc);
    if (!older_site) break;
    if (!older_sp || older_sp <= frame_sp) return 0;
    if (!relocate_site_roots(older_site, older_sp, register_slots)) return 0;
    frame_sp = older_sp;
    owner = older_site->owner;
    ++walked_frames;
  }
  if (walked_frames > maximum_frames) maximum_frames = walked_frames;
  size_t scan = 0;
  int scan_old_side = aot_gc_thread_state.remembered_dirty != 0;
  size_t old_scan = scan_old_side ? 0 : old_before;
  int next_remembered_dirty = 0;
  for (;;) {
    while (scan < to_used || old_scan < old_used) {
      int scanning_old = scan >= to_used;
      uint8_t *object = scanning_old ? old_space + old_scan : to_start + scan;
      const LayoutRec *layout = layout_for(*(uint64_t *)object);
      if (!layout) return 0;
      if (layout->reference_bitmap & layout->boxed_bitmap) return 0;
      for (uint32_t i = 0; i < layout->field_count && i < 64; ++i) {
        uint64_t bit = 1ull << i;
        uintptr_t *field = (uintptr_t *)(object + 8 + i * 8);
        uintptr_t moved = 0;
        if (layout->boxed_bitmap & bit) {
          if (!relocate_boxed(field)) return 0;
          if (aot_js_managed((AotJsValue)*field)) moved = aot_js_payload((AotJsValue)*field);
        } else if (layout->reference_bitmap & bit) {
          moved = relocate(*field);
          if (*field && !moved) return 0;
          *field = moved;
        } else continue;
        if (scanning_old && moved >= (uintptr_t)to_start &&
            moved < (uintptr_t)(to_start + capacity)) next_remembered_dirty = 1;
      }
      if (scanning_old) old_scan += (layout->size + 7u) & ~7u;
      else scan += (layout->size + 7u) & ~7u;
    }
    size_t prior_forwards = forwarded_len;
    if (!relocate_side_edges(scan_old_side, &next_remembered_dirty)) return 0;
    if (forwarded_len == prior_forwards) break;
  }
  discard_dead_side_records();
  active_space = 1 - active_space; used = to_used; ++collections;
  if (used + old_used > peak_live_heap) peak_live_heap = used + old_used;
  YoungAge *ages_swap = young_ages; young_ages = next_ages; next_ages = ages_swap;
  size_t ages_cap_swap = young_ages_cap; young_ages_cap = next_ages_cap;
  next_ages_cap = ages_cap_swap; young_ages_len = next_ages_len; next_ages_len = 0;
  aot_gc_thread_state.cursor = spaces[active_space] + used;
  aot_gc_thread_state.limit = spaces[active_space] + capacity;
  aot_gc_thread_state.young_start = spaces[active_space];
  aot_gc_thread_state.young_end = spaces[active_space] + capacity;
  aot_gc_thread_state.old_end = old_space + old_used;
  aot_gc_thread_state.remembered_dirty = (uint64_t)next_remembered_dirty;
  if (!verify_heap()) {
    fprintf(stderr, "native GC verification failed after collection %llu\n",
            (unsigned long long)collections);
    return 0;
  }
  return 1;
}

static int collect(void *context, uint8_t *caller_sp, void *return_pc) {
  struct timespec before, after;
  clock_gettime(CLOCK_MONOTONIC_RAW, &before);
  int result = collect_impl(context, caller_sp, return_pc);
  clock_gettime(CLOCK_MONOTONIC_RAW, &after);
  gc_nanoseconds += (uint64_t)(after.tv_sec - before.tv_sec) * 1000000000ull +
                    (uint64_t)(after.tv_nsec - before.tv_nsec);
  return result;
}

int aot_gc_configure(size_t bytes, int stress) {
  free(spaces[0]); free(spaces[1]);
  free(old_space);
  capacity = (bytes + 7u) & ~7u;
  spaces[0] = calloc(1, capacity); spaces[1] = calloc(1, capacity);
  old_capacity = capacity;
  old_space = calloc(1, old_capacity);
  old_used = 0; young_ages_len = next_ages_len = 0;
  if (young_ages_cap) memset(young_ages, 0, young_ages_cap * sizeof(YoungAge));
  if (next_ages_cap) memset(next_ages, 0, next_ages_cap * sizeof(YoungAge));
  active_space = 0; used = 0; stress_mode = stress;
  aot_gc_thread_state.cursor = spaces[0];
  aot_gc_thread_state.limit = spaces[0] + capacity;
  aot_gc_thread_state.stress = stress != 0;
  aot_gc_thread_state.old_start = old_space;
  aot_gc_thread_state.old_end = old_space;
  aot_gc_thread_state.young_start = spaces[0];
  aot_gc_thread_state.young_end = spaces[0] + capacity;
  aot_gc_thread_state.remembered_dirty = 0;
  aot_gc_thread_state.barrier_hits = 0;
  aot_gc_thread_state.allocations = 0;
  aot_gc_thread_state.bytes_allocated = 0;
  collections = verifications = oom_count = moves = 0;
  slow_paths = promotions = 0;
  copied_bytes = promoted_bytes = peak_live_heap = maximum_frames = gc_nanoseconds = 0;
  barrier_disabled = 0;
  array_scan_disabled = 0;
  array_growth_disabled = 0;
  for (size_t i = 0; i < js_arrays_len; ++i) {
    free(js_arrays[i].elements); free(js_arrays[i].present);
  }
  for (size_t i = 0; i < js_strings_len; ++i) {
    free(js_strings[i]->units); free(js_strings[i]);
  }
  js_objects_len = js_properties_len = 0;
  memset(js_object_cache, 0, sizeof(js_object_cache));
  memset(js_property_cache, 0, sizeof(js_property_cache));
  js_property_cache_complete = 1;
  memset(js_array_cache, 0, sizeof(js_array_cache));
  js_arrays_len = 0;
  js_strings_len = 0;
  return spaces[0] && spaces[1] && old_space;
}

void *aot_gc_alloc(int64_t bytes, int64_t shape, void *context,
                   uint8_t *caller_sp, void *return_pc) {
  ++slow_paths;
  size_t size = ((size_t)bytes + 7u) & ~7u;
  if (!spaces[0] && !aot_gc_configure(1u << 20, 0)) return NULL;
  if (aot_gc_thread_state.cursor >= spaces[active_space] &&
      aot_gc_thread_state.cursor <= spaces[active_space] + capacity)
    used = (size_t)(aot_gc_thread_state.cursor - spaces[active_space]);
  if ((stress_mode || used + size > capacity) && !collect(context, caller_sp, return_pc)) {
    ++oom_count; return NULL;
  }
  if (used + size > capacity) { ++oom_count; return NULL; }
  uint8_t *result = spaces[active_space] + used;
  memset(result, 0, size); *(uint64_t *)result = (uint64_t)shape; used += size;
  ++aot_gc_thread_state.allocations;
  aot_gc_thread_state.bytes_allocated += size;
  if (used + old_used > peak_live_heap) peak_live_heap = used + old_used;
  aot_gc_thread_state.cursor = spaces[active_space] + used;
  return result;
}

__attribute__((noreturn)) void aot_gc_oom_trap(void) {
  _Exit(86);
}

uint64_t aot_gc_collections(void) { return collections; }
uint64_t aot_gc_verifications(void) { return verifications; }
uint64_t aot_gc_ooms(void) { return oom_count; }
uint64_t aot_gc_moves(void) { return moves; }
uint64_t aot_gc_slow_paths(void) { return slow_paths; }
uint64_t aot_gc_promotions(void) { return promotions; }
uint64_t aot_gc_barriers(void) { return aot_gc_thread_state.barrier_hits; }
uint64_t aot_gc_allocations(void) { return aot_gc_thread_state.allocations; }
uint64_t aot_gc_bytes_allocated(void) { return aot_gc_thread_state.bytes_allocated; }
uint64_t aot_gc_copied_bytes(void) { return copied_bytes; }
uint64_t aot_gc_promoted_bytes(void) { return promoted_bytes; }
uint64_t aot_gc_peak_live_heap(void) {
  if (aot_gc_thread_state.cursor >= spaces[active_space] &&
      aot_gc_thread_state.cursor <= spaces[active_space] + capacity) {
    size_t current = (size_t)(aot_gc_thread_state.cursor - spaces[active_space]);
    if (current + old_used > peak_live_heap) peak_live_heap = current + old_used;
  }
  return peak_live_heap;
}
uint64_t aot_gc_maximum_frames(void) { return maximum_frames; }
uint64_t aot_gc_nanoseconds(void) { return gc_nanoseconds; }
void aot_gc_disable_barrier_for_test(void) {
  barrier_disabled = 1;
  aot_gc_thread_state.old_start = (uint8_t *)UINTPTR_MAX;
}
void aot_gc_disable_array_scan_for_test(void) { array_scan_disabled = 1; }
void aot_gc_disable_array_growth_for_test(void) { array_growth_disabled = 1; }
uintptr_t aot_gc_unit_base(void) { return (uintptr_t)aot_kernel - functions()[0].code_start; }
uint64_t aot_gc_site_pc(uint32_t i) { return i < site_count() ? sites()[i].pc : UINT64_MAX; }
uint64_t aot_gc_stack_u32(uint32_t i) { return u32(aot_stackmaps + i); }
