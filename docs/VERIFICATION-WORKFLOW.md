# Verification and implementation workflow

This workflow is mandatory for every roadmap slice. It is designed around failures this repository
has already experienced: clean verifiers around wrong programs, fixtures that could not exercise the
claimed path, provisional types used for irreversible rewrites, and schedule-order-dependent results.

## Programmatic controller

`workflow/roadmap.json` is the machine-readable dependency graph and `workflow/state.json` is the
tracked completion record. Use:

```sh
node tools/workflow.mjs status
node tools/workflow.mjs next
node tools/workflow.mjs check G0
node tools/workflow.mjs complete G0
```

`check` runs the milestone-specific gate plus quick, full, and extended repository gates without
changing state. `complete` runs the same evidence and advances state atomically only if every command
passes. It records the commit and commands used. Never edit a milestone to `done` directly in prose;
advance it through the controller, then mirror the resulting state into the roadmap and current-slice
document in the same commit.

## Roles of the evidence

No single check proves compiler correctness. Each layer answers a different question:

| Evidence | Question answered |
|---|---|
| Structural verifier | Is this phase's representation internally well formed? |
| Exact dump/golden | Did the intended structural transformation occur? |
| Interpreter differential | Did ideal semantics change? |
| Native differential | Did machine lowering preserve ideal semantics? |
| Adversarial fixture | Can the implementation reject or survive a nearby hard case? |
| Falsification | Would the gate fail if the claimed behavior were broken? |
| Stress/seed matrix | Is correctness accidentally dependent on resource abundance or order? |
| Object/disassembly inspection | Did encoding/linkage actually emit the claimed mechanism? |

A milestone gate should use the smallest combination that proves its contract, but mechanism claims
always require both structural evidence and an observable execution witness.

## One-slice procedure

### 1. Establish the baseline

Before editing:

```sh
git status --short
tools/gate.sh --quick
```

Record the baseline commit and any pre-existing changes. Do not absorb unrelated user changes into a
slice. Build output must remain ignored.

### 2. Restate one contract

Copy the chosen slice from `IMPLEMENTATION-PLAN.md` into the working notes and state:

- the exact supported input after the slice;
- the exact unsupported input that remains;
- the phase invariant being added;
- the observable result that must remain unchanged;
- the named failure produced outside the supported envelope.

If this cannot be stated in a paragraph, the slice is too large.

### 3. Write the failing gate first

Add the focused fixture and assertion before implementation. Confirm failure is for the intended
missing behavior, not a parser error, malformed graph, unrelated verifier failure, or test timeout.

For capability slices, the initial expected state may be a named “unsupported” result. The final
test changes that one fixture to expected success while later ladder entries remain explicitly
unsupported.

### 4. Add phase-local verification

Every new representation or phase needs a verifier before it becomes input to another phase. The
verifier must:

- return a stable named code;
- identify the first offending function/block/edge/instruction/value;
- avoid mutating the structure it checks;
- have corruption tests that prove it can fail;
- run immediately after the phase in debug/test pipelines.

Do not rely on a later encoder crash to validate an earlier CFG.

### 5. Implement the minimum general mechanism

Implement against structural identities—blocks, edges, predecessor slots, use sets, register masks—
not fixture names or discovered source patterns. When a general algorithm is not yet available,
reject the unsupported case by name rather than extending a chain of shape conditions.

### 6. Run the focused matrix

At minimum run:

- the new focused positive test;
- its negative/corruption tests;
- the nearest existing suite;
- interpreter before/after optimization when ideal IR changes;
- native/interpreter comparison when backend behavior changes.

For scheduling-sensitive work, vary worklist and scheduler seeds. For allocation-sensitive work, run
normal and restricted register budgets. For reference-sensitive work, run normal collection and
collect-every-allocation.

### 7. Falsify the gate

Prefer a committed corruption or fault-injection test that introduces the smallest defect matching
the claim in memory. Examples:

- exchange two Phi inputs;
- omit one predecessor propagation in liveness;
- remove a call clobber;
- reverse a load/store dependency;
- reuse a pre-safepoint root;
- encode a call target as zero;
- skip one callee-saved restore.

Run the focused gate and require the verifier or differential to reject the corrupted structure for
the expected reason. Keep that test permanently so CI repeats the falsification. If in-memory
corruption or fault injection is impractical, temporarily mutate the implementation, restore it,
and rerun; record that exceptional manual falsification in `JOURNAL.md` with the exact test and
failure. Never commit the temporary implementation defect.

### 8. Review through adversarial lenses

Review the diff with these questions:

#### Graph law

- Was any irreversible rewrite based on a provisional type?
- Did Region/Phi arity change atomically?
- Did control mutation invalidate dominators or loop metadata?

#### CFG law

- Are predecessor slots preserved?
- Are all edges reciprocal and function-local?
- Does unreachable or never-exiting control have a defined treatment?

#### Machine law

- Are fixed registers and clobbers explicit?
- Are Phi uses assigned to edges?
- Are spills frame-local and aligned?
- Can a different layout or seed expose hidden textual-order assumptions?

#### Memory and GC law

- Can a load/store/call move across an overlapping effect?
- Does every safepoint describe exact live reference locations and kinds?
- Are post-safepoint uses relocation projections?
- Is the test executing compiled collection or only the collector model?

#### Tooling law

- Does failure preserve enough dumps to reproduce it?
- Does unsupported input fail before partial object publication?
- Did generated output remain out of Git?

### 9. Run repository gates

Before a slice commit:

```sh
tools/gate.sh --quick
```

Before marking a roadmap milestone done:

```sh
tools/gate.sh
```

Both commands are verification-only and must leave tracked files unchanged. Publishing a new timed
benchmark report is an explicit operation:

```sh
tools/benchmark-gate.sh --update
```

Review and commit the resulting `docs/BENCHMARKS.md` and `bench-profile.json` changes only as part of
an intentional performance-report slice.

The full gate includes diagrams because broken diagnostic output is a broken compiler tool. Extended
full-depth binary-trees and expensive seed/stress matrices live in `tools/extended-gate.sh`; G0
creates that command. The normal gate must exercise a bounded witness of the same mechanism. A
milestone whose required extended witness has not yet been added and run is not done.

### 10. Land atomically

A slice commit contains:

- implementation;
- focused positive and adversarial tests;
- verifier changes;
- necessary tool changes;
- journal entry;
- roadmap status change only when the whole milestone exit gate is green.

Do not commit generated `.coil/build`, object files, linked binaries, temporary dumps, or benchmark
scratch output.

## Required test dimensions by milestone

| Milestones | Required dimensions |
|---|---|
| G0-G3 | raw/optimized, worklist seeds, exact CFG/Phi structure, native differential |
| G4-G5 | leaf/non-leaf, argument counts, nested calls, recursion, disassembly |
| G6-G7 | CFG traversal seeds, normal/low registers, calls, loops, Phi edges, spills |
| G8-G9 | placement/scheduler seeds, memory aliases, loops, calls, before/after phase |
| G10 | symbol/layout permutations, object inspection, external link/run |
| X1 | normal/stress collection, root in every location kind, promotion/barrier cases |
| X2-X3 | depth matrix, optimized/raw/native/interpreter/Node, pressure and GC stress |
| X4 | correctness outside timing, raw samples, environment metadata, losses |

## Parity ladder policy

The parity ladder is monotonic. Once a fixture becomes supported:

- it remains in the normal gate;
- its expected status never returns to “unsupported”;
- later refactors must preserve its native/interpreter result;
- the corpus floor or explicit fixture count prevents silent removal.

Unsupported ladder entries are not ignored. They assert the exact current capability code. This
means an accidental partial implementation cannot silently change failure mode.

## Seed and pressure policy

Use a small deterministic matrix in the normal gate and a broader matrix in an extended gate.
Recommended normal dimensions:

- ideal worklist seeds: at least 1, 5, and one historically adversarial seed;
- scheduler tie-break seeds: at least three once G9 exists;
- register budgets: normal target budget and at least two restricted budgets;
- collector mode: normal and collect-every-allocation for bounded allocation fixtures.

The exact seeds and budgets belong in one shared test configuration created in G0 so individual
suites cannot silently weaken them.

## Native differential protocol

For each executable parity program:

1. Build raw ideal graph and verify it.
2. Interpret raw graph and save structured outcome.
3. Optimize, verify, and interpret again.
4. Require raw and optimized outcomes to match.
5. Lower to machine CFG and verify after every phase.
6. Encode and inspect the object when mechanism claims require it.
7. Execute native code in a child process or external harness.
8. Compare scalar results and escaped heaps structurally, not by pointer identity.
9. On mismatch, retain deterministic ideal/machine dumps in the test output or a temporary path,
   never as committed build artifacts.

Timeout or crash is a distinct outcome, not “does not match.” Infinite fixtures must be declared and
validated structurally rather than treated as accidental timeouts.

## GC verification protocol

Claims advance through four explicit levels:

1. **IR contract:** safepoints and relocation projections satisfy verifier rules.
2. **Metadata:** stack maps/layouts contain the exact locations and reference kinds expected.
3. **Runtime unit:** collector moves a synthetic heap and rewrites supplied roots.
4. **Native integration:** compiled code enters the collector and resumes correctly.

X1 is complete only at level 4. Tests should deliberately place the sole live root in a register,
spill slot, incoming argument, outgoing argument when supported, and another object's field.

## Benchmark verification protocol

- Correctness gates run before timed samples.
- Stress mode is reported separately and is not compared to V8 as normal execution.
- Warmup, iteration count, sample count, machine, OS, Node version, compiler commit, and depth are
  recorded.
- Raw samples are retained.
- Compilation, linking, startup, execution, and GC are separate axes.
- Ratios use a stated direction consistently.
- Regressions and losses remain visible.

## Stop conditions

Stop a slice and revise the design when:

- support requires another fixture-name or graph-shape branch;
- a verifier cannot state the new invariant;
- the gate cannot be falsified;
- correctness depends on one seed, layout, or register budget;
- native GC needs a root location the allocator cannot describe;
- a later phase is compensating for malformed earlier output;
- the implementation changes an architectural decision without appending a decision record.
