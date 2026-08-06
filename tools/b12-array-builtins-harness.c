#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "js-value.h"

extern uint64_t kernel(void);
uint64_t aot_gc_enter(uint64_t (*)(void));
int aot_gc_configure(size_t, int);

int main(int argc, char **argv) {
  if (argc < 2) return 2;
  int stress = argc > 2 && strcmp(argv[2], "stress") == 0;
  if (!aot_gc_configure(4096, stress)) return 3;
  int expect_array = strcmp(argv[1], "array") == 0;
  AotJsValue expected = strcmp(argv[1], "undefined") == 0
                          ? AOT_JS_UNDEFINED
                          : (strcmp(argv[1], "true") == 0
                              ? AOT_JS_BOOLEAN | UINT64_C(1)
                              : (strcmp(argv[1], "null") == 0
                                  ? AOT_JS_NULL
                          : (strncmp(argv[1], "raw:", 4) == 0
                              ? (AotJsValue)strtoll(argv[1] + 4, NULL, 10)
                              : aot_js_box_int(strtoll(argv[1], NULL, 10)))));
  AotJsValue answer = aot_gc_enter(kernel);
  if (expect_array && aot_js_tag(answer) == AOT_JS_ARRAY) return 0;
  if (answer != expected) {
    fprintf(stderr, "B12 builtin mismatch: got=0x%016llx expected=0x%016llx\n",
            (unsigned long long)answer, (unsigned long long)expected);
    return 4;
  }
  return 0;
}
