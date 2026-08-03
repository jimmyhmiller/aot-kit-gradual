# Detailed implementation plan

Each section is a landable slice. A slice is complete only after every listed deliverable and exit
gate exists, passes, and has been falsified according to [VERIFICATION-WORKFLOW.md](VERIFICATION-WORKFLOW.md).
Do not combine slices merely because their code touches the same module.

## Common slice requirements

Every slice must provide:

- a named capability or invariant;
- a focused positive test;
- a focused negative/corruption test when the structure is verifiable;
- interpreter/native differential coverage for behavior the current slice makes executable;
- deterministic diagnostic or dump output for failures;
- full `tools/gate.sh --quick` before commit;
- full `tools/gate.sh` before a roadmap milestone is marked done;
- a journal entry stating what was implemented, what the falsification changed, and why the gate
  went red.

New backend phases should expose a verifier callable independently from tests. A verifier that only
runs inside the full pipeline cannot isolate which phase first corrupted the program.

## G0: capability diagnostics and parity fixture ladder

### Purpose

Make every current backend limitation explicit before replacing it. This is the control group for
the whole project.

### Deliverables

1. Introduce stable backend result codes rather than boolean selection failure. At minimum distinguish:
   unsupported ideal opcode, malformed ideal graph, unsupported CFG shape, unsupported Phi form,
   unsupported call, unsupported live-across-call, allocation failure, encoding failure, and object
   emission failure.
2. Ensure failure is atomic: code/object buffers are not consumable after a failed phase.
3. Add a dedicated parity fixture module or clearly isolated builders containing:
   - diamond with two value Phis;
   - loop with two value Phis;
   - loop-carried swap requiring a cyclic parallel copy;
   - branch nested in a loop;
   - loop nested in a branch;
   - two direct nonrecursive functions;
   - a value live across a call;
   - direct recursion;
   - mutual recursion;
   - recursive fixed-shape allocation and traversal;
   - reduced binary-trees.
4. Record interpreter outcomes for every terminating fixture. Store structured expected outcomes,
   not prose or copied terminal output.
5. Add a parity-ladder runner that reports the highest completed capability without treating
   expected unsupported stages as general gate failures.
6. Put the normal and extended seed, register-pressure, and collector matrices in one shared test
   configuration consumed by the ladder and later suites.
7. Add `tools/extended-gate.sh` as the named home for broad seed/stress matrices. It may initially
   run the G0 broad parity matrix; later milestones append their expensive witnesses.

### Likely files

- `src/backend.coil`
- `tests/backend-test.coil`
- new `tests/backend-parity-test.coil`
- new `src/backend-parity.coil` if fixture sharing warrants a product module
- `tools/gate.sh`

### Exit gate

- Existing corpus remains green.
- Every parity fixture either executes correctly or fails with its exact expected capability code.
- No fixture fails through a generic false/zero return.
- Corrupting one fixture produces a graph/verifier error distinct from “unsupported.”
- The reduced binary-trees interpreter result is stable across the configured seed set.

## G1: machine functions, blocks, and edges

### Purpose

Create the structural substrate all later backend phases consume.

### Deliverables

1. Define a compilation-unit owner containing reachable `MFunction`s, global symbols, runtime
   dependencies, and phase state.
2. Define `MFunction` with ideal function identity, entry block, ordered block list, return blocks,
   frame metadata placeholder, and code range placeholder.
3. Define `MBlock` with stable ID, owner, ideal control representative, predecessor edges, successor
   edges, instruction list, loop depth, and eventual layout index.
4. Define `MEdge` with source, target, target predecessor slot, and edge-copy placeholder.
5. Enumerate reachable ideal functions from the compilation entry and closed-world call targets.
6. Build a function-local CFG in reverse postorder. Preserve the exact Region/Loop predecessor slot
   used by Phi operands.
7. Define treatment of entry, return, unreachable, and never-exiting blocks.
8. Add a machine-CFG verifier checking ownership, reciprocal edges, terminator/successor arity,
   predecessor-slot uniqueness, RPO reachability, and function isolation.
9. Add a deterministic CFG dump used by tests and debugging.

### Design constraints

- Constants or nodes shared by ideal functions cannot silently acquire one machine-function owner.
- Edge identity must survive critical-edge splitting later.
- Building the CFG must not mutate the ideal graph.

### Exit gate

- Exact CFG tables for straight line, diamond, nested diamond, loop, nested loop, and multiple
  functions.
- Every edge round-trips through both predecessor and successor lists.
- Deliberately broken ownership, edge reciprocity, and predecessor slots each produce named errors.
- Unreachable ideal control does not appear in emitted machine functions.

## G2: general block-based selection

### Purpose

Replace recursive control-pattern emission with instruction selection over verified blocks.

### Deliverables

1. Select all supported pinned control and memory nodes into their owner blocks.
2. Represent explicit block terminators: conditional branch, unconditional branch, and return.
3. Select movable data conservatively into a legal controlling block; sophisticated placement waits
   for G8.
4. Define machine opcode descriptors containing input/output arity, register-class placeholders,
   side effects, pinning, memory effects, terminator status, and encoding availability.
5. Remove correctness dependence on diamond detection, the single-loop-Phi search, and the global
   `inloop` flag.
6. Make unsupported opcodes fail by code before scheduling or encoding.
7. Verify that each instruction belongs to one function/block and every terminator matches block
   successors.

### Exit gate

- All scalar corpus behavior selects through blocks.
- Arbitrary nesting of supported reducible branches and loops selects without recognizing builder
  names or fixed graph shapes.
- Changing block layout does not change successor semantics.
- Unsupported `Call` still fails with the G0 call code, proving selection did not silently omit it.

## G3: general Phi edge lowering

### Purpose

Implement SSA destruction correctly for arbitrary merges and loops.

### Deliverables

1. Attribute each Phi input to the matching incoming `MEdge` using predecessor-slot identity.
2. Create one parallel-copy set per edge.
3. Split critical edges when an edge needs executable copies and cannot safely host them.
4. Resolve parallel copies with:
   - acyclic topological moves;
   - self-copy elimination;
   - cycle breaking through a temporary virtual register;
   - spill-based fallback after allocation if no register temporary exists.
5. Support any number of value Phis and loop-carried values.
6. Treat memory Phis as state/order dependencies, not scalar register copies.
7. Verify that no ideal Phi reaches encoding and every Phi result has definitions on all reachable
   incoming edges.
8. Keep `CSEL` as an optional later fold for profitable two-arm scalar merges.

### Exit gate

- Diamonds with two and three Phis execute correctly.
- Loops with multiple counters/accumulators execute correctly.
- A swap cycle executes under normal and forced-spill configurations.
- A critical-edge fixture produces the exact expected split block.
- Swapping one Phi arm makes the native/interpreter differential fail.

## G4: conservative multi-function direct calls

### Purpose

Carry existing ideal direct-call semantics into native code with the smallest honest envelope.

### Deliverables

1. Add machine call and call-result representation.
2. Bind singleton closed-world call targets to `MFunction`s.
3. Lay out several machine functions in one text buffer with stable labels.
4. Encode internal arm64 `BL` fixups.
5. Move register arguments into the initial ABI locations and read the result from `x0`.
6. Preserve ideal call/control ordering through `CallEnd`.
7. Initially reject indirect calls, closures, stack arguments, and values live across calls with
   distinct capability codes.
8. Extend executable-memory and linked-object harnesses to call a multi-function unit.

### Exit gate

- Entry calls an add function and returns its result.
- Entry calls two different functions.
- One callee with multiple returns joins correctly.
- A call chain of depth three works.
- The live-across-call fixture fails with the intended temporary restriction.
- Disassembly contains real `bl`, not inlined arithmetic.

## G5: arm64 ABI and per-function frames

### Purpose

Make non-leaf and recursive execution ABI-correct.

### Deliverables

1. Define arm64 register classes and caller/callee-save sets.
2. Define fixed locations for incoming arguments and results.
3. Support arguments beyond the register set through outgoing/incoming stack slots.
4. Compute each frame from local spills, saved registers, outgoing arguments, and metadata needs.
5. Maintain 16-byte SP alignment at all call boundaries.
6. Save and restore LR for non-leaf functions; define the frame-pointer policy.
7. Address spills relative to the current frame; remove the fixed 2048-byte reservation and fixed
   1024-byte spill base.
8. Generate prologue/epilogue after frame layout stabilizes.
9. Handle large frame offsets with legal instruction sequences.
10. Define stack-overflow behavior or an explicit current bound; never silently overwrite memory.

### Exit gate

- Leaf and non-leaf prologue/epilogue disassembly matches reviewed expectations.
- Calls with 0, 8, and more than 8 arguments work.
- SP alignment is asserted from an external harness.
- A callee-saved witness remains intact.
- Direct and mutual recursion execute through many independent frames.
- Frame sizes are exact for zero, small, forced-spill, and large cases.

## G6: CFG liveness

### Purpose

Compute the data needed for safe allocation, calls, and precise stack maps.

This phase runs after global placement and local scheduling. Any later transformation that changes
the CFG, instruction placement, definitions, uses, or call sites invalidates its result and must
rerun G6 before allocation.

### Deliverables

1. Compute block `use` and `def` sets.
2. Compute `live-in` and `live-out` to a fixpoint over successors.
3. Attribute Phi operands to predecessor edges rather than the Phi block.
4. Model call uses, definitions, and clobbers.
5. Represent liveness per machine function with deterministic value numbering.
6. Retain value kind: scalar, raw managed reference, boxed word, or nonmoving pointer.
7. Expose exact live sets at safepoints.
8. Add a liveness verifier and deterministic dump.

### Exit gate

- Golden live sets for diamond, multiple-Phi loop, nested loops, call chain, recursion, and
  caller-live-across-call.
- Phi-arm values are live only on their matching incoming edge.
- Loop-carried values are live on back edges.
- Different block traversal orders reach identical fixpoints.
- Deleting a successor propagation step makes a focused loop test red.

## G7: CFG-correct constrained register allocation

### Purpose

Assign legal physical locations across arbitrary CFGs and calls.

### Deliverables

1. Add per-machine-op input, output, temporary, and clobber masks.
2. Build interference from CFG liveness.
3. Model fixed argument/result registers and caller-clobber interference.
4. Coalesce safe copies, particularly Phi-edge and ABI moves.
5. Assign callee-saved locations to profitable live-across-call ranges or spill them correctly.
6. Allocate frame-local spill slots with compatible size/alignment/kind.
7. Insert reloads, stores, and split ranges at legal block/edge positions.
8. Recompute affected liveness/interference and repeat until all ranges have legal locations.
9. Resolve allocated parallel-copy cycles safely.
10. Emit location maps suitable for safepoints.

### Exit gate

- Every live definition has a legal physical or stack location.
- Caller-live values survive nested calls.
- Recursive programs work with normal and deliberately tiny register budgets.
- Phi cycles work while spilled.
- Scalar and managed-reference spill metadata remain distinct.
- Allocation is deterministic for a fixed seed and semantically identical across tie-break seeds.

## G8: Simple-style global code motion

### Purpose

Place movable nodes legally and profitably using the existing dominator/loop tree.

### Deliverables

1. Classify pinned and movable ideal/machine nodes.
2. Compute earliest legal placement from definitions.
3. Compute latest legal placement from use LCAs.
4. Treat Phi uses as occurring on matching predecessor edges.
5. Choose among legal blocks using loop depth/frequency preference.
6. Keep placement function-local even for shared constants.
7. Add load/store and call memory anti-dependencies.
8. Rebuild or reject stale dominance information after CFG mutation.
9. Provide exact placement dumps and verifier checks for dominance of every use.

### Exit gate

- Loop-invariant arithmetic hoists; loop-variant arithmetic does not.
- Values used by Phis remain legal on their incoming edges.
- Loads do not cross overlapping stores or calls.
- Placement is stable across ideal worklist seeds.
- Tests adapted from the relevant `reference/Simple/chapter24` placement cases pass.
- Native/interpreter results match with GCM disabled and enabled.

## G9: dependency-correct local scheduling

### Purpose

Produce legal deterministic instruction order inside each block.

### Deliverables

1. Build a dependency DAG containing data, memory, anti-dependency, fixed-register, and call edges.
2. Keep entry materialization first and terminators last.
3. Keep edge copies in their split block or legal edge position.
4. Define latency and priority metadata separately from correctness dependencies.
5. Schedule deterministically with configurable test tie-breakers.
6. Verify every dependency precedes its consumer and all block instructions are scheduled once.

### Exit gate

- Load/store and store/store ordering witnesses cannot reverse.
- Calls remain ordered with memory effects.
- Multiple scheduler tie-break seeds produce identical observable results.
- Deliberately removing a memory dependency turns the focused test red.

## G10: multi-function Mach-O and metadata

### Purpose

Emit a real linkable compilation unit rather than one synthetic kernel.

### Deliverables

1. Emit exported and internal function symbols with correct values and sizes.
2. Resolve internal calls or emit appropriate relocations.
3. Emit relocations for runtime slow paths and other external symbols.
4. Add versioned metadata sections for stack maps and object layouts.
5. Validate all symbol, relocation, and section references before publishing object bytes.
6. Keep object output atomic on error.
7. Add a repository-local structural object parser where platform tools cannot provide stable gates.

### Exit gate

- Mechanical inspection finds all expected functions and calls.
- An external C harness links and runs a multi-function recursive object.
- Unresolved targets fail linking or earlier validation, never target offset zero.
- Reordered function layout preserves behavior and relocations.

## X1: native allocation and moving-GC bridge

### Purpose

Make compiled code allocate into and survive the real collector.

### Deliverables

1. Specify native object headers, field layout, size alignment, shape/layout ID, and reference bitmap.
2. Add runtime heap state with allocation pointer and limit.
3. Emit a bump-allocation fast path for `New`.
4. Emit a runtime slow-path call on limit or stress mode.
5. Serialize exact safepoint stack maps from G6/G7 locations and value kinds.
6. Walk native frames using G5 frame metadata.
7. Relocate roots in saved registers and spill slots.
8. Resume compiled code using relocation projections, never pre-safepoint values.
9. Scan object reference fields using layout descriptors.
10. Implement and gate the generational write barrier required for old-to-young references.
11. Replace fixed model capacities with configured runtime spaces and explicit OOM behavior.
12. Run the heap verifier after every collection in debug/stress mode.

### Exit gate

- Compiled code, not a model replay, enters the collector.
- Collect-every-allocation preserves a native linked heap.
- Collection succeeds when the only root is in a register, spill slot, argument, and object field.
- A stale pre-safepoint root negative fixture is caught.
- Recursive allocation collects and resumes.
- Promotion and old-to-young updates remain valid.

## X2: hand-built binary-trees

Implement the program and gates exactly as specified in [BINARYTREES.md](BINARYTREES.md). It must
use ordinary ideal nodes, calls, objects, and loops. Backend code may not inspect the fixture name,
function names, tree shape, or depth constants.

## X3: parser-independent frontend and TypeScript lowering

### Deliverables

1. Choose a maintained TypeScript parser and pin its dependency/version.
2. Add a normalized frontend IR for functions, blocks, locals, assignments, branches, loops, calls,
   constructor calls, object literals, fields, operators, and source ranges.
3. Add lexical resolution with stable symbol IDs, closed-world function tables, arity checks, and
   precise unsupported-syntax diagnostics.
4. Add structured CFG lowering that maintains control, memory, bindings, loop targets, return
   merges, and Phi arity contracts.
5. Lower annotations to the existing proven/guarded type model.
6. Lower into the same Coil ideal graph consumed by X2.
7. Retire the JavaScript-side executable graph as a product path; it may remain only as a parser
   oracle while migration is incomplete.

### Exit gate

- Existing TypeScript corpus retains its results and guard-count claim.
- TypeScript binary-trees produces the same structured ideal behavior as X2.
- Small-depth interpreter/native/Node results agree.
- Unsupported syntax fails with source ranges and no partial object.

## X4: performance report

Record raw samples for parsing, resolution, graph construction, optimization, selection, GCM,
scheduling, allocation, encoding, linking, execution, GC time, allocation throughput, collections,
copied/promoted bytes, peak live heap, and code size. Publish medians and kit/V8 ratios, including
losses. Correctness and stress gates run separately from timed measurements.
