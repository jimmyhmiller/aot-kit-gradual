#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

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
  uint64_t reference_bitmap, reserved;
} LayoutRec;

static uint8_t *spaces[2];
static size_t capacity;
static size_t used;
static uint8_t *old_space;
static size_t old_capacity;
static size_t old_used;
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
   with the three fixed offsets emitted by backend.coil. */
AotGcThread aot_gc_thread_state;

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
      for (uint32_t i = 0; i < layout->field_count && i < 64; ++i) {
        if (!(layout->reference_bitmap & (1ull << i))) continue;
        uintptr_t ref = *(uintptr_t *)(base + cursor + 8 + i * 8);
        int young = ref >= (uintptr_t)spaces[active_space] &&
                    ref < (uintptr_t)(spaces[active_space] + used);
        int old = ref >= (uintptr_t)old_space && ref < (uintptr_t)(old_space + old_used);
        if (ref && !young && !old) return 0;
      }
      cursor += (layout->size + 7u) & ~7u;
    }
    if (cursor != bytes) return 0;
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
    uintptr_t moved = relocate(*slot);
    if (*slot && !moved) return 0;
    *slot = moved;
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
  size_t old_scan = aot_gc_thread_state.remembered_dirty ? 0 : old_before;
  int next_remembered_dirty = 0;
  while (scan < to_used || old_scan < old_used) {
    int scanning_old = scan >= to_used;
    uint8_t *object = scanning_old ? old_space + old_scan : to_start + scan;
    const LayoutRec *layout = layout_for(*(uint64_t *)object);
    if (!layout) return 0;
    for (uint32_t i = 0; i < layout->field_count && i < 64; ++i) {
      if (!(layout->reference_bitmap & (1ull << i))) continue;
      uintptr_t *field = (uintptr_t *)(object + 8 + i * 8);
      uintptr_t moved = relocate(*field);
      if (*field && !moved) return 0;
      *field = moved;
      if (scanning_old && moved >= (uintptr_t)to_start &&
          moved < (uintptr_t)(to_start + capacity)) next_remembered_dirty = 1;
    }
    if (scanning_old) old_scan += (layout->size + 7u) & ~7u;
    else scan += (layout->size + 7u) & ~7u;
  }
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
  return verify_heap();
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
uintptr_t aot_gc_unit_base(void) { return (uintptr_t)aot_kernel - functions()[0].code_start; }
uint64_t aot_gc_site_pc(uint32_t i) { return i < site_count() ? sites()[i].pc : UINT64_MAX; }
uint64_t aot_gc_stack_u32(uint32_t i) { return u32(aot_stackmaps + i); }
