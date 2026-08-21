// Coil's metaprogram engine resolves imported externs before final-link objects
// are available. These weak definitions let graph-building macros compile. The
// native frontend must never execute in the metaprogram engine; final executables
// link libaot_typescript.a, whose strong definitions replace these stubs.
#include <stdint.h>

// A normal static-archive link would consider the weak stubs below sufficient and
// never extract the bridge's strong definitions. This one symbol exists only in
// the Go archive, so its relocation selects the archive portably: no Darwin
// -force_load or GNU --whole-archive spelling is needed.
extern void aot_ts_force_link(void);
__attribute__((used)) static void (*const aot_ts_force_link_ref)(void) = aot_ts_force_link;

// Go's Darwin runtime needs these frameworks. Put the requirement in this object
// rather than the project manifest so the same manifest also links on Linux.
#if defined(__APPLE__)
__asm__(".linker_option \"-framework\", \"CoreFoundation\"");
__asm__(".linker_option \"-framework\", \"Security\"");
#endif

__attribute__((weak)) uintptr_t aot_ts_parse(const char *source, int32_t length) {
  (void)source; (void)length; return 0;
}
__attribute__((weak)) void aot_ts_parse_delete(uintptr_t parse) { (void)parse; }
__attribute__((weak)) int32_t aot_ts_root(uintptr_t parse) { (void)parse; return -1; }
__attribute__((weak)) int32_t aot_ts_node_count(uintptr_t parse) { (void)parse; return 0; }
__attribute__((weak)) int32_t aot_ts_node_kind(uintptr_t parse, int32_t node) { (void)parse; (void)node; return -1; }
__attribute__((weak)) int32_t aot_ts_node_start(uintptr_t parse, int32_t node) { (void)parse; (void)node; return -1; }
__attribute__((weak)) int32_t aot_ts_node_end(uintptr_t parse, int32_t node) { (void)parse; (void)node; return -1; }
__attribute__((weak)) int32_t aot_ts_node_child_count(uintptr_t parse, int32_t node) { (void)parse; (void)node; return -1; }
__attribute__((weak)) int32_t aot_ts_node_child(uintptr_t parse, int32_t node, int32_t index) { (void)parse; (void)node; (void)index; return -1; }
__attribute__((weak)) int32_t aot_ts_diagnostic_count(uintptr_t parse) { (void)parse; return 0; }
__attribute__((weak)) int32_t aot_ts_diagnostic_code(uintptr_t parse, int32_t index) { (void)parse; (void)index; return -1; }
__attribute__((weak)) int32_t aot_ts_diagnostic_start(uintptr_t parse, int32_t index) { (void)parse; (void)index; return -1; }
__attribute__((weak)) int32_t aot_ts_diagnostic_length(uintptr_t parse, int32_t index) { (void)parse; (void)index; return -1; }
