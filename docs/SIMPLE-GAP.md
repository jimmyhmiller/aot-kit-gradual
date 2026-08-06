# Audited gap with SeaOfNodes/Simple

This document records what was verified against the checked-in
`reference/Simple/chapter24`. It prevents two opposite errors: discarding working middle-end
machinery, and mistaking corpus coverage for a general backend.

## Audit conclusion

The project substantially recreated the parts of Simple it originally named as references:

- the ideal sea-of-nodes graph;
- lattice-driven optimistic analysis;
- peephole rewriting and GVN;
- control, Region, Phi, and loop representation;
- dominators and loop nesting;
- callable graph nodes and optimistic interprocedural inference.

The project did not recreate the general code-generation sequence represented in late Simple by
CFG construction, global placement, local scheduling, register allocation, and encoding of a whole
program. The backend phase modules were then expanded beyond the original arm64 prototype; see
`docs/BACKEND-ARCHITECTURE.md` for their current boundaries.

## Reusable implementation

### Ideal graph and optimizer

`src/node.coil` provides dense node identities, ordered inputs, reverse uses, compute/idealize,
peepholing, GVN, dependencies, worklists, Regions, Loops, Phis, and construction windows.

`src/ty.coil` provides the lattice, widening, memory types, object refinements, callable types, and
the proven/provisional distinction consumed by irreversible rewrites.

`src/shape.coil` and the memory portions of `src/node.coil` provide shapes, aliases, memory SSA,
loads, stores, allocation, and memory merges.

`src/verify.coil`, `src/gtext.coil`, and `src/eval.coil` provide a verifier, exact graph text, and a
differential interpreter. These are essential infrastructure for closing the backend gap.

### Callable ideal program

The graph already contains `Fun`, `FunStart`, `Parm`, `Call`, `CallEnd`, and `Closure`. Construction
supports cyclic recursive definitions. Interpretation and tests cover direct recursion, mutual
recursion, higher-order calls, closures, and caller-frame restoration. Inference discovers call
targets and propagates parameter and return information to a fixpoint.

Therefore calls must not be redesigned at the ideal level merely because native selection lacks
them. The task is to carry the existing semantics through machine lowering.

### Control metadata

The graph already computes immediate dominators, depths, natural loop bodies, and loop nesting. It
rejects stale analysis tables after control mutation. This is the intended substrate for global code
motion and CFG construction.

### Low-level backend pieces

The current backend contains reusable arm64 encoders, local branch labels, virtual-register IDs,
executable-memory tests, basic Mach-O byte writing, forced-spill tests, and native differential
execution. These should be reorganized around functions and blocks rather than discarded.

## Missing or incomplete implementation

### Compilation-unit model

Selection resets global state around one return root. There is no owner for several machine
functions, no reachable-function enumeration, no function-local block/instruction ranges, and no
per-function frame or allocation metadata.

### Native calls

`OP-CALL` has no selection case. The backend has no machine call, internal target, `BL`, call result,
return site, clobber mask, LR handling, or call relocation.

### Machine CFG

Control is emitted by recursive pattern walking. Diamonds and loops are recognized by shape. There
are no explicit block predecessor/successor lists, edge identities, RPO order, critical-edge splits,
or general unreachable-block policy.

### Phi lowering

Two-way values may become `CSEL`; one loop value may become `MI-MOV`. There is no arbitrary Phi set,
edge copy, parallel-copy solver, or cyclic-copy support. Memory Phi handling is similarly narrow.

### Global placement

There is no equivalent of Simple's earliest/latest placement, use LCA, Phi-edge use treatment,
loop-frequency selection, or memory/call anti-dependencies. Existing dominator tables are available
but not consumed this way.

### Local scheduling

Selection order is effectively instruction order. There is no block-local dependency DAG or
scheduler aware of memory, calls, fixed registers, latency, or terminators.

### Liveness

The current scheduler computes textual first/last indices and extends intervals around detected
backward branches. It does not solve block use/def/live-in/live-out, attribute Phi uses to edges, or
model call clobbers and exact safepoint liveness.

### Register allocation

Greedy textual interval coloring does not provide machine register masks, fixed constraints,
caller/callee-save interference, CFG interference, Phi coalescing, principled splitting, or repeated
allocation after inserted spills.

### ABI and frames

The backend reserves a fixed stack area and uses fixed spill offsets. It lacks derived aligned frame
sizes, LR saves, callee saves, outgoing stack arguments, frame-local offsets, recursive independence,
and large-frame addressing.

### Object emission

Mach-O output exposes one `_kernel` symbol. It lacks multiple function symbols, internal/runtime
relocations, function sizes, stack-map sections, and runtime metadata.

## Deliberate extensions beyond Simple

The following are not drift and must not be “fixed” by copying Simple:

- dynamic, union, and gradual types;
- proven annotations and guarded generic fallback;
- shapes and shape-set memory types;
- NaN-boxed dynamic representation;
- abstract safepoints and relocation projections;
- a moving generational collector;
- a TypeScript source frontend.

The backend must adapt Simple's structural lessons to these requirements. In particular, liveness
and allocation must retain scalar/raw-reference/boxed-reference kinds at safepoints.

## Deferred work that is not on the parity critical path

- Broad JavaScript syntax and runtime semantics
- Exceptions and exceptional CFG edges
- Native closures and indirect calls
- Arrays, modules, async, and console emulation
- Aggressive inlining of memory, branches, or recursion
- Additional CPU targets and ELF
- Every optimization present in Simple

The parity objective is structural correctness, not identical heuristic choices. A simpler allocator
or scheduler is acceptable only if it supports general CFGs, constraints, calls, and spills with the
same correctness envelope.

## Anti-drift checks

Before accepting any backend change, ask:

1. Does it operate on explicit general structure, or recognize another fixture shape?
2. Can a small adversarial graph make it fail?
3. Is the failure named before partial encoding?
4. Does correctness survive different worklist/scheduler orders and low register budgets?
5. Is native output compared to the interpreter?
6. If memory or references are involved, is a collection-capable path covered?

If the answer to the first question is “shape recognition,” the change requires redesign even if the
current corpus turns green.
