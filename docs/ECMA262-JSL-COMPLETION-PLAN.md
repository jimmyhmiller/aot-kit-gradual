# ECMA-262 to JSL Completion Plan

## Mission

Account for the complete pinned ECMA-262 specification, implement every in-scope JavaScript
semantic operation once in JSL, keep syntax and compiler structure in their proper layers, and
prove the result with fast focused tests plus complete Test262 evidence.

This is not a plan to copy specification prose mechanically or to move parsing, early errors,
execution scheduling, or machine representation into JSL. It is a plan to make ECMA-262 the
machine-readable work queue and to give every normative algorithm an explicit disposition:

- implemented in JSL;
- implemented structurally by the frontend and delegated to JSL for JavaScript meaning;
- implemented by a runtime representation primitive beneath JSL;
- implemented by the host or embedding layer;
- intentionally out of the selected product profile, with a tested refusal;
- blocked by a named prerequisite, with no silent approximation.

The effort is complete only when there are no unclassified normative clauses or unverified claims.

## Governing rules

1. `lib/**/*.jsl` is the single implementation of JavaScript runtime semantics. The frontend may
   preserve syntax and construct control, scope, and evaluation structure; it must not open-code an
   operation JSL defines or could define.
2. JSL primitives expose representation and machine capabilities, not JavaScript policy. Adding a
   primitive requires proving that the operation cannot be expressed correctly from existing
   primitives.
3. Unsupported behavior is refused by name and source range. It is never approximated, skipped
   silently, or reported as supported because an easy subset passes.
4. Every implementation claim is generated from executable metadata and tests. Hand-maintained
   prose may explain a claim but cannot create one.
5. Focused tests are the normal development loop. Complete Test262 runs are milestone and release
   evidence, not the price of receiving feedback on each edit.
6. A passing Test262 result may not regress. Every tranche compares exact variants before and
   after; pass-to-nonpass transitions block completion.
7. `coil test` must remain green. `coil test --suite frontier` runs at session start and handoff;
   its intentional failures remain visible and are never weakened to make a change appear green.
8. Existing project decisions, especially the closed-world model, graph verification, GC contract,
   and honest refusal policy, remain in force.

## Definition of complete ECMA-262 coverage

“All of ECMA-262” means all normative material in one pinned edition or source commit is present in
the generated ledger. Each ledger item has an owner, status, dependencies, tests, and evidence.

The ledger covers:

- abstract operations;
- syntax-directed operations and runtime semantics;
- static semantics and early errors;
- object internal methods and internal slots;
- built-in constructors, functions, methods, accessors, and intrinsic objects;
- execution contexts, environment records, realms, scripts, and modules;
- iterators, generators, promises, jobs, agents, and memory-model operations;
- host hooks and implementation-defined boundaries;
- grammar productions whose acceptance or rejection affects observable behavior.

Coverage does not mean every item belongs in JSL. It means every item is correctly owned and
accounted for. A syntax-directed operation that only determines bound names belongs in the
frontend. `ToPropertyKey` belongs in JSL. Raw symbol allocation belongs below JSL. A host hook may
belong in the embedding layer. The ledger must make those distinctions explicit.

The project may define a product profile that excludes Annex B, modules, shared memory, or another
large subsystem temporarily. Such an exclusion is a milestone boundary, not completion of the
whole specification. Full completion requires either implementation or a deliberate final product
decision that is documented, manifested, and tested as an unsupported boundary.

## Deliverables

The program produces these durable artifacts:

1. A pinned ECMA-262 source revision and reproducible extractor.
2. A generated specification ledger containing every normative item.
3. A dependency graph connecting spec algorithms, JSL definitions, primitives, frontend
   structural handlers, host hooks, and tests.
4. Structured provenance and status metadata on JSL declarations.
5. A declarative intrinsic/publication manifest.
6. The minimum JSL extensions needed for faithful transcription.
7. A clause-oriented workbench for checking and testing one operation quickly.
8. Generated focused semantic cases and explicit hand-written edge/falsification cases.
9. Test262 mappings and exact before/after transition reports.
10. A generated support manifest and progress dashboard.
11. Complete retained Test262 evidence at milestone boundaries.
12. A final conformance report listing implementation, product-profile exclusions, host-defined
    behavior, and any accepted implementation-defined choices.

## Work item and metadata model

### Specification item identity

Every extracted item receives a stable identity containing:

- pinned spec revision;
- clause id;
- algorithm or production name;
- kind: abstract operation, syntax-directed operation, internal method, built-in, grammar,
  invariant, host hook, or prose requirement;
- parameter list, optionality, and result type when declared;
- direct algorithm dependencies;
- enclosing subsystem and intrinsic.

Stable clause ids are the primary identity. Human-readable names are labels and may change between
editions.

### Implementation disposition

Each item has exactly one primary disposition:

- `jsl`: JavaScript runtime meaning implemented in `lib/`;
- `frontend`: parser, early-error, scope, or evaluation structure;
- `runtime`: storage, representation, GC, platform math, or machine service;
- `host`: embedding hook or implementation-provided behavior;
- `composite`: a structural frontend entry whose semantic suboperations are named JSL calls;
- `unsupported`: explicit product boundary with a tested refusal;
- `blocked`: incomplete, naming its prerequisites.

`partial` is a status, not an owner. A partial item must name the unsupported steps or receiver
kinds precisely.

### Proposed JSL declaration metadata

The exact spelling should be settled with focused parser/checker tests, but the information must be
equivalent to:

```clojure
(macro ToPropertyKey
  :spec "ecma262@<commit>#sec-topropertykey"
  :spec-name "ToPropertyKey"
  :status complete
  :params [(argument dyn)]
  :ret dyn
  ...)
```

Additional metadata may include:

- `:profile` for Annex B or other profile-controlled behavior;
- `:specializes` when a helper implements a deliberately narrower algorithm;
- `:deviation` referencing a named, tested limitation;
- `:tests` referencing focused case groups and Test262 mappings;
- `:intrinsic` referencing its publication descriptor.

The checker must reject stale clause ids, duplicate canonical claims, invalid status values,
unresolved dependencies, and `complete` declarations carrying deviations.

## Progress measurements

Declaration count is not a progress metric. One foundational operation can unlock hundreds of
public algorithms, while many representation helpers can add no observable support.

The generated fine-grained planning view is [ECMA-262 Fine-Grained Dependency Graph](ECMA262-DEPENDENCY-GRAPH.md).
Its JSON and Graphviz forms retain every normative item, specification-operation edge, reviewed
prerequisite, aggregate capability, recursive dependency component, and ranked actionable work
unit. Aggregate capabilities remain visible as milestone debt, but they do not replace or obscure
the concrete operation dependencies used to choose the next tranche.

The generated report must show:

- normative items classified / total;
- public algorithms fully implemented through their transitive dependency closure;
- public algorithms partial, blocked, unsupported, and unclassified;
- JSL-owned operations implemented / total;
- frontend-owned structural operations implemented / total;
- internal-method families implemented by receiver kind;
- intrinsic objects and properties published / total;
- focused semantic case results;
- mapped Test262 variants passed, failed, refused, and skipped;
- newly passing and pass-to-nonpass transitions for the current tranche;
- top blockers by directly affected tests;
- top prerequisites by transitive unlock score.

The unlock score for a prerequisite includes both the public algorithms and mapped Test262 variants
that become reachable when it is implemented. It is a planning signal, not a claim of passes.

## Fast feedback: the normal per-edit test ladder

Developers must not need a complete Test262 run to learn whether a new JSL operation works. Each
work item climbs the following ladder. Stop at the first failure.

### Level 0: metadata and dependency check

Target: well under one second once the extractor cache exists.

- Parse the changed JSL unit.
- Validate spec ids, declaration shape, types, effects, and dependency names.
- Confirm that canonical, specialized, partial, and representation helpers are classified
  consistently.
- Print unresolved spec dependencies and illegal layer crossings.

Proposed command:

```sh
coil jsl check lib/abstract/property.jsl
```

### Level 1: one-operation lowering

Target: seconds, without compiling every public consumer.

- Lower the selected declaration and its transitive JSL dependency closure.
- Run graph verification, effect verification, and representation checks.
- Print or diff a normalized graph summary: nodes, calls, allocations, throws, heap aliases,
  safepoints, and retained dynamic guards.
- Reject an operation that claims no allocation, callback, or throw but lowers one.

Proposed command:

```sh
coil jsl lower ToPropertyKey --verify --summary
```

### Level 2: table-driven semantic examples

Target: seconds.

Each operation owns a compact data file or test block with:

- ordinary positive cases;
- type-boundary cases;
- omitted versus explicit `undefined` cases;
- NaN, infinities, signed zero, and numeric limits where relevant;
- nullish and primitive receivers;
- accessor, prototype, and mutation observations where relevant;
- expected throw constructor and message properties where specified.

Run every case through both the graph evaluator and native backend. Their answers must match. The
case format should encode JavaScript values and abrupt outcomes without requiring a complete
Test262 harness.

Proposed commands:

```sh
coil jsl test ToPropertyKey
coil jsl test Array.prototype.map --case sparse-accessor
```

### Level 3: independent differential oracle

Target: seconds.

For behavior implemented by Node and not dependent on a deliberately different host policy:

- generate a small standalone JavaScript program for the same table;
- run it in Node;
- compare values using SameValue semantics and compare thrown constructor names;
- preserve the generated oracle output when a regression is diagnosed;
- include at least one falsification case that would fail for a tempting incorrect
  implementation.

Node is not the oracle for implementation-defined behavior, resource limits, or this project's
unsupported product boundaries. Those require direct specification assertions.

### Level 4: focused source witness

Target: seconds.

Compile and execute a small ordinary JavaScript program that reaches the operation through its
real public syntax or intrinsic. This proves publication, receiver ABI, frontend routing, lowering,
linking, native execution, and observable result together.

Every public built-in requires at least:

- one direct-call witness;
- one first-class extracted-call witness when legal;
- one generic-receiver witness when the spec says the method is generic;
- one abrupt witness when it can throw;
- one mutation/aliasing witness when it touches objects.

Focused witnesses belong in bounded gate tests or an operation-specific focused suite, not only in
an external Test262 checkout.

### Level 5: mapped Test262 slice

Target: seconds to a few minutes, never the whole corpus.

The ledger maps an operation to relevant Test262 paths, frontmatter features, includes, and known
indirect consumers. The workbench runs only that deterministic cohort:

```sh
coil jsl test262 ToPropertyKey --quick
node tools/run-test262.mjs --no-build --quick --test262 /path/to/test262 \
  /path/to/test262/test/built-ins/Reflect
```

The retained verification form writes JSONL and compares against the previous result for the exact
same expanded variants:

```sh
coil jsl test262 ToPropertyKey --results results/topropertykey-after.jsonl \
  --compare results/topropertykey-before.jsonl
```

Completion requires zero pass-to-nonpass transitions. New failures or refusals may be honest only
when the old pass was proven accidental; such a transition still blocks the tranche until it is
diagnosed, recorded, and approved as a correction rather than hidden.

### Level 6: bounded repository gate and frontier

Run after every implementation edit:

```sh
coil test
```

Run the frontier at session start and handoff:

```sh
coil test --suite frontier
```

The frontier remains red exactly for its recorded open bugs. An unexpected frontier change is a
result requiring diagnosis, not cleanup.

### Level 7: subsystem cohort

Run when a shared foundation or public family is complete. Examples include the complete property
descriptor, iterator, Symbol, Array, String, Promise, or TypedArray cohorts. Retain before and after
JSONL, analyze exact transitions, and regenerate the subsystem report.

### Level 8: complete Test262 milestone

Run only at milestone boundaries, before broad releases, after shared compiler/runtime invariant
changes, or when the complete-corpus dependency model needs recalibration. Retain all results and a
generated breakdown. Do not substitute a random sample for completion evidence.

## Clause workbench

Build one command that makes a spec clause the unit of work:

```sh
coil jsl work sec-array.prototype.with
```

It should:

1. show the pinned algorithm and source link;
2. show direct and transitive dependencies;
3. classify each dependency by owner and status;
4. create or locate the JSL skeleton and intrinsic descriptor;
5. run Levels 0 through 4 by default;
6. optionally run the mapped Test262 slice;
7. compare exact prior results;
8. print remaining blockers and the operation's unlock score;
9. update generated reports without editing hand-written status prose.

The skeleton generator must stop at unknown operations, specification types, host hooks, or
internal methods. It emits a blocker report; it never fills a gap with an approximation.

## JSL alignment work

JSL should remain a small expression language. Add only constructs that repeatedly remove
incorrect translations of specification machinery.

### A. First-class argument presence and rest arguments

Represent omission separately from the JavaScript value `undefined`:

```clojure
:params [(end (optional dyn)) (items (rest dyn))]
```

Provide presence, argument count, indexed rest access, and safe defaulting. Lower these from the
existing JavaScript call ABI; do not allocate observable arrays unless the algorithm requests one.

Exit criteria:

- no semantic sentinel values stand for omitted arguments;
- frontend repetition for variadic built-ins is replaced by JSL loops;
- focused tests distinguish omitted, `undefined`, zero arguments, and many arguments.

### B. Compile-away specification records, enums, and lists

Add named records and enums whose fields lower to SSA values unless escape requires materialization.
Add non-observable specification Lists distinct from JavaScript Array objects.

Initial record families:

- Completion Record;
- Reference Record;
- Property Descriptor;
- Iterator Record;
- Promise capability and reaction records when Promise work begins;
- Realm, environment, and module records when those phases begin.

Exit criteria:

- field names and types are checked;
- records can cross branches and loops with verified Phis;
- list mutation has explicit ordering and no JavaScript-visible prototype behavior;
- no record allocation is introduced merely for transcription convenience.

### C. Narrow abrupt-completion capture

Ordinary calls continue to propagate abrupt completion implicitly. Add one structured mechanism for
algorithms that inspect or prioritize completions, such as iterator closing, `finally`, disposal,
and generator cleanup.

Exit criteria:

- `IteratorClose` precedence cases pass focused tests;
- nested captured completions preserve heap and control state;
- ordinary algorithms remain uncluttered;
- the checker rejects uncaught or multiply-consumed captured completions.

### D. Internal-method protocol

Expose spec-shaped operations such as `Get`, `Set`, `DefineOwnProperty`, `Delete`,
`OwnPropertyKeys`, `Call`, and `Construct`. Dispatch through semantic receiver kinds, with ordinary
and exotic implementations behind one boundary.

Implementation order:

1. ordinary objects;
2. functions and bound functions;
3. arrays and string exotic objects;
4. arguments objects;
5. typed arrays and ArrayBuffer views;
6. Proxy;
7. module namespace and remaining standard exotic objects.

Runtime primitives beneath this boundary expose storage descriptors, shape transitions, internal
slots, allocation, and key iteration. JSL owns prototype traversal, receivers, accessors,
attributes, extensibility, proxy/exotic policy, and errors.

### E. Declarative intrinsic publication

Create a deterministic manifest for constructors, prototypes, functions, accessors, aliases,
well-known-symbol properties, names, lengths, descriptors, and JSL implementations.

Generate:

- intrinsic identities;
- global and prototype installation;
- callable adapters;
- property attributes;
- frontend lookup tables;
- support-manifest entries;
- focused publication tests.

The frontend must not grow a new semantic name switch for every built-in.

Current implementation boundary (2026-08-28): `spec/intrinsics.json` is authoritative for the 25
global bindings the frontend currently publishes. It generates exact compiler identities,
lowering-family ids, runtime constructor kinds, callability/constructability queries, global-name
global/property routing, `lib/generated/intrinsic-publication.jsl`, and
`spec/generated/intrinsic-support.json`. Distinct Error constructors retain distinct
identities while sharing the generated `error` lowering family. The `properties` arrays remain
partial deliberately. Twenty `%Symbol%` properties are now generated: the fifteen standard
well-known-symbol data properties with their exact all-false attributes; constructor methods `for`
and `keyFor`; prototype methods `valueOf` and `toString`; and the prototype `description` accessor.
Method roots create stable callables with observable names, lengths, and exact descriptors.
Accessor roots create independently named getter/setter closures (including an absent setter) and
install exact accessor attributes. The frontend carries general semantic owner kinds for callable
values and Property Descriptor objects so their property reads cannot be confused with unrelated
shaped fields. Property component operation numbers are part of GVN identity, preventing getter,
setter, and descriptor-field operations from merging. Constructor metadata, callable adapters for
the remaining families, and the rest of the standard intrinsic inventory have not yet migrated and
must not be counted as published by this manifest.

Well-known-symbol dependencies are roots, not a reason to initialize `%Symbol%` wholesale.
Consumers request focused entries such as `SymbolSpeciesValue` and `SymbolToStringTagValue`; this
is the publication granularity the completed manifest must generate. It both matches Torque's
root-table model and keeps an unrelated constructor initializer out of focused operation graphs.

### F. Diffable lowered graphs and effect summaries

Normalize the graph for a declaration and dependency closure. Record stable summaries or selected
goldens so review shows changes in calls, allocation, control, memory, safepoints, and code size.
Generated snapshots must be deterministic and refreshed only by an explicit command.

## Implementation phases

### Phase 0: freeze the baseline

1. Pin the ECMA-262 and Test262 revisions.
2. Retain the current complete Test262 results and generated breakdown.
3. Record current JSL declarations, primitives, frontend semantic calls, intrinsic publication,
   supported syntax, and runner-policy exclusions.
4. Make regeneration deterministic.
5. Establish exact transition comparison for identical expanded variants.

Exit gate: another machine can regenerate the same baseline and ledger inputs.

### Phase 1: extract and classify the whole specification

1. Parse the pinned ecmarkup source.
2. Extract normative items, signatures, algorithms, dependencies, and enclosing subsystems.
3. Seed automatic matches from existing JSL names and spec links.
4. Manually resolve ambiguous matches and all prose requirements.
5. Assign every item an owner and status.
6. Generate the first dependency graph, coverage report, and unclassified-item gate.

Exit gate: zero unclassified normative items. `blocked` is allowed only with named prerequisites.

### Phase 2: provenance, manifest, and workbench foundation

1. Add structured spec metadata to the JSL declaration model.
2. Add metadata validation and generated support reports.
3. Add one-operation checking and dependency-closure lowering.
4. Add table-driven evaluator/native cases.
5. Add Node differential generation where valid.
6. Add deterministic Test262 clause/cohort mapping and result comparison.
7. Add graph/effect summaries.

Exit gate: one existing operation can be developed through Levels 0-5 with one command, and an
injected semantic defect is caught before a complete Test262 run.

### Phase 3: declarative publication and call surface

Status: in progress. Global identity/routing, lowering metadata, fifteen well-known-symbol value
roots, and the first two general method descriptors/root accessors are generated. General
data/accessor property generation, complete
intrinsic inventory migration, adapters, and removal of the remaining property-name switches are
still required before this phase's exit gate is satisfied.

1. Define the intrinsic descriptor schema.
2. Migrate current built-ins without changing observable behavior.
3. Generate identities, properties, attributes, names, lengths, and routing.
4. Add first-class omitted and rest arguments.
5. Remove migrated frontend repetition and name switches.

Exit gate: adding a simple built-in requires a JSL definition, one publication descriptor, focused
cases, and no handwritten frontend routing.

### Phase 4: specification data and completion machinery

The compiler-wide prerequisite and exact staged implementation contract are defined in
[Torque-style lowered values](TORQUE-STYLE-LOWERED-VALUES.md). Record migration must follow that
model: one canonical recursive physical layout, lowered parameter and result signatures, explicit
multi-result internal calls, and named JavaScript-boundary refusals. Do not extend the provisional
Record-specific ABI independently.

1. Add compile-away records and enums.
2. Add specification Lists.
3. Add narrow abrupt-completion capture.
4. Implement canonical Completion, Reference, Property Descriptor, and Iterator Record forms.
5. Migrate sentinel- and array-encoded algorithms in bounded tranches.

Exit gate: omitted arguments, descriptor algorithms, and `IteratorClose` translate without
frontend splitting or semantic sentinels.

### Phase 5: ordinary object and function foundation

Complete and validate:

- type conversion and testing;
- equality and relational comparison;
- property keys and descriptors;
- ordinary object internal methods;
- function call and construction;
- prototype and inheritance semantics;
- error objects and abrupt outcomes;
- global environment and ordinary bindings;
- ordinary iterators.

This phase deliberately precedes bulk built-in transcription because most later algorithms depend
on these foundations.

Exit gate: all ordinary-object internal-method ledger items are complete, their focused matrices
pass, and mapped Test262 cohorts have zero unexplained failures in supported syntax.

### Phase 6: harvest leaf built-ins by dependency closure

Use unlock score and complete-corpus evidence to select families. A likely order is:

1. fundamental objects and functions;
2. Number and Math;
3. String;
4. Array and array iterators;
5. Object and Reflect;
6. JSON;
7. Symbol;
8. Map and Set;
9. RegExp;
10. Date;
11. ArrayBuffer, DataView, and TypedArray;
12. errors and remaining structured-data built-ins.

For each family:

1. take a complete retained cohort baseline;
2. implement dependencies before public leaves;
3. transcribe each algorithm with pinned provenance;
4. complete Levels 0-6 per operation;
5. run the subsystem cohort;
6. compare exact transitions;
7. regenerate the ledger and support manifest;
8. record evidence in `HANDOFF.md`.

### Phase 7: syntax-directed and static semantics completeness

Account for and implement the frontend-owned portions of:

- declarations and binding instantiation;
- destructuring;
- functions, arrows, methods, and parameter semantics;
- classes, private elements, `super`, and fields;
- generators, async functions, and `await` structure;
- control statements and abrupt control transfer;
- scripts and modules;
- all early errors and context-sensitive grammar restrictions.

Frontend handlers must call named JSL operations for runtime meaning. Ownership tests must reject
new open-coded semantics.

Exit gate: every syntax-directed/static item is classified and either implemented or explicitly
profile-excluded, with parse/early/runtime negative tests at the correct phase.

### Phase 8: execution systems

Implement the shared semantic and runtime foundations for:

- execution contexts and environment records;
- realms and intrinsic isolation;
- generators and iterator cleanup;
- promises and job queues;
- async functions and async iteration;
- modules, linking, evaluation, and dynamic import within the closed-world policy;
- agents, shared memory, and Atomics if included in the final product profile;
- WeakRef and finalization only with a GC contract capable of supporting them.

Each subsystem receives its own focused scheduler/state-machine tests. Do not use full Test262 as
the first debugger for jobs, modules, or concurrency.

Exit gate: subsystem state transitions pass deterministic focused tests before their full Test262
cohorts run.

### Phase 9: exotic objects and remaining built-ins

Complete internal methods and public surfaces for every remaining standard exotic object. Validate
internal-method invariants directly, not only through public method examples. Run cross-family
tests because Proxy, species, iterators, and constructors deliberately intercept other built-ins.

Exit gate: the internal-method matrix is complete across receiver kinds and no public algorithm is
marked specialized where the specification requires generic behavior.

### Phase 10: full conformance closure

1. Regenerate the ledger from the pinned specification.
2. Require zero unclassified or blocked normative items.
3. Run all focused operation and subsystem suites.
4. Run `coil test`, frontier, and the exhaustive suite where shared invariants changed.
5. Run the complete pinned Test262 corpus under every supported mode.
6. Classify every nonpass as a product-profile exclusion, harness/host policy, upstream issue, or
   implementation defect.
7. Fix every implementation defect; do not convert it to an exclusion.
8. Repeat until results and manifests are stable and reproducible.
9. Publish the final generated support and conformance report.

Exit gate: every normative item has a final disposition; every claimed supported Test262 variant
passes; no failure is opaque; no pass regresses; regeneration is clean; and the repository gates
are in their documented states.

## Per-operation workflow

Every operation follows this checklist:

- [ ] Select the pinned clause and inspect its direct dependencies.
- [ ] Confirm ownership: JSL, frontend, runtime, host, or composite.
- [ ] Capture an exact focused baseline before changing semantics.
- [ ] Add or update structured provenance.
- [ ] Implement missing prerequisites first.
- [ ] Translate the algorithm without narrowing generic receivers or optionality.
- [ ] Add ordinary, boundary, abrupt, mutation, and falsification cases.
- [ ] Run metadata/checker validation.
- [ ] Lower the dependency closure and inspect graph/effect changes.
- [ ] Run evaluator/native table cases.
- [ ] Run Node differential cases where valid.
- [ ] Run public source witnesses.
- [ ] Run the mapped Test262 slice.
- [ ] Compare exact before/after transitions; require zero pass regressions.
- [ ] Run `coil test` and the frontier at the required boundaries.
- [ ] Regenerate the ledger, dependency graph, and support manifest.
- [ ] Record evidence and remaining blockers in `HANDOFF.md` and the project pad.

## Required test patterns

### Positive tests

- canonical examples from the algorithm;
- every branch and loop exit;
- all declared input kinds;
- generic receivers where required;
- inherited and accessor properties;
- callback mutation and reentrancy where permitted;
- extracted first-class calls and receiver behavior;
- both evaluator and native execution.

### Negative tests

- wrong receiver kinds;
- non-callable callbacks;
- invalid descriptors and constructors;
- abrupt dependencies at every `?` boundary;
- omitted versus `undefined` arguments;
- non-extensible and non-configurable objects;
- iterator close precedence;
- invalid syntax and early errors at the required phase;
- unsupported product features producing a precise refusal.

### Falsification tests

Every nontrivial algorithm includes a case that defeats a plausible shortcut. Examples:

- infinities defeat `|0` as `ToIntegerOrInfinity`;
- the largest double below `0.5` defeats `floor(x + 0.5)` for `Math.round`;
- sparse/inherited properties defeat raw array storage iteration;
- getters and callback mutation defeat preloaded values;
- explicit `undefined` defeats omission sentinels;
- proxies defeat bypassing internal methods;
- original abrupt completion precedence defeats naive iterator closing.

### Metamorphic tests

Where direct expected values are expensive, assert relations mandated by the spec:

- round trips such as parse/stringify or key enumeration/redefinition;
- idempotence of freeze/preventExtensions;
- equivalence between direct and extracted calls where receivers are supplied explicitly;
- consistency between property operations and descriptors;
- iterator results agreeing with indexed observation when the receiver is unchanged.

## Change size and landing discipline

- Land one foundation or coherent algorithm family at a time.
- Do not mix a JSL language extension with a broad semantic migration in one unreviewable change.
- First land the language construct and falsification tests; then migrate existing algorithms; then
  add newly unlocked algorithms.
- Preserve exact before/after cohort artifacts for every semantic tranche.
- If work exposes a Coil or other-project defect, follow that project's bug-pad instructions and
  keep the semantic tranche blocked until the dependency is honest.
- Do not edit a frontier assertion to claim success. A fixed frontier case becomes an ordinary
  regression witness according to the standing project rules.

## Immediate work queue

Execute these in order:

1. Pin ECMA-262 and Test262 revisions in a machine-readable project file.
2. Build the ecmarkup extractor and generate the raw normative-item ledger.
3. Define the disposition/status schema and classify the current JSL library automatically where
   names and links permit.
4. Manually close the remaining classification gaps until the unclassified count is zero.
5. Add structured spec metadata to JSL declarations and checker validation.
6. Generate the dependency graph, support report, blocker counts, and unlock scores.
7. Build one-operation dependency-closure checking/lowering.
8. Build table-driven evaluator/native semantic cases and Node differential output.
9. Build exact focused Test262 mapping and before/after comparison.
10. Prove the workbench on three representative operations:
    - a pure conversion operation;
    - a heap-mutating generic property operation;
    - a callback/abrupt operation.
11. Add declarative intrinsic publication and migrate the existing public surface without semantic
    changes.
12. Add first-class argument presence/rest arguments, then specification records/lists and narrow
    completion capture in separate verified tranches.
13. Begin the dependency-ordered implementation phases above.

Do not begin bulk transcription before items 1-10 are complete. Without the ledger, dependency
model, and focused workbench, bulk translation would create a large body of plausible code without
fast proof that it implements the specification.

## Final completion checklist

- [ ] ECMA-262 revision is pinned and reproducible.
- [ ] Every normative item is present in the generated ledger.
- [ ] Zero items are unclassified or blocked.
- [ ] Every JSL canonical operation has checked provenance and tests.
- [ ] Every non-JSL item has a tested owner and boundary.
- [ ] The intrinsic manifest accounts for every standard intrinsic in the selected edition.
- [ ] The internal-method matrix covers every required ordinary and exotic receiver kind.
- [ ] All focused semantic, differential, source, and subsystem suites pass.
- [ ] Every supported complete Test262 variant passes under all required modes.
- [ ] Every excluded variant maps to an explicit, final product-profile decision.
- [ ] No result is an opaque crash, timeout, generic execution failure, or unexplained refusal.
- [ ] Exact comparison contains zero pass-to-nonpass transitions.
- [ ] Generated manifests and reports reproduce without diffs.
- [ ] `coil test` is green.
- [ ] The frontier has exactly its honestly remaining open bugs.
- [ ] `HANDOFF.md` contains the final evidence and retained artifact locations.
