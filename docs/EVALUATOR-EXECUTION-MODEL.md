> **HISTORICAL, 2026-08-18.** The evaluator described here was deleted. This file is kept as
> the design record of how graph execution worked — the memory-version heap, the per-control
> effect chain, the failure codes — because Phase A rebuilds execution against the CPU and the
> problems it had to solve do not go away. Nothing here describes current code.

# Ideal evaluator execution-model redesign

## Status and purpose

This document is an implementation proposal for replacing the ideal evaluator's overlapping heap,
call-cache, and control-cache mechanisms with a single explicit execution model. It is motivated by
the remaining B15 DeltaBlue failure, but the design is benchmark-independent and must not contain
DeltaBlue-, Richards-, source-file-, or function-name dispatch.

The proposal is intentionally a correctness refactor, not an optimization project. The evaluator is
the semantic oracle used to compare raw and optimized ideal graphs. It should be simple enough that a
wrong graph produces a precise failure, rather than requiring the evaluator itself to emulate several
different memory models at once.

B15 must remain open until the migration is complete and the original benchmark checks pass. Do not
latch B15 green merely because a reduced witness passes.

## Executive summary

Adopt three explicit identities:

1. one imperative JavaScript heap for observable object and array state;
2. one evaluator frame for each dynamic function invocation;
3. one control-arrival identity for each dynamic visit to a control node.

Graph memory values remain meaningful, but their evaluator role becomes validation and ordering.
They prove that an operation has a legal memory dependency and alias set; they are not a second
historical store of JavaScript object and array contents.

Every effectful or snapshot-sensitive node executes at most once for a particular
`(frame, control arrival, node)` tuple. Loops create new arrivals. Calls create new frames. Recursion
therefore needs no graph-wide cache snapshot or restoration.

Add a structured event trace and a first-divergence comparator. Full benchmarks become acceptance
tests; minimized semantic compositions become the primary diagnostic tests.

## Why the current model is expensive to debug

The current evaluator has several mechanisms that can answer what a program value is:

- persistent heap versions and memory merges;
- a global `current-mem` used at call boundaries;
- synthetic memory `Arg` values;
- imperative dynamic-property storage in `jsobject`;
- fixed-field latest-write recovery;
- array latest-version recovery;
- a graph-sized `hasenv`/`env` cache;
- per-control effect lists;
- call-result caching;
- graph-wide recursive frame snapshots.

Each mechanism was locally reasonable, but their composition has no single execution identity. A
boolean cache entry cannot distinguish these cases:

- the same node revisited on the next loop iteration;
- the same function node invoked recursively;
- the same call node demanded twice during one continuation;
- a caller node observed while a callee is active;
- a stale result from an earlier invocation;
- a value intentionally sampled before a destructive mutation.

This causes failures to surface far from their origin. The present DeltaBlue witness is representative:

1. a collection contains a constraint;
2. `removeFirst()` reads that constraint and shrinks the array;
3. the returned object is consumed through another method call;
4. evaluator cache state permits the destructive call or its inputs to be observed again;
5. the second observation produces `undefined`;
6. failure is finally reported at a property load of `output`, not at the duplicate execution.

The benchmark assertion is downstream evidence. The actual defect is the absence of an explicit
dynamic execution identity.

## Design goals

The redesign must provide these properties:

- **One source of observable heap truth.** A property or array element has one current runtime value.
- **Exactly-once dynamic effects.** A call, store, allocation, resize, or destructive builtin runs
  once per dynamic control arrival.
- **Stable sampled values.** A load ordered before a destructive effect retains its sampled result
  for subsequent uses in the same arrival.
- **Function-local state.** Calling a function cannot clear or restore unrelated caller caches.
- **Natural recursion.** Recursive calls receive distinct frames instead of sharing graph-sized
  mutable cache entries.
- **Memory-graph validation.** Incorrect aliases, missing memory dependencies, or malformed merges
  still produce named evaluator failures.
- **Determinism.** A graph, seed, arguments, and budget produce the same outcome and event trace.
- **First-divergence diagnostics.** Tests report the earliest semantic mismatch with enough identity
  information to reproduce it.
- **No benchmark knowledge.** All behavior is defined in terms of IR operations and JavaScript
  runtime semantics.

## Non-goals

- Replacing ideal IR memory nodes or weakening the verifier.
- Making the evaluator fast enough to be the production runtime.
- Sharing the native runtime implementation with the evaluator.
- Implementing additional JavaScript language surface while migrating.
- Relaxing original benchmark checks.
- Hiding unsupported behavior behind host Node execution.

## Target architecture

### Evaluator state

The evaluator owns run-global state that is truly global:

```text
Evaluator
  status, failure_node, result
  step_budget, steps
  heap
  frames
  active_frame
  next_frame_id
  next_arrival_id
  trace_sink
```

It must not own a graph-wide cache of dynamic values. Dense graph metadata such as node ownership,
effect lists, and verifier facts may remain global because those facts are static.

### JavaScript heap

Use one imperative heap for observable runtime state:

```text
JsHeap
  objects: object_id -> JsObject

JsObject
  shape
  prototype
  named properties
  optional dense-array payload

JsArrayPayload
  length
  capacity
  indexed tagged values
  presence/hole information
```

The exact container types may reuse `src/jsobject.coil` and `src/jsarray.coil`, but evaluator object
identity must be unified. An array is a JavaScript object with indexed storage, not an unrelated ID
space that happens to have an associated object.

Operations have direct semantics:

- `PropStore` mutates the object's named-property table;
- `PropLoad` follows own properties and the prototype chain;
- `ArrayStore` mutates indexed storage and length;
- `ArrayLoad` reads indexed storage or returns `undefined` for a hole/out-of-range access;
- `ArrayResize` changes length and presence according to JavaScript semantics;
- fixed-field `Store` and `Load` use the same object record or a clearly separated compiler-field
  table owned by that object identity;
- `SetProto` mutates the prototype link after cycle validation.

There must not be parallel imperative and persistent copies of the same observable value.

### Graph memory values

Retain an evaluator representation for memory tokens, but narrow its responsibility:

```text
MemoryToken
  token_id
  alias_mask
  predecessor token(s)
  producing node
```

Memory evaluation checks:

- a load/store receives a memory value;
- the required alias is present;
- merge children have legal/disjoint alias coverage where the IR requires it;
- the operation is ordered after the appropriate predecessor;
- a token is not consumed on a control arrival where it was never produced.

Memory tokens do not carry historical object/array contents. Reading through an old token may still
be rejected when ordering is invalid, but it must not resurrect an old JavaScript heap snapshot.

This distinction should be explicit in comments and tests: the ideal graph models dependencies;
the evaluator heap models the current observable runtime.

### Function frames

Create one frame per invocation:

```text
EvalFrame
  id
  function_node
  caller_frame
  return_call
  parameters
  captures
  phi_values
  node_values
  node_value_epochs
  current_control
  current_arrival
```

`node_values` may be dense over nodes owned by the function or sparse. Correct ownership matters
more than representation. A frame must never restore values belonging to another frame.

Calls proceed as follows:

1. evaluate the callee, receiver, explicit arguments, captures, and incoming memory token in the
   caller frame;
2. allocate a callee frame;
3. bind parameters and captures in that frame;
4. execute the callee CFG;
5. return the value and outgoing memory validation token to the caller;
6. cache the call result for the caller's current arrival;
7. destroy or recycle the callee frame.

Recursive and mutually recursive calls naturally allocate additional frames. Remove graph-wide
`frame-nodes` snapshots once frame-local storage is authoritative.

### Control arrivals and epochs

Every dynamic visit to a control node creates an arrival:

```text
ControlArrival
  id
  frame_id
  control_node
  predecessor_control
```

The frame records its current arrival ID. A cached value has an epoch equal to the arrival in which
it was computed. A cache hit requires both the same frame and the same arrival unless the node is
explicitly invocation-stable, such as a bound parameter or immutable closure capture.

Examples:

- revisiting a loop header creates a new arrival and recomputes its dynamic calls/effects;
- demanding a `Call` twice below one `CallEnd` returns the same result;
- a `New` node allocates once on one arrival and again on the next loop arrival;
- an `ArrayLoad` sampled before `ArrayResize` returns its cached old value later in that arrival;
- the same ideal node in two recursive frames has independent values.

Classify evaluator nodes explicitly:

| Class | Lifetime | Examples |
|---|---|---|
| immutable | run | constants, function identities, string constants |
| invocation | frame | parameters, captures |
| merge | arrival at merge | Phi values |
| sampled | control arrival | loads whose value must survive later effects |
| effect | control arrival | stores, resize/copy, allocation, builtin effects |
| call | control arrival | call result and outgoing effect token |
| pure derived | demand or arrival cache | arithmetic, comparison, casts |

Do not infer lifetime from a general boolean such as `hasenv`.

### CallEnd semantics

`CallEnd` is the dynamic execution point for a call. Define one rule and use it in top-level and
function-local CFG walkers:

1. establish the CallEnd arrival;
2. execute its call if that call has not executed for this arrival;
3. publish the result and outgoing memory token into the caller frame's arrival cache;
4. execute continuation-pinned effects in source/node order;
5. select the next control successor.

Data users of the `Call` read the published result. They never execute the callee again. This makes
void calls and value-returning calls obey the same rule and eliminates special eager/deferred paths.

### Merge and Phi semantics

Keep the evaluator's simultaneous Phi rule:

1. determine the incoming predecessor index;
2. evaluate every incoming Phi value against the old frame environment;
3. commit all Phi values together for the new merge arrival.

Phi storage moves into the frame. A boxed dynamic Phi remains an ordinary Phi whose incoming values
are representation conversions. No Phi may recursively demand itself.

## Structured tracing and first-divergence debugging

Add an optional trace sink disabled by default. Events should be structured records, not ad hoc
`fmt` statements tied to node IDs.

Minimum event fields:

```text
sequence
frame_id
function_node
arrival_id
control_node
node
operation
operands (stable rendered identities/values)
result
memory alias/token summary
```

Required event types:

- control arrival and chosen branch;
- merge entry and committed Phi values;
- call enter/return;
- allocation;
- fixed and dynamic property load/store;
- array load/store/resize/copy;
- prototype mutation;
- builtin invocation;
- throw/failure;
- final return.

Example:

```text
0042 f=17/a=91 call-enter  n=2158 target=OrderedCollection.removeFirst recv=o181
0043 f=18/a=92 array-load  n=211 object=o188 index=0 result=o203
0044 f=18/a=92 array-resize n=212 object=o188 old-length=1 new-length=0
0045 f=17/a=91 call-return n=2158 result=o203
```

Add a comparator that stops at the first unequal event and prints a bounded context window. Node
instrumentation need not expose Coil node IDs; compare normalized semantic events such as calls,
heap operations, branches, and returns. Where full Node instrumentation is impractical, compare the
evaluator's raw and optimized event streams after normalizing nodes to source ranges/operation roles.

The trace mode must have a gate proving that enabling it does not change the result.

## Automatic reduction workflow

When a benchmark fails:

1. retain the exact source, mode, seed, and first-divergence event;
2. reduce source declarations and statements while preserving that divergence;
3. reduce iteration counts and data sizes;
4. convert the result to a benchmark-independent test;
5. verify it against Node;
6. make the reduced test fail before implementing the fix;
7. fix the general evaluator/compiler behavior;
8. rerun the reduced test, capability gates, then the full benchmark.

The reducer predicate should be the first semantic divergence or named evaluator status, not merely
the final benchmark exit code. Preserve generated reduced artifacts only when they become tests.

## Implementation phases

### Phase E0 — freeze evidence and add focused regressions

Before restructuring:

- preserve the current DeltaBlue failure as a deterministic reproducer;
- add a small collection witness equivalent to `add -> size -> pop -> call -> property read`;
- add looped and recursive variations;
- record raw and optimized outcomes;
- ensure current evaluator tests remain runnable throughout migration.

Required focused source witnesses include:

```javascript
const x = { value: 7 };
const a = [x];
const y = a.pop();
consumeWithoutMutation();
if (y.value !== 7 || a.length !== 0) throw 1;
```

and:

```javascript
for (let i = 0; i < 3; i++) {
  const a = [{ value: i }];
  const y = a.pop();
  if (y.value !== i) throw 1;
}
```

Falsify by deliberately executing `pop` twice and prove the focused gate turns red.

### Phase E1 — introduce frames and ownership metadata

- add exact function ownership for evaluator-relevant nodes;
- introduce `EvalFrame` and frame-local Parm/Phi/value storage;
- move calls to push/pop frames;
- retain the old heap temporarily behind a narrow interface;
- delete graph-wide frame snapshotting after recursion and mutual-recursion tests pass.

Exit evidence:

- direct, nested, recursive, and mutually recursive call tests pass;
- two simultaneous invocations cannot observe one another's Parm/Phi/call cache;
- a deliberate frame-ID alias causes the focused gate to fail.

### Phase E2 — introduce control-arrival epochs

- allocate an arrival ID on every dynamic control visit;
- key allocations, calls, effects, and sampled loads by frame plus arrival;
- unify top-level and function-local CallEnd behavior;
- replace `hasenv` for dynamic nodes with explicit epoch checks;
- retain permanent/invocation values in separate storage classes.

Exit evidence:

- calls execute once per arrival and again on the next loop iteration;
- allocations have the same rule;
- pre-mutation loads remain stable in one arrival;
- loop and nested-call event counts agree with Node instrumentation.

### Phase E3 — unify the imperative JavaScript heap

- unify evaluator object identity across fixed fields, dynamic properties, prototypes, and arrays;
- move observable array contents/length out of persistent memory history;
- preserve holes, bounds, growth, truncation, and tagged values;
- make property and array operations mutate/read the single heap;
- keep memory tokens as validation metadata;
- remove latest-write/latest-array recovery once no callers remain.

Exit evidence:

- B11 and B12 ideal matrices remain green;
- aliasing an object through parameters observes mutations;
- array mutation across calls and loops agrees with Node;
- malformed memory edges still produce `EV-MEM` rather than silently succeeding.

### Phase E4 — simplify memory-token evaluation

- replace value-carrying heap versions with alias/order tokens;
- keep merge/view validation and named failures;
- document the precise legality rules;
- add corruption tests for wrong alias, missing predecessor, invalid merge, and unproduced token;
- delete historical value traversal used only for runtime reads.

Exit evidence:

- every existing memory-verifier negative remains red for the intended reason;
- changing a memory edge can fail validation but cannot resurrect an old heap value;
- raw and optimized ideal results still agree.

### Phase E5 — structured trace and reducer support

- add trace schema and bounded renderer;
- add normalized raw-versus-optimized comparator;
- add Node semantic instrumentation for the focused JavaScript surface;
- add a command that runs a source and reports the first divergence;
- optionally integrate statement/declaration reduction after the comparator is stable.

Exit evidence:

- an injected duplicate `pop` reports the duplicate operation as first divergence;
- an injected wrong Phi reports the merge divergence;
- tracing on/off produces identical results;
- output is bounded and deterministic.

### Phase E6 — reopen the B15 acceptance matrix

Run, in order:

1. evaluator unit tests;
2. frame/arrival/heap focused tests;
3. B03, B04, B07, B09–B14 gates;
4. Richards raw and optimized ideal;
5. DeltaBlue raw and optimized ideal;
6. Richards and DeltaBlue native normal/pressure/seed matrix;
7. moving-GC stress;
8. independent correctness mutations;
9. complete B15 gate and workflow controller.

Only then update the B15 contract and roadmap state.

## Expected files

The implementer should confirm exact boundaries before editing, but the likely surface is:

- `src/eval.coil` — evaluator orchestration, frames, arrivals, calls, memory validation;
- `src/jsobject.coil` — unified object identity and named properties;
- `src/jsarray.coil` — indexed payload attached to evaluator object identity;
- `src/jsvalue.coil` — tagged-value encoding at heap boundaries;
- `src/node.coil` — static function/node ownership metadata if not already available;
- `src/verify.coil` — memory-token legality only if the evaluator exposes a missing invariant;
- `tests/eval-test.coil` — frame, arrival, exactly-once, merge, and corruption tests;
- `tests/jsobject-test.coil` and `tests/jsarray-test.coil` — unified heap behavior;
- `tools/` — trace runner, comparator, Node instrumentation, and optional reducer;
- `tools/gates/B15.sh` — acceptance matrix, without weakening original checks.

Avoid modifying the native backend unless a newly reduced test proves a separate native defect. This
proposal primarily changes the ideal oracle.

## Required invariants and assertions

Add cheap assertions or named failures for these conditions:

- a frame evaluates only nodes owned by its function, except immutable global nodes;
- every dynamic cache lookup matches the active frame and required arrival;
- every CallEnd refers to one call and publishes one result per arrival;
- a merge predecessor is present exactly once;
- all Phis on a merge are committed simultaneously;
- object IDs are valid and never cross heap identity spaces;
- array payload ownership matches its object;
- an effect executes no more than once per arrival;
- a memory token covers the requested alias;
- tracing cannot call evaluator operations or mutate runtime state.

Prefer named evaluator statuses for malformed graphs and internal assertions for impossible evaluator
state. Do not return plausible `undefined` values for internal corruption.

## Required positive tests

At minimum, cover:

- direct and nested calls returning primitives and objects;
- recursion and mutual recursion with values live across calls;
- two call sites targeting the same function;
- the same call site across loop iterations;
- a call result demanded by multiple users after CallEnd;
- a void call whose mutation must occur at CallEnd;
- object property mutation across calls;
- prototype lookup after mutation;
- array push/pop/resize with the returned value used after another call;
- array holes and truncation;
- allocation once per arrival and fresh allocation on loop backedge;
- simultaneous Phi swap;
- sampled load before store/resize;
- raw versus optimized agreement for every witness.

## Required negative and falsification tests

Each subsystem needs a mutation that the gate demonstrably catches:

- reuse one frame for recursive calls;
- omit the arrival component of a call cache key;
- execute a CallEnd call twice;
- reuse an allocation across loop arrivals;
- commit Phis sequentially;
- maintain separate array and object identity spaces;
- read runtime contents from an old memory token;
- omit an alias from a memory token;
- allow a trace callback to mutate the heap;
- corrupt the DeltaBlue projection expectation and Richards queue/hold expectation independently.

The test should state the expected failure reason so a different accidental failure does not count as
falsification.

## Performance constraints

Correctness comes first, but the design should avoid known pathological costs:

- use dense frame-local arrays when node ownership provides compact local indices;
- use O(1) epoch comparisons rather than clearing graph-sized caches on every control arrival;
- avoid walking complete heap history for loads;
- keep tracing disabled without per-event allocation in normal runs;
- bound rendered failure context;
- retain the existing evaluator step budget across nested frames.

Add stress tests with at least hundreds of objects, collection operations, and loop arrivals so an
accidental quadratic implementation is visible before full DeltaBlue.

## Migration and compatibility rules

- Keep old and new evaluator paths side by side only if a temporary differential mode compares
  them; do not leave two permanent semantic implementations.
- Land phases with focused gates green. Do not combine the complete refactor with unrelated frontend
  or backend features.
- Preserve named evaluator status codes where their meaning remains valid.
- If a status changes, update tests and documentation in the same change with an explicit reason.
- Remove obsolete recovery tables, cache flags, and comments when their replacement lands.
- Run `git diff --check` and search for temporary `TRACE`/`DBG` instrumentation before handoff.

## Current-worktree warning

The B00–B15 implementation is presently a large uncommitted worktree. `src/eval.coil` includes
in-progress experiments made while reducing DeltaBlue, including array latest-version recovery,
array-load caching, control-arrival call handling experiments, and active-function tracking. The
implementer must inspect the current diff rather than assuming repository `HEAD` is the intended
baseline.

Before starting the redesign:

1. preserve the current worktree;
2. identify which evaluator changes are already covered by focused tests;
3. retain general fixes with passing regressions;
4. replace experimental cache workarounds through the phased architecture above;
5. do not use destructive Git cleanup commands against the user's work.

## Completion checklist

- [ ] One authoritative imperative evaluator heap exists.
- [ ] Object and array identities are unified.
- [ ] Every invocation has a function-local frame.
- [ ] Every dynamic control visit has an arrival identity.
- [ ] Calls/effects/allocations are exactly once per frame arrival.
- [ ] Sampled pre-mutation loads are stable for their arrival.
- [ ] Recursive calls require no graph-wide cache snapshots.
- [ ] Memory tokens validate aliases and ordering without storing runtime contents.
- [ ] Structured traces identify the first semantic divergence.
- [ ] Focused positive and falsification matrices pass raw and optimized.
- [ ] Predecessor gates remain green.
- [ ] Richards and DeltaBlue pass the complete B15 acceptance matrix.
- [ ] Temporary diagnostics and superseded recovery mechanisms are removed.

## Handoff definition

The implementation is ready to hand back for continued benchmark work when:

1. all phases E0–E5 have their focused exit evidence;
2. evaluator behavior is documented by the invariants above;
3. the B15 gate reaches either green or a new first-divergence report that is demonstrably outside
   the evaluator execution model;
4. the worktree contains no benchmark-specific semantic shortcuts;
5. the implementer records the exact commands and outcomes in `docs/JOURNAL.md`.

At that point resume the ordinary roadmap at B15. Do not begin B16 while B15 remains open.
