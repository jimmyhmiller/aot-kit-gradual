/* Run one JSL library definition, compiled to machine code, over the conformance table and print
   the same `label=value` lines tools/jsl-string-oracle.mjs prints.

   WHY THIS EXISTS. The interpreter and the backend are two implementations of one semantics, and
   only the interpreter was ever checked. They can disagree: eval.coil's RtVal is uniformly tagged
   so boxing is invisible, while the backend compiles arithmetic on raw registers. This harness
   links the emitted object and feeds it the same inputs, so the same committed golden judges both.

   The kernel takes NaN-boxed values and returns one, which is the ABI a JSL builtin is written
   against. Encoding matches the Node side exactly: `nan`, `inf`, `-inf`, a decimal integer when
   the value is integral and safe, `bits:N` otherwise, and `true`/`false` for booleans. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <math.h>
#include "js-value.h"

extern AotJsValue kernel(AotJsValue, AotJsValue);

static AotJsValue box_double(double d) {
  union { double number; uint64_t bits; } u = { d };
  return (AotJsValue)u.bits;
}

/* An input is written as a boxed integer when it is exactly one, matching how the JSL side's
   `oc-int` fixtures reach the interpreter. Everything else stays a raw double. */
static AotJsValue box_number(double d) {
  if (d == (double)(int64_t)d && d >= (double)AOT_JS_INT_MIN && d <= (double)AOT_JS_INT_MAX &&
      !(d == 0.0 && signbit(d)))
    return aot_js_box_int((int64_t)d);
  return box_double(d);
}

static void print_value(const char *label, AotJsValue v) {
  printf("%s=", label);
  uint64_t tag = aot_js_tag(v);
  if (tag == AOT_JS_BOOLEAN) { printf("%s\n", aot_js_payload(v) ? "true" : "false"); return; }
  if (tag == AOT_JS_INTEGER) { printf("%lld\n", (long long)aot_js_unbox_int(v)); return; }
  if (v == AOT_JS_NAN) { printf("nan\n"); return; }
  union { uint64_t bits; double number; } u = { v };
  double d = u.number;
  if (d != d) { printf("nan\n"); return; }
  if (d == INFINITY) { printf("inf\n"); return; }
  if (d == -INFINITY) { printf("-inf\n"); return; }
  if (d == (double)(int64_t)d && d >= -9007199254740991.0 && d <= 9007199254740991.0) {
    printf("%lld\n", (long long)d);
    return;
  }
  printf("bits:%lld\n", (long long)(int64_t)v);
}

/* The value tables, in the Node script's order. Kept here rather than generated so the native side
   is an independent transcription: a shared generator would make the comparison self-consistent. */
static const double NUMS[] = {0, 1, -1, 2.5, -2.5, 2.4, -2.4, 0.5, -0.5,
                              0.49999999999999994, 7, -7, 1e300, NAN, INFINITY, -INFINITY};
static const size_t NUMS_N = sizeof NUMS / sizeof NUMS[0];

static const double PAIRS[][2] = {{1,2},{2,1},{NAN,1},{1,NAN},{INFINITY,5},{-INFINITY,5},{3,3}};
static const size_t PAIRS_N = sizeof PAIRS / sizeof PAIRS[0];

static const double VALS[] = {0, 1, -1, 2.5, NAN, INFINITY, -INFINITY,
                              9007199254740991.0, 9007199254740992.0, 1e300};
static const size_t VALS_N = sizeof VALS / sizeof VALS[0];

int main(int argc, char **argv) {
  if (argc < 3) { fprintf(stderr, "usage: harness LABEL TABLE\n"); return 1; }
  const char *label = argv[1], *table = argv[2];
  char buf[64];
  if (!strcmp(table, "nums")) {
    for (size_t i = 0; i < NUMS_N; i++) {
      snprintf(buf, sizeof buf, "%s%zu", label, i);
      print_value(buf, kernel(box_number(NUMS[i]), 0));
    }
  } else if (!strcmp(table, "pairs")) {
    for (size_t i = 0; i < PAIRS_N; i++) {
      snprintf(buf, sizeof buf, "%s%zu", label, i);
      print_value(buf, kernel(box_number(PAIRS[i][0]), box_number(PAIRS[i][1])));
    }
  } else if (!strcmp(table, "vals")) {
    for (size_t i = 0; i < VALS_N; i++) {
      snprintf(buf, sizeof buf, "%s%zu", label, i);
      print_value(buf, kernel(box_number(VALS[i]), 0));
    }
  } else if (!strcmp(table, "idx")) {
    /* A plain 0..N-1 selector. The probe dispatches on it and returns a boolean or an integer, so
       a string result can be judged without the harness reading one out of the runtime. */
    int n = argc > 3 ? atoi(argv[3]) : 0;
    for (int i = 0; i < n; i++) {
      snprintf(buf, sizeof buf, "%s%d", label, i);
      print_value(buf, kernel(aot_js_box_int(i), 0));
    }
  } else {
    fprintf(stderr, "unknown table %s\n", table);
    return 1;
  }
  return 0;
}
