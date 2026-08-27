# Cached allocation layouts

## Purpose

Retained JSL machine functions may contain `MI-NEW`, but an encoded allocation currently embeds
the compiling graph's shape number and object size. Shape numbers are compiler-local and may not
be reused by a later Test262 Script. Rejecting every such function is safe, but leaves seven of the
eleven otherwise-cacheable JSL records out of the warm image.

The retained image must instead own the runtime allocation layouts required by its machine text.
This is a link-time data problem. It must not preserve a prior test's graph, type IDs, aliases,
shape transitions, Realm, global object, or other mutable JavaScript state.

## Semantic invariant

Every allocation operand in retained text names a catalog entry by a stable layout fingerprint.
For each final linked image, the linker assigns that entry an image-local shape ID, emits exactly
one matching `LayoutRec`, and patches every shape-ID and size operand in the retained text.

An image is invalid if any retained allocation has no catalog entry, if two entries with one
fingerprint disagree on layout, or if a patched shape ID has no emitted `LayoutRec`.

Shape IDs are not JavaScript-visible identity. The native runtime uses the ID to locate allocation
size, field count, reference bitmap, and boxed-value bitmap for copying, scanning, and heap
verification. JavaScript-visible properties remain owned by `lib/` and the runtime side tables.

## Catalog record

Each retained layout record contains:

- Stable fingerprint of the ordered runtime field layout.
- Allocation size and alignment.
- Field count.
- Raw-managed-reference bitmap.
- Boxed-managed-value bitmap.

Compiler-only type IDs and aliases are deliberately absent. They are not valid across requests
and are unnecessary after instruction selection.

## Extraction

1. Encode every `MI-NEW` shape and size immediate at a fixed width.
2. Emit `MFT-RELOC-SHAPE-ID` for both encoded shape-ID operands.
3. Emit `MFT-RELOC-SHAPE-SIZE` for all three encoded size operands.
4. Attach the source layout fingerprint and complete runtime layout to the function-text record.
5. Reject extraction if the shape cannot be represented by the runtime catalog schema.

Fixed-width operands are required because linking must not change instruction offsets, branch
distances, stack-map PCs, function ranges, or relocation offsets.

## Linking

1. Build the ordinary fresh-Script layouts first.
2. Deduplicate retained catalog entries by fingerprint and exact layout equality.
3. Assign retained-only layouts IDs after the fresh layout namespace.
4. Append their `LayoutRec` values to the linked image's layout section.
5. Patch every retained shape and size relocation.
6. Verify that every patched ID resolves to an emitted record before publication.

The mapping is rebuilt for every linked image. Retained machine text is immutable; only the fresh
linked copy is patched. The runtime clears its layout lookup cache when that image is registered.

## Test262 isolation

This design does not combine tests or alter their source. Each variant remains an independent
Script with official harness includes, its own top-level semantics, and fresh forked runtime/Realm
state. Only immutable native implementation text and self-describing runtime layout metadata are
shared by the compiler worker.

## Required witnesses

- One cached allocation function relinks when its original compiler shape ID differs.
- Multiple allocations of one fingerprint deduplicate to one linked `LayoutRec`.
- Different fingerprints with equal sizes remain distinct.
- Conflicting records for one fingerprint are rejected.
- Missing shape and size relocations are rejected before publication.
- A GC-stressing execution witness moves and scans objects allocated by retained text.
- Cache admission increases without passed-to-nonpassed Test262 transitions.
- The identical 199-variant String workload reports retained-record count and phase timing before
  and after the change.

## Implementation order

1. Add catalog storage and validation to the function-text archive.
2. Make AArch64 `MI-NEW` immediates fixed-width and extract five semantic relocations.
3. Merge catalog layouts and patch operands in `mfti-build!`.
4. Remove `MFT-UNCACHEABLE-SHAPE` only when all allocation relocations are complete.
5. Add the focused linker and GC witnesses.
6. Run the bounded gate, frontier, and identical Test262 benchmark.
