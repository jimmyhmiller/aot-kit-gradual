# Current slice: X5 TypeScript depth-21 moving-GC closure

X4 published the reproducible nine-sample depth-21 report and made ordinary verification
write-free. That run exposed one deeper gap outside X3's depth-10 contract: the normalized
TypeScript native kernel can enter collection with an invalid `Tree.right = 2`. X5 keeps the
controller open until the stack-map/root-location cause is fixed rather than hidden with a larger
heap, disabled verification, or the hand-built kernel.

## Contract

The readable TypeScript source must run at depth 21 through normalization, Coil graph construction,
optimization, selection, motion, scheduling, allocation, encoding, Mach-O linking, and the moving
collector. All 31 fields and exact allocation metrics must agree with Node and the canonical model.

## Required evidence

- [x] Reduce the invalid relocated field to a named focused CallEnd/allocation-order witness.
- [x] Fix the general backend invariant, without fixture-specific dispatch.
- [x] Preserve multi-shape layout/reference bitmaps and exact safepoint locations.
- [x] Pass TypeScript native depth 21 in normal and heap-verification modes.
- [x] Pass depth 21 under six-register pressure and seeds 11 through 14.
- [x] Preserve X1-X4 gates, including verification-only worktree cleanliness.
- [x] Close X5 only through `node tools/workflow.mjs complete X5`.

## Stop conditions

Do not close X5 by increasing the heap until no collection occurs, accepting non-heap values as
references, disabling heap verification, switching the execution measurement to Node, or treating
the already-correct hand-built kernel as evidence for the TypeScript-native path.
