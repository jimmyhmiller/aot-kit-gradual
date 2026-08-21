#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>

int aot_gc_configure(size_t, int);
extern int64_t kernel(int64_t);
int64_t aot_gc_enter(int64_t (*)(void));

static int64_t arg;

static int64_t call(void) {
    return kernel(arg);
}

int main(int argc, char **argv) {
    arg = argc > 1 ? atoll(argv[1]) : 0;
    if (!aot_gc_configure(1048576, 0)) return 2;
    printf("%lld\n", (long long)aot_gc_enter(call));
    return 0;
}
