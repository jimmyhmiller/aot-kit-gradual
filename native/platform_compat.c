#include <sys/resource.h>
#include <stddef.h>

#if defined(__APPLE__)
__asm__(".weak_definition _kernel\n"
        "_kernel:\n"
        ".byte 0\n");
#endif

#if !defined(__APPLE__)
// Darwin exposes sys_icache_invalidate directly. Other hosts use the compiler
// builtin, which is a no-op on coherent-cache targets such as x86-64 and emits
// the required maintenance instructions on targets that need them.
void sys_icache_invalidate(void *start, size_t length) {
  __builtin___clear_cache((char *)start, (char *)start + length);
}
#endif

int aot_mmap_anon_flags(void) {
#if defined(__APPLE__)
  return 0x1002; // MAP_PRIVATE | MAP_ANON
#else
  return 0x22; // MAP_PRIVATE | MAP_ANONYMOUS
#endif
}

int aot_host_is_x86_64(void) {
#if defined(__x86_64__)
  return 1;
#else
  return 0;
#endif
}

// Peak resident set size of THIS process, in bytes, as the kernel has observed it so far.
// `ru_maxrss` is monotonic, so a caller reading it after the largest phase reads that phase's
// peak. The unit differs by host and is normalized here rather than at every call site.
long aot_peak_rss_bytes(void) {
  struct rusage usage;
  if (getrusage(RUSAGE_SELF, &usage) != 0) return -1;
#if defined(__APPLE__)
  return (long)usage.ru_maxrss;
#else
  return (long)usage.ru_maxrss * 1024L;
#endif
}
