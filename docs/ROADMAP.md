# Roadmap: close the Simple backend gap

This file is the authoritative roadmap. The previous M0-M13 roadmap described how the current
prototype was assembled; it is obsolete. Historical rationale remains in [JOURNAL.md](JOURNAL.md),
and architectural laws remain in [DECISIONS.md](DECISIONS.md).

The present objective is narrower and more demanding:

> Turn the existing ideal IR and optimizer into a general, whole-program native compiler by
> completing the missing Simple-derived backend machinery, then prove the result with a native,
> GC-stressed binary-trees program and finally lower that program from TypeScript.

The supporting documents are part of this roadmap:

- [SIMPLE-GAP.md](SIMPLE-GAP.md) records the audited gap and the boundary between reusable work,
  missing Simple machinery, and this project's deliberate extensions.
- [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) specifies every implementation slice, its
  prerequisites, deliverables, likely files, and executable exit gate.
- [VERIFICATION-WORKFLOW.md](VERIFICATION-WORKFLOW.md) is the mandatory workflow for implementing,
  reviewing, falsifying, and landing a slice.
- [BINARYTREES.md](BINARYTREES.md) defines the integration program, observables, test ladder, GC
  stress requirements, and final benchmark gate.

If these documents disagree, precedence is:

1. `DECISIONS.md` for compiler law.
2. This roadmap for order and status.
3. `IMPLEMENTATION-PLAN.md` for slice contracts.
4. `VERIFICATION-WORKFLOW.md` for execution procedure.
5. `BINARYTREES.md` for the integration workload.

## Baseline

The baseline commit is `269c245` (`Complete M10-M13 compiler milestones`). At that baseline:

- `tools/gate.sh --quick` is green with 239 tests.
- All 28 corpus graphs select, allocate, and encode for arm64.
- The 27 terminating corpus programs agree with the interpreter.
- Ideal IR, interpretation, graph text, and inference support direct calls, recursion, mutual
  recursion, higher-order calls, and closures.
- The native backend does not select `Call` and does not compile a whole multi-function unit.
- Native CFG lowering recognizes selected corpus shapes instead of representing arbitrary blocks.
- Liveness and allocation are based on textual intervals, with a special back-edge extension.
- Native `New` metadata and the collector are tested separately; compiled code does not yet enter
  the moving collector and resume with relocated roots.
- The TypeScript frontend lowers into a JavaScript-side graph and executor, not the native Coil IR.

This baseline is useful and must remain green, but it is not the completion criterion.

## Non-negotiable rules

1. **No shape-specific feature claims.** A second loop-phi helper, another diamond pattern, or a
   binary-trees-specific selector is not progress toward a general backend.
2. **No plausible placeholders.** Unsupported input produces a named capability failure before
   code emission. It never returns `false`, zero, or partial object bytes without a diagnostic.
3. **Correctness never depends on inlining.** Recursive and ordinary calls must work as calls.
4. **The interpreter is the semantic oracle.** Every terminating parity fixture is compared before
   and after optimization and against native execution.
5. **Every gate must be falsified.** Temporarily reverse or remove the behavior it claims to test;
   the focused gate must turn red for the expected reason.
6. **No milestone advances across a red predecessor.** Later exploratory work may exist locally,
   but no later milestone is marked done or merged while an earlier required gate is red.
7. **Generated artifacts are not source.** Build output, binaries, dumps, and temporary objects stay
   ignored unless a document explicitly defines a reviewed golden artifact.
8. **Claims name their scope.** “Collector model passes,” “native metadata exists,” and “compiled
   code survives collection” are three different claims and require three different gates.

## Definition of the gap

The audit against `reference/Simple/chapter24` found that parity is strong through the ideal graph,
peephole engine, lattice, loop tree, callable program model, and optimistic interprocedural analysis.
The concentrated gap is the general code-generation half:

```text
whole ideal program
    -> explicit machine functions and CFG
    -> general instruction selection
    -> edge-correct Phi lowering
    -> global code motion
    -> local scheduling
    -> CFG liveness
    -> constrained register allocation
    -> ABI frames and calls
    -> multi-function Mach-O
```

Native moving-GC integration and TypeScript lowering follow this substrate. They are project goals,
not Simple parity.

## Milestone table

Status values are `not started`, `in progress`, `blocked`, and `done`. “Done” means the exit gate in
`IMPLEMENTATION-PLAN.md` is executable, green, and has been falsified successfully.

| ID | Milestone | Status | Required predecessor | Primary gate |
|---|---|---|---|---|
| G0 | Capability diagnostics and parity fixture ladder | done | baseline | `backend-parity-test` rejects unsupported stages by name |
| G1 | Machine compilation units, functions, blocks, and edges | done | G0 | verified exact CFG tables for nested and multi-function fixtures |
| G2 | General block-based instruction selection | done | G1 | arbitrary reducible parity CFGs select without shape helpers |
| G3 | General Phi edge lowering | done | G2 | multi-Phi, split-edge, cyclic-copy, memory-Phi, and spill differentials |
| G4 | Conservative multi-function direct calls | done | G3 | two native functions call and return through real `BL` |
| G5 | arm64 ABI and per-function frames | done | G4 | non-leaf, stack-argument, and recursive frame gates |
| G8 | Simple-style global code motion | complete | G3, G5 | placement laws and memory anti-dependencies are executable |
| G9 | Dependency-correct local scheduling | complete | G8 | seeded schedules preserve dependencies and native results |
| G6 | CFG liveness | complete | G3, G5, G9 | exact live-in/out and Phi-edge sets over final scheduled code |
| G7 | CFG-correct constrained register allocation | complete | G6 | forced-pressure calls, loops, Phi cycles, and spills agree |
| G10 | Multi-function Mach-O and metadata emission | complete | G5, G7 | symbols, fixups/relocations, external harness execution |
| X1 | Native allocation and moving-GC bridge | complete | G7, G9, G10 | compiled code collects and resumes with relocated roots |
| X2 | Hand-built binary-trees integration gate | complete | X1 | interpreter/native/stress/full-depth ladder is green |
| X3 | Parser-independent frontend IR and TypeScript lowering | complete | X2 | TypeScript binary-trees reaches the same native pipeline |
| X4 | Published binary-trees performance report | complete | X3 | raw samples, ratios, GC metrics, and losses published |
| X5 | TypeScript depth-21 moving-GC closure | complete | X4 | exact native results survive moving collection at full depth |

## Critical path

```text
G0 -> G1 -> G2 -> G3 -> G4 -> G5 -> G8 -> G9 -> G6 -> G7 -> G10 -> X1 -> X2 -> X3 -> X4 -> X5
```

The IDs describe capability groups, not implementation order. Placement and scheduling precede the
final liveness solution and register allocation because both can change instruction locations and
therefore live ranges. A later CFG-mutating phase must explicitly invalidate and rerun G6/G7; it may
not consume stale allocation or safepoint data.

## Milestone summaries

### G0: capability diagnostics and parity fixtures

Create a permanent ladder that forces every missing behavior independently. The ladder begins with
multiple Phis and ends with reduced binary-trees. Unsupported stages must fail with stable codes.
This ensures later slices cannot confuse “selector accepted the graph” with “program compiled.”

### G1: machine functions and CFG

Add explicit `MFunction`, `MBlock`, and `MEdge` ownership. Enumerate reachable functions, construct
RPO per function, preserve Region predecessor-slot identity, and verify both directions of every
edge. No scheduling or clever placement is required yet.

### G2: general selection

Select into blocks. Replace recursive control walking and special recognition of diamonds/loops.
Every supported ideal control node maps to an explicit terminator or block boundary. Data nodes are
initially pinned conservatively to a legal controlling block.

### G3: general Phi lowering

Put Phi moves on incoming edges, split critical edges, and resolve parallel copies including cycles.
`CSEL` becomes optional optimization, never the implementation of merge correctness.

### G4: direct calls

Compile several ideal functions in one invocation and encode direct internal calls. Begin with a
deliberately conservative call envelope and named rejection of unsupported live-across-call cases.

### G5: ABI and frames

Replace the fixed frame with derived per-function layouts. Model argument and return registers,
caller/callee saves, LR, stack alignment, outgoing arguments, spills, and recursion.

### G6: liveness

Solve use/def/live-in/live-out over the machine CFG. Attribute Phi uses to incoming edges. Model call
clobbers and expose value-kind-aware safepoint liveness.

### G7: register allocation

Build interference from CFG liveness, honor fixed masks and clobbers, coalesce safe copies, allocate
frame-local spill slots, insert splits/reloads/stores, and repeat analysis as necessary.

### G8: global code motion

Port the relevant Simple placement algorithm: earliest legal block, latest use-LCA block, Phi-edge
uses, loop-depth preference, pinned rules, function locality, and memory/call anti-dependencies.

### G9: local scheduling

Within each block, schedule a dependency graph deterministically. Preserve memory, calls, fixed
constraints, edge-copy placement, and terminator position.

### G10: object emission

Emit several function symbols, internal call fixups or relocations, runtime symbols, frame metadata,
and stack-map sections. Validate the object mechanically before linking it from an external harness.

### X1: native GC integration

Replace synthetic native allocation behavior with bump allocation, a slow-path runtime call, real
layout descriptors, exact stack maps, native frame walking, and root relocation. Stress must execute
compiled code, not merely replay allocation sites through the collector model.

### X2: hand-built binary-trees

Build the program through the trusted node API before involving a frontend. Run a small-depth
differential matrix, forced pressure, collect-every-allocation, and a full-depth extended gate.

### X3: TypeScript lowering

Adopt a mature TypeScript parser behind a normalized frontend IR. Implement only the explicit
semantic subset needed to express the program cleanly, while retaining named rejection elsewhere.
Lower into the same Coil graph used by X2; do not maintain a second executable “core graph.”

### X4: performance

Publish compilation phases and runtime separately, including allocation throughput, collection
counts, copied/promoted bytes, peak live heap, code size, raw samples, ratios, and losses.

### X5: TypeScript full-depth moving-GC closure

Preserve intra-block CallEnd effect chains so recursive field-producing calls precede the parent
allocation, then prove the normalized TypeScript kernel at depth 21 under collection, verification,
register pressure, and multiple deterministic schedules.

## When the Simple gap is closed

Items G0 through G10 are complete only when all of these statements are executable facts:

1. One backend invocation compiles a reachable closed program with multiple functions.
2. Arbitrary supported reducible control flow becomes an explicit verified machine CFG.
3. Arbitrary Region/Phi sets lower through edge-specific parallel copies.
4. Direct and mutually recursive functions execute through real calls and independent frames.
5. Movable nodes receive legal function-local placement based on dominance, uses, loop depth,
   pinning, and memory dependencies.
6. Every block receives a dependency-correct schedule.
7. Liveness covers Phi edges, branches, loops, calls, and safepoints.
8. Allocation honors register constraints and call clobbers and spills to frame-local locations.
9. Mach-O emission contains the functions, symbols, calls, and metadata the program needs.
10. Native output agrees with the interpreter across the parity ladder under normal and forced
    pressure, including hand-built recursive object programs.

X1-X4 then establish this project's stronger claim: moving-GC-safe native execution and a real
TypeScript source path demonstrated by binary-trees.

## How to start

The next task is G0, not frontend work and not binary-trees code generation. Follow the slice
procedure in [VERIFICATION-WORKFLOW.md](VERIFICATION-WORKFLOW.md), then implement the exact G0
contract in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md#g0-capability-diagnostics-and-parity-fixture-ladder).
The ready-to-use contract and checklists are in [CURRENT-SLICE.md](CURRENT-SLICE.md).
