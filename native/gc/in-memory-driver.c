#if !defined(__APPLE__)
#error "the in-memory Mach-O driver is Darwin-only"
#endif

#include <errno.h>
#include <fcntl.h>
#include <libkern/OSCacheControl.h>
#include <mach-o/loader.h>
#include <mach-o/arm64/reloc.h>
#include <mach-o/nlist.h>
#include <mach-o/reloc.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

int aot_gc_configure(size_t, int);
void aot_gc_register_unit(const uint8_t *, const uint8_t *, const uint8_t *, const uint8_t *);
int64_t aot_gc_enter1(int64_t (*)(int64_t), int64_t);
uintptr_t aot_gc_runtime_symbol(int);

static void fail(const char *message) {
  fprintf(stderr, "aot-memory-driver: %s: %s\n", message, strerror(errno));
  exit(65);
}

static uintptr_t runtime_symbol(const char *name) {
  if (!strcmp(name, "_aot_alloc_slow")) return aot_gc_runtime_symbol(0);
  if (!strcmp(name, "_aot_js_property")) return aot_gc_runtime_symbol(1);
  if (!strcmp(name, "_aot_js_array")) return aot_gc_runtime_symbol(2);
  if (!strcmp(name, "_aot_arr_load")) return aot_gc_runtime_symbol(3);
  if (!strcmp(name, "_aot_arr_store")) return aot_gc_runtime_symbol(4);
  if (!strcmp(name, "_aot_arr_len")) return aot_gc_runtime_symbol(5);
  if (!strcmp(name, "_aot_js_string")) return aot_gc_runtime_symbol(6);
  if (!strcmp(name, "_aot_js_dispatch_resolve")) return aot_gc_runtime_symbol(7);
  return 0;
}

int main(int argc, char **argv) {
  if (argc != 3) return 64;
  int fd = open(argv[1], O_RDONLY);
  if (fd < 0) fail("open");
  struct stat st;
  if (fstat(fd, &st) != 0) fail("fstat");
  uint8_t *object = mmap(NULL, (size_t)st.st_size, PROT_READ, MAP_PRIVATE, fd, 0);
  if (object == MAP_FAILED) fail("mmap object");
  close(fd);

  const struct mach_header_64 *header = (const struct mach_header_64 *)object;
  if (header->magic != MH_MAGIC_64 || header->filetype != MH_OBJECT) return 65;
  const struct section_64 *text = NULL, *stackmaps = NULL, *layouts = NULL;
  const struct symtab_command *symtab = NULL;
  const struct load_command *command = (const struct load_command *)(header + 1);
  for (uint32_t i = 0; i < header->ncmds; ++i) {
    if (command->cmd == LC_SEGMENT_64) {
      const struct segment_command_64 *segment = (const struct segment_command_64 *)command;
      const struct section_64 *section = (const struct section_64 *)(segment + 1);
      for (uint32_t j = 0; j < segment->nsects; ++j) {
        if (!strncmp(section[j].sectname, "__text", 16)) text = &section[j];
        else if (!strncmp(section[j].sectname, "__aot_stackmap", 16)) stackmaps = &section[j];
        else if (!strncmp(section[j].sectname, "__aot_layout", 16)) layouts = &section[j];
      }
    } else if (command->cmd == LC_SYMTAB) {
      symtab = (const struct symtab_command *)command;
    }
    command = (const struct load_command *)((const uint8_t *)command + command->cmdsize);
  }
  if (!text || !stackmaps || !layouts || !symtab) return 65;

  size_t image_size = ((size_t)text->size + (size_t)text->nreloc * 16u + 4095u) & ~4095u;
  uint8_t *image = mmap(NULL, image_size, PROT_READ | PROT_WRITE,
                        MAP_PRIVATE | MAP_ANON, -1, 0);
  if (image == MAP_FAILED) fail("mmap image");
  memcpy(image, object + text->offset, (size_t)text->size);

  const struct nlist_64 *symbols = (const struct nlist_64 *)(object + symtab->symoff);
  const char *strings = (const char *)(object + symtab->stroff);
  const struct relocation_info *relocs =
      (const struct relocation_info *)(object + text->reloff);
  uint64_t kernel_offset = UINT64_MAX;
  for (uint32_t i = 0; i < symtab->nsyms; ++i)
    if (!strcmp(strings + symbols[i].n_un.n_strx, "_kernel")) kernel_offset = symbols[i].n_value;
  if (kernel_offset == UINT64_MAX) return 65;

  for (uint32_t i = 0; i < text->nreloc; ++i) {
    const struct relocation_info *reloc = &relocs[i];
    if (!reloc->r_extern || reloc->r_type != ARM64_RELOC_BRANCH26) return 65;
    const char *name = strings + symbols[reloc->r_symbolnum].n_un.n_strx;
    uintptr_t target = runtime_symbol(name);
    if (!target) return 65;
    size_t stub = (size_t)text->size + (size_t)i * 16u;
    int64_t delta = ((int64_t)stub - reloc->r_address) / 4;
    *(uint32_t *)(image + reloc->r_address) = UINT32_C(0x94000000) |
                                              ((uint32_t)delta & UINT32_C(0x03ffffff));
    *(uint32_t *)(image + stub) = UINT32_C(0x58000050);     /* ldr x16, #8 */
    *(uint32_t *)(image + stub + 4) = UINT32_C(0xd61f0200); /* br x16 */
    *(uint64_t *)(image + stub + 8) = (uint64_t)target;
  }

  if (mprotect(image, image_size, PROT_READ | PROT_EXEC) != 0) fail("mprotect");
  sys_icache_invalidate(image, image_size);
  int64_t (*kernel)(int64_t) = (int64_t (*)(int64_t))(image + kernel_offset);
  aot_gc_register_unit((const uint8_t *)kernel, image, object + stackmaps->offset,
                       object + layouts->offset);
  if (!aot_gc_configure(1u << 20, 0)) return 66;
  printf("%lld\n", (long long)aot_gc_enter1(kernel, atoll(argv[2])));
  return 0;
}
