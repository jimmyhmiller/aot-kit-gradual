# Backend Scaling Refactor

## Status and purpose

The closed-product backend refactor is implemented. MachineValues are completed at construction
with authoritative definition, provenance, representation, register-class, Phi/call-slot, and ABI
metadata. Scheduling consumes frozen owner-local adjacency, liveness and allocation use sparse
owner-local products, and encoding/publication consume dense allocator and function-range tables
without graph or instruction rediscovery. The AArch64 legacy allocation scans and the obsolete
fallback counters have been deleted.

The reusable JSL artifact is versioned by compiler ABI, runtime ABI, target, code-generation
options, and JSL semantic identity, and carries an integrity digest. Linking builds one
open-addressed semantic-identity index, computes the transitive relocation closure from the fresh
entry, and publishes only reachable text, callable symbols, relocations, stack-map owners, and
roots. A cache-only archive is deliberately not executable without a fresh source root.

The bounded gate is green at 81/81. Its 129-function, 74,975-block, 98,389-edge seed reports
selection 0.429 s, local scheduling 0.187 s, liveness 0.849 s, allocation 1.008 s, AArch64 encoding
0.086 s, and memory publication 0.776 s. The warm nine-block program reports 0.197 ms selection,
0.042 ms scheduling, 0.020 ms liveness, 0.027 ms allocation, 0.019 ms encoding, and 0.011 ms
publication. The artifact reload is about 0.101 s. The required frontier remains honestly red at
0/1 for `for-await-has-no-bridge-kind.js`.

Allocation intervals now materialize live-in at block entry and live-out at the exclusive block
exit (`first + count`), so values live through a block cannot collapse onto its final instruction's
destination. The independent reverse-CFG verifier also checks every physical destination against
the exact live-after register map. Assignment failures are terminal phase results: publication,
ABI-move construction, and verification cannot erase or publish a partial allocation.

The 2026-08-28 exhaustive run did not pass independently of this refactor. It reached nine named
failures with no allocation-verifier failure, then was stopped after one exhaustive case consumed
22 minutes of CPU without output. The bounded gate and focused backend suites are the authoritative
regression evidence for this change; the nine broad-suite failures remain separate work and must
not be described as an exhaustive pass.

This document is the implementation plan for replacing AOT Kit's cache-plus-fallback backend with
a closed, record-once pipeline. It is not a plan to optimize `ml-kind-for-vreg-scan`. That function
and every equivalent production rediscovery path must cease to exist.

The triggering witness is tiny JavaScript, but the 2026-08-28 bounded gate built roughly 143,000
ideal nodes, 129 functions, and 75,000 blocks while compiling 128 retained JSL seed records. It
reported 6.138 seconds in selection, 864.151 seconds in `scheduling`, 18.097 seconds in allocation,
and 82 milliseconds in AArch64 encoding. Sampling the long phase placed essentially all sampled
main-thread work in `backend_select.ml-kind-for-vreg-scan`. The phase name was misleading:
`be-schedule-seeded!` includes `ml-compute!`, so the reported scheduling time includes liveness and
machine-value classification.

The product requirement is stricter than “remove the current 864-second cliff”:

- an ordinary tiny program must compile, schedule, allocate, encode, publish, and start in less
  than one second on the reference development machine with a warm immutable runtime artifact;
- no individual backend phase may routinely take one second;
- scaling must be explained by explicit input/work counters, never by an unmeasured fallback;
- missing metadata must be a named compiler error at its producer boundary, not a reason to scan.

## Why the previous fix was not a fix

The earlier performance work correctly identified that `ml-kind-for-vreg` was scanning every
function times every ideal node. It added dense `vreg-node` and `vreg-node-owner` arrays and taught
`ms-vset!` to publish their common-case entries. That made ordinary mapped ideal values fast.

It deliberately left this rule in `src/backend_select.coil`:

```text
direct metadata is valid -> use it
otherwise                -> ml-kind-for-vreg-scan
```

The comment describes the scan as a correctness fallback for a recorded node that died, was
reassigned, or was never recorded. This preserved the old architecture:

1. `ms-new-vreg!` creates an incomplete value containing only an integer id and placeholder `-1`
   entries.
2. Dozens of selector sites later decide, independently, whether to associate the vreg with an
   ideal node.
3. Synthetic values, copies, raw call results, materializations, Phis, temporaries, or reassigned
   values can remain incomplete.
4. Liveness asks an instruction to reconstruct kind and class after selection has finished.
5. A missing answer silently invokes a whole-program search.

The dense arrays were therefore optional caches, not authoritative phase products. Performance
depended on every producer happening to populate a cache that the type system and verifier did not
require. The large Symbol graph exposed the exact state the fallback had been retained to hide.

## Reference model: what Simple gets right

The pinned reference is SeaOfNodes/Simple chapter 23 at revision
`66e426e7c4576a8433449bc649597cf63f22436e` in `reference/Simple-pinned`.

Simple preserves identity through the backend:

```text
machine Node identity -> LRG identity -> assigned register
```

`RegAlloc` maps each node to its live range and `regnum(Node)` reads the live range's assigned
register directly. Scheduling works over those same machine nodes and their def/use edges.
Encoding asks the completed allocator for the register of the node being encoded. A later phase
does not recover a machine value by searching the ideal graph.

Simple is not automatically the better implementation in every detail. Chapter 23's
`ListScheduler.best` linearly scans the ready set for every scheduled node; the pinned wide-block
benchmark demonstrates superlinear local scheduling. AOT Kit's ready heap is the better structure
and stays. Simple also omits a full conventional LIVE pass in its teaching allocator and bounds
split/retry rounds. AOT Kit keeps its owner-local worklist liveness and stronger verification. The
invariant to copy is **identity and phase ownership**, not Simple's exact containers or every
teaching-compiler algorithm.

AOT Kit separates ideal nodes, machine instructions, and virtual registers, so it needs an explicit
machine-value record instead of relying on Java object identity. That additional representation is
legitimate. Leaving it partial is not.

## Target pipeline

The target pipeline has closed inputs and outputs:

```text
reachable ideal program
  -> selection: MachineUnit { functions, blocks, instructions, values, def/use, constraints }
  -> placement: final instruction block ownership and memory dependencies
  -> local schedule: final order and block ranges
  -> liveness: live sets and edge-live sets over MachineValue ids
  -> allocation: one final location per allocatable MachineValue
  -> encoding: bytes, instruction offsets, function ranges, relocations
  -> publication: object/runtime image from recorded encoding products
```

Every arrow is a verifier boundary. A consumer reads only the previous phase's declared product.
No consumer queries the ideal graph to reconstruct machine metadata. No production lookup has a
whole-unit fallback. Mutation after a phase either preserves and updates its owned indexes or
invalidates the phase product explicitly and rebuilds it once.

## Authoritative machine-value model

Replace parallel, partially populated vreg arrays with one logical `MachineValue` table indexed by
dense `MachineValueId`. Coil may store it as struct-of-arrays if that is measurably better, but the
API and verifier treat each row as one indivisible record.

Every row contains:

- `id`: dense stable id;
- `owner`: machine function id;
- `definition`: discriminated logical definition: instruction result, Phi, call-result slot, fixed
  ABI ingress, or explicit no-definition constant category;
- `write-sites`: adjacency for the physical instructions/edge copies that establish the logical
  value; a Phi or constrained copy relation may have multiple physical write sites without having
  multiple logical SSA definitions;
- `origin-kind`: ideal-node, Phi, call-result slot, materialization, edge copy, ABI copy,
  scheduler/allocator temporary, or constant;
- `origin-node`: ideal node id only when `origin-kind` is ideal-derived;
- `representation`: scalar, raw managed, boxed, or non-moving;
- `register-class`: GPR or FPR;
- `abi-constraint`: unconstrained or a declared fixed ingress/result location;
- `gc-policy`: derived, checked classification used by stack-map construction;
- `state`: reserved, defined, scheduled, live, allocated, or retired as appropriate.

There is no “unknown representation defaults to scalar.” Unknown is a construction-time state that
must be resolved before an instruction can be published and before selection verification can pass.

`MOpcodeDesc` must grow table-driven operand/result constraints: accepted representation sets,
register classes, fixed/tied operand relations, ABI role, and whether an operand is a value, block,
immediate, memory token, or call slot. `MInst` construction validates against that descriptor.
This replaces scattered opcode switches in late kind/class inference with one declarative contract.

### Construction API

Delete general production use of `ms-new-vreg!`. Replace it with constructors that require the
information the producer owns:

- `mv-new-ideal!(owner, node, representation, class)`;
- `mv-new-phi!(owner, phi-node, representation, class, block)`;
- `mv-new-call-result!(owner, call, slot, representation, class, abi)`;
- `mv-new-derived!(owner, operation, source-value, representation, class)`;
- `mv-new-copy!(owner, source-value, copy-kind)`; kind and class are inherited and asserted;
- `mv-new-fixed!(owner, ingress-kind, representation, class, abi)`;
- `mv-new-temporary!(owner, reason, representation, class)`.

If an instruction defines a value, the emission API accepts a completed `MachineValueId` and
atomically establishes the definition. It refuses a second definition unless the representation is
an explicitly modeled Phi or union/live-range relation. It is impossible to append an instruction
whose destination row does not exist and already name kind, class, owner, and origin.

### Mutation and repacking

Scheduling may reorder instructions, but cannot change value identity, owner, origin, kind, or
class. Repacking rebuilds `value -> defining instruction` in one instruction walk and verifies it
against the existing value table. It must not repair missing metadata.

Copy insertion and spill repair create new, complete value rows through the same constructors.
The raw reserving constructor is private to the builder. Finalization compacts abandoned ids away or
proves that no operand, edge, or table references them; “retired” cannot become a sanctioned hole.
Dead but published values retain complete inspectable metadata until the unit is reset.
No code tests whether an origin node is still alive to decide whether value metadata is valid.

## Phase contracts

### Selection

Selection owns construction of functions, blocks, instructions, values, and initial def/use edges.
It may inspect the ideal graph. Later phases may not.

Required changes:

- migrate every `ms-new-vreg!` call to a typed constructor;
- make `ms-vset!` associate an ideal node with an already complete machine value, not complete the
  value as a side effect;
- record call-result slot representation from the declared ABI at result creation;
- record conversion result representation at the conversion emitter;
- record Phi representation once from the checked Phi type and require all incoming copies to
  agree;
- give edge-copy and cycle-breaking temporaries explicit inherited metadata;
- replace node-derived late queries in `ml-kind-for-inst` and `ml-class-for-inst` with descriptor
  checks against instruction operands and destination values;
- verify complete value coverage, one legal definition, owner consistency, operand existence, and
  opcode constraint compatibility before scheduling.

### Placement and local scheduling

The ready heap remains. Dependency construction must be adjacency-driven:

- data edges come from value def/use adjacency;
- memory edges come from the already published memory dependency and anti-dependency lists;
- structural edges are built by category lists (labels, ingress, copies, terminators), not by
  blindly comparing every instruction pair;
- source-order effect constraints are explicit edges with a named reason;
- each edge is inserted once and counted once;
- scheduling consumes indegrees and producer adjacency in `O(instructions + edges)`, plus
  `O(instructions log ready)` heap work.

The active `ms-schedule-block-once!` path already uses transitive-reduced structural construction,
explicit operand/memory lists, producer adjacency, and a ready heap. The old pair predicate and
stale comments must not be mistaken for executed production work. Preserve the good active shape,
deduplicate edges/reasons, and delete dead pair machinery after callers are proven absent.

The serious placement problems are earlier: final memory anti-dependency construction scans all
machine instructions for each write; late-memory repair can repeatedly move instruction ranges and
rebuild definition indexes up to an instruction-squared cap; those indexes themselves can allocate
function-count times ideal-node-count tables. Replace repair-by-reorder with one explicit memory
dependency DAG and one topological placement. Scheduling must never relax an effect-order edge to
escape a cycle; a cycle is either an invalid dependency model or an earlier placement error.

Output verification checks schedule legality from independently built def/use and memory facts in
linear work. Verification must not repeat production's pairwise construction.

### Liveness

Liveness consumes final machine CFG, final instruction order, def/use adjacency, and the complete
machine-value table.

- Delete `ml-kind-for-vreg-scan`.
- Delete `ml-kind-for-vreg-direct` as a conditional cache lookup; replace it with an unconditional
  bounds/state-checked `mv-representation(value)`.
- Stop initializing every value as scalar/GPR and repairing it from instructions.
- Remove the whole-instruction `liveness_kinds_initial` reconstruction pass.
- Propagate register-class constraints only for operations whose result class genuinely depends on
  an input; check the result against the already declared value record.
- Keep owner-local packed bitsets and predecessor worklists.
- Consume owner/local numbering recorded on MachineValue rather than rediscovering it from
  definition instructions.
- Replace whole-instruction fixed-point register-class propagation with creation-time constraints
  and adjacency propagation only where a copy relation requires it.
- Materialize safepoint live sets once; `ml-live-before?`/`ml-live-after?` production queries must
  not rescan block tails.
- Compare independently constructed expected edge rows once per edge; do not scan every edge copy
  again for every packed word.
- Make verifier complexity proportional to represented blocks, edges, instructions, values, and
  live bits. Independent verification may rebuild summaries once, never per-query scans.

### Allocation

Allocation consumes liveness and immutable value constraints.

- initialize allocation rows directly from the machine-value table;
- replace the current per-function dense packed interference matrix, whose storage/zeroing is
  `sum(V_function^2 / word_bits)`, with deduplicated sparse adjacency and a measured density-based
  dense representation only where it wins;
- build interference from sparse live sets/edges, without cross-function or global-vreg rows;
- keep GPR and FPR domains structurally separate;
- preserve managed/boxed/non-moving representation through spills and copies;
- attach fixed ABI constraints to values before coloring;
- publish dense `value -> location`, `value -> spill`, and `value -> owner` tables once;
- construct ABI parallel moves from published locations and explicit bundles;
- publish per-function ingress and call/result-pointer summaries so stack arguments and result
  slots do not rescan later instructions or the complete unit per function;
- make independent verification edge- and constraint-driven rather than rebuilding dense
  quadratic matrices or scanning instruction tails per value.

### Encoding and publication

The direction in `docs/LINEAR-BACKEND-PUBLICATION.md` remains correct, but its allowance for legacy
fallbacks must be narrowed to explicitly marked unit-test fixture builders. Production paths have
none.

- encoding reads final value locations in O(1);
- block and instruction offsets are written once during sizing;
- function ranges and relocations are recorded during layout/emission;
- stack maps consume liveness and value representation directly;
- Mach-O/publication serializes recorded products without machine or ideal graph rediscovery;
- global `machine-unit` accessor removal from hot loops remains a secondary constant-factor task,
  not a substitute for fixing complexity.

Both encoders must also receive dense label, entry-owner, call-argument ordinal, and function-range
products. Current prefix scans make x64 call stack indexing as bad as cubic in argument count, and
both targets still contain function-range cross-products. Function-text extraction consumes final
per-function ranges and recorded relocations rather than rescanning all instructions for each
owner. Mach-O root publication receives roots in site order or uses `O(R log R)` sorting, not
quadratic insertion sort.

## Graph-size and runtime-library work

Making the backend linear is necessary but does not make 143,000 ideal nodes and 75,000 blocks a
reasonable cost for tiny source. The shared JSL/runtime program must stop being rebuilt or retained
without demand.

The audit must partition every function and node in the large witness into:

- immutable JSL seed body;
- source/harness body;
- source-reachable specialization;
- intrinsic initialization;
- unreachable or retained-only body;
- duplicated lowering of an otherwise identical declaration;
- exceptional-control expansion;
- aggregate/record lowering expansion.

Required architecture:

1. Compile the pinned JSL seed once per compiler/runtime ABI and content hash.
2. Store relocatable function text and typed call/relocation interfaces, not live compiler graph
   state, as the reusable artifact.
3. Build each source unit from its own reachable graph plus referenced immutable artifact symbols.
4. Lower a JSL declaration once per required specialization key; duplicate keys are a verifier
   failure.
5. Dead-strip unreachable functions before machine CFG construction.
6. Report per-origin counts for ideal nodes, live nodes, functions, blocks, instructions, and
   machine values.
7. Set bounded ceilings for tiny witnesses and require an explicit reviewed update when semantics
   legitimately raises one.

Artifact identity includes compiler revision, JSL source hash, artifact schema version,
semantic/type/layout/runtime ABI hashes, target triple, and code-generation options. A mismatch is
an explicit cold rebuild, never accidental reuse or an unexplained warm rebuild.

Fresh seed construction remains a separate benchmark and release gate. It is not charged to every
ordinary tiny-program compile and does not weaken the sub-second product requirement.

## Forbidden production patterns

The refactor is incomplete while any of these remain reachable in production:

- a value query falling back from a dense table to a graph or instruction scan;
- an unknown value kind or register class defaulting to scalar/GPR;
- `functions * ideal_nodes` work after selection;
- `functions * instructions` metadata reconstruction;
- `blocks * instructions` packing or ownership reconstruction;
- per-value instruction scans for definitions, uses, locations, roots, or owners;
- per-branch scans for labels or offsets;
- per-relocation scans for source/target facts;
- verifier algorithms asymptotically worse than the producer without a bounded test-only mode;
- phase mutation that silently leaves a stale cache available;
- a phase timer that includes unnamed subordinate phases;
- a warm tiny compilation rebuilding the immutable JSL seed.

Static ownership tests should search for banned calls from backend phases. Runtime counters remain
zero in every gate, so newly introduced indirect fallbacks are also caught.

## Current code disposition inventory

This is the initial source inventory. Stage 0 must regenerate it mechanically and extend it before
implementation; a row is not complete merely because its known function was repaired.

| Current code | Defect | Required disposition |
| --- | --- | --- |
| `backend_select.ms-new-vreg!` and its many call sites | creates partial ids with `-1` provenance | replace every call with a typed MachineValue constructor; delete the generic constructor |
| `backend_select.ms-vset!` | provenance is an optional side effect of ideal-node mapping | make mapping validate an already complete ideal-origin value |
| `backend_select.ml-kind-for-vreg-direct` | treats authoritative metadata as a conditional cache | replace with unconditional bounds/state-checked MachineValue access |
| `backend_select.ml-kind-for-vreg-scan` | functions × ideal-nodes fallback per miss | delete |
| `backend_select.ml-kind-for-inst` | reconstructs value representation late from op, node, or source fallback | reduce to an opcode/value-contract verifier; consumers read MachineValue |
| `backend_select.ml-class-for-inst` | reconstructs or propagates register class after emission | move decisions to value creation; retain only constraint verification |
| `backend_select.ms-def-inst` | scans every instruction when the dense definition entry is absent | missing definition becomes named verification failure; delete both scan arms |
| `backend_select.ms-cache-def-insts!` | allocates function-count × ideal-node-count storage and is rebuilt after repacking | use value-dense definitions plus one node-dense owner-tagged/sparse origin index, finalized once |
| `backend_select.ms-build-verifier-indices!` | independently allocates multiple function-count × ideal-node-count tables | rebuild sparse/node-dense expected facts once without Cartesian storage |
| `backend_select.ms-build-memory-anti-deps!` | scans all machine instructions for every write and linearly checks duplicates | index reads/writes by alias; emit deduplicated dependency edges from candidate adjacency |
| `backend_select.ms-repair-late-memory-deps!` | instruction-squared move/retry loop repeatedly shifts ranges and rebuilds definition maps | replace with an explicit memory DAG and one topological placement; delete repair loop |
| `backend_liveness.ml-init-tables!` | initializes unknown values as valid scalar/GPR | initialize liveness only; value metadata already exists and unknown is invalid |
| `backend_liveness.ml-compute-use-def!` kind/class passes | re-derive machine-value metadata from every instruction | delete reconstruction; validate instruction contracts in selection verifier |
| liveness owner/local setup | rediscovers ownership from defining instructions | read finalized MachineValue owner/local ids directly |
| liveness register-class propagation | full instruction fixed-point scan over copy-chain depth | creation-time class plus copy adjacency propagation/check |
| `ml-live-before?` / `ml-live-after?` | rescan a block tail for every query | materialize safepoint/program-point live summaries consumed in O(1)/row time |
| liveness edge verifier | repeats all edge-copy scans inside each packed-word comparison | build one expected row per edge and compare words once |
| `backend_schedule.be-schedule-seeded!` | combines schedule and liveness under one public phase | split orchestration and exclusive phase timings |
| scheduler effect-order retry in `ms-schedule-block!` | relaxes provisional source-order effect edges after a cycle | model effect/memory tokens explicitly; a cycle is a named error, never solved by weakening dependencies |
| scheduler edge insertion | the same producer/consumer can be inserted for multiple reasons without deduplication | intern one edge with a reason bitset and one indegree contribution |
| `backend_aarch64.be-reg-of-legacy`, `be-spill-of-legacy`, `be-owner-of-legacy` | instruction-scan fallback when allocation tables are absent | move hand-built fixtures to an explicit fixture adapter; delete from production encoder |
| `backend_aarch64.be-register-class` | invalid/missing ownership can silently become GPR | invalid production value is an error; fixture default belongs only in adapter |
| AArch64 entry owner, call ordinal, function-range helpers | per-query function/prefix scans and function cross-products | consume dense entry-owner/argument-ordinal/range tables |
| `backend_x64.x64-label-off` | cached lookup falls back to an instruction scan | require completed label-offset table before encoding |
| `backend_x64.x64-entry-owner` | cached lookup falls back to a function scan | require dense block/function ownership table |
| x64 call argument/stack ordinal helpers | nested prefix scans, up to cubic call-argument work | publish ABI ordinals once with each call bundle |
| x64 function-range construction | scans functions within function processing | consume final dense function ranges |
| `backend_function_text.mft-owner-for-ideal-fun` | searches all functions for a per-relocation query | publish ideal-function -> machine-owner mapping once |
| `backend_function_text.mft-extract-mode!` | performs multiple full instruction scans per owner | consume recorded per-function instruction ranges, stack maps, and relocations |
| `backend_allocate.be-force-spill-vreg!` | test helper mutates every defining instruction by scanning the unit | keep test-only but route through an explicit corruption/fixture API, never production |
| `backend_allocate.mra-init!` interference rows | allocates/zeros `sum(V_function^2 / 64)` regardless of real overlap | sparse deduplicated adjacency with measured dense conversion only for dense functions |
| allocator stack-ingress and result-pointer setup | scans later/all instructions per STACKARG or per function | publish per-function ingress and call summaries once |
| `backend_allocate.mra-verify!` | independently rebuilds costly interference structures | retain independence but verify from sparse expected edges with separate timing |
| `backend_macho` root ordering | insertion-sorts roots quadratically | emit in site order or sort `O(R log R)` |
| `backend_cfg.mu-build!` | builds every live `Fun` before source reachability is an explicit backend input | replace whole-graph discovery with a reachable function set produced by frontend/closure analysis |
| production reads through global `machine-unit` in hot loops | hides dependencies and adds accessor overhead | pass explicit phase contexts after structural complexity is fixed |

Also audit every use of `n-count`, `mu-function-count`, `be-inst-count`, and nested loops in
`backend_cfg`, `backend_select`, `backend_liveness`, `backend_allocate`, both encoders,
`backend_function_text`, and `backend_macho`. Each loop receives a declared complexity annotation:
the collection traversed, maximum visits per element, and the index/adjacency that justifies it.
An annotation is rejected if it says “fallback,” “rare,” or “legacy” on a production path.

## Observability contract

Every compilation reports one structured phase record when profiling is enabled. Parent timings
must be exclusive or explicitly marked inclusive. At minimum record:

- ideal/live nodes by origin;
- functions and blocks by origin;
- machine instructions and values by origin;
- maximum and percentile block width;
- def/use edges and memory edges;
- structural dependency candidates tested and edges emitted;
- ready-heap pushes, pops, comparisons, and maximum ready width;
- liveness words, predecessor visits, and changed words;
- interference edges, colors, spills, and verifier edges;
- value metadata direct reads;
- missing-metadata events, fallback scans, and scanned nodes: all permanently zero;
- seed cache state and rebuilt/reused function counts;
- exclusive wall/CPU time and peak memory for each phase.

The bounded gate stores a machine-readable baseline and compares invariants and work ratios. Wall
time is an additional product gate, not the only diagnostic.

## Migration plan

### Stage 0: freeze evidence and expose honest timings

- Preserve the exact tiny Symbol witness and current profile as a performance regression fixture.
- Split `scheduling` into placement/local-schedule, schedule verification, liveness initialization,
  kind/class handling, liveness solve, edge-live, and liveness verification.
- Add counters for direct/fallback kind queries and scanned ideal nodes before changing behavior.
- Add graph/machine origin accounting and seed rebuilt/reused state.
- Confirm the sampled cliff with counters, not another multi-minute profile guess.

Exit: the current failure is reproducible and every reported second belongs to a named phase.

### Stage 1: introduce complete MachineValue records

- Add the logical table, state machine, typed constructors, accessors, and corruption hooks.
- Initially mirror existing arrays, but assert equality at every phase boundary.
- Inventory and migrate every `ms-new-vreg!` producer category.
- Add focused tests for ideal values, Phis, calls with multiple results, materializations, fixed ABI
  ingress, edge copies, copy-cycle temporaries, FP conversions, managed values, and boxed values.

Exit: every allocated id has complete owner/origin/kind/class/definition metadata; zero placeholders
cross selection verification.

### Stage 2: make the value table authoritative

- Switch scheduling, liveness, allocation, stack maps, and encoders to unconditional table reads.
- Turn any missing/stale record into a named verifier failure with value, producer, owner, and
  instruction context.
- Delete `ml-kind-for-vreg-scan`, the conditional direct helper, late instruction-based kind
  reconstruction, and scalar/GPR placeholder initialization.
- Delete the mirrored legacy arrays after parity tests prove no consumer remains.

Exit: static ownership tests find no production rediscovery path and runtime fallback counters do
not exist because fallback code is gone.

### Stage 3: freeze indexes and the dependency graph

- Replace function × node definition/verifier tables with value-dense and node-dense owner-tagged
  or sparse indexes, built once at MachineProgram finalization.
- Replace global memory scans and reorder/repack repair with explicit deduplicated data, memory,
  effect, and structural dependency edges.
- Keep the ready heap and active adjacency-driven scheduler.
- Remove relaxed retry scheduling: a dependency cycle is a named construction error.
- Independently verify exact edge reasons and topological legality in linear/sparse work.
- Add wide-block scaling fixtures matched against the pinned Simple benchmark.

Exit: layout is frozen once; measured scheduler work follows instructions plus unique emitted edges;
no repair loop rebuilds indexes or weakens dependencies.

### Stage 4: bound liveness

- Consume finalized owner/local numbering and MachineValue metadata.
- Replace class fixed-point instruction sweeps with explicit copy adjacency.
- Materialize safepoint live sets and make edge verification row-linear.
- Measure packed-row density and introduce a sparse/dense hybrid if
  `sum(blocks_function * ceil(values_function / 64))` is not bounded on real witnesses.
- Add adversarial many-function, many-block, Phi-heavy, copy-chain, call-heavy, and managed-root
  fixtures with exact work-counter bounds.

Exit: liveness work is explained by CFG edges, value uses, copy edges, and represented live words;
no production or verifier query rescans instruction ranges.

### Stage 5: replace dense allocation cross-products

- Replace unconditional packed interference rows with deduplicated sparse adjacency and measured
  dense promotion only for genuinely dense owner-local graphs.
- Publish per-function stack-ingress, call, and result-pointer summaries once.
- Make allocator verification independently edge-driven and separately timed.
- Preserve deterministic seeded allocation and GC stress coverage.

Exit: allocation work tracks actual interference and ABI constraints, not squared function vreg
counts or function × instruction scans.

### Stage 6: close encoding and publication products

- Publish dense label offsets, entry owners, call ABI ordinals, and function ranges before encoding.
- Produce one frozen `EncodedProgram`: bytes, offsets/lengths, ranges, relocations, safepoints, roots.
- Make function-text extraction and Mach-O publication consume only that product.
- Move legacy hand-built fixtures to an explicit adapter and delete all production encoder
  fallbacks/defaults.

Exit: encoding/publication work is linear or log-linear in bytes, instructions, functions,
relocations, and roots, with no per-query rediscovery.

### Stage 7: stop recompiling the runtime world

- Complete the relocatable immutable JSL function artifact and typed symbol/call interface.
- Separate cold seed-build benchmarks from warm source compilation.
- Enforce specialization-key uniqueness and pre-machine dead stripping.
- Add graph-origin ceilings for the tiny Symbol and ordinary arithmetic/property witnesses.

Exit: a warm tiny source compile does not lower, analyze, select, schedule, or allocate unrelated JSL
functions.

### Stage 8: remove compatibility architecture

- Delete deprecated constructors, arrays, fallback fixture modes, stale counters, and old timing
  names.
- Update `DESIGN.md`, `LINEAR-BACKEND-PUBLICATION.md`, `SIMPLE-PERFORMANCE-PARITY.md`, and
  `HANDOFF.md` to describe only the architecture that exists.
- Run exhaustive Test262 comparison and broad native differential/GC stress before declaring the
  migration complete.

## Verification matrix

Every stage runs the ordinary bounded gate and honest frontier. Additionally:

| Concern | Focused proof |
| --- | --- |
| metadata completeness | corruption of each MachineValue field produces a distinct named failure |
| no defaulting | unknown kind/class is rejected before liveness and cannot reach encoding |
| copies | copy, ABI copy, Phi copy, and cycle temporary preserve kind/class exactly |
| multi-result ABI | every raw result and materialization has declared slot provenance and class |
| GC safety | managed/boxed roots survive calls, allocation, spills, copies, and collection stress |
| phase ownership | scheduling reorder changes only order/ranges; allocation changes only locations |
| no scans | static ownership test plus zero forbidden-work counters |
| scheduler scaling | sparse wide blocks and dense real-edge blocks report expected distinct work |
| liveness scaling | many blocks/functions scale with owner-local words and CFG edges |
| allocation scaling | interference work tracks actual live overlap, not all global vreg pairs |
| runtime reuse | warm compile reports seed reused and zero unrelated JSL functions compiled |
| semantic parity | exact native differential and Test262 outcome comparison |

No performance fix may weaken a semantic assertion, remove a frontier repro, default missing data,
or skip independent verification.

## Performance acceptance criteria

Measure on the same reference Apple Silicon host, with toolchain revision, compiler revision,
runtime seed hash, cold/warm state, and counters recorded.

### Warm tiny-program product gate

For arithmetic, property access, one builtin call, and the focused Symbol descriptor witnesses:

- frontend index/build/analyze: each below 200 ms;
- selection and placement/GCM: below 200 ms combined;
- local scheduling plus verification: below 100 ms;
- liveness plus verification: below 100 ms;
- allocation plus verification: below 100 ms;
- encoding plus publication: below 100 ms;
- total compile through publication: below 750 ms;
- compile, spawn, and first result: below 1,000 ms;
- zero missing metadata, fallback scans, or immutable seed rebuilds.

These are initial hard ceilings, not targets to consume. Report medians and p95 across repeated
processes; the gate may use a small noise allowance only after work-counter invariants pass.

### Scaling gates

- phase work must remain proportional to its declared data structure;
- a 2x sparse input increase must not produce an unexplained 4x work-counter increase;
- maximum block width is always reported so wide-block behavior cannot hide in total nodes;
- cold seed build has its own explicit budget and scaling record;
- no Test262 variant may exceed one second of backend work without a recorded proportional graph,
  machine, or interference size and a reviewed regression entry.

## Definition of done

This refactor is complete only when:

1. every machine value is complete by construction;
2. the whole-graph vreg-kind fallback and equivalent production rediscovery paths are deleted;
3. phase verifiers reject missing, stale, cross-owner, or contradictory metadata;
4. scheduling, liveness, allocation, encoding, and publication consume closed phase products;
5. scheduler and allocator work counters demonstrate the intended complexity on adversarial shapes;
6. warm tiny programs meet the sub-second end-to-end gate;
7. tiny programs do not rebuild or retain unrelated JSL/runtime functions;
8. bounded, frontier, exhaustive, differential, seeded, and GC-stress evidence is current;
9. documentation no longer describes optional caches or sanctioned production fallbacks;
10. the old compatibility code is removed, not left dormant for the next hole to reactivate.
