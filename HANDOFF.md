# 2026-08-28: declarative Number roots publish through one generated constructor initializer

- The intrinsic manifest now supports `jsl`-valued data properties: a checked zero-argument JSL
  declaration supplies values such as NaN and infinities that cannot be represented as JSON
  literals. Generated compiler metadata exposes the same root for representation-specialized
  lowering, so the manifest remains the single selector of both publication and raw numeric use.
- `%Number%` now declaratively publishes `length`, `name`, `prototype`, and all eight standard
  numeric constants with exact attributes. Generated intrinsic support grows from 26 to 37
  properties, and the checked JSL surface from 495 to 507 declarations. The ownership gate now
  treats `src/generated_intrinsics.coil` as compiler wiring rather than misclassifying generated
  publication roots as dead semantics.
- Constructor initialization is itself manifest metadata. The generator emits one aggregate JSL
  initializer, and every frontend request for `%Number%` crosses that same boundary. This removed
  the order-sensitive multi-root native failure without moving Number semantics into the frontend;
  the exact former repro is now retained in `tests/native-execution-test.coil`.
- Focused native witnesses prove both one demand-loaded `Number.EPSILON` root and the complete
  eight-constant interaction execute and agree with Node. The intrinsic manifest tests,
  generated-artifact checks, full spec-ledger gate, and bounded `coil test` gate are green.
- One newly exposed failure remains preserved honestly: the ordinary descriptor read for a
  published Number data root throws. It is
  `repros/open/generated-number-data-descriptor-throws.js`; the required frontier is red at
  **0/2** alongside `for-await-has-no-bridge-kind.js`. `docs/NATIVE-FRONTIER.md` is the generated
  status table.

# 2026-08-28: the backend is a closed product and retained JSL links by source reachability

- Final allocator hardening records both CFG boundaries in conservative intervals: live-in at
  block entry and live-out at the exclusive block exit. Exact reverse-CFG verification now rejects
  any destination write that clobbers a different live-after value. Allocation-phase failures stop
  publication and cannot be reset by the verifier.
- The final bounded gate is green at **81/81**. The 129-function / 74,975-block / 98,389-edge seed
  reports selection **0.429 s**, scheduling **0.187 s**, liveness **0.849 s**, allocation
  **1.008 s**, encoding **0.086 s**, and publication **0.776 s**. The warm nine-block allocation is
  **0.027 ms**. The frontier remains honestly red at **0/1** for
  `for-await-has-no-bridge-kind.js`.
- Exhaustive validation was not green: it reached nine named failures, none an allocation-verifier
  failure, and was stopped when one exhaustive case ran for 22 minutes without output. The log is
  `/tmp/aotk-full-coherent.log`; this result is recorded explicitly rather than claimed as a pass.

- MachineValue rows are now authoritative at construction: definition kind, provenance payload,
  representation, register class, Phi block, call result slot, and ABI constraints are verified
  before later phases consume them. Late kind/class reconstruction was replaced by opcode result
  contracts and an independent verifier.
- Scheduling and memory dependencies use owner-local sparse indexes. Liveness and allocation use
  frozen owner-local products; allocation no longer constructs an interference graph. Encoding
  reads dense allocation and function-range tables. The AArch64 instruction-scan compatibility
  path and its dead fallback counters are deleted.
- Retained artifacts are schema/compiler/runtime/target/options/JSL-identity keyed and protected by
  a final digest. The linker constructs one open-addressed semantic identity index and traverses
  CALL, ADDRESS, and CALLABLE_ID relocations from the current entry. Only reachable functions,
  symbols, stack maps, roots, and external relocations enter the executable image.
- `tests/backend-object-test.coil` is green at 27/27 and explicitly distinguishes a reusable
  cache-only archive from an executable rooted image. The seed gate proves a full retained library
  links to a smaller reachable image and still executes `main(7) == 8`.
- Required validation: `coil test` is green at **81/81**. The final measurements and exhaustive
  status are recorded above. The required frontier is honestly red at **0/1**, solely
  `for-await-has-no-bridge-kind.js`.

# 2026-08-28: frozen liveness/allocation and linear encoder publication meet the backend budget

- The large immutable-seed witness now reports liveness **0.849 s**, allocation **0.599 s**, and
  AArch64 encoding **0.083 s** for 129 functions, 74,975 blocks, and 98,389 CFG edges. Liveness and
  allocation are therefore below the one-second cold-phase ceiling; a warm nine-block program
  remains in tens of microseconds.
- Allocation's obsolete interference graph, corruption hooks, and expected-edge verifier product
  are gone. Production constraints are frozen OR-range indexes over instruction clobbers and fixed
  ABI definitions; the independent verifier replays exact register liveness and call clobbers.
- Liveness edge verification applies each edge copy once, and verifier scratch is allocated once
  at the maximum owner-local word width instead of being rebuilt per block and edge.
- x64 label and entry-owner queries now require their dense encoder tables. x64 and AArch64 publish
  exact function text ranges with one pass over the scheduled instruction stream instead of a
  quadratic function-start comparison.
- The bounded gate is green at **81/81**. The required frontier remains honestly red at **0/1** for
  `for-await-has-no-bridge-kind.js`. The overall refactor is not complete: creation-time typed
  MachineValues, removal of the AArch64 legacy fixture adapter/default class, and content-addressed
  reachable JSL artifact keys remain explicit work.

# 2026-08-28: backend scaling refactor removes the provenance and dense-interference cliffs

- `docs/BACKEND-SCALING-REFACTOR.md` is now the active implementation contract. Backend timing is
  split into exclusive local-scheduling and liveness phases, and always-on counters expose kind,
  definition, and memory rediscovery work.
- Machine-value provenance is persistent metadata. It is no longer invalidated when the mutable
  node-selection cache is overwritten or an ideal node dies. Logical call-result materialization
  takes its representation from its projection, not from the raw ABI snapshot. The Symbol witness
  that previously spent more than twelve minutes in `ml-kind-for-vreg-scan` no longer enters that
  scan; focused liveness is green at 17/17.
- Allocation no longer allocates owner-local quadratic packed interference rows. Exact sparse
  adjacency is deduplicated in destination batches with generation marks, avoiding a general hash
  lookup for every live-overlap candidate. Its independent verifier rebuild remains sparse and
  detects deliberate corruption. Focused allocation is green at 10/10.
- The exact `generated_symbol_constructor_data_descriptors_are_exact` native differential passes
  in 30.79 seconds and its generated program reaches first output in 16.6 ms. This is a large
  reduction, not the finish line: it still builds 238,048 ideal nodes, 59,127 blocks, and 6,015,012
  code bytes for tiny source.
- The required bounded gate is green at 81/81. Its 129-function / 74,975-block seed reports
  selection 7.416 s, local scheduling 0.385 s, liveness 1.417 s, allocation 17.125 s, AArch64
  encoding 0.095 s, and seed compilation 34.305 s. The required frontier is honestly red at 0/1
  for only `for-await-has-no-bridge-kind.js`. These measurements make typed MachineValue closure,
  sparse liveness/allocation work, and the reachable immutable JSL artifact the remaining work;
  none of those costs is accepted as complete.

# 2026-08-28: generated Symbol prototype publication proves the general method/accessor model

- The intrinsic property schema now supports constructor and prototype targets plus three checked
  property kinds: well-known-symbol values, methods, and accessors. Accessors declare a named
  getter, an optional named setter, and exact enumerable/configurable attributes; generated roots
  create stable closures and explicitly install `undefined` when the setter is absent.
- `%Symbol.prototype%.valueOf`, `%Symbol.prototype%.toString`, and
  `%Symbol.prototype%.description` now join `%Symbol%.for`, `%Symbol%.keyFor`, and the fifteen
  well-known symbols in generated publication. The support manifest therefore claims exactly 20
  migrated properties. Their algorithms remain in `lib/symbol/core.jsl`; the manifest owns
  publication identity and descriptors.
- The frontend now preserves general semantic owner kinds for callable values and Property
  Descriptor objects, including through local variables and call results. Their observable
  properties use JSL property semantics and cannot be redirected to an unrelated compatible
  shaped field. Focused native differentials prove function name/length metadata, method and
  accessor attributes, getter name/length, absent setter behavior, and a decoy ordinary
  `{set: 123}` object.
- The absent-setter witness exposed a fundamental GVN defect: `PropLoadKey` and `PropStoreKey`
  omitted their property-component operation number from `op-encode-payload`, allowing an
  otherwise identical `.get` and `.set` load (or two descriptor stores) to merge. The operation is
  now part of node identity, with a low-level regression proving equal operations deduplicate while
  different component operations remain distinct. No Symbol- or accessor-specific optimizer path
  was added.
- Subsequent isolation disproved the prior shaped-field diagnosis for the frontier disagreement.
  Callable property reads passed independently, and regenerating the frontier after the GVN fix
  proved that the complete combined logical-OR interaction now agrees with Node too. Its exact
  source is retained in `tests/native-execution-test.coil`; the open repro and frontier registration
  were removed only after that permanent differential was in place. The frontier therefore returns
  to the sole genuine `for await` refusal. The older entry immediately below is superseded on both
  diagnosis and current status. Ledger generation and its gate are green. The regenerated frontier
  report is current and `coil test --suite frontier` is intentionally red at exactly 0/1 for the
  named `for await` refusal. The bounded `coil test` gate is green at 80/80; its immutable seed
  retained/restored 122 records and completed the native execution witness after roughly 537
  seconds of seed compilation.

# 2026-08-28: generated intrinsic publication now includes callable method roots

- The intrinsic property schema now supports validated `method` descriptors in addition to
  well-known-symbol values. A method descriptor names its constructor/prototype target, callable,
  independently demand-loadable root, observable function name and length, and exact writable,
  enumerable, and configurable attributes.
- `%Symbol%.for` and `%Symbol%.keyFor` are the first migrated methods. Generated
  `SymbolForValue`/`SymbolKeyForValue` roots create stable closures, install their function
  metadata and `5` (`writable`, non-enumerable, configurable) property mask, and provide generated
  frontend routing. `SymbolConstructorValue` composes those roots; its duplicated handwritten
  method installation is gone. The support report now counts 17 deliberately migrated properties.
- Generator validation is 9/9 green, the exact 486-declaration whole-library load/lower witness is
  green, and independent native differentials agree with Node for Symbol registry identity and
  method/function descriptor metadata. The provenance/coverage chain and
  `npm run spec:ledger:gate` are green.
- A combined witness initially appeared to expose shaped-field contamination of callable
  properties. The newer entry above records the isolating evidence and corrected diagnosis:
  callable and Property Descriptor semantic boundaries are independently green, while the retained
  combined failure belongs to logical-OR control flow.
- Post-tranche `coil test` is green at 80/80. The immutable seed retained/restored 119 callable
  records, completed its native witness, and spent about 491 seconds in scheduling. The required
  frontier was intentionally red at exactly 0/2: the then-misdiagnosed combined disagreement
  (`ours=104`, Node=`7`) and the existing named `for await` refusal. The newer entry supersedes its
  bug name and diagnosis.

# 2026-08-28: the first intrinsic property family is generated end to end

- `%Symbol%`'s fifteen standard well-known-symbol data properties now live in
  `spec/intrinsics.json`, including description, implementation root, and exact writable,
  enumerable, and configurable attributes. The support report counts exactly those fifteen—not an
  inferred or aspirational property surface.
- The generator now emits `lib/generated/intrinsic-publication.jsl`. Each property gets one
  independently demand-loadable builtin that obtains the stable root and installs its descriptor
  attributes. It also emits frontend `(intrinsic, property) -> JSL root` routing, replacing the
  handwritten `Symbol.replace` and `Symbol.toPrimitive` cases and covering all fifteen entries.
- `SymbolConstructorValue` composes the same generated roots, so whole-constructor and focused
  publication share identity instead of maintaining two implementations. ArrayBuffer and
  TypedArray continue to request only the roots they need.
- Generator/schema tests cover duplicate keys, complete attributes, deterministic generated JSL,
  generated routing, and exact support counts. The 484-declaration whole-library lowering witness
  is green. Focused native tests prove repeated root identity, distinct roots, exact `species`
  descriptor attributes, ArrayBuffer caught RangeErrors, and TypedArray backing-buffer accessors.
- The regenerated provenance/coverage chain and `npm run spec:ledger:gate` are green. The bounded
  gate after this value-property slice was green at 80/80; its frontier was exactly the one
  `for-await-has-no-bridge-kind.js` refusal. The newer method tranche above supersedes that evidence.

# 2026-08-28: declarative intrinsic lowering begins at Torque-style root granularity

- `spec/intrinsics.json` now owns the exact 25 currently published global identities plus one
  lowering record for each: lowering family, runtime constructor kind, callability, and
  constructability. `tools/intrinsic-manifest.mjs` validates the one-to-one relation and generates
  the compiler constants/queries and `spec/generated/intrinsic-support.json` deterministically.
- Error subclasses no longer collapse to the `%Error%` frontend symbol. `%Error%`, `%EvalError%`,
  `%RangeError%`, `%ReferenceError%`, `%SyntaxError%`, `%TypeError%`, and `%URIError%` have distinct
  generated identities and runtime kinds while selecting one generated `error` lowering family.
  Error construction no longer derives kind from AST spelling.
- ArrayBuffer's invalid-length regression initially looked like an exception-routing failure. A
  focused direct-catch witness and runtime transport tracing proved the throw had not occurred:
  ArrayBuffer publication invoked the entire `SymbolConstructorValue` merely to obtain
  `Symbol.species` and `Symbol.toStringTag`, and that unrelated initializer reached a missing
  Symbol internal-slot read. ArrayBuffer and TypedArray now request independent
  `SymbolSpeciesValue` and `SymbolToStringTagValue` roots. This is the Torque-style root-table
  boundary, not an ArrayBuffer exception workaround.
- The original loop/catch/`instanceof RangeError` regression, an exception-routing-only variant,
  a single invalid-length catch, Error identity, and TypedArray backing-buffer publication all
  compile, execute natively, and agree with Node. The focused ArrayBuffer graph fell from roughly
  157k nodes/31 functions to 73k nodes/26 functions because unrelated `%Symbol%` publication is no
  longer in its dependency closure.
- Runtime fatal diagnostics now distinguish frozen mutation, missing internal-slot access, and
  invalid direct array-length mutation. This made the actual failing primitive observable without
  changing exception behavior.
- `npm run spec:ledger:gate` is green after deterministic provenance/coverage regeneration.
  `coil test` is green at 80/80; the immutable seed retained/restored 104 records and executed its
  native witness. `coil test --suite frontier` remains intentionally red for exactly
  `for-await-has-no-bridge-kind.js`.
- The manifest still deliberately claims zero published properties. Static/prototype property
  descriptors, well-known-symbol entries, callable adapters, and the rest of the standard
  intrinsic inventory are the next Phase 3 work; this tranche does not claim that exit gate.

# 2026-08-28: the full Torque-style model clears the bounded exit gate

- Throwing calls now use the full Torque-style outcome model already specified in
  `docs/TORQUE-STYLE-LOWERED-VALUES.md`: unconditional raw ABI snapshots, explicit normal and
  exceptional continuations, and logical result materialization restricted to the normal edge.
  PropertyDescriptor Records remain typed and flattened across the 28-slot internal call.
- Global code motion now resolves earliest placement recursively from actual producers rather
  than repeatedly rescanning the whole machine unit. Pure boxed-value tagging is movable, string
  constants are anchored in their function entry block, and sibling inputs may meet only at a
  selected block that both definitions dominate.
- The focused native regression
  `configurable_data_property_can_become_an_accessor_after_a_wide_throwing_descriptor_call`
  compiles 190,956 machine instructions across 21 functions, links a 5 MB Mach-O image, executes
  `main(7)`, and agrees with Node at 9. This is the previously blocked descriptor-kind transition,
  not a reduced mock operation.
- That witness exposed a general AArch64 size-model mismatch. Polymorphic-call sizing counted two
  fixed words that emission does not produce, while ABI parallel-move sizing counted register and
  scratch no-ops that emission omits. The sizing functions now mirror the shared emitter exactly;
  no descriptor-specific encoder path was added.
- The seed's dead Loop backedge was a lowering ownership bug, not an optimizer repair problem.
  `recur` parked its values and memory with explicit pins but left its control only in a Coil-side
  array; scope collection could therefore delete a normal CProj before the Loop acquired it as a
  backedge. Parked control now owns the matching pin, `n-add-def!` and `n-set-def!` reject dead
  definitions at the mutation boundary, and
  `a_recur_parks_its_normal_control_until_the_loop_closes` is the focused regression.
- Controlled call projections now remain the ideal identity of `MI-RESULT-MATERIALIZE`, whose GCM
  anchor is the projection's proven-normal continuation. Raw `MI-CALL-RESULT` captures remain
  unconditional beside the call. Structural projection shape—not fallible direct-target
  inference—prevents indirect throwing calls from also publishing an unchecked materialization.
- The newly reachable whole-library path exposed two independent backend invariants. Call-bundle
  release ordering now excludes prologue instructions, avoiding the real cycle
  `Parm -> call -> capture -> Parm`; and float Unbox elision now requires a physically raw numeric
  representation, not merely a graph type whose consumers happen to be floating point.
- The reusable JSL seed compiles, selects, schedules, allocates, encodes, serializes, restores in a
  clean compiler process, and executes its native witness. The small throwing multi-result witness
  is green. `coil test` is green at 79/79. `coil test --suite frontier` remains intentionally red
  for exactly `for-await-has-no-bridge-kind.js`.
- The whole-library seed currently spends about 533 seconds in scheduling and about 33 seconds in
  allocation on this machine. That is acceptable as an exit witness but reinforces the plan's
  focused-test ladder: per-operation work must use bounded graph/selection/native witnesses rather
  than recompiling the entire immutable library.

# 2026-08-28: Stage 7 groundwork makes effects and conversions signature-owned

- `JslSignature` now owns the declaration's effect facts (`transitioning`, `cold`, heap use,
  callback use, and `canthrow`) beside its logical and physical type vectors. Library identity
  hashes all five facts. The outcome ABI can therefore be derived from retained compatibility
  metadata rather than body scans or poison-tuple recognition.
- Ideal Fun ABI metadata now carries an explicit `canthrow` bit. JSL function opening publishes it,
  and focused node/JSL tests pin both the default non-throwing contract and a transitive throwing
  Record-returning builtin.
- Canonical value conversion is enforced at internal calls as well as Record construction. Exact
  Record schema matches pass their already-normalized leaves unchanged; scalar `dyn -> dyn` also
  remains unchanged. Only a raw logical scalar crossing into `dyn` is boxed. A graph assertion
  pins that a flattened dyn Parm does not become `Box(Parm dyn)`.
- `ValidateAndApplyPropertyDescriptor` still reaches the intended throw and currently loses it at
  the pending-outcome/catch boundary. Stage 7 remains open: the new effect bit must next propagate
  through retained function artifacts and machine call bundles, then drive normal-edge-only result
  materialization.

# 2026-08-28: full Torque-style ABI ownership fixes value transport; Stage 7 remains explicit

- Machine IR now retains one declaration-authoritative class beside every call argument. The
  source vreg still determines how its bits are snapshotted, but the callee's lowered signature
  determines the GPR/FPR ordinal and overflow location. Representation refinement can therefore
  never rewrite a declared calling convention.
- Both AArch64 and x86-64 consume that retained class vector. The selector verifies the argument
  and class tables have identical extent. A native regression starts with a double in an FPR,
  passes its exact bits through a declared GPR parameter, and observes them unchanged.
- Canonical Record construction is now source- and destination-aware. A raw scalar leaf entering a
  `dyn` field is boxed once; an already-`dyn` parameter is already tagged and remains unchanged.
  The former unconditional rule produced `Box(Parm dyn)` and replaced PropertyDescriptor values
  with `undefined` at runtime.
- `ValidateAndApplyPropertyDescriptor` now stores the requested fixed value and raises the intended
  TypeError for its illegal redefinition. That throw currently escapes rather than reaching the
  source catch, independently confirming the remaining Stage 7 requirement: model normal and
  exceptional call outcomes explicitly and materialize normal result projections only on the
  normal edge.
- Focused Record and cross-class ABI witnesses pass. Bounded gate: 78/78. Frontier remains the
  exact intentional failure `for-await-has-no-bridge-kind.js`.

# 2026-08-28: Stage 7 defines abrupt wide-call invariants and exposes the missing outcome split

- `ValidateAndApplyPropertyDescriptor` is now a called internal builtin instead of a macro. Its
  28 physical arguments are the canonical flattening of three scalar inputs, one 12-leaf
  `PropertyDescriptor`, and one 13-leaf `MaybePropertyDescriptor`; no runtime descriptor Object or
  macro-only workaround crosses the boundary.
- This turns the previous four mapped Test262 timeouts into bounded compiler/runtime evidence. The
  first compiler defect was a stale verifier cap: selector construction supports 32 call arguments
  while `ms-call-args-valid?` rejected more than 16. `M-CALL-MAX-ARGS` now names the shared limit,
  and a direct 28-argument selection/verifier witness pins it.
- Exception jump targets now declare captured-cell memory before lowering their bodies. The focused
  regression proves a caught throw preserves `n` for a closure created afterward; previously
  `main(7)` returned 2 instead of 9. The phi-copy verifier also validates availability at the
  source terminator rather than the half-open block end, which belongs to an unrelated block.
- Every Return from a multi-result builtin now conforms to its canonical physical signature.
  Exceptional pending-flag Returns carry the marker in slot zero and representation-correct poison
  in the remaining slots; a focused two-result test pins the exact arity and graph verification.
- The complete descriptor witness now builds, selects, allocates, encodes, and links. Its remaining
  runtime failure is narrower and architectural: normal-result capture still executes immediately
  after an abrupt wide call, before the caller branches on pending status, and can clobber state
  live only on the catch edge. Stage 7 therefore requires an explicit normal/exceptional call
  outcome in the machine model, with wide result materialization owned by the normal edge.
- A separate raw AArch64 forward-call encoding issue was exposed by an exploratory native micro-
  witness, recorded in the project pad, and deliberately not coupled to this change. Exploratory
  encoder edits were reverted.
- Bounded gate: 78/78. Frontier remains intentionally red for exactly
  `for-await-has-no-bridge-kind.js`.

# 2026-08-28: Stage 6 closes on one retained canonical signature

- `JslDecl` no longer stores parallel parameter-count, lowered-count, return-type, and Record-return
  fields. It owns one `JslSignature` containing the logical source signature and exact offsets into
  retained physical parameter and result type vectors.
- Every existing declaration accessor is now a view over that object. Function ABI opening reads
  the flat retained parameter vector directly; calls and function entry validate the signature;
  result capture and Return lowering consume its retained result vector. Immutable library identity
  fingerprints both physical vectors.
- `jsl-signature-valid?` proves logical parameter ranges, physical offsets and widths, Record leaf
  types, result shape, and vector bounds agree. The focused ABI witness deliberately damages the
  physical arity, observes rejection, restores it, and then completes normal lowering.
- Together with generic branch/loop transport, this removes the provisional Record-only lowering
  paths required by Stage 6. Scalar public frontend APIs remain explicit checked adapters, not an
  alternate JSL value model. Bounded gate: 78/78. Frontier remains intentionally red for exactly
  `for-await-has-no-bridge-kind.js`.

# 2026-08-28: control flow now transports lowered values generically

- Branch joins now validate and transport `JslLoweredValue` descriptors as physical slot ranges.
  The old Record join recursion and the separate Record-List/scalar reconstruction branches are
  deleted. One generic join emits one Phi per descriptor slot and reconstructs the result from its
  prototype descriptor.
- Loop headers obtain aggregate Phi types through the same checked slot-type query, and loop
  bindings reconstruct scalar, Record, and Record-List values through one
  `jl-lowered-from-slots-like!` operation. Concrete-kind knowledge remains only at legitimate
  construction, field-access, and storage-materialization boundaries.
- Focused control-flow witnesses: 5/5. Bounded gate: 78/78. Frontier remains intentionally red for
  exactly `for-await-has-no-bridge-kind.js`.

# 2026-08-28: Stage 5 closes with an executed abrupt multi-result caller

- A runtime-linked native witness now executes the exceptional half of a two-result internal call.
  The callee raises boxed `40`, returns through descriptor 104, and the caller checks descriptor
  101 before consuming normal projections, takes and clears the thrown value through descriptor
  102, and returns 42.
- The same compiled image is re-entered on its normal path and consumes `[40, 2]` to return 42,
  proving that the pending exception was cleared and that both outcomes share one exact lowered
  signature and machine call bundle.
- Focused multi-result transport: 4/4; backend object: 26/26; native GC: 9/9. Stage 5 of the
  accepted fully Torque-style design is complete; Stage 6 now owns removal of the remaining
  Record-specific and numeric-handle lowering paths.
- Stage 6 has started at the public inline seam. `jsl-inline-lowered!` now accepts and returns
  `JslLoweredValue` descriptors, validates Record schema identity, and preserves every result leaf
  across scope teardown. The old `jsl-inline!` is only a checked scalar frontend adapter.
- A focused witness passes a two-leaf Record through `ReplaceRight`, consumes the returned Record,
  and verifies zero `New` nodes. Bounded gate: 77/77. Frontier remains intentionally red with
  exactly `for-await-has-no-bridge-kind.js`.
- The internal call seam now returns `JslLoweredCall`, pairing the effect/control `CallSite` with
  its canonical `JslLoweredValue`. Record projections are constructed exactly once inside the
  call boundary; `jl-builtin-call` no longer re-reads return metadata and reconstructs them.
  `jsl-call-lowered-with-memory!` remains a checked site-only adapter for graph clients.
- A second public-boundary witness calls `MakePair`, receives one exact two-slot Record descriptor,
  consumes both leaves, and proves two projections with zero allocation. Bounded gate: 78/78;
  frontier is unchanged and honest.
- Function entry and return now use the same convention. `jl-lowered-parameter!` reconstructs
  scalar or nested-Record parameters from the declaration's canonical slot range; one indexed
  lowered-result API drives function ABI opening, call capture, result validation, and Return
  flattening. The old scalar-vs-Record return construction branch is deleted.
- Successful lowering must now match that exact declared result descriptor. A separately recorded
  lowering diagnostic is intentionally not relabelled corruption; the bounded negative loop test
  caught and pinned that distinction. Bounded gate remains 78/78, with the exact one-bug frontier.

# 2026-08-28: first-class call bundles and native memory-channel transport

- `MCallBundle` now owns each call's instruction, anchor, exact capture range, outgoing-frame
  release boundary, logical result count, and result-area size. Selection constructs and verifies
  the table, scheduling rebuilds it after repacking, and every call/capture instruction has one
  reverse-mapped bundle owner.
- Scheduling, post-allocation parallel-copy construction, and both target encoders consume bundle
  boundaries instead of rediscovering multi-result groups by adjacent opcodes.
- Seeded function layout is also an instruction-publication boundary: it now rebuilds and verifies
  bundle indices after reordering function text. The three-function multi-seed object witness
  catches stale descriptor maps before allocation or encoding can consume them.
- A real native memory witness calls a two-result function which stores `1` through a caller-owned
  object address, returns `[39, 2]` plus memory, and requires a post-call load to produce 42. A
  throwing two-result target also retains one descriptor-104 exceptional Return while its normal
  path executes natively to 42. Actual native execution of the abrupt path remains open.
- Backend object: 26/26; native GC: 9/9; focused native multi-result/memory/throwing-normal:
  3/3; bounded gate: 76/76. Frontier remains intentionally red with exactly
  `for-await-has-no-bridge-kind.js`.
- One separate open harness gap is recorded in the project pad: the raw mmap branch-call witness
  cannot resolve the correctly selected `ValueTruthy` external runtime operation. It must gain the
  real runtime-symbol linking contract; truthiness normalization and test assertions must remain.

# 2026-08-28: caller-owned overflow results execute and are typed GC roots

- Both AArch64 and x86-64 now implement the wide-result ABI from the accepted Torque-style design:
  the caller owns an aligned overflow area, passes an explicit hidden pointer, retains the outgoing
  frame through result capture, and the callee stores overflow leaves through its saved pointer.
- Stackmap version 5 adds typed indirect result-area roots. Direct Mach-O publication and retained
  function-text linking derive the same roots, serialize them per call site, and independently
  verify them; the runtime relocator follows the caller's stable pointer slot to each result word.
- A ten-result witness returns eight register values plus two boxed overflow values, checks both
  typed roots in both metadata paths, encodes on x86-64, and executes natively to 42. The object
  witness also removed a scalar-assumption leak: multi-result internal functions now have an
  explicit non-JavaScript-dispatch code instead of being queried for one scalar return type.
- Focused backend-object: 26/26; native GC: 9/9; bounded gate: 76/76. Frontier remains
  intentionally red with exactly `for-await-has-no-bridge-kind.js`.

# 2026-08-28: one post-allocation parallel-copy phase owns multi-result transport

- Multi-result captures and returns now become typed post-allocation moves among fixed registers,
  allocated registers, spill slots, and a class-compatible reserved scratch location. One
  target-independent resolver removes identities, emits acyclic leaves, and breaks cycles.
- Per-instruction resolved ranges are verified independently for exact owner/instruction identity,
  bounds, matching register class, and valid register/spill/scratch locations. AArch64's exact word
  model and both AArch64/x86-64 encoders consume the resolved table rather than implementing their
  own slot loops.
- Result-specific allocator exclusion masks are deleted. Unrestricted coloring makes the native
  `Pair<int, int>` witness exercise a real raw-result cycle; the test requires a temporary scratch
  move and the generated native code still returns 42.
- The 101-function retained JSL clean-process witness remains green. Bounded gate: 76/76.
  Frontier: intentionally red with exactly `for-await-has-no-bridge-kind.js`.

# 2026-08-28: result locations are class-indexed and artifact-exact

- Machine result location derivation no longer treats logical result slot number as a register
  number. Mixed vectors allocate GPR and FPR ordinals independently; the focused
  `[int, float, bool, float]` witness proves `[x0, d0, x1, d1]`.
- The canonical API now distinguishes bounded `Register` locations from aligned `ResultArea`
  locations. A 20-leaf signature uses eight registers in each class and assigns its four overflow
  leaves offsets 0, 8, 16, and 24 in one 32-byte caller-owned area.
- Artifact format version 5 retains result register classes beside machine value kinds for every
  function and relocation target. Save/load, truncation, compaction, ABI compatibility, and
  dependency closure preserve and compare both vectors. A same-kind GPR/FPR mismatch is now an
  explicit ABI mismatch.
- The complete backend-object suite is green at 26/26, and the 101-function retained JSL artifact
  passes clean-process compilation and native execution with the new metadata.
- Bounded gate: 76/76. Frontier: intentionally red with exactly
  `for-await-has-no-bridge-kind.js`.

# 2026-08-28: native two-result transport works; the full result-location cutover is specified

- A real JSL `MakePair` builtin returning `Pair<int, int>` now lowers to one generic machine call
  plus two ordered `MI-CALL-RESULT` captures. A host-native caller consumes both projections and
  returns 42. This is the first executable proof that compile-away JSL Records cross an internal
  call boundary without allocation.
- Calls and their raw-result captures are structurally indivisible in scheduling, and the
  independent verifier checks exact anchor and slot order. Allocation prevents the temporary
  sequential result moves from destroying another raw result; the retained 101-function JSL seed
  artifact passes selection, scheduling, allocation, encoding, reload, and native execution.
- The earlier retained-library crash was not evidence against result bundles. `MI-CALL-RESULT` had
  been inserted on the wrong side of the descriptor case chain, accidentally giving ordinary
  `MI-ABI-COPY` an effect. That produced a real call/effect scheduling cycle. The descriptors are
  corrected and pinned by focused assertions. Sparse abandoned vreg ids are also handled without
  asking for an owner at `-1`.
- `docs/TORQUE-STYLE-LOWERED-VALUES.md` specifies the accepted full model: canonical per-target
  result-location vectors, class-indexed registers, caller-owned overflow result areas with an
  explicit hidden pointer, first-class call bundles, typed GC roots, and one shared parallel-copy
  resolver. The current allocator masks and encoder loops are explicitly temporary and have a
  named deletion stage.
- Focused JSL shape, host-native multi-result, and retained-artifact witnesses pass. Bounded gate:
  76/76. Frontier: intentionally red with exactly `for-await-has-no-bridge-kind.js`.

# 2026-08-28: Stage 4 result vectors now survive retained artifacts and exact dependency checks

- Retained machine-function metadata no longer collapses a function ABI or a call relocation to
  one return kind. Both now own canonical flattened `first/count/kinds` result vectors, including
  zero, one, and multiple results.
- Snapshotting, suffix truncation, stable cache compaction, artifact version 4 save/load, cache
  identity lookup, dependency-closure filtering, and final relocation compatibility all preserve
  and compare every indexed result kind. Scalar return-kind accessors remain checked one-result
  compatibility shims and reject multi-result records.
- `retained_artifact_round_trips_indexed_multi_result_abi_metadata` upgrades an ordinary retained
  record and its caller relocation to `[scalar, boxed]`, saves it, reloads it in a cleared store,
  and proves both exact vectors survived. This is a bounded metadata witness; Stage 5 still owns
  actual machine production and transport of both values.
- Function indices are now single-owner by construction. A second `n-fun-open-identity!` for an
  occupied index is a named corruption instead of silently replacing the first function's
  identity/ABI metadata; the two retained-JSL tests now use distinct callable indices for their
  distinct functions.
- Bounded gate: 74/74. Frontier: intentionally red only for
  `for-await-has-no-bridge-kind.js`. Stage 4 remains open only for explicit memory/abrupt-channel
  witnesses and the native return-consumption exit witness, whose transport belongs to Stage 5.

# 2026-08-28: Stage 4 establishes ideal multi-result calls and JSL Record returns

- Function ABI metadata no longer has a scalar return cell. Every Fun retains a canonical result
  range (`first/count/types`); the scalar declaration API is exactly a one-element vector wrapper,
  and indexed access is mandatory for multi-result signatures.
- A declared multi-result `Call` computes a tuple in ordinary analysis, `call-result` creates typed
  `Proj` consumers, and `n-return-values!` emits `[control, results..., optional-memory]`. The
  verifier derives the result range from the owning Fun, checks every value slot and the separate
  trailing memory channel, and accepts Call projections only within the declared result count.
- Internal JSL builtins may now return Specification Records. Function opening uses the cached
  Record leaf vector as its result signature, declaration lowering returns the physical leaf range,
  and internal calls reconstruct one `JslLoweredValue` from generic call projections. JavaScript
  callable linkage still rejects Record parameters and results.
- `internal_builtin_record_results_use_the_generic_multi_result_call_model` proves a nested Record
  return with two exact `int` result types, two generic `Proj` nodes, zero `New` nodes, and a clean
  verifier result. Node tests prove raw two-result Return/Call behavior. Focused suites: node 33/33,
  JSL 61/61. Bounded gate: 74/74. Frontier: only the intentional `for-await` refusal.
- Stage 4 remains open pending explicit memory/abrupt-channel witnesses. Serialization/import now
  preserves exact result vectors; Stage 5 backend result locations and native transport have not
  begun.
- Tooling note: `coil balance --write` placed a missing closer immediately after `(block :call)`,
  creating an empty block instead of closing its indented body. The exact reproducer is filed in
  the `coil-bugs` pad; the source was repaired manually at the correct function boundary.

# 2026-08-28: Stage 3 completes canonical lowered signatures

- Every checked `JslParam` now retains its canonical `lowered-off` and `lowered-width`, and every
  declaration separately retains logical source arity and total physical ABI arity. Nested Record
  layout is therefore computed once rather than independently at function opening, entry binding,
  and internal call sites.
- Function ABI opening, declaration-entry Record reconstruction, and direct internal builtin calls
  consume those ranges and their exact lowered types. Calls validate the argument's logical Record
  identity, physical width, and expected starting offset before emitting any ABI slots.
- Immutable library identity fingerprints the complete lowered signature. The source-facing
  `jsl-call-with-memory!` boundary now explicitly rejects Record parameters because its input is one
  graph node per JavaScript argument; it can no longer silently confuse logical and physical arity.
- The focused nested-Record-plus-scalar witness proves logical arity 2, physical arity 3, ranges
  `[0,2)` and `[2,3)`, exact leaf types, matching Fun ABI metadata, and zero `New` nodes. The JSL
  suite is green at 60/60; `coil test` is green at 73/73; the frontier remains intentionally red
  only for `for-await-has-no-bridge-kind.js`.
- `jsl-call-lowered-with-memory!` is now the one explicit logical-value call boundary. It validates
  logical arity, consumes the retained ranges, checks physical arity, and emits the call. Both
  syntax-driven JSL calls and the scalar source-facing adapter route through it; the latter rejects
  Records by name instead of pretending one graph node can carry an aggregate.
- The focused graph witness invokes that API directly and passes selection. A host-native witness
  passes `(Pair<int,int>, int)` as three ABI words to a real JSL builtin and executes the answer
  `(20 + 1) * 2 = 42`; two machine functions are present and no Record object is materialized.
- Stage 3's graph, selector, and native exit condition is complete. Stage 4 is now the active work:
  result vectors, normal Return ranges, and call-result projections.

# 2026-08-28: Stage 2 completes the explicit lowered-value cutover

- `jl-expr-lowered` is now the only JSL expression result model. Bindings, Record operations,
  typed Record Lists, branch joins, loops/recur, macro expansion/`otherwise`, declaration entry,
  and internal-call arguments carry `JslLoweredValue` directly.
- The numeric descriptor arena and every negative-handle, parity, node-or-aggregate, and temporary
  adapter helper are deleted. Node ids reach graph builders only through checked scalar or physical
  slot projection. Ordinary node keep/unkeep/collection no longer has aggregate dispatch.
- Loop lowering stores logical kind/schema plus physical width per binding, reconstructs scalar,
  Record, and Record-list values from its Phi vector, and parks recur arguments as physical slots.
  Fixed 16-value temporary arrays were replaced with dynamically sized owned vectors.
- The checker had the same missing dimension: loop scope and recur metadata retained Record schema
  but discarded Record-list schema. It now carries both, accepts a loop-carried typed capability,
  and rejects a recur that changes its element schema with `JSL-ERR-BAD-RECORD-LIST`.
- `loop_carried_record_lists_preserve_their_typed_capability` proves one carrier Phi, one explicit
  materialization, one store, and one load. The focused JSL suite is green at 60/60.
- The first bounded gate exposed an ownership-transfer bug the focused shape tests could not:
  unused macro arguments retained their outer temporary pin after the macro binding disappeared,
  leaving 2,353 unreachable nodes in the immutable-library graph. Macro cleanup now protects the
  result, releases each argument's final owner, and collects only arguments with no graph users.
  The seed-artifact witness retains and reloads all 101 verified library functions.
- Final gates: `coil test` is green at 73/73. `coil test --suite frontier` remains intentionally
  red with exactly `for-await-has-no-bridge-kind.js`.

# 2026-08-28: expressions and branch joins begin carrying lowered values end-to-end

- `jl-expr-lowered` now carries explicit descriptors through literals, lookup, sequential `let`,
  Record construction/get/with, Record-list materialization, primitive operands, JavaScript call
  operands, and both dynamic branch arms.
- Record construction and reconstruction consume `JslLoweredValue` fields or canonical physical
  leaves directly. Typed Record-list store/load validate descriptor kinds and schemas and move the
  Record's physical range without recreating logical field trees.
- `jl-lowered-value-join` validates kind/schema compatibility and builds one Phi per cached
  physical leaf. Nested Records no longer use a recursive Record-specific join path; scalar and
  Record-list joins use the same logical dispatcher and checked projections.
- The focused JSL suite is green at 59/59 and the bounded gate is green at 72/72. The frontier is
  still exactly the intentional `for-await-has-no-bridge-kind.js` refusal. Remaining adapter sites
  are loops/recur, macro expansion/`otherwise`, and declaration/internal-call result boundaries.

# 2026-08-27: lexical bindings now retain explicit lowered values

- `JslBind` no longer stores an ambiguous integer. Every non-rest lexical binding retains a
  `JslLoweredValue` descriptor by value, so scalar and aggregate bindings have the same lifetime,
  slot-range, and ownership representation.
- `jl-lowered-scalar-node` is the checked scalar projection: it accepts exactly a scalar
  one-slot descriptor. Binding pin/unpin/collection and declaration cleanup walk complete physical
  ranges rather than branching on integer encodings.
- The focused lowered-value witness now checks scalar projection and verifies that an aggregate
  binding retains a three-slot Record descriptor. The JSL suite remains green at 59/59 and the
  bounded gate remains green at 72/72. The frontier is still exactly the intentional
  `for-await-has-no-bridge-kind.js` refusal.
- The remaining temporary integer adapter is confined to `jl-expr` and selected call/CFG helpers;
  migrating those is the next Stage 2 cut.

# 2026-08-27: Stage 2 begins with one logical-value and physical-slot arena

- Records and typed Record Lists now use one `JslLoweredValue` descriptor containing explicit
  kind, logical schema, and contiguous physical-slot range. The previous three side tables and the
  even/odd aggregate-handle encoding are deleted.
- Nested Record fields are cached-layout subrange views. Flattening copies the descriptor's leaf
  range directly, reconstruction creates a descriptor over the canonical leaf vector, and pinning
  and collection operate on physical slots rather than recursively rediscovering logical fields.
- `lowered_record_values_own_explicit_canonical_slot_ranges` directly verifies descriptor kinds,
  nested range widths, leaf identity, the typed Record-list carrier, and zero runtime allocation.
  The focused JSL suite is green at 59/59 and the bounded gate is green at 72/72. The frontier
  remains exactly the intentional `for-await-has-no-bridge-kind.js` refusal.
- This is deliberately recorded as partial Stage 2. `jl-expr` and `JslBind` still use a temporary
  integer descriptor-index adapter. Stage 2 completes only after they traffic in explicit values
  and graph builders accept scalars through a checked one-slot projection.

# 2026-08-27: the migration target is the full Torque-style value model

- The accepted end state is one uniform `LoweredValue` abstraction for scalar and aggregate JSL
  values. Tagged/parity-coded integer handles are migration debris, not an ABI or a supported
  alternate representation.
- Expression lowering, bindings, branch/loop joins, arguments, and returns will traffic in logical
  values backed by explicit physical slot ranges. Graph-node ids cross into graph builders only
  through a checked one-scalar-slot projection; divergence remains control state.
- Record Lists are explicit typed storage capabilities rather than odd integer handles. Any
  temporary scalar compatibility adapter is confined to the external frontend boundary and has a
  mandatory deletion point when ideal multi-result calls land.
- `docs/TORQUE-STYLE-LOWERED-VALUES.md` records these choices and the Stage 2 exit condition. This
  decision intentionally commits the later work to canonical lowered signatures and true
  multi-result calls/returns; stopping at Record-only flattening would not complete the design.

# 2026-08-27: Stage 1 caches canonical Record layouts and fingerprints their complete ABI

- Every checked Record schema now owns one cached recursive physical leaf-type vector. Each logical
  field retains a contiguous offset/width range into that vector, so function opening, calls,
  branches, loops, and materialization no longer rediscover width and leaf types through separate
  recursive walks.
- Empty schemas and layouts wider than 256 physical leaves fail as malformed Records before
  lowering. The focused witness pins scalar and nested field ranges/types and a recursively doubled
  excessive-width refusal.
- Immutable JSL library identity now includes ordered schema names/fields, nested schema identity,
  the complete cached physical vector, and Record-valued parameter and return annotations. A
  same-width field reorder therefore changes artifact identity; the focused test proves it.
- All 58 JSL tests, the recursive Phi-box test, the data-Phi Effect dependency test, and the native
  accessor witness are green. The bounded gate is green at 71/71. The frontier remains exactly one
  intentional `for-await-has-no-bridge-kind.js` refusal.

# 2026-08-27: graph-owned Phi boxing and data-Phi effect ordering restore native descriptors

- Standalone JSL seed compilation exposed `Box(Phi(undefined|bool))`. A raw union has lost the
  discriminator needed to select one JavaScript tag; the existing correct repair boxed each Phi
  edge, but lived in the JavaScript frontend and stopped at the graph's original node count.
  `g-distribute-deferred-phi-boxes!` now belongs to `node.coil`, follows newly created nested Phi
  boxes to a fixed graph frontier, and is called by both JSL-library and frontend finalization.
- The native accessor witness then exposed a separate `MSEL-DEPENDENCY`: an `Effect` carried a
  data Phi as its observable ordering value. Selection had already assigned a valid dominating
  vreg, but `ms-memory-node-before?`'s Phi arm accepted only memory Phis and rejected the data Phi
  before the ordinary value rule. Memory Phis now use CFG validation; data Phis use the selected
  dependency/dominance check.
- Focused tests retain recursive mixed-raw Phi boxing and a selected property read whose Effect
  dependency is a data Phi. The immutable complete-library seed artifact compiles, saves, reloads,
  links, and executes. `object_literal_accessors_use_descriptor_semantics` now compiles and runs
  natively. The bounded gate is green at 70/70; the frontier remains exactly the intentional
  `for-await-has-no-bridge-kind.js` refusal.
- Selection failure output now prints the failed machine instruction, every call argument and its
  producer validity, memory-dependency status, and the corresponding ideal-node inputs instead of
  dumping an unusably large whole graph. This diagnostic directly identified both invariants.

# 2026-08-27: full Torque-style lowered-value architecture is the accepted Record model

- `docs/TORQUE-STYLE-LOWERED-VALUES.md` now defines one compiler-wide recursive lowering from a
  logical scalar/Record type to ordered physical slots. It covers explicit compiler values,
  cached field layouts, lowered signature identity, internal parameters, true multi-result calls
  and returns, branch/loop joins, effects, GC leaves, dynamic Record-list materialization, and
  ideal/machine verification. This replaces further growth of Record-specific ABI exceptions.
- The implementation plan has eight independently gated stages. It begins by diagnosing the
  existing Property Descriptor native ownership failure, then centralizes layouts and compiler
  values, introduces lowered signatures and multi-result ideal/backend ABIs, removes provisional
  JSL paths, and only then completes the descriptor vertical slice and migrates other ECMA-262
  Record families.
- The design explicitly forbids the tempting shortcuts: no hidden descriptor Objects, automatic
  boxing, forced macro expansion, verifier weakening, or JavaScript-visible specification
  Records. Runtime-length Lists remain explicit typed materialization boundaries.
- `docs/JSL.md`, `docs/ECMA262-JSL-COMPLETION-PLAN.md`, and the README now point to the accepted
  architecture and accurately distinguish the implemented parameter-only bridge from the planned
  internal Record-return ABI.
- Documentation validation and all 57 focused JSL tests are green inside the bounded run, but the
  bounded gate is not green: 69/70 passed. Seed-artifact creation reaches selection and refuses
  `Box : undefined|bool` at node 68982 (`MSEL-UNSUPPORTED`). This is pre-existing in the active
  descriptor migration and must be handled by the staged architecture/diagnosis, not hidden by the
  documentation change. The frontier remains exactly one intentional failure,
  `for-await-has-no-bridge-kind.js`.

# 2026-08-27: specification Records have a checked compile-away SSA representation

- JSL now declares named schemas with `(record Name [(field type) ...])` and admits record types
  only on macro parameters and returns. Named construction, access, and immutable update are
  `(record-new ...)`, `(record-get ...)`, and `(record-with ...)`; missing, duplicate, unknown, and
  ABI-escaping records fail with stable diagnostics before lowering.
- Records are compiler-only bundles, encoded in the JSL lowerer's side table. They recursively own
  the pins of their ordinary SSA fields and never introduce a record opcode, heap object, object
  shape, or backend case. A dynamic branch over equal schemas emits one ordinary typed Phi per
  differing field. The focused witness forces both fields to differ and proves exactly two Phis and
  zero `New` nodes.
- Loop bindings flatten Records into one header Phi per scalar leaf, validate every `recur` against
  the binding schema, and reconstruct only compiler-side handles. Nested Records recursively
  flatten through both diamonds and loops; the focused nested witness proves a three-leaf outer/
  inner structure produces exactly three Phis and no allocation.
- Runtime callable/JavaScript boundaries reject these bundles instead of guessing a materialized
  representation. The bounded gate is green at 67/67 and the focused JSL suite is green at 54/54.
- This does not complete Phase 4. Auditing Property Descriptor migration exposed a real controlled-
  materialization dependency: `DefineProperties` must retain normalized descriptors across a
  dynamic List before mutating its target. Nested Records now support the required Maybe/Completion
  structure, but explicit runtime List materialization and the descriptor migration remain.

# 2026-08-27: radix-10 Number strings use shortest round-tripping binary64 digits

- The unchanged `shortest-round-trip-digits.js` frontier program now compiles, executes, and agrees
  with Node: `String(1 / 3)` is `"0.3333333333333333"`, not the 17-significant-digit noise emitted
  by `%.17g`. It was moved into permanent native coverage before the repro and failing frontier test
  were removed.
- `aot_js_shortest_double` searches the complete binary64 round-trip bound from 1 through 17
  significant digits. Each correctly rounded decimal candidate is parsed and compared by exact
  IEEE-754 bits; the first match is therefore minimal-k. The candidate is normalized to the spec's
  `(s, n, k)` representation and rendered using ECMAScript's fixed interval `-5 <= n <= 21`, rather
  than C `%g`'s incompatible presentation threshold.
- The focused native matrix pins `1/3`, `0.1 + 0.2`, both fixed/scientific boundaries, minimum
  subnormal, both sides of the normal boundary, maximum finite, signed zero, and negative
  recursion. The directly affected `CanonicalNumericIndexString` graph and native workbench also
  verify and agree with Node.
- This behavioral closure is not overstated as completion of the canonical JSL operation. The
  generated ledger still classifies `Number::toString` as blocked on the JSL internal-method
  protocol because the present representation primitive owns more formatting policy than the final
  architecture permits. `CanonicalNumericIndexString` remains honestly partial for unrepresented
  BigInt and integer-indexed exotic families, but no longer cites a fixed digit-formatting gap.
- Generated reports now contain 96 native witnesses and one honest frontier refusal (`for await`),
  down from two open bugs.

# 2026-08-27: observable coercion effects survive scheduling into later JSL calls

- The unchanged `String.prototype.startsWith` object-position frontier program now compiles,
  executes natively, and answers 7 for `main(7)`, matching Node. It is pinned as
  `object_position_coercion_is_scheduled_before_string_starts_with` before the open repro and its
  failing frontier case were removed.
- The reported call-target mismatch was downstream noise: target discovery, direct-target
  selection, and call arguments were all valid. The actual rejected invariant was the pre-call
  heap. `Effect` wrappers beneath a `MemMerge` carried observable coercion values, but the memory
  dependency collector discarded those value edges, allowing global scheduling to place them
  after the later call.
- `ms-push-memory-dep-tree!` now lowers structural memory nodes into schedulable facts: an `Effect`
  contributes both predecessor memory and ordering value, and a `MemMerge` contributes its leaves
  instead of an unschedulable aggregate. Scheduling additionally orders the selected vreg producer,
  so structural values such as closures and casts retain the same dependency as direct machine
  nodes. Verification checks that selected producer through the ordinary input-validity contract.
- Dynamic JavaScript calls are also born with `CALL-ABI-DYNAMIC-RECEIVER` before their first
  peephole. This removes the invalid intermediate state in which devirtualization could replace a
  heap callable before the call was relabelled dynamic; the focused JSL ABI suite pins the result.
- Fast evidence is green: the focused native regression, all 49 JSL tests, and the isolated
  `ToClampedIndex` graph/native workbench. Its four mapped Test262 variants remain 30-second
  timeouts (0 pass / 4 timeout), matching the retained scale limitation rather than contradicting
  the focused semantic witness. The bounded gate is green at 62/62. The generated reports now show
  95 native witnesses and two honest frontier bugs, down from three.

# 2026-08-27: TypedArray backing buffers initialize their ArrayBuffer accessor surface

- The unchanged `signed.buffer.byteLength` frontier program now compiles, executes natively, and
  answers 11 for `main(7)`, matching Node. Its regression covers a direct TypedArray getter, an
  intermediate buffer binding, and the original nested accessor chain.
- The failure had two structural causes. The frontend did not retain ArrayBuffer/TypedArray value
  provenance through constructor results and `.buffer`, so a nested spec property name could be
  mistaken for an unrelated closed-world shape slot. Dedicated value categories now keep those
  accesses on the DSL-owned `GetV` path.
- More importantly, `NewArrayBuffer` assumed its caller had initialized the ArrayBuffer intrinsic.
  Direct construction did, but TypedArray backing-buffer allocation did not. The operation now
  establishes `ArrayBufferConstructorValue` itself before installing its prototype, so every
  allocation path has the inherited `byteLength` accessor it depends on.
- The focused native regression and frontend graph suite are green. The bounded gate is green at
  62/62. The fixed repro is removed only after being pinned in `tests/native-execution-test.coil`;
  the generated frontier and derived index now report three open bugs and 94 native witnesses.

# 2026-08-27: fixed TypedArray state has canonical witness, bounds, length, and element operations

- Seven pinned partial JSL operations now own the represented fixed Int8Array/Uint8Array seam:
  `TypedArrayElementType`, `TypedArrayElementSize`, `IsUnsignedElementType`,
  `MakeTypedArrayWithBufferWitnessRecord`, `IsTypedArrayOutOfBounds`, `TypedArrayLength`, and
  `TypedArrayByteLength`. Getter and indexed-read implementations compose those operations instead
  of decoding internal kinds and lengths independently.
- The witness-record encoding is explicit: for fixed, attached buffers the TypedArray object is
  sufficient because the cached backing byte length cannot change. Resizable, length-tracking,
  detached, nonzero-offset, wider-element, and BigInt views remain precise deviations. The
  ownership gate rejected `ValidateTypedArray` and `ValidateTypedArrayBounds` because no current
  public consumer reaches them; those premature declarations were removed rather than kept alive
  artificially.
- All seven direct operation graphs verify. One focused ordinary-JavaScript program constructs
  both represented element kinds over a shared buffer, checks length/byteLength/byteOffset,
  backing-buffer identity, and indexed zero reads; every operation compiles it, executes natively,
  and agrees with Node.
- A latent representation defect in `TypedArrayName` was fixed properly: its string alternatives
  are now explicitly boxed before their phi reaches property publication. This removed a
  `PropStoreKey` raw-pointer verifier violation instead of bypassing verification.
- Exact mappings retain twelve new Test262 variants. All remain timeouts in the broad TypedArray
  constructor harness, so the focused witness is the bounded feedback lane and the retained
  failures remain honest publication/harness debt. Coverage is zero-gap at 2,655/2,655:
  122 complete, 55 partial, and 2,478 blocked. Fifty-eight mappings cover 547 variants
  (135 pass, 411 fail, one refused).
- Chaining `signed.buffer.byteLength` still computes 0 where Node computes 4, although direct
  TypedArray getters, backing-buffer identity, and standalone ArrayBuffer byteLength work. The
  unchanged program is now the executable `typed-array-buffer-chained-byte-length.js` frontier
  repro; the frontier therefore contains four honest open bugs.

# 2026-08-27: fixed ArrayBuffer state is expressed by five canonical operations

- `IsSharedArrayBuffer`, `IsDetachedBuffer`, `IsGrowableSharedArrayBuffer`,
  `IsFixedLengthArrayBuffer`, and `ArrayBufferByteLength` are now pinned partial JSL operations.
  ArrayBuffer getters compose them instead of reading representation fields or restating state
  predicates. The internal-slot table now correctly says represented kind 105 has
  `[[ArrayBufferData]]` and `[[ArrayBufferByteLength]]`, but not the resizable-only
  `[[ArrayBufferMaxByteLength]]` slot.
- The supported domain is explicit: represented ArrayBuffers are allocated, non-shared, and
  fixed-length. The five operations therefore return the specification answers for that domain;
  shared data blocks, detachment, and resizable/growable buffers remain named deviations rather
  than fabricated runtime states.
- One small focused program checks zero- and nonzero-length buffers through `byteLength`,
  `maxByteLength`, `resizable`, and `detached`. All five operation checks compile that witness,
  execute it natively, and agree with Node. Their direct JSL graphs also verify.
- Exact Test262 mappings retain twelve variants. They currently expose broader missing
  publication/state support (399 mapped failures total), and the shared/detached cohorts time out;
  they are not suitable for the bounded feedback loop yet. The focused native witness is the fast
  correctness lane for the represented domain.
- Coverage remains zero-gap at 2,655/2,655 and moves five clauses from blocked to partial:
  122 complete, 48 partial, and 2,485 blocked. Fifty-three operation mappings cover 535 variants
  (135 pass, 399 fail, one refused).
- The unchanged `for-of-catch-arraybuffer-invalid-phi.js` frontier program now compiles, executes,
  and agrees with Node. Its exact source is pinned in `tests/native-execution-test.coil`, the stale
  open repro is removed, and the generated frontier is down from four open bugs to three.
- A direct workbench graph for `HasInternalSlot(buffer,
  [[ArrayBufferMaxByteLength]])` fails verification without a diagnostic, although the only
  represented ArrayBuffer kind provably lacks that slot. `IsFixedLengthArrayBuffer` consequently
  returns the canonical constant `true` for the explicitly fixed-only representation. The
  diagnostic gap is recorded in the project pad; it must be resolved before adding resizable
  buffer kinds.

# 2026-08-27: absolute and clamped index conversion are canonical Number-domain operations

- `ToAbsoluteIndex` and `ToClampedIndex` are now pinned partial JSL operations. The former performs
  `ToIntegerOrInfinity` and adjusts only finite negative indices relative to the supplied length;
  the latter clamps that Number result to `[0, length]`. Both preserve the specification's boxed
  Number domain, including infinities at the absolute-index boundary.
- `RelativeIndex` and `ClampedIndex` are now explicit machine adapters over those canonical
  operations. `AddNumericValues` preserves the immediate-integer representation when both inputs
  are represented integers, so indexing consumers erase boxing without pushing their storage
  representation back into the abstract operations.
- The canonical graphs verify at 59,446/50,224 total/live nodes for `ToAbsoluteIndex` and
  59,536/50,309 for `ToClampedIndex`. Focused native programs cover positive/negative fractions,
  in-range and out-of-range relative indices, both infinities, clamping at both bounds, and one
  observable object coercion through the absolute path; both compile, execute, and agree with Node.
- Four direct Array `at` and String `startsWith` Test262 files retain eight variants. Coverage is
  zero-gap at 2,655/2,655: 122 complete, 43 partial, and 2,490 blocked. Forty-eight mappings cover
  523 variants (135 pass, 387 fail, one refused).
- Object-valued `startsWith` position coercion exposes a distinct closed-world call-target selection
  failure (`decoded=2`, `expected=8`) even though the graph verifies and the same `valueOf` works
  through `ToAbsoluteIndex`. It is retained as the executable frontier repro
  `starts-with-object-position-wrong-call-target.js`; the focused clamped-index witness keeps all
  non-object conversion/clamping branches and does not claim that open composition.
- The ledger gate and bounded gate (62/62) are green. The generated frontier now honestly contains
  four failures: three named refusals and the shortest-round-trip digit disagreement.

# 2026-08-27: `ToIndex` is canonical; ArrayBuffer keeps only its storage-range policy

- `ToIndex` is now a pinned partial canonical JSL operation. It owns absent/undefined zero,
  `ToIntegerOrInfinity`, negative rejection, `ToLength`, SameValueZero overflow validation, and
  RangeError construction. `ToArrayBufferLength` now composes it and owns only the represented
  fixed-buffer `2^31 - 1` allocation cap plus raw machine-index conversion.
- The 59,247-node / 50,018-live-node operation closure verifies. A focused native witness covers
  absent and explicit undefined, fractional Number and String lengths, single `valueOf` coercion,
  negative values, both infinities, and the greater-than-MaxSafeInteger boundary; it compiles,
  executes, and agrees with Node.
- Four direct ArrayBuffer Test262 files retain eight exact variants (all currently failing at
  broader harness/publication paths). Coverage remains zero-gap at 2,655/2,655 and moves ToIndex
  from blocked to partial: 122 complete, 41 partial, and 2,492 blocked. Forty-six mappings cover
  515 variants (135 pass, 379 fail, one refused).
- The first witness composed the four caught RangeErrors inside `for...of`. Its graph verified but
  machine selection refused an invalid loop-exit phi edge. The same cases agree with Node when
  called individually, proving the defect is iterator/abrupt-control composition rather than
  ToIndex. It is now an executable frontier case at
  `repros/open/for-of-catch-arraybuffer-invalid-phi.js`, with the correct-answer failing test and
  generated frontier entry required by the project rules.
- The ledger gate and bounded gate (62/62) are green. The opt-in frontier now honestly contains
  three failures: the new phi-selection refusal, the existing `for await` refusal, and the existing
  shortest-round-trip digit disagreement.

# 2026-08-27: `ToLength` and `LengthOfArrayLike` separate Number semantics from storage bounds

- `ToLength` is now a pinned partial canonical JSL operation returning a boxed ECMAScript Number
  in `[0, 2^53 - 1]`. The previous two-argument helper was renamed `ToMachineLength`: its explicit
  storage cap remains a checked specialization and can no longer be mistaken for the abstract
  operation. Array-like and `String.raw` indexing apply that representation conversion only after
  the canonical Number-domain operation.
- `LengthOfArrayLike` is now a pinned partial canonical JSL operation that performs the observable
  `Get(obj, "length")` exactly once and delegates coercion to `ToLength`. Existing generic Array
  consumers reach it through their storage-bound `ArrayLikeLength` adapter, so one named operation
  now owns the spec semantics without forcing machine indices into its public result type.
- The focused native witness proves string/fraction length coercion, a single accessor read,
  negative clamping, and no indexed getter observation after a zero result. Both operation graphs
  verify (`ToLength` 58,847/49,655 total/live nodes and `LengthOfArrayLike` 62,778/53,017), and the
  focused JavaScript program compiles, executes, and agrees with Node.
- Exact mappings retain eight Test262 variants across object-coercion, positive-fraction, and
  negative-fraction cases. All eight remain honest failures at broader harness/publication paths.
  Coverage is zero-gap at 2,655/2,655: 122 complete, 40 partial, and 2,493 blocked; 45 mappings
  cover 507 variants (135 pass, 371 fail, one refused).

# 2026-08-27: three property-definition operations share one internal-method seam

- `CreateDataProperty`, `CreateDataPropertyOrThrow`, and `DefinePropertyOrThrow` are now pinned
  partial JSL operations. They construct the specification Property Descriptor record, preserve
  the all-true data-property attributes, return the internal method's boolean where required, and
  turn false results into `TypeError` at the two `OrThrow` boundaries.
- `DefineOwnPropertyRecord` is the single represented `[[DefineOwnProperty]]` dispatch seam:
  String exotic receivers use `StringDefineOwnProperty` and every other represented receiver uses
  `OrdinaryDefineOwnProperty`. `Object.defineProperty` and iterator-result construction now consume
  the canonical operations instead of duplicating their policy. The precise retained deviation is
  Proxy and receiver families whose exotic internal methods do not yet have representations.
- All three transitive operation graphs verify. Their focused native witnesses compile, execute,
  and agree with Node: iterator results expose own writable/enumerable/configurable `value` and
  `done` properties, while String definition covers successful ordinary fallback and abrupt
  incompatible indexed updates.
- Generated coverage remains zero-gap at 2,655/2,655 and moves three clauses from blocked to
  partial: 122 complete, 38 partial, and 2,495 blocked. Forty-three mapped operations cover 499
  variants (135 pass, 363 fail, one refused); the six new retained variants are honest failures at
  broader harness/publication prerequisites, not operation contradictions.

# 2026-08-27: String exotic definition is canonical; guarded numeric unboxes retain control

- `IsCompatiblePropertyDescriptor` and the String exotic `[[DefineOwnProperty]]` internal method
  are now pinned complete JSL operations. The latter composes `StringGetOwnProperty`, the canonical
  compatibility predicate, and `OrdinaryDefineOwnProperty`; the focused witness proves empty and
  same-value indexed updates succeed, incompatible value/writable changes throw `TypeError`, and
  non-index properties retain ordinary definition behavior.
- The initially reported String-definition “value/effect defect” had two parts. Returning
  `0x7ffc000000000007` was only the diagnostic returning boxed dynamic `7` without its required
  native `| 0` result coercion. The real SIGTRAP was broader: `%UnboxNumber` carried no control
  anchor, so scheduling hoisted its checked conversion above `IsNumber` and tried to numerically
  unbox a tagged String loaded from a property. Numeric JSL unboxing now retains current control;
  a graph regression requires that edge, and the strengthened `SameValue` witness covers dynamic
  String, Number, and Object property loads.
- Isolated operation checks verify 1,192/1,071 total/live nodes for
  `IsCompatiblePropertyDescriptor`, 3,381/2,920 for the called String internal method, and
  187/162 for `StringGetOwnProperty`; all focused programs compile, execute, and agree with Node.
  Generated coverage is zero-gap at 2,655/2,655: 122 complete, 34 partial, and 2,499 blocked.
  Thirty-nine mapped operations cover 491 variants (135 pass, 355 fail, one refused).
- The ledger gate and bounded gate (62/62) are green. The opt-in frontier remains exactly the two
  intentional failures: `for-await-has-no-bridge-kind.js` and `shortest-round-trip-digits.js`.

# 2026-08-27: String exotic reads and descriptors are JSL-owned; numeric keys canonicalize once

- `StringGetOwnProperty` is now a pinned complete JSL operation. `NewStringObject` carries
  `[[StringData]]` and installs the real non-writable/non-enumerable/non-configurable `length`
  property; JSL constructs indexed code-unit descriptors and routes ordinary reads,
  `Object.getOwnPropertyDescriptor`, `hasOwnProperty`, and `propertyIsEnumerable` through one
  String-exotic descriptor path. The runtime resolves wrapper representation but no longer
  supplies indexed descriptor/read policy for String objects.
- The focused witness first exposed a broader structural bug: computed numeric property loads and
  stores passed raw numbers to `GetV`/lvalue property operations even though those paths require a
  PropertyKey. The frontend now inserts the canonical JSL `ToPropertyKey` call at computed-key
  structural boundaries, including compound lvalues where conversion must occur exactly once.
  Both the String-wrapper witness and the strengthened ordinary numeric/string key witness compile,
  execute, and agree with Node; DSL ownership remains 4/4 green.
- String exotic `[[DefineOwnProperty]]` is deliberately not claimed yet. A minimal compatible
  `Object.defineProperty(Object("abc"), "1", {})` returns a tagged String word instead of the
  integer result, while a same-value descriptor traps with SIGTRAP. That is an unresolved
  compiler value/effect representation defect, not a case to bypass with runtime policy.
- Generated coverage remains zero-gap at 2,655/2,655: 120 complete, 34 partial, and 2,501 blocked.
  Thirty-seven mapped operations cover 485 variants (135 pass, 349 fail, one refused). The new
  mapped Test262 variants are four honest failures because those legacy cases depend on unsupported
  `new String(...)` publication/harness paths. The ledger gate and bounded gate (61/61) are green;
  the opt-in frontier remains exactly the two intentional failures.

# 2026-08-27: the extensibility write side and both Object built-ins are canonical

- `OrdinaryPreventExtensions` is now a pinned complete JSL operation over the represented
  `[[Extensible]]` slot. `Object.isExtensible` and `Object.preventExtensions` are pinned partial
  built-in algorithms: primitive behavior and every represented non-Proxy Object path are
  canonical, while their metadata names Proxy internal-method dispatch/revocation (and the
  unrepresented false exotic `[[PreventExtensions]]` result) precisely.
- The frontend now delegates the two Object static methods to the canonical built-in declarations,
  which compose `IsExtensible` or `OrdinaryPreventExtensions`; it no longer names private
  `*Value` helpers. The focused prevention witness proves identity return, a false extensibility
  state, rejection of a new property, and continued mutation of an existing writable property.
  Primitive identity/false cases are covered separately by the two built-in witnesses.
- The three operation graphs verify at 16/15 total/live nodes for
  `OrdinaryPreventExtensions`, 41/38 for `Object.isExtensible`, and 49/42 for
  `Object.preventExtensions`. All focused native programs agree with Node. Their exact six-file
  mappings expand to twelve variants and compare as twelve `failed->failed`, with identical
  cohorts and zero pass regressions.
- Generated coverage remains zero-gap at 2,655/2,655: 119 complete, 34 partial, and 2,502 blocked.
  Public closure status moved from 523 blocked / 3 partial to 521 blocked / 5 partial. Thirty-six
  mapped operations cover 481 variants (135 pass, 345 fail, one refused). The ledger gate,
  bounded gate (61/61), native frontier-document gate (3/3), DSL ownership, and diff check are
  green; the opt-in frontier remains exactly the two intentional failures.

# 2026-08-27: ordinary property definition and extensibility are canonical; operations 22/23 survive lowering

- `OrdinaryGetOwnProperty`, `OrdinaryDefineOwnProperty`, and `OrdinaryIsExtensible` are now pinned
  complete JSL operations. `IsExtensible` is a pinned partial operation whose only named gap is
  Proxy exotic dispatch/revocation. Production `Object.defineProperty` reaches the ordinary
  definition operation, which composes canonical current-descriptor reconstruction,
  `IsExtensible`, and `ValidateAndApplyPropertyDescriptor` rather than a parallel policy path.
- The first ordinary-definition focused witness found a real compiler/runtime ABI break:
  `Object.preventExtensions(target)` was followed by `Object.isExtensible(target) === true`, and a
  new property could still be added. Generic JSL memory lowering discarded the declared
  `PropLoadKey(22)` and `PropStoreKey(23)` discriminators and emitted ordinary property operations
  0 and 1. The general load/store fallback now retains every `jsp-aux` operation discriminator;
  the earlier operation-24 prototype special case remains correct, and a graph regression pins
  operations 22 and 23 together.
- All four focused native witnesses agree with Node. Verified operation graphs are 213/156
  total/live nodes for `OrdinaryGetOwnProperty`, 2,197/1,864 for
  `OrdinaryDefineOwnProperty`, and 14/13 each for `OrdinaryIsExtensible` and `IsExtensible`.
  Each exact two-file Test262 cohort expands to four variants and compares as four
  `failed->failed`, with identical cohorts and zero pass regressions.
- Generated coverage remains zero-gap at 2,655/2,655: 118 complete, 32 partial, and 2,505 blocked.
  Thirty-three mapped operations cover 469 variants (135 pass, 333 fail, one refused). The ledger
  gate, bounded gate (61/61), DSL ownership (4/4), native frontier-document gate (3/3), and diff
  check are green. The opt-in frontier remains exactly the two intentional failures.

# 2026-08-27: `ValidateAndApplyPropertyDescriptor` is the canonical ordinary-property validator

- `ValidateAndApplyPropertyDescriptor ( object, propertyKey, extensible, propertyDesc, current )`
  is now a pinned partial JSL macro. It owns absent-property extensibility checks, empty-descriptor
  acceptance, non-configurable Enumerable/Configurable/kind restrictions, accessor identity
  checks, non-writable data restrictions, validation-only calls, and application for represented
  ordinary Objects, Arrays, and Functions. Its remaining deviation is explicit: Proxy and
  unrepresented exotic `[[DefineOwnProperty]]` protocols do not exist yet.
- `DefinePropertyRecord` now constructs the current private Property Descriptor record and calls
  this canonical operation. The old handwritten `ValidPropertyRedefinition` duplicate is gone.
  Application composes the existing `WritableAttribute`, `EnumerableAttribute`, and
  `ConfigurableAttribute` helpers, preserving the DSL ownership gate with no dead semantic path.
- The canonical graph verifies at 1,993 nodes / 1,719 live nodes. A focused native witness covers
  same-value acceptance on a non-configurable/non-writable property, different-value rejection,
  and configurable data-to-accessor transition; compiled `main(7)` agrees with Node. The exact
  two-file Test262 cohort remains four `failed->failed` variants with no cohort drift and zero pass
  regression; those failures remain outside the focused operation witness.
- Generated coverage remains zero-gap at 2,655/2,655: 115 complete, 31 partial, and 2,509 blocked.
  The ledger gate, bounded gate (60/60), DSL ownership (4/4), and native frontier-document gate
  (3/3) are green. The opt-in frontier remains exactly the two intentional failures:
  `for-await-has-no-bridge-kind.js` is refused and `shortest-round-trip-digits.js` disagrees.

# 2026-08-27: `CompletePropertyDescriptor` supplies canonical default fields for new properties

- `CompletePropertyDescriptor ( propertyDesc )` is now a pinned complete JSL macro over the private
  descriptor record. It selects data completion for generic/data descriptors, accessor completion
  otherwise, and fills every absent kind-specific, Enumerable, and Configurable field with the
  specification default while retaining field presence independently from value.
- `DefinePropertyRecord` calls completion only for a newly created property. Existing-property
  validation deliberately retains the original partial descriptor because field absence is
  semantically significant there. The canonical graph verifies at 146 nodes / 107 live nodes; a
  focused witness covers both partial data and partial accessor descriptors and agrees with Node.
- The exact new-generic-property Test262 file retains the identical two default/strict variants as
  two `failed->failed`, with no cohort drift or pass regression. The baseline for the next
  `ValidateAndApplyPropertyDescriptor` tranche is also retained before its implementation: four
  variants across non-configurable rejection and configurable data-to-accessor replacement.
- Generated coverage remains zero-gap at 2,655/2,655: 115 complete, 30 partial, and 2,510 blocked.
  Twenty-nine staged/mapped operations cover 453 variants (135 passed, 317 failed, one refused);
  the validation/application mapping is staged with its baseline but has no implementation claim
  yet. The ledger gate, bounded gate (60/60), native frontier-document gate (3/3), DSL ownership,
  and diff checks are green; the opt-in frontier is exactly the two known intentional failures.

# 2026-08-27: descriptor classifiers are complete canonical operations and the old duplicate is gone

- `IsAccessorDescriptor`, `IsDataDescriptor`, and `IsGenericDescriptor` are pinned complete JSL
  macros over the private Property Descriptor record representation. Their canonical graphs are
  respectively 20/18, 20/18, and 43/37 total/live nodes, and dedicated native witnesses for
  accessor creation, data creation, and a generic update that preserves the existing data kind all
  agree with Node for `main(7)`.
- Production descriptor validation/application now calls these operations instead of spelling the
  field tests locally. The bounded gate initially rejected dead `IsGenericDescriptor`; migrating
  the exact generic-kind comparison removed that duplicate semantic copy and restored the DSL
  ownership invariant rather than exempting the declaration.
- Each exact one-file Test262 cohort expands to two default/strict variants. All three retain the
  identical before/after cohort with two `failed->failed` transitions, no newly passing variant,
  and zero pass regressions. The failures remain at the broader Test262 helper publication surface.
- Generated coverage is zero-gap at 2,655/2,655: 114 complete, 30 partial, and 2,511 blocked.
  Twenty-seven mappings retain 447 variants (135 passed, 311 failed, one refused). The ledger gate,
  bounded gate (60/60), DSL ownership gate (4/4), native frontier-document gate (3/3), and diff
  check are green. The opt-in frontier remains exactly the two intentional failures.
- These three direct moves are deliberately the front of a larger cut: the generated graph assigns
  343 dependent normative items / 142 public algorithms to
  `ValidateAndApplyPropertyDescriptor`, whose classifier prerequisites are now canonical.

# 2026-08-27: `ToPropertyDescriptor` is canonical and dynamic prototype reads retain operation 24

- `ToPropertyDescriptor ( object )` is now one pinned partial canonical JSL macro in
  `lib/abstract/property-descriptor.jsl`. A private Property Descriptor record preserves field
  presence independently from field values, and conversion performs inherited `HasProperty`/`Get`
  observation in specification order, boolean conversion, callable Getter/Setter validation, and
  the accessor/data exclusion. `Object.defineProperty` and the two-pass `Object.defineProperties`
  path now convert user descriptor Objects once and apply the resulting specification records.
- The focused native witness observes inherited `enumerable` and `configurable` getters in the
  required order, applies the resulting data descriptor, and agrees with Node for `main(7)`. The
  canonical operation graph verifies at 61,177 nodes / 52,111 live nodes.
- That witness exposed a compiler-contract defect rather than a descriptor workaround opportunity:
  `jl-prim-mem` collapsed `%GetPrototype`'s `PropLoadKey(24)` into the ordinary operation-0
  constructor. Dynamic missing-property walks therefore evaluated `object[null]`, recurred on
  `undefined`, and never terminated. `n-get-prototype-at!` now retains runtime operation 24, and
  `get_prototype_retains_its_runtime_operation_discriminator` pins the graph invariant. The
  pre-existing accessor/`Object.defineProperty` native regression is green again.
- The exact four-file Test262 mapping expands to the same eight default/strict variants before and
  after: eight `failed->failed`, zero pass regressions, and no cohort drift. All currently stop at
  the broader missing Test262 `assert` harness publication rather than contradicting the focused
  descriptor result. Evidence is digest-bound in
  `spec/evidence/to-property-descriptor-test262.json`.
- Generated coverage remains zero-gap at 2,655/2,655 classified: 111 complete, 30 partial, and
  2,514 blocked. Twenty-four mappings retain 441 Test262 variants (135 passed, 305 failed, one
  refused). The complete ledger gate, JSL suite (47/47), DSL ownership suite (4/4), bounded gate
  (60/60), native frontier-document gate (3/3), and `git diff --check` are green. The opt-in
  frontier remains honestly red with exactly the two known bugs: `for-await-has-no-bridge-kind.js`
  is refused and `shortest-round-trip-digits.js` disagrees.

# 2026-08-27: `RequireInternalSlot` is canonical and represented brands share one slot-name seam

- `RequireInternalSlot ( obj, internalSlot )` is now one pinned partial canonical JSL macro. JSL
  has explicit identities for all sixteen internal slots currently represented by Number,
  Boolean, String, Symbol, ArrayBuffer, TypedArray, and Array Iterator objects. `HasInternalSlot`
  is the single bridge from those specification names to the opaque `%InternalKind` layout query;
  only the representation mapping knows numeric runtime brands, while the canonical operation owns
  the Object/slot validation and TypeError policy.
- Existing represented consumers now use that seam: ArrayBuffer and TypedArray receiver predicates
  and accessors, Symbol wrapper receivers, Array Iterator `next`, and primitive-wrapper extraction
  in `ToPrimitiveObject`. This removes the repeated private brand-check policy without adding a
  frontend semantic arm or a new machine primitive. The declaration remains partial because the
  runtime has no representations for the specification's other internal-slot families yet.
- The focused witness reads a real ArrayBuffer byte length and proves that an ordinary object
  inheriting `ArrayBuffer.prototype` is rejected by the inherited getter. The 356-node canonical
  operation closure verifies, and native `main(7)` agrees with Node. The direct five-file Test262
  cohort expands to ten default/strict variants and compares exactly as ten `failed->failed`, with
  identical cohorts and no pass regression. The retained failures are two existing SIGABRT cases
  and eight compile-budget timeouts, not newly claimed passes.
- Level-1 feedback now reports the actual JSL file, byte range, and diagnostic context. The loader
  previously copied a reader error through the last successfully inspected declaration, so a
  malformed `symbol/core.jsl` form was falsely attributed to the final form in `property.jsl`.
  `jsl-read-source!` now stamps the reader `Diag` source/range before recording the failure, the
  operation checker prints it, and a two-source regression proves the second file is named.
- Generated coverage remains zero-gap at 2,655/2,655 classified: 111 complete, 29 partial, and
  2,515 blocked. Twenty-three mappings retain 433 Test262 variants (135 passed, 297 failed, one
  refused). The complete ledger gate, bounded gate (59/59), native frontier-document gate (3/3),
  and exact cohort comparison are green. The frontier remains exactly two honest failures.

# 2026-08-27: `ToPrimitive` owns `@@toPrimitive` and addition uses the default hint

- `ToPrimitive ( input [ , preferredType ] )` is now one pinned partial canonical JSL macro with
  the exact `GetMethod`, `Call`, and `OrdinaryToPrimitive` dependencies. An omitted preferred type
  is represented internally by `undefined` and produces the required `"default"` hint. The
  `@@toPrimitive` method receives the original object and a one-element argument List; primitive
  results return and Object results throw TypeError before ordinary fallback can run.
- `SymbolToPrimitiveValue` publishes only the required well-known-symbol identity, sharing the
  stable `Symbol` constructor property with full publication without retaining that constructor's
  entire closure. The frontend recognizes only structural `Symbol.toPrimitive` selection and
  calls this JSL entry; symbol identity and all lookup/call policy stay in the library.
- `JsAdd` now performs `ToPrimitive` on both operands with the omitted/default hint before deciding
  String concatenation versus numeric addition. This is required observable behavior: routing an
  object directly through `ToNumber` passed `"number"` and made a nominal ToPrimitive definition
  ineffective for `+`.
- The first correct implementation made `ToPrimitive` one large called builtin. The bounded gate
  exposed that this retained the complete heap/callback closure even for statically numeric
  `n + 1`, overflowing the graph-text oracle and timing out seed execution. The fundamental fix is
  a canonical macro primitive guard plus one specialized object-only called continuation. Numeric
  fast paths erase the continuation; object semantics remain implemented once. No buffer or
  timeout was loosened. Both original gate tests pass unchanged.
- The focused witness assigns one `Symbol.toPrimitive` method and proves stable symbol identity,
  receiver identity, exactly one `"default"` argument, one invocation, and the primitive result
  through addition. The 42,116-node canonical closure verifies and native `main(7)` agrees with
  Node. The exact five-file Test262 cohort expands to ten default/strict variants and compares as
  ten `failed->failed`, identical cohorts, zero new passes, and zero pass regression; its broad
  multi-callback cases still exceed the retained Test262 execution budget.
- Generated coverage remains zero-gap at 2,655/2,655 classified: 111 complete, 28 partial, and
  2,516 blocked. Twenty-two mappings retain 423 Test262 variants (135 passed, 287 failed, one
  refused). The complete ledger gate, bounded gate (58/58), native frontier-document gate (3/3),
  and `git diff --check` are green. The frontier remains exactly two honest failures.

# 2026-08-27: `OrdinaryToPrimitive` is canonical for both hint orders

- The Number-only `OrdinaryToPrimitiveNumber` specialization has been replaced by one pinned
  partial `OrdinaryToPrimitive ( obj, hint )` JSL operation. Its exact dependencies are canonical
  `Get`, `IsCallable`, and `Call`. String hint reads `toString` then `valueOf`; Number hint reads
  `valueOf` then `toString`; non-callables are skipped, Object results advance to the second
  method, abrupt completions propagate, and exhaustion throws TypeError.
- `ToPrimitiveNumber` now delegates its ordinary-object arm to the canonical operation, and
  `ToStringValue` reaches the String-hint arm for represented ordinary objects. Existing Array and
  primitive-wrapper paths remain explicit partial paths until the intrinsic manifest publishes
  every inherited default `valueOf`/`toString` method; Proxy exotics and BigInt are also still
  named deviations. No synthetic fallback result was retained inside the canonical algorithm.
- The exact pre-change focused witness, containing separate Number- and String-hint callbacks,
  was refused by the known large callback/Phi graph defect. The retained focused witness isolates
  the newly implemented String-hint route with one callback and proves custom `toString`, exact
  single invocation, and the resulting String; native `main(7)` agrees with Node. The canonical
  closure lowers and verifies at 36,388 nodes. Existing number-hint callback coverage remains in
  the focused `ToIntegerOrInfinity` witness.
- The direct addition Test262 file expands to two default/strict variants. Its exact retained
  comparison is two `failed->failed`, identical cohorts, zero newly passing variants, and zero
  pass regression. It remains nonpassing because its broad sequence stacks callback/object-result
  cases beyond the focused compiler surface. Evidence is
  `spec/evidence/ordinary-to-primitive-test262.json` and the paired
  `results/ecma262-ordinary-to-primitive-{baseline,after-mapping}-2026-08-27.jsonl` files.
- Generated coverage remains zero-gap at 2,655/2,655 classified: 111 complete, 27 partial, and
  2,517 blocked. Twenty-one mappings retain 413 Test262 variants (135 passed, 277 failed, one
  refused). The complete ledger gate, bounded gate (58/58), native frontier-document gate (3/3),
  and `git diff --check` are green. The frontier remains exactly the two known honest failures.

# 2026-08-27: `GetMethod` owns method lookup and `String.prototype.replace` reaches it

- `GetMethod` is now one pinned partial JSL operation with the exact `GetV` and `IsCallable`
  dependencies. It returns `undefined` for nullish property values, preserves callable identity,
  and throws a TypeError for represented non-callables. Its named deviation is limited to callable
  Proxy exotics and the unrepresented BigInt family.
- The represented `String.prototype.replace` prefix now follows the specification boundary: it
  performs `GetMethod(searchValue, @@replace)` in JSL and invokes the result through canonical
  `Call` with the search object as receiver and the original string receiver and replacement as
  arguments. The frontend passes boxed source values and no longer open-codes coercion policy.
- `SymbolReplaceValue` publishes only the required well-known-symbol identity instead of retaining
  the entire `Symbol` constructor closure. This keeps intrinsic identity in JSL while giving the
  compiler a structurally targeted entry point; it is not a second implementation of Symbol
  semantics.
- `npm run spec:operation -- GetMethod` verifies a 29,450-node operation closure and compiles the
  focused witness. Native execution proves one property lookup/invocation, exact receiver and
  argument forwarding, and one call; `main(7)` agrees with Node. A larger stacked negative witness
  encountered the already-known large-graph Phi allocation defect, so the focused claim was not
  inflated: null fallback, abrupt getter completion, and non-callable behavior remain represented
  in the mapped Test262 evidence.
- The exact three-file Test262 cohort expands to six default/strict variants. Baseline and after
  are the identical cohort with six `failed->failed`, zero newly passing variants, and zero pass
  regressions. Evidence is `spec/evidence/get-method-test262.json` and the paired
  `results/ecma262-get-method-{baseline,after-mapping}-2026-08-27.jsonl` files.
- Generated coverage remains zero-gap at 2,655/2,655 classified: 111 complete, 26 partial, and
  2,518 blocked. Twenty mappings retain 411 Test262 variants (135 passed, 275 failed, one refused).
  The complete ledger gate, bounded gate (58/58), native frontier-document gate (3/3), and
  `git diff --check` are green. The required frontier remains exactly two honest failures:
  for-await bridge lowering and shortest-round-trip digits.

# 2026-08-27: `GetV` preserves the original primitive receiver

- `GetV` is now one pinned partial JSL operation with its exact `ToObject` dependency. Ordinary
  `[[Get]]` composition no longer conflates the lookup object with the receiver: the shared
  receiver-aware path finds the property on the object/exotic representation but invokes an
  accessor through `Call` with the separately supplied receiver. Canonical `Get` passes the object
  for both roles; `GetV` passes `ToObject(value)` for lookup and the original value for receiver.
- Primitive-capable source MemberExpression reads now route structurally through `GetV`; statically
  shaped raw field loads remain compiler structure, and known built-in Object reads continue to use
  canonical `Get`. No ToObject, accessor, or receiver policy was added to the frontend.
- The focused falsification installs a strict inherited String getter and proves that its `this`
  is the primitive string rather than the temporary wrapper. It also covers inherited Boolean data
  and the null/undefined TypeError boundary. `npm run spec:operation -- GetV` lowers a verified
  29,399-node closure, compiles the source witness, runs it natively, and agrees with Node.
- The exact five-file property-accessor Test262 cohort expands to ten default/strict variants. Its
  retained comparison is ten `failed->failed`, identical cohorts, zero newly passing variants, and
  zero pass regression. Evidence is `spec/evidence/get-v-test262.json` and the paired
  `results/ecma262-get-v-{baseline,after-mapping}-2026-08-27.jsonl` files.
- A broader first focused witness with three distinct accessor callbacks exposed the existing
  large-graph Phi allocation defect; the decisive one-accessor receiver falsification compiles.
  This is not hidden by the GetV claim: broader Proxy/BigInt/String-exotic receiver families remain
  its named deviation and the retained Test262 files remain nonpassing.
- Generated coverage remains zero-gap at 2,655/2,655 classified: 111 complete, 25 partial, and
  2,519 blocked. Nineteen mappings retain 405 Test262 variants (135 passed, 269 failed, one
  refused). The complete ledger gate, bounded gate (58/58), native frontier-document gate (3/3),
  and `git diff --check` are green.

# 2026-08-27: `ToObject` is canonical and callback representation gaps are fixed

- `ToObject` is now one pinned partial JSL operation in `lib/abstract/coercions.jsl`. It performs
  the nullish TypeError boundary, preserves existing Object identity, and allocates the represented
  Boolean, Number, String, and Symbol wrapper families. `Object(value)` delegates to it for every
  non-nullish value while retaining its distinct nullish-create behavior. The competing
  `ToObjectValue` helper was removed; sloppy receiver binding, Object.assign targets, destructuring,
  String.raw, Object rest, and enumeration now call the canonical operation.
- Wrapper construction now links `%Number.prototype%`, `%Boolean.prototype%`, and
  `%String.prototype%` instead of installing an incorrect own `constructor` property. Numeric- and
  String-hint coercion reads the represented String wrapper's internal data slot. BigInt wrappers
  and String exotic indexed/`length` own properties remain named deviations owned by their proper
  representation/internal-method work rather than being approximated inside ToObject.
- `npm run spec:operation -- ToObject` lowers a verified 26,459-node closure. Its focused source
  witness compiles and runs natively, covering ordinary identity, all four represented primitive
  wrapper families, internal data observed through coercion, and both nullish throws; it agrees
  with Node for `main(7)`. The retained 12-variant Test262 comparison is exactly 12
  `failed->failed`, with identical cohorts and zero pass regression. Evidence is
  `spec/evidence/to-object-test262.json` and the paired
  `results/ecma262-to-object-{baseline,after-mapping}-2026-08-27.jsonl` files.
- The callback work beneath `Call` is now proved beyond the earlier partial note: callback outer
  memory remains ordered through `Effect`, captured Object identity and integer/float fields pass
  native execution, dynamic callback returns preserve their full 64-bit JavaScript tag through
  stackmap format version 4, and callback throws cross the DSL and are caught. The obsolete reduce
  callback frontier repro was retired only after its existing test turned green. The frontier is
  now exactly two honest bugs: for-await bridge lowering and shortest-round-trip digits.
- Generated coverage is zero-gap at 2,655/2,655 classified: 111 complete, 24 partial, and 2,520
  blocked. Eighteen mappings retain 395 Test262 variants (135 passed, 259 failed, one refused).
  The complete ledger gate, `git diff --check`, native frontier-document gate, focused callback
  witnesses, and bounded gate (58/58) are green.

# 2026-08-27: `Call` owns invocation and specification Lists compile away

- The pinned `Call ( func, thisValue [ , argList ] )` abstract operation is now one canonical
  partial JSL macro in `lib/abstract/call.jsl`. Every semantic library invocation routes through
  it; `call-dynamic-with-receiver-rest` remains only the representation form inside `Call` itself.
  The frontend continues to own syntax and call-graph structure, while `Call` owns callable
  validation, TypeError completion, receiver forwarding, and argument-List invocation.
- JSL now represents ECMA-262 specification Lists directly with a final macro-only `(rest T)`
  parameter. Rest arguments lower once into a compiler-owned SSA slice, never a JavaScript Array,
  and expand into the receiver ABI with the exact argc. The checker refuses non-final, non-macro,
  scalar, invalid-spread, and over-16 forms. Scope teardown releases element pins and truncates the
  compile-time slice; `jsl-inline!` and the one-operation workbench both support zero-or-more rest
  actuals. The focused JSL suite is green at 45/45.
- Establishing the receiver ABI fixed the primitive-receiver frontier bug fundamentally. Receiver
  calls now box raw primitive specializations but retain exact raw Object-pointer specialization;
  the representation verifier accepts exactly tagged values or proven raw pointers and rejects a
  raw machine Number. The fixed `Function.prototype.call` primitive receiver case is promoted into
  `tests/native-execution-test.coil`; the frontier is reduced from four bugs to three.
- `npm run spec:operation -- Call` lowers a verified 240-node operation graph, compiles the focused
  direct/strict/sloppy receiver and argument-count witness, runs it natively, and agrees with Node.
  The exact Function.prototype.call cohort contains seven variants and compares as seven
  `failed->failed`, with identical cohorts and no pass regression. Object-heavy falsification
  probes exposed two separately recorded representation gaps (captured Object identity and boxing
  a dynamically reached numeric field Load), so the partial deviation names them instead of
  inflating support.
- Generated coverage remains zero-gap at 2,655/2,655 classified: 111 complete, 23 partial, and
  2,521 blocked. Seventeen mappings retain 383 Test262 variants (135 passed, 247 failed, one
  refused). The complete ledger gate, `git diff --check`, focused native operation, and bounded
  gate (57/57) are green.

## 2026-08-27: Number equality methods are canonical JSL operations

- `Number::equal` and `Number::sameValueZero` are now pinned complete JSL macros rather than
  anonymous logic embedded in their callers. `IsStrictlyEqual` delegates its Number arm to
  `NumberEqual`; `SameValueZero` delegates its Number arm to `NumberSameValueZero`, which in turn
  adds only NaN-pair equality to `NumberEqual`. This follows the spec's operation boundaries while
  keeping the frontend structural. Their generated dependency scores are respectively 462
  normative dependents/196 public algorithms and 9 normative dependents/3 public algorithms.
- Dedicated focused witnesses cover NaN, both signed-zero orders, equal and unequal finite values,
  fractions, and both infinities; the SameValueZero witness exercises the distinction through
  `Array.prototype.includes`. Both transitive closures verify, compile to native code, execute
  `main(7)`, and agree with Node.
- The exact mapped Test262 cohorts retain eight `Number::equal` variants and two
  `Number::sameValueZero` variants. Baseline-to-after comparisons are respectively eight and two
  `failed->failed`, with identical cohorts and no pass regression. These are retained as honest
  evidence of broader harness/runtime gaps, not treated as proof against the focused native
  semantic witnesses.
- The ledger is 2,655/2,655 classified: 111 complete, 22 partial, and 2,522 blocked. Sixteen mapped
  operations retain 376 Test262 variants (135 passed, 240 failed, one refused). The ledger gate,
  `git diff --check`, and bounded gate (56/56) are green. The required frontier rerun remains the
  same four open bugs: for-await bridge kind, shortest-round-trip digits, reduce callback invalid
  Phi edge, and primitive receiver tagging.

## 2026-08-27: Number::sameValue is a complete numeric-method claim

- `Number::sameValue` was extracted from the numeric arm of `SameValue` and pinned as a complete
  JSL numeric method. It directly implements NaN-pair equality, signed-zero distinction, finite
  equality, and infinity equality; `SameValue` now delegates its Number arm to this one operation.
  The generated dependency score is 462 normative dependents and 196 public algorithms.
- Its dedicated focused witness covers NaN, both zero signs in both orders, finite integers and
  fractions, unequal Numbers, and both infinities. The operation lowers to a verified 134-node
  graph and native `main(7)` agrees with Node.
- Direct uses of the public global `Infinity` binding exposed a separate graph verifier refusal
  (`VERR-DEAD-INPUT`, 12 dead `TypeTest` inputs) in both shared and dedicated witnesses. Constructing
  the same IEEE values as `1 / 0` and `-1 / 0` is green, isolating the defect to global intrinsic
  binding/publication rather than numeric comparison. The issue is recorded in the project pad.
- The exact Number-only `Object.is` cohort retains four default/strict variants. The comparison is
  four `failed->failed`, with no drift or pass regression; their end-to-end failure remains in the
  broader Test262 harness/publication path. Evidence is `spec/evidence/number-same-value-test262.json`.
- The ledger is 2,655/2,655 classified: 109 complete, 22 partial, and 2,524 blocked. Fourteen mapped
  operations retain 366 Test262 variants (135 passed, 230 failed, one refused). The ledger gate,
  `git diff --check`, and bounded gate (56/56) are green; frontier remains the same four open bugs.

## 2026-08-27: SameValueNonNumber is shared by all represented equality families

- `SameValueNonNumber` was the next represented high-reach prerequisite: 461 normative dependents
  and 196 public algorithms. Its logic was previously embedded separately in equality operations.
- It is now a pinned partial canonical macro. After callers establish `SameType` and exclude Number,
  it compares String UTF-16 contents and uses canonical tagged identity for undefined, null,
  Boolean, Symbol, and all represented Object kinds. BigInt is the only named missing type.
  `SameValue`, `SameValueZero`, and `IsStrictlyEqual` now share this one implementation.
- The focused witness now covers Boolean/null/undefined distinctions, String content, and identity
  versus nonidentity for ordinary Objects, Arrays, and Functions in addition to the existing Number
  cases. The operation itself lowers to 18 verified nodes and native `main(7)` agrees with Node.
- Its exact non-Number `Object.is` cohort contains 20 default/strict variants. The comparison is 20
  `failed->failed`, with no cohort drift or pass regression; broader Test262 harness/publication
  paths remain the blocker. Evidence is `spec/evidence/same-value-non-number-test262.json`.
- The generated ledger is 2,655/2,655 classified: 108 complete, 22 partial, and 2,525 blocked.
  Thirteen mapped operations retain 362 Test262 variants (135 passed, 226 failed, one refused).
  `spec:ledger:gate`, `git diff --check`, and `coil test` (56/56) are green; the required frontier
  remains red at the same four honestly open bugs.

## 2026-08-27: ToIntegerOrInfinity is one canonical JSL operation

- The dependency queue selected `ToIntegerOrInfinity`: 249 normative items and 175 public
  algorithms transitively depend on it. The runtime already exposed numeric truncation, but
  arbitrary-value callers invoked that representation primitive directly and therefore did not
  consistently own the observable ToPrimitive/ToNumber protocol in JSL.
- `ToIntegerOrInfinity` is now a pinned partial canonical macro: it calls `ToNumberValue` once and
  then the numeric `%ToInteger` capability. Its deviation names BigInt and the incomplete object
  ToPrimitive surface. Arbitrary-value consumers in relative indexing, clamping, Array methods,
  ArrayBuffer length conversion, and `toFixed` now call it. The only remaining direct primitive
  uses are the canonical operation and two already-number-proven algorithms (`Math.trunc` and JSON
  gap formatting).
- The focused native witness reaches the operation through `Array.prototype.at` and covers
  fractional positive/negative values, NaN, both infinities, strings, booleans, null, undefined,
  Array coercion, and a custom `valueOf` whose single invocation is observed. Its transitive JSL
  closure verifies and native `main(7)` agrees with Node.
- The exact mapped Test262 cohort contains six default/strict variants for numeric, nonnumeric,
  object, and Symbol index conversion. The comparison is six `failed->failed`, with no cohort
  drift or pass regression; broader Test262 harness/publication paths still prevent completion.
  Digest-bound evidence is `spec/evidence/to-integer-or-infinity-test262.json`.
- The generated ledger remains 2,655/2,655 classified: 108 complete, 21 partial, and 2,526 blocked.
  Twelve mapped operations retain 342 Test262 variants (135 passed, 206 failed, one refused).
  `spec:ledger:gate`, `git diff --check`, and `coil test` (56/56) are green. The required frontier
  rerun remains honestly red at the same four open bugs.

## 2026-08-27: IsArray recognizes the real `%Array.prototype%` Array exotic

- The canonical `IsArray` claim is now pinned as partial. Its represented non-Proxy algorithm is
  the existing Array tag test; the remaining deviation is exactly Proxy target recursion and the
  revoked-Proxy TypeError path.
- This tranche fixed the representation beneath that operation rather than special-casing the
  intrinsic in `IsArray`. Runtime descriptor 21 now materializes intrinsic kind 17 as one stable
  Array-tagged identity backed by dense-array state. `BuiltinPrototypeValue` initializes that
  Array exotic's `[[Prototype]]` to `%Object.prototype%` in JSL, where JavaScript semantics live.
- The focused differential covers primitives, ordinary objects, arrays, `%Array.prototype%`, and
  the prototype impostor `Object.create([])`. The latter exposed an adjacent genuine defect:
  `ObjectCreate` accepted only the ordinary-object runtime tag. It now accepts ordinary, Array,
  and Function Object values while still creating an ordinary result. Native `main(7)` agrees
  with Node, including `Array.isArray(Array.prototype) === true` and
  `Array.isArray(Object.create([])) === false`.
- The exact direct Test262 cohort remains 58 variants. The comparison is 57 `failed->failed` and
  one `refused->failed`: no cohort drift, no pass regression, and no newly passing variant. Those
  complete files remain blocked by broader harness/publication paths even though the focused
  semantic witness now executes. Digest-bound evidence is `spec/evidence/is-array-test262.json`.
- `coil test` is green at 56/56. The required frontier rerun remains honestly red at the same four
  open bugs: for-await bridge kind, shortest round-trip digits, reduce callback invalid Phi edge,
  and primitive receiver tagging.

## 2026-08-27: ToPropertyKey has executable primitive, Symbol, and Array-key evidence

- The dependency ranking selected `ToPropertyKey` at 141 normative dependents and 20 public
  algorithms. The existing JSL helper already preserves represented Symbol identity and delegates
  all other keys to `ToStringValue`; no semantic rewrite was needed for that supported surface.
- It now carries a pinned partial claim. The deviation names BigInt and the complete String-hint
  object `ToPrimitive` protocol (`@@toPrimitive`, custom `toString`, then custom `valueOf`) rather
  than treating primitive success as the whole algorithm.
- The focused native differential covers Number, Boolean, null, undefined, Array-to-string keys,
  Symbol identity, and the separation between a Symbol key and its descriptive string. Its
  transitive JSL closure lowers to a verified graph and native `main(7)` agrees with Node.
- The direct Test262 mapping deliberately includes object-coercion evaluation order, a primitive
  Symbol key, and object conversion returning a Symbol. All six exact default/strict variants
  remain failed on the named prerequisite and broader harness paths; the comparison is six
  `failed->failed`, with no cohort drift or pass regression. Digest-bound evidence is
  `spec/evidence/to-property-key-test262.json`.
- The generated ledger is 2,655/2,655 classified: 108 complete, 19 partial, and 2,528 blocked.
  Ten mapped operations retain 278 Test262 variants (135 passed, 142 failed, one refused).
  `spec:ledger:gate`, `git diff --check`, and `coil test` (56/56) are green.

## 2026-08-27: HasProperty now walks the represented prototype chain

- The dependency ranking selected `HasProperty` at 41 normative dependents and 31 public
  algorithms. Its prior JSL definition stopped after receiver-specific own-property checks, so an
  inherited property incorrectly answered false even though the pinned algorithm delegates through
  `[[HasProperty]]` along the prototype chain.
- `HasProperty` now canonicalizes the key once, loops through `[[Prototype]]`, and applies the
  existing ordinary Object, dense Array, and fixed TypedArray own-property rules at every level.
  The frontend remains only the structural `in`-expression caller. The checked partial deviation
  names Proxy traps and exotic receiver families outside those represented kinds.
- The focused witness distinguishes own `undefined` from absence, exercises a custom inherited
  property and own-versus-inherited identity, and pins dense Array index, hole, and `length`
  behavior. `npm run spec:operation -- HasProperty` lowers the closure, verifies the graph, and its
  native `main(7)` agrees with Node.
- Two direct Test262 `[[HasProperty]]` files retain four exact default/strict variants. All remain
  failed because their broader harness/intrinsic and constructor paths are not yet executable; the
  comparison is four `failed->failed`, zero cohort drift, and zero pass regression. Evidence is
  `spec/evidence/has-property-test262.json`.
- A larger first focused shape mixing the same cases with `new Int8Array([n])` exposed a separate
  `PropStoreKey` representation refusal (`raw-ptr` String phi where a tagged value is required).
  Removing only that unrelated constructor path leaves the complete ordinary/Array HasProperty
  witness green; the TypedArray interaction is recorded in the project pad for follow-up rather
  than hidden as support evidence.
- The generated ledger is 2,655/2,655 classified: 108 complete, 18 partial, and 2,529 blocked.
  Nine mapped operations retain 272 Test262 variants (135 passed, 136 failed, one refused).
  `spec:ledger:gate`, `git diff --check`, and `coil test` (56/56) are green.

## 2026-08-27: CreateIteratorResultObject now creates an ordinary result object

- The dependency ranking selected `CreateIteratorResultObject` next: its canonical clause reaches
  60 normative dependents and 31 public algorithms. The prior helper allocated raw `%NewObject`
  storage and assigned with ordinary `Set`, omitting the spec-required `%Object.prototype%` link
  and own-data-property creation semantics.
- The JSL implementation now initializes the fresh ordinary object and defines own `value` then
  `done` data properties through `DefineField`, the existing fresh-object equivalent of
  `CreateDataPropertyOrThrow`. It carries a pinned partial claim because BigInt values remain
  outside the represented frontend/runtime value surface.
- The focused differential proves successive and exhausted array iterator results, the same
  intrinsic prototype as an ordinary object, inherited `hasOwnProperty`, own
  writable/enumerable/configurable descriptors, and writable `value`. Its transitive JSL closure
  lowers to a verified graph and native `main(7)` agrees with Node.
- The direct Array iterator `next` Test262 test retains both default and strict variants. Both
  remain failed by timeout at the existing `Symbol.iterator` publication prerequisite; the exact
  comparison is two `failed->failed`, with no cohort drift or pass regression. Digest-bound
  evidence is `spec/evidence/create-iterator-result-object-test262.json`.
- The generated ledger remains 2,655/2,655 classified: 108 complete, 17 partial, and 2,530 blocked.
  Eight mapped operations retain 268 Test262 variants (135 passed, 132 failed, one refused).
  `spec:ledger:gate`, `git diff --check`, and `coil test` (56/56) are green.
- Audit note: comparing the result prototype directly with the public `Object.prototype` value
  disagreed natively even though it equals the prototype of an ordinary object and inherits the
  expected intrinsic methods. That broader intrinsic-publication identity needs a separate audit;
  it is not hidden inside this operation claim.

## 2026-08-27: IteratorComplete and IteratorValue are executable partial claims

- The corrected canonical-candidate ranking selected `IteratorComplete` and `IteratorValue` as
  adjacent high-reach prerequisites: they affect 97/96 normative dependents and 40 public
  algorithms apiece. Both now carry pinned canonical provenance and precise partial deviations in
  `lib/array/iterator.jsl`; their supported ordinary-object behavior remains implemented through
  `GetProperty` and `ToBoolean`, not open-coded by the frontend.
- Their shared focused witness covers array `for...of`, direct `values().next()` extraction, and
  exhausted iterator results. `npm run spec:operation -- IteratorComplete` and
  `npm run spec:operation -- IteratorValue` both lower the transitive JSL closure, verify the
  graph, execute natively, and agree with Node.
- Each direct Test262 algorithm-step mapping retains both default and strict variants. All four
  remain failed because the custom `Symbol.iterator` setup exceeds the current array-only
  `GetIterator` product profile. Exact before/after comparisons retain the same variant identities,
  contain no pass regression or cohort drift, and do not manufacture a green subset. The
  digest-bound records are `spec/evidence/iterator-complete-test262.json` and
  `spec/evidence/iterator-value-test262.json`.
- The generated ledger is zero-gap at 2,655/2,655: 108 complete, 16 partial, and 2,531 blocked.
  Seven mapped operations retain 266 Test262 variants (135 passed, 130 failed, one refused).
  `spec:ledger:gate` is green, `coil test` is green at 56/56, and the frontier remains the same
  four honest open bugs.

## 2026-08-27: specialized JSL helpers cannot masquerade as canonical spec claims

- Added checked `:specializes` metadata for deliberately narrower helpers. It is mutually exclusive
  with canonical `:spec`/`:spec-name`/`:status`, requires a pinned normative clause plus a non-empty
  narrowing description, and is retained directly on `JslDecl`. The checker refuses missing
  descriptions and mixed claim/specialization forms by name.
- Offline provenance independently rejects stale, unknown, or informative specialization targets.
  Provenance schema 2 emits a separate `specializations` collection and excludes those declarations
  from canonical candidates. Coverage validates that schema, republishes the records, and reports
  `specializedJslHelpers` as a separate measurement rather than coverage.
- Annotated four genuine narrowings: machine-index `ToLength`, Number-hint
  `OrdinaryToPrimitiveNumber`, String/String `StringEquals`, and String/String `StringCompare`.
  None can now be promoted accidentally from an exact name or nearby spec link. The unrelated
  `IsPrimitiveValue` false association was fixed by attaching the ToNumber link to the actual
  `ToNumberValue` declaration instead of silencing the helper.
- The generated state has 371 JSL declarations, 14 canonical partial claims, four specialized
  helpers, 62 unique review candidates, three ambiguous candidates, and 292 declarations with no
  name candidate. Coverage remains zero-gap at 2,655/2,655; specialization does not change a
  normative item's status.
- Six offline provenance tests and the new JSL parser/checker cases cover the accepted and refused
  forms. `spec:ledger:gate` is green, and `coil test` is green at 56/56.

## 2026-08-27: RequireObjectCoercible has one canonical JSL owner

- Replaced the duplicate `ObjectCoercible` and string-specific `RequireObjectCoercible`
  implementations with one canonical definition in `lib/abstract/coercions.jsl`. Array methods,
  object built-ins, string indexOf, `ToObjectValue`, and empty object destructuring all delegate to
  it. The frontend changed only the name of its structural destructuring call; semantics remain in
  `lib/`.
- The canonical operation returns every represented non-nullish value unchanged and creates a real
  `TypeError` object for `null` or `undefined`. Its pinned claim is partial only because BigInt is
  outside the represented frontend/runtime surface. `npm run spec:operation --
  RequireObjectCoercible` passes dependency lowering, graph verification, and a source witness that
  catches its TypeError path and agrees with Node.
- The two direct String Includes Test262 algorithm-step tests for null and undefined receivers are
  retained at the pinned revision. All four default/strict variants remain failed with execution
  signal 5 because the existing function-call receiver bridge is still open; the exact comparison
  has four `failed->failed`, zero drift, and zero pass regressions. Evidence is
  `spec/evidence/require-object-coercible-test262.json` rather than a manufactured green subset.
- The generated ledger remains 2,655/2,655 classified: 108 complete, 14 partial, and 2,533 blocked.
  Five mapped Test262 operations now account for 262 exact variants. `spec:ledger:gate` is green,
  and `coil test` is green at 55/55.

## 2026-08-27: SameValueZero and Array.prototype.includes are executable partial claims

- `SameValueZero` and `ArrayIncludes` now carry pinned canonical ECMA-262 provenance, explicit
  partial deviations, focused native differential mappings, and reviewed classification overrides.
  The generated ledger remains zero-gap at 2,655/2,655 classified; 108 are complete, 13 partial,
  and 2,534 blocked. Four mapped Test262 operations now account for 258 exact variants.
- `npm run spec:operation -- SameValueZero` and `npm run spec:operation -- ArrayIncludes` both pass
  provenance freshness, dependency closure lowering, graph verification, and native execution.
  Their shared focused witness covers NaN, both signed-zero directions, equal/unequal strings,
  positive and negative `fromIndex`, omitted arguments, `undefined`, and object identity.
- The complete pinned `test/built-ins/Array/prototype/includes` cohort is retained rather than
  narrowed: 6 passed, 53 failed, and one refused across 60 variants. A second exact-identity run
  preserved all 60 outcomes with six `passed->passed`, 53 `failed->failed`, one
  `refused->refused`, zero drift, and zero pass regressions. Digest-bound evidence is
  `spec/evidence/array-includes-test262.json`.
- The cohort exposes honest next prerequisites: generic primitive receivers, complete
  `ToIntegerOrInfinity`/large-index behavior, abrupt indexed access, built-in descriptor metadata,
  resizable buffers, harness-global publication in large programs, and one large SameValueZero
  selection refusal. These are not hidden by the partial claim.
- The focused ArrayIncludes program initially exposed unsorted Mach-O stackmap roots. Root pairs
  are now explicitly sorted by instruction site and vreg before lower-bound lookup/serialization;
  the 12-assertion native witness executes and agrees with Node. `coil test` is green at 55/55,
  and `spec:ledger:gate` is fully green.

## 2026-08-27: pinned Level 5 evidence and reviewed ownership families are executable

- `npm run spec:test262 -- NAME` resolves deterministic repository-relative cohort mappings,
  refuses any Test262 checkout except pinned commit `d86b2294e…`, retains expanded variants, and
  can compare them against an exact prior JSONL even when the cohort contains failures.
- The first authoritative `ToBoolean` cohort contains 38 logical-not variants: 30 pass and eight
  fail. A separate after run preserved the exact 38-variant cohort with 30 `passed->passed`, eight
  `failed->failed`, zero pass regressions, and no drift. Digest-bound evidence is retained in
  `spec/evidence/toboolean-test262.json`; coverage verifies its commit, mapping, JSONL digest,
  identities, and totals offline.
- The cohort disproved the earlier complete claim: two direct BigInt variants fail because BigInt
  is outside the represented frontend/runtime surface. `ToBoolean` is now honestly partial with
  that explicit deviation. The other six failures expose `eval` and constructor/runtime
  prerequisites and remain visible; the mapping was not narrowed to manufacture green evidence.
- Classification rules now cover 387 normative productions, 149 grammar-enclosing clauses, 94
  static-semantics operations, 132 runtime-semantics SDOs, 18 reviewed evaluation/instantiation
  operations, 525 unreviewed built-in algorithms, 143 semantic method protocols, and 20 host or
  implementation-defined operations. Coverage is 1,453/2,655 classified; all 1,450 blocked items
  reference validated capability records, three reviewed JSL claims are partial, and 1,202 clauses
  remain in a generated non-claim review queue.
- `tools/analyze-test262-results.mjs` no longer inserts unrelated full-run timing and variant
  constants into focused reports. New runner summaries retain actual timing/variant metadata;
  analysis without a summary omits those fields rather than inventing them.

## 2026-08-27: Test262 comparisons use exact expanded-variant identities

- `tools/compare-test262-results.mjs` compares retained JSONL by canonical `test/...` path plus
  expanded variant, so different checkout roots do not manufacture cohort changes.
- The comparator rejects duplicate identities and unknown statuses, reports added/removed variants
  separately from shared-result transitions, and exits nonzero for either cohort drift or any
  shared `passed` to non-passing transition. Improvements remain visible as exact identities.
- Three focused tests cover cross-checkout identity, regressions versus cohort drift, duplicate
  rows, and invalid outcomes. A real retained 44-variant artifact compared to itself with 44 shared
  variants, no drift, and no pass regression. `npm run test262:compare -- BEFORE AFTER` is the
  retained comparison command; the focused tests are part of `spec:ledger:gate`.

## 2026-08-27: coverage overlay and one-operation workbench are executable

- `spec/generated/ecma262-coverage.json` merges generated JSL claims with the reviewed
  `spec/ecma262-classifications.json` overlay. It accounts for all 2,655 normative items, resolves
  4,449 abstract-operation dependency edges, computes public-builtin closure status and transitive
  unlock scores, and rejects invalid owners/statuses, missing evidence, dishonest partial/complete
  combinations, duplicate claims, and blocked entries without prerequisites.
- `npm run spec:operation -- NAME` checks manifest freshness, lowers only the selected JSL
  declaration and its transitive callees, verifies the graph, and runs a retained native-versus-
  Node witness when mapped. `ToBoolean` is complete and passes the focused command; `SetProperty`
  is explicitly partial and passes its represented ordinary-data-property witness. Coverage is
  3/2,655 classified: one complete, two partial, and 2,652 unclassified.
- The callback/abrupt `ArrayReduce` representative exposed a real regression: its graph verifies,
  but selection builds a phi copy whose destination is the phi itself. It is now the executable
  `repros/open/reduce-callback-throw-invalid-phi-edge.js` frontier case, with node's answer 9. The
  frontier is honestly three bugs; generated frontier and what-works reports were refreshed.
- Complete JSL claims are rejected by coverage generation unless
  `spec/ecma262-operations.json` names a retained focused native differential witness. A source
  citation alone cannot create complete status.

## 2026-08-27: descendant self captures and parameter environments stop corrupting graphs

- Resolver capture classification now distinguishes a named expression's private function-ID
  binding from declaration/call-target identities. Descendants record that lexical capture, and
  runtime capture filtering owns it relative to the named expression itself rather than its
  parent. Ordinary nested functions can now retain and return the exact self callable.
- Private self publication at function entry now precedes default-parameter evaluation, matching
  the named-expression environment's creation order. Parameter-created descendants therefore
  capture an initialized cell rather than `NO-NODE`.
- Default parameter expressions are resolved before body `var` bindings enter scope. The resolver
  then rebuilds the body stack as hoisted locals followed by parameters, preserving body
  var/parameter shadowing while keeping body-only declarations invisible to parameter closures.
- The full `language/expressions/function` directory moved from 52 passed / 43 failed / 4 refused
  to 59 passed / 36 failed / 4 refused. The retained comparison shows seven failed-to-passed
  transitions and zero regressions: four `scope-name-var-*` variants, two
  `scope-paramsbody-var-open` variants, and `arguments-with-arguments-lex`. Evidence:
  `results/test262-function-expressions-after-parameter-env-order-2026-08-27.jsonl`.
- Focused evidence is 4/4 for descendant private-self captures and 4/4 for the open/closed
  parameter/body environment witnesses. `coil test` is green at 52/52; the final frontier remains
  exactly `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-27: named-expression self bindings are private, immutable, and first-class

- Resolution now creates a private binding only for explicitly named function/class expressions;
  declarations retain their surrounding hoisted binding, and method/accessor property names are
  not treated as body bindings. Both resolver entry paths apply the same rule.
- The frontend supplies callable ABI/storage structure only when the body actually resolves a use
  of that private symbol. Parameter 0 publishes the current callable at entry, first-class self
  reads retain object identity, and descendant arrow/function captures materialize the binding as
  a cell. Empty named expressions keep their prior representation and function metadata.
- Assignment meaning remains in `lib/`: `SetImmutableBinding` preserves the RHS and binding in
  sloppy code and throws `TypeError` in strict code. The frontend only recognizes the immutable
  lexical binding and routes the write; no Test262 harness behavior changed.
- The focused function-expression cohort moved from 2/6 to 6/6: direct self reads, sloppy no-op
  writes, strict throws, and arrow captures all pass in their required modes. Evidence:
  `results/test262-named-function-expression-immutable-final-v3-2026-08-27.jsonl`.
- The complete `language/expressions/function` directory currently reports 52 passed, 43 failed,
  and 4 refused across 99 executable variants. Remaining families include `eval`, parameter
  environments, function `length`, `with`, and separate scope-cell bugs. Evidence:
  `results/test262-function-expressions-full-after-private-self-2026-08-27.jsonl`.
- `coil test` is green at 52/52. Final `coil test --suite frontier` remains exactly the two expected
  red bugs: `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-27: caught exceptions remain effectful when the binding is unused

- Catch entry now sequences descriptor-102 `ExceptionTake` through a dedicated
  `Effect(control, memory, value) -> memory` ideal node. The node emits no machine instruction of
  its own; it orders selection of the existing runtime operation and prevents reachability/DCE from
  deleting the pending-exception state clear when a catch binding is absent or unread.
- `Effect` is compiler structure, not JavaScript semantics. Its opcode metadata, graph text codec,
  verifier contract, dead-control idealization, alias-transparent frontend memory ownership, and
  backend ordered-memory traversal are explicit. No Test262 harness behavior changed and no
  JavaScript operation was open-coded outside `lib/`.
- The focused empty, constant-only, and value-reading catch matrix moved from 2 passed / 4 uncaught
  failures to 6/6 across default and strict variants. The empty-catch bounded witness throws again
  afterward, proving the first pending exception was consumed rather than hidden. Evidence:
  `results/test262-flatmap-catch-effect-memory-v3-2026-08-27.jsonl` and its summary.
- `coil test` is green at 52/52. Final `coil test --suite frontier` reports exactly the two
  expected open bugs: `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.
  `coil test --suite full` is currently blocked before execution by unrelated dirty test sources:
  unbound `JSV-RESERVED-0` in `tests/backend-test.coil:260`, and an existing malformed
  `agrees-with-node?` form at `tests/native-execution-test.coil:1138`.


## 2026-08-27: `%UnboxArray` stays below its DSL control guards

- JSL primitive lowering now constructs `%UnboxArray` as `ArrayUnbox(jl-ctrl, value)` instead of
  sending it through the generic null-control value-op builder. This is representation/control
  structure, not JavaScript semantics; `ArrayConcatValue` and `ArrayFlatMap` remain entirely in
  `lib/array/build.jsl`.
- The production `flatMap` abrupt-completion trap is fixed. Crash tracing mapped signal 5 to ideal
  `ArrayUnbox` node 45671 in machine block 6421. Its ideal control was `-1`, so GCM anchored it
  through the callback value to the block *before* descriptor-101's pending-exception branch and
  checked the exceptional tagged-`undefined` placeholder as an Array. The expected tag guard was
  correct; the missing ideal control was the whole defect.
- The original focused Test262 witness moved from 0/2 signal-5 failures to 2/2 passing. The complete
  callback-abrupt family is 8/8 (`direct`, `map`, `every`, and `flatMap`, default plus strict).
  Evidence: `results/test262-flatmap-abrupt-original-fixed-2026-08-27.jsonl` and
  `results/test262-callback-abrupt-family-array-anchor-2026-08-27.jsonl`.
- Empty and constant-only catch reductions now expose a separate bug instead of trapping: they
  reach the uncaught sink, while a catch that reads `e` passes. `ExceptionTake` is currently a
  value-only `JsBuiltin`; when its result is unused, graph reachability deletes the state-clearing
  runtime operation. The next clean fix is to thread exception transport as an effect, not retain
  it with a fake JavaScript use.
- The complete upstream `flatMap` checkout is not present locally, so no cohort-wide transition is
  claimed. `coil test` is green at 52/52; the 40,000-pass goal remains active.

## 2026-08-27: standalone JSL calls now publish abrupt returns

- `jl-lower-decl!` now collects abrupt edges owned by a standalone DSL declaration and publishes
  each one as a descriptor-104 exceptional `Return` on that declaration's `Fun`. A callback result
  is never consumed as an ordinary value after the pending flag becomes true; the caller receives
  the existing pending-exception ABI and checks it before touching the placeholder result.
- This is shared lowering infrastructure, not an Array or Test262 special case. JavaScript meaning
  remains in `lib/`; no harness behavior changed. The bounded native witness includes a throwing
  `flatMap` callback caught by source `try`/`catch`, and `coil test` is green at 52/52.
- Production Test262 compilation still exposes a separate signal-5 failure for the same `flatMap`
  shape. The callback is correctly published and dispatched (`id=12`, record/owner 109), `%Throw`
  sets pending to 1, and descriptor 101 reads tagged true. No later array operation executes, but
  descriptor 102 (`ExceptionTake`) is not reached before the trap. `map`, `every`, and a direct
  call with the same callback pass. Inline function, inline arrow, and variable-held callbacks all
  fail; empty, constant, and value-using catch bodies all fail. Seed serialization is excluded:
  `--no-seed-artifact` behaves identically.
- Authoritative traces are retained locally in
  `results/test262-abrupt-flatmap-array-trace-2026-08-27.jsonl` and
  `results/test262-callback-abrupt-family-2026-08-27.jsonl`. A proposed change replacing the merged
  throw dependency Phi with a neutral value produced zero transitions and was reverted. The next
  investigation should identify the exact generated `brk` after the pending-true branch; LLDB
  attached only to the compiler parent and could not follow the execution grandchild.
- The persistent 40,000-pass goal remains active. The frontier is expected to remain exactly the
  two recorded bugs, `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-27: empty-string logical values confirmed after native cache invalidation

- Complete logical-AND plus logical-OR cohorts now report 52 passed / 16 failed / 0 refused across 68 variants. Each directory is 26/34, up from 24/34 at `bc8eaa7` and 22/34 before tagged logical arms.
- The four new transitions are default and strict `S11.11.1_A3_T3.js` and `S11.11.2_A3_T3.js`: empty strings now drive the correct branch and preserve the selected string value. No previous passes regressed.
- The source fix was already in `bc8eaa7`: native `VALUE_TRUTHY` resolves raw or tagged managed strings and tests the runtime record length. Test262 rebuilds initially appeared unchanged because Coil reused `.coil/build/native/2232296025890215446/source.o` from 00:31 after `native/gc/runtime.c` changed. Removing that one stale object and rebuilding made all four focused variants pass. This is a Coil native-source cache invalidation bug, not a harness semantic adjustment.
- Authoritative results: `results/test262-logical-empty-string-native-runtime-2026-08-27.jsonl` and `results/test262-logical-cohorts-empty-string-fixed-2026-08-27.jsonl`, with summaries.
- Of the remaining 16 cohort failures, four require `eval`, two are missing function binding/TCO, and ten are one unresolvable-reference family. Direct and logical missing-name reads catch an allocated object whose `name`, `message`, and `constructor` initialization stores are absent; explicit top-level `new ReferenceError` survives intact. Converting `NewErrorObject` to a builtin produced zero transitions and was reverted. The next target is abrupt-path property-memory capture for DSL-thrown global-reference errors. Focused evidence is retained in `results/test262-unresolvable-reference-error-memory-2026-08-27.jsonl`.
- `coil test` is green at 52/52. `coil test --suite frontier` remains intentionally red at exactly `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-27: logical signed-zero values now survive truthiness selection

- `If` selection now sends every predicate not proven to be a raw machine number through the JavaScript value-truthiness primitive. The old `n-ty == dyn` test misclassified tagged numeric merges such as `-0` because ideal type is not machine representation.
- Native value truthiness now resolves raw or tagged managed strings through the canonical string registry before applying the generic tagged-value rule. Empty-string Test262 cases remain open; this is retained as representation support rather than claimed as a transition.
- The bounded native witness pins `undefined || string`, empty-string `&&`/`||`, and signed-zero result preservation. `coil test` is green at 52/52.
- Complete logical-AND plus logical-OR cohorts report 48 passed / 20 failed / 0 refused across 68 variants, up from 44/68. Each directory moved from 22/34 to 24/34. The four failed-to-passed transitions are the default and strict signed-zero cases `S11.11.1_A3_T2.js` and `S11.11.2_A3_T2.js`; no prior passes regressed.
- Empty-string cases `S11.11.1_A3_T3.js` and `S11.11.2_A3_T3.js` remain red in both variants. The selected Script value still behaves as the empty left operand; this is the next focused logical-value defect.
- Authoritative output: `results/test262-logical-cohorts-representation-truthiness-2026-08-27.jsonl` and its summary. Focused transition evidence: `results/test262-logical-truthiness-witnesses-2026-08-27.jsonl` and its summary.
- `coil test --suite frontier` remains intentionally red at exactly the two recorded bugs: `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-27: logical value merges preserve the JavaScript tagged boundary

- `&&` and `||` used to merge raw operand representations directly into a `dyn` Phi. `verifyProp || name` therefore selected an untagged string pointer when the left operand was `undefined`, even though the source-level result was an ordinary JavaScript String.
- Logical value arms now cross the same tagged boundary as conditional and nullish expressions, using the tagged-aware argument helper so already-tagged parameters, property loads, and call results are not boxed twice. The frontend still owns only branch structure; truthiness and value semantics remain in the DSL/IR contracts.
- The bounded native witness covers both a false raw-Boolean helper result and `undefined || "value"` used as a computed property key. `coil test` is green 52/52. The frontier remains exactly the expected `for-await-has-no-bridge-kind` and `shortest-round-trip-digits` failures.
- The reduced upstream `propertyHelper.js` `isWritable` shape moved from 0/2 to 2/2. In each complete Int8Array and Uint8Array constructor cohort, constructor and prototype `BYTES_PER_ELEMENT` moved failed-to-passed in both variants. Four former passes also became honest failures because the same broken helper had hidden writable-constructor and thrown-value defects, so each cohort remains 6 passed / 16 failed / 0 refused rather than claiming false progress.
- Complete logical-AND and logical-OR expression directories each report 22 passed / 12 failed / 0 refused across 34 variants. Remaining direct value bugs include preserving `""` and `-0`; eval and TCO cases have independent missing-global/function issues. Retained results are `results/test262-logical-{and,or}-tagged-values-2026-08-27.jsonl` and `results/test262-{int8,uint8}-tag-aware-logical-boxing-2026-08-27.jsonl`, with summaries.

## 2026-08-27: `Object.getPrototypeOf` is a DSL operation and JSDoc metadata is not executable syntax

- Added `%GetPrototype` as the runtime property primitive and implemented `ObjectGetPrototypeOf`, its callable entry, and the standard `Object.getPrototypeOf` function value in `lib/abstract/property.jsl`. The frontend only recognizes the structural direct/aliased call and publishes the DSL-owned function value; JavaScript semantics remain in `lib/`.
- Objects now retain the canonical tagged prototype value alongside the runtime prototype record. GC relocation updates that side edge, so prototype identity survives movement and `Object.getPrototypeOf` returns the JavaScript-visible value rather than a compiler-internal record.
- Fixed the TypeScript-Go multi-script bridge so parser JSDoc nodes remain registered for stable role IDs but are detached from both ordinary child lists and the virtual compilation-unit statement list. This is not a Test262 harness exception: comments and JSDoc metadata no longer become executable statements for any multi-script compilation.
- The focused aliased `Object.getPrototypeOf` native witness and a JSDoc `@callback` witness are in the bounded gate. `coil test` is green at 52/52. `coil test --suite frontier` remains intentionally red only for `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.
- Complete Int8Array and Uint8Array constructor cohorts each remain 6 passed / 16 failed / 0 refused across 22 variants, with zero regressions. The two `proto.js` variants in each family now compile and execute instead of aborting on bridge kind 0; they expose the next independent dependency, `Float64Array is not defined`. Retained results: `results/test262-int8-get-prototype-jsdoc-final-2026-08-27.jsonl` and `results/test262-uint8-get-prototype-jsdoc-final-2026-08-27.jsonl` plus summaries.
## 2026-08-27: typed-array constructor cohort has zero compiler refusals

- The last refusal was an optimizer miscompile, not a selector limitation. A nested short-circuit
  expression correctly built an outer value Phi over Region 101267, but `phi-single-input`
  discarded its bypass arm because that control was dead-typed in the proof snapshot. Another
  rewrite in the same sweep rewired the bypass live, leaving `Not(innerPhi)` on a block the inner
  Phi did not dominate.
- Phi collapse now follows the structural Region/Phi invariant: `region-remove-path!` exclusively
  owns proven-dead path deletion and removes the matching Phi arm atomically. `phi-single-input`
  ignores only self-edges and never independently skips a dead-typed structural arm. This keeps
  irreversible value removal from depending on sweep order.
- The complete 44-variant Int8Array/Uint8Array constructor cohort is now 8 passed / 36 failed /
  0 refused, preserving every prior pass and converting the final compiler refusal into an honest
  descriptor failure. Retained result:
  `results/test262-int8-uint8-zero-refusals-final-2026-08-27.jsonl`.
- The next progress is JavaScript semantics rather than compiler infrastructure: constructor
  classification, prototype chains, property descriptors (`BYTES_PER_ELEMENT`, `constructor`,
  `name`, `length`), and ordinary built-in metadata account for this cohort's executable failures.
- `coil test` is green 52/52. `coil test --suite frontier` remains exactly the expected two red
  bugs: `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-27: dead folded branches no longer become impossible machine blocks

- Test262 typed-array constructor refusals converged on ideal `If` nodes whose two `CProj` arms
  and every continuation had folded away. `backend_cfg` walked forward from reachable control,
  retained the obsolete `If` as a block, and selection then correctly refused to emit a two-way
  terminator for a block with zero successors.
- `be-if-has-machine-continuation?` now admits an `If` to MachineUnit control discovery only when
  it has a live projected control continuation or a live direct continuation rewired around a
  folded arm. This is CFG structure, not JavaScript meaning; no DSL, frontend, or harness semantics
  changed.
- The exact 44-variant Int8Array/Uint8Array constructor cohort moved from 8 pass / 25 fail / 11
  refuse to 8 pass / 35 fail / 1 refuse. Ten selector refusals now reach executable semantic
  failures, with zero lost passes. Retained result:
  `results/test262-int8-uint8-live-if-final-2026-08-27.jsonl`.
- The one remaining refusal is a separate SSA/CFG defect in strict
  `Uint8Array/prototype/BYTES_PER_ELEMENT.js`: `Not(Phi<bool>)` is consumed in a sibling block with
  a bypass predecessor not dominated by the Phi Region. Late GCM reports earliest block 10364 and
  latest/use block 10365; cloning or hoisting the unavailable value would be wrong. Selector and
  native-harness diagnostics now preserve the full ideal/machine dependency chain and late-GCM
  block/idom data for that next fix.
- `coil test` is green 52/52. `coil test --suite frontier` remains exactly the expected two red
  bugs: `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-27: typed-array numeric keys and one-byte stores are DSL-owned

- `TypedArrayIndex` now parses canonical nonnegative decimal property keys in a JSL `builtin`.
  The call boundary is intentional: inlining its control-flow loop into generic property access
  reproduced the known non-entry JSL control-flow corruption. No frontend or Test262 harness
  behavior was added; `GetProperty`, `SetProperty`, and `HasProperty` remain ordinary DSL callers.
- The parser normalizes raw/tagged string representation at its boundary, rejects empty strings,
  leading zeroes, nondigits, and values above the signed internal-index range, and never requires
  compiler intern tables at execution time.
- `TypedArraySet` boxes the raw SSA right-hand side before `ToInt32`, stores the low byte in the
  shared ArrayBuffer backing array, and returns the tagged assigned value. Int8 reads sign-extend;
  Uint8 reads remain unsigned; absent backing slots read as zero.
- `one_byte_typed_array_views_are_dsl_owned` pins zero initialization at indices 0 and 3, shared
  backing-buffer writes, Uint8 wrapping, Int8 signed reads, accessors, identity, and
  `ArrayBuffer.isView` in the bounded native gate.
- The exact final 44-variant Int8Array/Uint8Array constructor measurement is 8 passed / 25 failed /
  11 refused, with no lost pass. The equivalent inlined algorithm reached 8 / 36 / 0 but caused
  unrelated invalid execution, so that better-looking result was rejected. Retained result:
  `results/test262-int8-uint8-builtin-index-final-2026-08-27.jsonl`.
- Broad ArrayBuffer measurement exposed a compiler sensitivity rather than a semantic failure.
  The inlined loop produced 46 pass / 340 fail / 4 refuse / 1 skip and regressed both variants of
  `prototype/byteLength/prop-desc.js`; the final builtin boundary restores strict to pass but
  default currently selects-refuses. The focused result is retained at
  `results/test262-arraybuffer-byteLength-prop-desc-builtin-final-2026-08-27.jsonl`. This remaining
  passed-to-refused transition is explicit and is the next selector target; it was not hidden by
  changing the harness or weakening a test.
- `coil test` is green 52/52. `coil test --suite frontier` remains exactly the expected two red
  bugs: `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-27: ArrayBuffer foundation is stable; Int8Array/Uint8Array globals are live

- Added DSL-owned fixed-length `ArrayBuffer` semantics and ordinary-object internal slots in
  `lib/array-buffer/core.jsl`: construction and call rejection, length validation, `byteLength`,
  `resizable`, `maxByteLength`, `detached`, `ArrayBuffer.isView`, species, and toStringTag. The
  frontend only recognizes syntax/global structure and delegates all visible behavior to JSL.
- The complete 391-variant ArrayBuffer cohort is retained at
  `results/test262-arraybuffer-int8-uint8-final-2026-08-27.jsonl`: 48 pass, 338 fail, 4 refuse,
  and 1 policy skip. This preserves the prior 48-pass fixed-accessor checkpoint exactly; the
  earlier foundation moved 20 variants from failed to passed with zero regressions.
- Added the first DSL-owned fixed-length `Int8Array` and `Uint8Array` constructor values, brands,
  backing-buffer identity, accessors, one-byte conversion, and numeric-index routing. In the same
  retained run each complete 22-variant constructor directory is 4 pass / 18 fail; constructor
  visibility and incompatible-receiver cases now pass.
- The next concrete typed-array defect is zero initialization of later sparse backing slots:
  `new Uint8Array(4)[0]` is zero, while index 3 currently reads `undefined`. Low-level array-store
  loops and `ArrayFill` do not materialize those opaque sparse slots reliably; the clean next fix
  is an internal element-presence/zero-filled byte-storage operation, not a frontend special case.
- Growing the JSL seed crossed the multi-script graph test's hard-coded function range at 128 and
  collided with `OrdinaryToPrimitiveNumber`. The structural witness now reserves 512 and 1024;
  verifier experiments were fully reverted. `coil test` is green 52/52. The frontier remains the
  expected two red bugs: `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-27: JSL provenance is checked data, not a spec-link comment

- JSL declarations now retain `:spec`, `:spec-name`, `:status`, and `:deviation`. The reader rejects
  incomplete metadata, a complete claim with a deviation, a partial claim without one, and two
  declarations claiming the same canonical clause. All failures have dedicated JSL error codes
  and focused positive/falsification tests.
- `ToBoolean` is the first end-to-end witness, pinned to
  `ecma262@ed463bc10dbeaad0410ce67e541a77ea8e9900a5#sec-toboolean` as a complete claim.
  `tools/jsl-provenance.mjs` independently checks the pin, clause existence, normative status,
  canonical name, status/deviation consistency, and uniqueness against the raw ledger.
- `spec/generated/jsl-provenance.json` is a deterministic support report. It currently states one
  verified complete claim and 367 declarations without provenance. Existing exact names and
  preceding spec-link comments produce 68 unique and four ambiguous review candidates, but never
  create implementation claims. `npm run spec:ledger:gate` checks the report offline.
- `docs/JSL.md` and `docs/ECMA262-LEDGER.md` document the declaration surface, review boundary, and
  regeneration commands. Focused JSL tests are 43/43 green; provenance tests are 4/4 green.

## 2026-08-27: pinned ECMA-262 source is an executable zero-claim ledger

- `spec/ecma262-sources.json` pins full ECMA-262 and Test262 commits and the SHA-256 of the exact
  Ecmarkup entry document. `tools/ecma262-ledger.mjs` acquires that revision into the ignored
  `.spec-cache/`, rejects dirty or mismatched inputs, and deterministically extracts clauses,
  algorithms, built-ins, signatures, effects, direct dependencies, grammar productions, and exact
  source locations.
- `spec/generated/ecma262-raw-ledger.json` accounts for 2,340 clauses (2,268 normative) and 404
  named productions (387 normative), with zero Ecmarkup warnings. Every normative item is
  explicitly `unclassified`; this tranche creates the complete work queue but makes no false JSL
  coverage claim.
- `npm run spec:ledger:gate` is the sub-second normal loop. Minimal imported-spec fixtures test the
  extractor, and an offline full-ledger validator checks pins, unique identities, locations,
  production references, classification fields, and recomputed totals without network access or
  Test262. `npm run spec:ledger:check` independently rebuilt the real pinned source and matched the
  committed ledger byte for byte.
- `docs/ECMA262-LEDGER.md` documents source updates, exact reproduction, focused fixture additions,
  and the boundary between raw extraction and reviewed implementation classification.

## 2026-08-27: Symbol callability is executable; nested callable bind remains open

- Fixed AArch64 in-memory publication for polymorphic calls. The runtime target table already
  mapped `MI-CALL` to `aot_js_dispatch_resolve`, but `nh-runtime-branch-pc` omitted the matching
  branch-PC case. The emitted `bl` therefore targeted itself forever. It now patches through the
  same verified 16-byte runtime veneer as every other external call.
- LLDB identified the exact stuck instruction as `bl` to its own PC. Focused witnesses now pass
  for a runtime-valued source call, ordinary captured `Function.prototype.bind`, direct
  `Symbol.prototype.valueOf`, and borrowed `valueOf.call(symbol)`.
- The complete retained Symbol cohort is
  `results/test262-symbol-call-reloc-2026-08-27.jsonl`: 32 passed, 120 failed, 2 refused, and 15
  policy-skipped. This intentionally makes no pass-rate claim from the relocation repair: the
  completed total is unchanged from the previous 32-pass run.
- The largest remaining Symbol blocker is Test262's property helper. Direct
  `hasOwnProperty.call(object, key)` passes, and ordinary source bind passes, but
  `Function.prototype.call.bind(Object.prototype.hasOwnProperty)` still forwards the nested JSL
  callable as its own receiver. Its trace is `FunctionBind1 -> BoundFunction2 -> FunctionCall2 ->
  FunctionCall2`; 44 Symbol failures currently surface through property-helper diagnostics.
- Two rejected experiments are not present: a selector-wide `Fun`/`Closure` boxing change broke
  ordinary bind, and a DSL fast path for bound `Function.prototype.call` corrupted both closure
  branches. The remaining fix belongs in the shared nested JSL callable receiver/capture ABI, not
  in Symbol or the Test262 harness. Other coherent Symbol gaps are strict primitive assignment,
  constructor classification/error paths, and object-to-string coercion ordering.

## 2026-08-27: complete ECMA-262-to-JSL execution plan

- `docs/ECMA262-JSL-COMPLETION-PLAN.md` is the strict breakdown for accounting for the complete
  pinned specification, assigning every normative item to JSL/frontend/runtime/host ownership,
  extending JSL only where spec machinery requires it, publishing intrinsics declaratively, and
  implementing the remaining language and built-in surface in dependency order.
- The plan makes focused feedback the ordinary loop: metadata checking, one-operation lowering,
  evaluator/native case tables, Node differential witnesses where valid, public-source witnesses,
  and mapped deterministic Test262 slices all precede subsystem or whole-corpus runs.
- Completion is defined by a generated zero-gap normative ledger, exact Test262 transition
  comparisons with no pass regression, complete internal-method/intrinsic matrices, reproducible
  manifests, a green bounded gate, and an honest frontier. No implementation behavior changed in
  this documentation tranche.

## 2026-08-26: global binding keys are runtime strings and ReferenceErrors name the binding

- Global binding semantics now have one representation: `GetGlobalBinding`,
  `TypeOfGlobalBinding`, `SetGlobalDeclarativeBinding`, and `SetUnresolvableBinding` accept the
  canonical runtime property-key string. Compiler-local shape-name IDs no longer cross this DSL
  boundary. The same string drives environment lookup, mutation, and `<name> is not defined`.
- The frontend supplies only identifier structure as a string constant. JavaScript-visible lookup,
  prototype traversal, strict/sloppy assignment behavior, and exception construction remain in
  `lib/abstract/property.jsl` through ordinary `HasProperty`, `GetProperty`, and `SetProperty`.
- The focused former failure now reports decoded `Date is not defined` in both variants. The full
  1,480-path former-ReferenceError cohort produced 2,815 variants in 441.233s with zero
  pass-to-nonpass transitions. Evidence:
  `results/test262-results-reference-errors-named-v2-2026-08-26.jsonl` and
  `results/test262-reference-error-paths-2026-08-26.txt`.
- Leading missing bindings are: `Symbol` 398, `Temporal` 366, `Date` 282, `eval` 263,
  `ArrayBuffer` 188, `Int8Array` 180, `Intl` 144, `Proxy` 141, `RegExp` 112, `Set` 81,
  `Promise` 68, `DataView` 59, `Map` 53, and `Reflect` 52. These are real absent subsystems, not
  globals whose existing DSL implementation merely needs publication. `Symbol` is the largest
  non-Temporal target, but requires a real primitive/key representation before its constructor can
  be materialized honestly.

## 2026-08-26: 10,000-path retained Test262 observability run

- A deterministic random 10,000-file Test262 selection is retained at
  `results/test262-random-10000-paths-2026-08-26.txt`; all 18,011 expanded variants are retained at
  `results/test262-results-random-10000-2026-08-26.jsonl`.
- Results: 4,009 passed, 10,880 failed, 1,879 refused, and 1,243 skipped. The resumed execution
  after recovery took 561.892s at 16 jobs.
- Of 5,048 visible JavaScript throws, 2,811 are decoded `ReferenceError` (2,810 say `unbound global
  identifier`), 235 are null throws, and 181 remain undecoded. Other leading failure classes are
  2,559 `SIGABRT`, 1,561 native signal 11, 961 graph corruptions, 472 native signal 5, and 222
  `SIGSEGV`.
- The previous complete-run JSONL and the first partial targeted rerun were deleted during disk
  cleanup, so the exact prior exit-70 path cohort could not be reconstructed. This deterministic
  sample replaces that lost evidence and lives under `results/` to keep it out of temporary-file
  cleanup.

## 2026-08-26: Test262 results retain JavaScript throw diagnostics

- Failed native execution now prefers the runtime's `uncaught JavaScript throw` diagnostic over
  the later generic `native-harness: execution failed` process summary. This changes reporting
  only; execution, harness assembly, and JavaScript semantics are untouched.
- The focused `Object.defineProperties/15.2.3.7-5-b-173.js` witness now records both variants as
  `uncaught JavaScript throw value=0x0000000000000000`, exposing the null throw previously hidden
  beneath exit 70. Evidence: `/tmp/aotk-exit70-observability-after.jsonl`.
- The existing deterministic 1,000-path corpus produced 1,644 variants in 65.382s: 375 passed,
  1,104 failed, 165 refused, and 147 skipped. Of 538 visible JavaScript throws, 330 are decoded
  `ReferenceError`, 18 are null throws, and 190 are other decoded or undecoded exceptions. The
  other leading failure classes are 257 aborts, 120 graph corruptions, 118 signal-11 crashes, and
  26 signal-named segmentation faults. Evidence:
  `/tmp/aotk-exit70-observability-1000.jsonl`.
- The bounded gate is 52/52 green. The frontier remains exactly the two expected open bugs:
  `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.

## 2026-08-26: cross-process JSL artifact is exact on disk but unsafe to execute

- The complete artifact-enabled run finished all 93,122 accounted variants in 3,708.366s:
  21,239 passed, 55,725 failed, 9,755 refused, and 6,403 skipped. Results are retained at
  `/tmp/aotk-full-artifact-20260826.jsonl`.
- That run is **not** accepted as the new default result. A current uncached control over 815 files
  that had passed in the prior v5 run found 34 passing variants. Comparing those exact variants
  against artifact execution exposed 17 cached pass-to-failed outcomes. Ten repeated runs over the
  disputed set produced 326/340 artifact passes versus 340/340 uncached passes.
- The serializer itself round-trips exactly: a seed built to `/tmp/aotk-seed-a.mfts`, loaded in a
  clean process, and reserialized to `/tmp/aotk-seed-b.mfts` is byte-identical. The defect is a
  missing separate-compilation invariant, not binary corruption.
- Exception tracing gives stable semantic witnesses. Retained `ObjectCreate` followed by property
  definition reaches `DefineProperty` with a value classified as non-object; retained
  `DefineProperties` misses descriptor/accessor behavior. This narrows the missing state to
  cross-process object/shape/callable metadata or relocation, despite direct-call ABI checks.
- The runner default is restored to fresh exec plus per-request JSL compilation. Artifact loading
  is available only with explicit `--seed-artifact`; source/graph batching remains default one.
  Parse and early-negative requests do not load the artifact because they do not lower JavaScript.
- Evidence: `/tmp/aotk-prior-pass-current-uncached-20260826.jsonl`,
  `/tmp/aotk-disputed-cached-*.jsonl`, `/tmp/aotk-disputed-uncached-*.jsonl`, and
  `/tmp/aotk-cross-process-trace-*.jsonl`. Next: make object/shape/callable identities fully
  relocatable, require 340/340 repeated equivalence, then repeat the complete run.

## 2026-08-26: clean Test262 processes now load an immutable compiled-JSL artifact

- The runner still compiles every Test262 Script in a fresh exec-created process with batch size
  one. It now builds the JSL machine-text seed once per invocation, writes a versioned binary
  `MachineFunctionTextStore` artifact, and loads that immutable prefix in every request process.
  No Realm, JavaScript global, AST, graph, or mutable compiler state crosses Script boundaries.
- The Coil-owned format contains every parallel machine-text table: semantic and ABI identities,
  code bytes, relocations, frame metadata, safepoint sites, and roots. Counts are bounds-checked;
  malformed/truncated files clear the store and fail. The import catalog is rebuilt from semantic
  identities after load rather than serialized as process state.
- Artifact startup re-reads and structurally lowers JSL declarations because that initializes
  frontend metadata needed by a fresh Script. It deliberately skips library graph analysis,
  selection, scheduling, allocation, encoding, and publication. Mean startup on the random
  100-path corpus is 30.96ms versus roughly 180-210ms for full seed compilation.
- Current-code control (`--no-seed-artifact`) on 166 executable variants took 18.836s and produced
  39 passed, 104 failed, 23 refused. The default artifact path took 18.103s in the final corrected
  run and produced 41 passed, 101 failed, 24 refused. There were zero pass-to-nonpass transitions:
  two positive destructuring variants changed from signal 5 to pass, and one changed from SIGSEGV
  to a compiler refusal. Evidence:
  `/tmp/aotk-random-100-current-uncached-20260826.jsonl` and
  `/tmp/aotk-random-100-artifact-lowered-20260826.jsonl`.
- `--no-seed-artifact` is retained as an explicit diagnostic control. The default gate now includes
  `tests/gate/seed-artifact-gate.coil`, which builds, writes, clears, reloads, links, executes, and
  cleans up a restored seed. `coil test` is 52/52 green.
- Next: run the complete supported Test262 scope with the artifact default, compare it to the last
  retained complete result, and investigate any passed-to-nonpassed transition before accepting
  the full-suite throughput number.

## 2026-08-26: warm singleton workers rejected; immutable seed artifact is the safe speed path

- Multi-test source/graph batching remains rejected and defaults to one. The 100-path comparison
  was slower in bulk and exposed a cross-unit indirect-call crash, so compilation-unit sharing is
  not an acceptable throughput mechanism.
- The server protocol no longer compiles in a post-fork request child. It now compiles directly in
  its exec-created worker; only generated JavaScript enters the later isolated child, which never
  calls Go. This removes the protocol's unsupported Go-after-fork operation.
- Long-lived mutable workers were tested but are **not** the runner default. On the same random
  100-path/166-executable-variant corpus, the clean baseline was 39 passed, 104 failed, 23 refused;
  warm singleton workers produced 38 passed, 105 failed, 23 refused. Exact comparison found three
  status transitions, including String `15.5.5.5.2-3-5.js` strict changing from pass to execution
  SIGSEGV. It passes when run first in a worker, proving order-dependent compiler-state leakage.
- Warm execution was 20.604s versus 20.344s for clean one-shot execution, so compiler crashes and
  worker replacement also erased the expected seed benefit. Evidence is
  `/tmp/aotk-random-100-warm-singleton-20260826.jsonl`; the clean baseline is
  `/tmp/aotk-random-100-singleton-20260826.jsonl`.
- The runner therefore remains fresh-exec-per-Script. The next throughput implementation is a
  versioned immutable artifact for `MachineFunctionTextStore`: persist the retained JSL records,
  relocations, ABI metadata, sites, and roots, then rebuild the import catalog after loading it in
  each clean process. This removes the measured 180-210ms JSL seed rebuild without preserving any
  mutable compiler or JavaScript state.
- `coil test` remains 51/51 green; frontier remains exactly `for-await-has-no-bridge-kind` and
  `shortest-round-trip-digits`.

## 2026-08-26: Test262 compilation now uses a fork-safe one-shot request boundary

- The warm supervisor architecture was invalid: it initialized the Go TypeScript runtime and then
  entered Go from forked request children. In a 510-variant former-timeout cohort, 501 completed
  records stopped after `source_parse_begin`, and two requests remained unreaped past timeout.
  This was a post-fork Go-runtime deadlock, not representative compiler performance.
- The default runner now `exec`s a fresh native request process for every independent Test262
  Script unit. The process parses and compiles from clean runtime state; generated JavaScript still
  executes in its own later fork child, which never enters Go. There are no source wrappers,
  concatenated tests, shared Realms, receiver rewriting, or persistent mutable compiler state.
- The rebuilt Map `valid-keys.js` witness parses in 3.1-3.4ms and reaches the expected frontend
  refusal in about 0.74s instead of timing out. The large Array sort stability witness parses in
  about 9ms and indexes in about 0.40s, then times out later in compilation; that is a separate
  large-program performance issue.
- Independent-unit bulk compilation remains opt-in (`--batch-size`; default 1). It structurally
  preserves distinct ASTs, Script records, callable ranges, and execution children, but it is not
  yet status-equivalent: the current two-variant `length-falsey.js` witness returns tagged
  `undefined` (`0x7ffc000000000000`) for both selectors instead of host status zero.
- Bulk-path defects fixed while diagnosing that mismatch: `REFUSED` is now a recognized batch
  outcome; fallback uses clean one-shot requests; linked images can be retained across isolated
  execution children and released once; batch compilation initializes the immutable JSL seed and
  publishes its suffix through `nh-cache-compiled-script?`; normal dispatcher completion is host
  status zero; retained entry selection uses ephemeral semantic identity rather than `symbol=-1`.
- Current evidence: `/tmp/aotk-exec-boundary-witness-20260826.jsonl` for the fork-safe singleton
  boundary and `/tmp/aotk-bulk-two-semantic-entry-20260826.jsonl` for the remaining bulk mismatch.
  `coil test` is 51/51 green; frontier remains exactly `for-await-has-no-bridge-kind` and
  `shortest-round-trip-digits`. Next: trace the linked owner-0 return path against direct owner-0
  execution and fix the retained image identity/layout issue before changing the default batch.

## 2026-08-26: retained Test262 cache crash is a function-text ownership defect

- The official-semantics architecture remains unchanged: each Test262 case is an independent
  ordered Script unit, executed in a fresh fork child. Speed comes from a persistent compiler and
  immutable compiled JSL records, never JavaScript wrappers, shared Realms, or receiver rewriting.
- Full 76-record retention exposed an AArch64 `CBZ` landing in veneer data. Crash tracing proved
  the instruction was internally well-sized and its CFG label was valid in the freshly encoded
  unit. The retained linker was copying a truncated function record, not misencoding the branch.
- `mft-extract-mode!` now diagnoses every plain `B`/`CBZ` whose target falls outside its claimed
  function-text range. The focused String-concat witness identifies owner 16: its record begins at
  byte 455216 and is truncated at 483336, while owner-16 blocks and branches continue through
  roughly byte 670000. Compact image assembly consequently omitted live control-flow targets.
- Selection lowering and the local scheduler now both publish canonical function/RPO order rather
  than raw graph-discovery block-id order. Those are correct independent fixes, but the focused
  witness proves a deeper owner/block inconsistency remains before encoding. Re-running with all
  existing graph/backend verification enabled did not reject it, so this invariant is currently
  absent from verification rather than hidden by the Test262 production policy.
- Runtime image registration now carries the actual linked code base separately from the kernel
  entry, semantic ephemeral lookup cannot collide with JSL symbols, and linked entry lookup uses
  the reserved synthetic-kernel symbol `-1`. Keep those fixes; retained prefixes make the old
  `kernel - first-function-offset` resolver arithmetic invalid.
- Current focused evidence is `/tmp/aotk-focused-post-allocation-layout-20260826.jsonl`; production
  verification is restored off. `coil test` is 51/51 green and the frontier remains exactly the
  two expected cases. Next: add a bounded final packed-owner/block invariant, identify the first
  mismatched instruction and producer phase, repair ownership at construction, then require zero
  out-of-record branches before repeating throughput measurements.

## 2026-08-26: 76/76 cache experiment identifies need for an explicit callable-id IR value

- Retained text now has `MFT-RELOC-CALLABLE-ID`, cache dependency closure understands that kind,
  AArch64 can emit a fixed four-word callable immediate, and image assembly can resolve its target
  by stable function kind/unit/local identity before patching an image-local callable symbol.
- Callable relocations participate in cacheability and retained dependency closure. With the
  callback exclusion temporarily removed, a rebuilt runner retained all 76 JSL records with zero
  dependency drops. The focused Script graph fell from roughly 30,943 to 24,540 nodes and from 34
  to 29 selected functions, proving that callback-bearing library work moved across the intended
  separate-compilation boundary.
- Reusing `Fun` itself as the closure target value was incorrect: the runtime closure field is an
  integer callable ID, and changing its ideal type/storage contract made the safe-seed witness
  segfault. That representation change was reverted. The correct next step is an explicit
  integer-valued `CallableId(target-fun)` ideal operation which preserves semantic target identity
  through selection without changing the closure object model.
- Production seed admission is restored to the proven 45 non-callback records. The relocation and
  collision-free symbol infrastructure remains present. The rebuilt safe-seed String concat
  witness passes default and strict. Do not reopen all 76 until the explicit IR value has a rebuilt
  native witness; `--no-build` uses the prior standalone runner binary and is not evidence after
  compiler source changes.

## 2026-08-26: Test262 cache seed is independent of test order

- The persistent singleton runner now builds its immutable cache from `lib/index` before compiling
  the first Test262 Script. It no longer treats an arbitrary first test's specialized graph as the
  common-library image.
- The seed includes exactly the transitive non-callback JSL subgraph. The DSL checker already
  computes `calls-back` to a fixed point, so excluded declarations include both direct JavaScript
  call forms and every JSL caller that can reach one. This preserves the existing closed-world
  callback semantics: callback-bearing operations are still compiled with each fresh Script.
- This is a proper separate-compilation boundary, not JavaScript batching: source and harness files
  remain independent Script records, and execution still occurs in a fresh fork child. The next
  expansion requires runtime-resolved indirect dispatch so callback-capable JSL can join the seed
  without embedding a test-specific function universe.
- The rebuilt focused String-concat witness passes default and strict variants. On the identical
  100-file String scope used by the preceding cache measurements, all 199 variants completed in
  58.744s versus 62.516s for the previous profiled path and 60.818s for its unprofiled run. Exact
  transitions are 74 passed-to-passed, 8 failed-to-passed, 117 failed-to-failed, and zero
  passed-to-nonpassed; totals are now 82 passed, 117 failed, 0 refused. The retained seed is a
  measurable improvement, not yet the large recovery expected from making callback-capable JSL
  separately compilable.
- Linked function metadata is now version 3 with explicit 32-bit JavaScript callable identity and
  signed return-normalization code fields. Both ordinary object publication and retained-image
  publication emit the same 40-byte record. The runtime resolves an ID against the currently
  registered image and returns its relocated code address plus ABI code; this is the shared
  architecture-independent foundation for replacing the AArch64 and x86-64 closed-world ladders.

## 2026-08-26: allocation-bearing JSL cache is live without semantic batching

- Runtime `MI-NEW` is fixed-width and retained text records three size plus two shape-ID
  relocations keyed by a stable runtime-layout fingerprint.
- Retained relocations archive size, field count, raw-reference bitmap, and boxed bitmap. The
  linker assigns per-image IDs, deduplicates exact layouts, rejects conflicts, appends
  `LayoutRec` metadata, and never retains compiler type/alias/Realm state.
- A shape-reset witness proves an allocation relinks after its original compiler shape table is
  gone. The slow-path publication locator was corrected to fixed word 37; before that fix the
  rebuilt child branched through the old variable-width relocation site.
- Rebuilt focused Test262 witness `String/prototype/concat/S15.5.4.6_A6.js` passes default and
  strict through cold and warm production paths.
- Identical 100-file String scope: 199 variants, 74 passed, 125 failed, 0 refused, and zero status
  transitions. Unprofiled total is 60.818s versus 74.903s immediately before this work. Profiled
  total is 62.516s; largest totals are selection 12.253s, frontend analysis 9.521s, native
  execution 9.290s, allocation 8.795s, native-to-first-output 8.617s, and suffix snapshot 6.334s.
- Cache admission changed from 11/18 directly cacheable with seven shape rejections and three
  retained to 18/18 directly cacheable with zero shape rejections and four retained. A later cold
  seed in the scope retained 7/23 after dependency closure.
- Runner stderr retention increased from 64 KiB to a bounded 1 MiB per active request. The old cap
  silently discarded completion-side cache/link/native profiles and produced impossible compile
  totals; persisted phase attribution is now complete.

## 2026-08-26: official singleton Test262 execution now reuses compiled JSL text

- The persistent native worker now retains ABI-identified, dependency-free JSL function text after
  its first successful Script compilation. Later requests lower matching declarations as explicit
  bodyless imports, compile a fresh Script-specific suffix, resolve semantic call/address
  relocations into an in-memory image, execute that image in the existing forked child, and
  truncate the suffix afterward. Test262 source and harness files remain ordered, independent
  Script records; there is no concatenation, generated JavaScript wrapper, shared executed Realm,
  or receiver substitution.
- The initial cache tier is intentionally safe and narrow. A retained JSL record must already be
  cacheable and contain no semantic call/address relocation, so it cannot refer to an omitted
  function. Imported functions retain stable identity plus declared ABI, have zero local CFG
  blocks, and are resolved by the ABI-checking image linker. A dependency-closed cache is the next
  expansion point; broadening retention without proving closure is prohibited.
- Integration exposed and fixed two backend assumptions that local bodies had hidden: call return
  representation now consults a declared function ABI before body inference, and return-tag
  propagation treats only `-1` as absent instead of rejecting valid negative function, closure,
  and array tags. AArch64 polymorphic dispatch now emits fixed-width semantic address relocations
  for imported targets rather than a one-word `BRK`, keeping sizing and emission identical.
- Warm imported suffixes bypass standalone memory publication because unresolved imports make a
  standalone image invalid; they proceed directly to the semantic linker. The linked entry is the
  first record after the retained prefix, which follows the owned snapshot invariant (fresh owner
  0 first) rather than guessing an identity kind. Every child result, including failure, truncates
  the suffix and clears linked-current state.
- Snapshot extraction was the dominant initial regression: it rebuilt global object indexes and
  GC roots once per function. Hoisting those unit-wide builders reduced warm suffix snapshot cost
  from about 346 ms/request to about 19 ms/request. On the identical 100-file String cohort (199
  variants), execution improved from 167,398 ms to 53,257 ms and total time from 175,896 ms to
  61,629 ms, a 2.85x end-to-end improvement. Both runs produced exactly 74 passed, 125 failed,
  zero refused, and zero skipped. Results are
  `test262-results-2026-08-26T05-07-06-172Z.jsonl` and
  `test262-results-2026-08-26T05-12-52-151Z.jsonl`.
- The focused upstream witness
  `built-ins/String/prototype/concat/S15.5.4.6_A6.js` passes both default and strict variants in one
  worker, proving cold publication followed by imported linking and execution. The bounded gate is
  51/51. Remaining performance work is ordinary fresh frontend/selection/scheduling/allocation and
  expanding the cache through a proven dependency-closed JSL set, not changing Test262 semantics.
- Retention now computes that dependency closure as a fixed point: a cacheable JSL record survives
  only while every semantic call/address target resolves to another retained JSL identity with an
  exactly compatible ABI. This is strictly more general than the original leaf rule and still
  cannot retain a dangling target. On the String concat witness it does not broaden the cache:
  cold admission reports 18 JSL records, 11 initially cacheable, 7 rejected for `MI-NEW` shape
  specialization, and only 3 dependency-closed records retained. Warm lowering remains 16 bodies
  and 6,167 nodes, so the observed 10-variant wall variation is not claimed as a cache speedup.
- The image linker already understands shape-id and shape-size relocations, but extraction does not
  yet emit them and imported bodies do not repopulate the fresh compiler shape table. Merely keeping
  the first test's shape table would make later compilation depend on corpus order and consume the
  bounded shape-id space, so that is not an acceptable shortcut. The next reusable boundary needs
  a deterministic cached-shape catalog (or a dedicated common-library/harness seed) whose runtime
  layout metadata is restored independently of any test Realm.

## 2026-08-25: internal calls now retain relocatable function metadata

- AArch64 previously resolved every direct internal `BL` during encoding and discarded the call's
  semantic relocation. `MachineUnit` now retains `(source owner, absolute code offset, target
  owner)` for every direct internal call while emitting the exact same branch bytes.
- Polymorphic JavaScript dispatch also embeds internal code addresses using
  `ADR + fixed-width delta + ADD`; these are not calls and cannot share the `BL` patcher. Both
  address-materialization sites now route through one helper and retain a separate
  `(source owner, ADR offset, target owner)` relocation stream. This closes the known internal
  layout dependencies in AArch64 text rather than caching code with hidden stale addresses.
- Read-only model accessors expose relocation count, source, offset, and target. The bounded object
  witness compiles a two-function call, requires one relocation, proves its site lies inside the
  recorded source function range, and independently checks the encoded `BL` against the target
  function's published code start.
- This is prerequisite infrastructure, not a cache or measured speedup. A reusable function-text
  record can now store a source-relative call site and repatch it at a new layout without retaining
  machine IR or scanning function ranges. External runtime relocations remain separate and
  unchanged. Stack maps, layout metadata, stable cache keys, and Script-global initialization are
  still required before any function can actually be reused across Test262 compilations.
- Direct-call relocation has a bounded byte-level witness. A focused polymorphic witness uses the
  valid runtime target set `{1, 2}`, requires exactly two address relocations, proves each ADR site
  lies inside its source function, verifies each target owner, and checks the encoded ADR opcode.
  `tests/backend-call-test.coil` is 20/21: this new witness is green; the sole failure is the
  pre-existing `explicit_capture_prefix_does_not_duplicate_closure_captures_or_shift_receiver`
  native execution mismatch and is unrelated to relocation metadata.

## 2026-08-25: backend-only profiling identifies the reusable-code boundary

- Direct profiling of one official ordered unit (`assert.js`, `sta.js`, then the test) avoids the
  runner's retained-stderr cap and accounts for the complete backend. The representative unit has
  17,631 ideal nodes, 25 machine functions, 3,177 blocks, 20,840 vregs, and 29,207 scheduled
  instructions.
- Selection spends 15.706 ms in recursive preselection and 7.378 ms emitting function
  terminators. Liveness totals 11.840 ms, led by a 2.315 ms predecessor-worklist solve; allocation
  totals 20.595 ms, led by 11.914 ms of exact interference construction and 5.461 ms of coloring.
  Liveness is already owner-local, word-packed, and worklist-driven; the old scheduler
  `pair_queries` number is not executed work.
- Per-function accounting shows 24,937 instructions before scheduling copies: 16,100 in the 12
  source-owned functions (including the 6,716-instruction host/main path) and 8,837 in 13 JSL
  functions. Scheduling adds another 4,270 instructions. Most work is therefore repeated common
  harness/runtime code, not the tiny test body or process protocol.
- The next large speed boundary is reusable compiled functions with relocatable calls and an
  explicit Script-global initialization interface. Official harness records still execute for
  every test against a fresh global; only immutable machine text and compiler results may be
  reused. Splitting frontend owners without that global lexical/declaration interface is not safe,
  and concatenation, JavaScript wrappers, or a shared executed Realm remain prohibited.
- Profile-only `machine_function` records now report owner, ideal function node, blocks, and
  pre-scheduling instruction count. They are emitted only under backend profiling and do not alter
  compilation or execution.

## 2026-08-25: shared JSL lowering is idempotent and allocator ingress setup is linear

- Independently appended Script units reserve one stable JSL function-id range, but declaration-
  local visited metadata resets per unit. `jl-require-decl!` now consults the retained graph by
  stable function id before opening a body. Width 2 consequently lowers 19 JSL declarations and
  6,594 nodes rather than 38 declarations and 13,224 nodes; calls from both units still reach the
  one shared body and participate in whole-image analysis.
- On the exact retained 100-file/190-variant cohort, width-2 execution fell from 17,174 ms to
  14,284 ms, a 16.8% improvement, while preserving 42 pass, 129 fail, 19 refuse, and zero exact
  `(path, variant)` status changes. It remains 26.8% slower than singleton and remains opt-in.
- Register-allocation initialization performed a complete machine-instruction scan for every ABI
  ingress copy merely to reconstruct that function's fixed argument-register mask. It now builds
  one mask per function during the existing instruction pass and applies it in O(1) per copy.
- The same exact singleton cohort remains status-identical and improves from 11,261 ms execution to
  10,623 ms, a 5.7% end-to-end execution gain. Aggregate allocation time fell from 9,544.6 ms to
  6,912.7 ms, a 27.6% phase reduction. Artifacts are `/tmp/aotk-current-single-v5.jsonl` and
  `/tmp/aotk-current-single-allocmask-v1.jsonl`.
- The reported scheduler `pair_queries` field is currently a legacy shape metric equal to the sum
  of squared block sizes, not an executed query count. Scheduler construction already uses indexed
  explicit dependency edges and a ready heap; do not cite that metric as performed work.

## 2026-08-25: exact batching equivalence is green, but combined backend work is slower

- Batched compilation now refuses unsupported members individually during independent frontend
  indexing. A rejected Script no longer poisons its supported neighbor or forces that neighbor
  through a redundant singleton retry. The protocol records `BATCH <index> REFUSED`, and the
  runner preserves it as native refusal status 2.
- The retained upstream 100-file/190-variant cohort is exactly status-equivalent between fresh
  singleton and width-2 runs: both report 42 pass, 129 fail, and 19 refuse, with **zero** per-path
  or per-variant status changes. Artifacts are `/tmp/aotk-current-single-v5.jsonl` and
  `/tmp/aotk-current-batch2-v5.jsonl`.
- Width 2 is not a throughput win and remains opt-in. Singleton execution took 11,261 ms; width 2
  took 17,174 ms, a 52.5% regression. Total times including the roughly 7.8-second Coil build were
  19,001 ms and 25,018 ms respectively.
- The cost is compiler work, not Realm/process isolation. Combined graphs make selection,
  scheduling, allocation, and analysis superlinear; later combined-graph failures also caused 51
  failed variants to retry at width 1. The correct next speed architecture is to retain independent
  Script parsing, indexing, graph ownership, and child execution while sharing immutable compiled
  harness/JSL machinery. Do not enable combined-graph batching by default merely because its
  semantics now agree on this cohort.
- The local 28-variant fixture corpus is also exact at width 1 versus 2 (28 pass, zero transitions),
  but width 2 took 2,276 ms execution versus 1,753 ms singleton. The bounded gate remains green at
  50/50; the frontier remains intentionally red on its two recorded bugs.

## 2026-08-25: real Test262 batching is end-to-end but remains opt-in

- The persistent protocol accepts a batch manifest whose rows retain one assembled Test262 unit
  each: official `assert.js`, `sta.js`, requested includes, and the test remain ordered Script
  records. The native harness independently parses/indexes every unit, reserves disjoint source
  callable ranges plus one shared JSL range, lowers one compiler-owned dispatcher, publishes once,
  and executes one selector per forked child.
- This is not enabled by default. `--batch-size` defaults to 1. Exact equivalence is now green on
  the current deterministic 100-file/190-variant cohort, but combined backend work is slower; see
  the newer entry above. Do not claim the earlier batch throughput measurements as usable.
- Fixed along the way: internal Script completion now uses Script rather than host-publication
  ownership; returned diagnostic words are no longer blindly called passes; normal Script
  completion is recognized as canonical `JSV-UNDEFINED`; singleton fallback retries use a fresh
  worker so late batch stderr cannot contaminate classification; and closure/direct-call metadata
  no longer assumes graph function id equals frontend-local id plus one.
- The earlier `assert` visibility failure was caused by dispatching a hard-coded function id rather
  than each indexed unit's actual synthetic main id. Entries now use the frontend's real main id;
  official harness declarations remain ordinary Script declarations and require no runner rewrite.

## 2026-08-25: independent Script units now share one compiler-owned dispatcher

- The frontend can now begin a Script compilation unit, append further independently parsed and
  indexed units without resetting graph/JSL state, emit an indexed native dispatcher, and run
  whole-image analysis once after the final append. Each unit receives a disjoint graph-level
  function-id base; no JavaScript wrapper or source concatenation participates.
- The bounded witness compiles two separate `NativeFrontend` instances at bases 64 and 128,
  requires both Script entry functions (65 and 129) and both host calls to remain live, verifies
  the combined graph, and selects the machine program. The bounded gate is green at 50/50.
- Host dispatch comparison is explicitly compiler-owned IR structure in `node.coil`; it is not a
  JavaScript equality operation and does not create an exception to DSL ownership. The frontend's
  exact semantic-op budget remains unchanged.
- This proves the core batching graph but does not yet make the Test262 runner use it. The runner
  still compiles one test variant per request. Next is a batch-manifest protocol, one published
  image per batch, and one forked child per selector, followed by singleton-versus-batch semantic
  comparison and timing. Harness records must remain official, ordered Script records, and every
  child must execute exactly one test against pristine pre-execution state.

## 2026-08-25: Script semantics no longer require the sole host Start

- Frontend compilation now distinguishes `script-entry` from `host-entry`. Script semantics
  (`this`, global declaration initialization, global environments, and no function `arguments`)
  remain attached to the former; graph publication, host exception completion, DSL entry control,
  and returns attached to global `Stop` belong to the latter. Existing compilation still sets both
  flags, so the ordinary path is behavior-neutral.
- `frontend-native-build-dispatched-script!` proves the next structural boundary without changing
  JavaScript source: it opens the synthetic Script entry as an internal `Fun`, compiles it with
  Script semantics, and emits a compiler-owned host `Start` call. The bounded witness requires the
  internal function and host call, verifies the graph, and selects the multi-function machine
  program. The gate is now 50/50.
- This is not yet multi-test batching. The next step is assigning globally unique function/symbol
  ranges to several independently indexed frontend units and extending the compiler-owned
  dispatcher to select one internal Script entry. No generated JavaScript function, shared Realm,
  or modified harness is involved.
- Source frontend ids now remain local while graph `Fun` identities accept an explicit reserved
  base. The dispatched-Script witness compiles at source-function base 64 and requires its live
  Script `Fun` identity to be at least 65 before graph verification and machine selection. This
  removes the first cross-unit collision without mutating frontend resolution tables. The remaining
  lifecycle work is to reserve every unit range up front, append units without resetting graph/JSL
  state, and run whole-image analysis plus one indexed dispatcher only after the final append.
- The attempted shortcut that reduced retained-snapshot folding to one seed round was rejected:
  an exact previously passing cohort found three passed-to-failed transitions. That experiment was
  removed. The sound selective first `iterate!` drain remains: the exact 107-variant passing cohort
  is restored to 107/107, and the earlier compiled cohort reduced mean frontend graph time from
  298.15 ms to 247.28 ms.

## 2026-08-25: loop discovery no longer rescans the complete CFG

- A 100-file/200-variant compiled Test262 profile confirms that singleton compilation is dominated
  by frontend graph work: 299.69 ms mean `frontend_graph`, including 230.54 ms of
  analyze/fold/iterate. Selection averaged 15.82 ms, allocation 10.63 ms, publication 2.84 ms, and
  native execution 2.33 ms. This is why process, parser, or publication batching alone cannot
  recover the old synthetic-wrapper throughput; the proper independent-entry architecture must
  reuse already analyzed harness code.
- Machine CFG loop discovery contained an unrelated but measurable algorithmic defect: for every
  backedge and every visited natural-loop block it scanned the complete edge array to rediscover
  predecessors, despite predecessor adjacency already being available. It now walks the block's
  predecessor slice. On the identical cohort, `mu_loops` fell from 18.66 ms to 0.394 ms per
  variant, a 47x phase reduction. End-to-end wall time was flat under eight-worker contention, so
  no whole-run speedup is claimed from this local fix.
- The exact official Module parse/early-error cohort is now 204/204, not the earlier 195/204
  checkpoint below. The bounded gate remains green at 49/49. Independent Script/Module entry
  batching remains active work and must not use generated JavaScript wrappers or shared Realm
  state.

## 2026-08-25: fresh-process in-memory execution removes the ARM64 loader round trip

- The semantically correct full baseline is retained as
  `test262-results-full-2026-08-25.jsonl`: 90,610 total variants, of which 84,302 were attempted;
  20,992 passed, 54,375 failed, 8,935 refused, and 6,308 were policy skips. It took 4,070,202 ms
  (67m50s) with eight persistent compiler workers. The complete module parse/early-negative cohort
  is now 204 pass and 0 fail for the currently enumerated Module parse/early-error cohort.
- The runner already compiles each case from distinct Script records (`assert.js`, `sta.js`, each
  include, then the test). It no longer combines independent tests as generated JavaScript
  functions. That preserves directive prologues, declaration instantiation, top-level `this`, and
  one fresh process/Realm per test, but exposes the real per-program compiler cost.
- ARM64 Test262 execution now forks the persistent compiler worker after code generation and runs
  the encoded machine code directly in the child. Copy-on-write process state preserves isolation;
  a pipe carries the complete i64 assertion result, and `alarm(2)` confines nontermination to the
  child. No Test262 source, metadata, harness file, or JavaScript operation is changed. x86-64 keeps
  the linked ELF path.
- A deterministic sample of 100 previously passing official files produced 196/196 passes with no
  status transitions. Mean matched attempt time fell from 155.53 ms in the retained full baseline
  to 113.26 ms, and native execution fell from 12.81 ms to 2.90 ms. This is a real 27% sample-level
  gain, not a restoration of synthetic-wrapper batching: graph construction, selection,
  allocation, and scheduling remain the dominant work.
- `--quiet` now actually suppresses all per-variant console lines; durable JSONL and summary output
  are unchanged. The bounded gate is green at 49/49. The active runner goal remains open: the next
  large throughput step must share compiled harness initialization across structurally independent
  Script entries, not wrap tests in functions or share JavaScript runtime state.
- ARM64 Test262 publication now emits only the model-verified stack-map and layout payload needed
  by direct execution, rather than serializing a complete Mach-O container and a duplicate text
  section. The same deterministic sample remains 196/196. Mean measured compilation falls from
  107.68 ms on the fork-only path to 89.10 ms; sample wall time is flat within contention/noise, so
  no additional end-to-end percentage is claimed. Full Mach-O publication remains exercised by the
  bounded native gate and all non-Test262 native paths.
- Ordinary runner invocations now default to `min(8, availableParallelism())` workers instead of
  serial execution. `docs/TEST262-INDEPENDENT-BATCHING.md` records the required compiler boundary
  for the remaining large gain: separate frontend declaration namespaces and structural Script
  entries sharing immutable harness text/code.
- Forced Module parsing no longer applies the Script-goal rule that rejects every static `import`,
  `export`, and `import.meta`. That bug made 109 module-negative tests pass for the wrong reason.
  The bridge now implements Module strictness; module `await`/`yield` grammar contexts; top-level
  import/export declaration position; imported-binding restrictions; imported/exported-name
  uniqueness; local export resolution; and default-export grammar using AST ownership and name
  tables. The exact 204-case cohort moved from an inflated 189 pass/15 fail, through an honest
  95/109 after removing the false positive, through 195/9, to **204 pass/0 fail**. This proves the
  currently enumerated cohort, not complete Module execution or every ECMAScript static semantic.

## 2026-08-25: runtime-backed globals no longer abandon successful exception checks

- Branch, loop, optional-expression, switch, and try/catch snapshots used `fng-assigned!` to build
  SSA carried-symbol sets. That set incorrectly included script globals, even though their sole
  JavaScript state already lives in `JS-PROPERTY-ALIAS`. Snapshotting such a symbol called the DSL
  global lookup, emitted a pending-exception guard, and then abandoned its successful control arm
  when construction restored another snapshot. The exceptional return remained live, so CFG
  selection either refused a dangling `CProj` or compiled the only surviving exceptional edge as
  an unconditional jump.
- `fng-assigned!` now admits only true lexical SSA bindings. Runtime-backed global-object and
  script-global symbols travel exclusively through the property-memory snapshot, matching the
  existing exception-target capture rule and keeping JavaScript-visible behavior in `lib/`.
- Pending transport now unboxes descriptor 101's tagged boolean before `If`, synthetic Script
  completion is emitted whenever live top-level control remains, and CFG construction ignores a
  folded projection only when it has no control continuation. The runtime also has opt-in
  `AOT_TRACE_EXCEPTION` records for transport operations 200--203; tracing proved every status
  read returned false before the erroneous uncaught operation executed.
- Focused evidence is 8/8: inert try/catch and no-throw-call witnesses plus default/strict variants
  of `assert-throws-incorrect-ctor.js` and `assert-throws-null-fn.js`. The complete local Test262
  fixture set is now 28 passed, 0 failed, 0 refused, and 0 skipped in
  `/tmp/test262-local-after-global-snapshot.jsonl`. A permanent native differential regression
  assigns a runtime-backed global on both try/catch arms and verifies normal no-throw completion.
- `coil test` is green at 49/49. `coil test --suite frontier` remains intentionally red on the same
  two open bugs. A monitored `coil build tools/test262-native.coil ...` completed in 9.82 seconds
  at 2,139,832,320 bytes maximum RSS (about 1.99 GiB), so that invocation did not reproduce the
  separately reported 60 GB event. Official modules, async completion, runtime-negative phases,
  complete early errors, `$262`, and the full official corpus remain protocol work; the active
  Test262-runner goal is not complete.

## 2026-08-25: batched Test262 runs no longer drop or misroute variants

- `--batch-size > 1` isolated parse-negative tasks into singleton units and then accidentally sent
  them through the ordinary one-shot execution path. A correct parser rejection was therefore
  reported as a native compilation failure. Parse negatives now run in an explicit persistent-
  server phase before positive compilation batches; batch size no longer changes test semantics.
- The runner now computes the exact expected result count before execution and aborts on any
  expected-versus-recorded mismatch. This caught an intermediate lifecycle design that silently
  omitted 254 object-expression variants instead of allowing another plausible but false summary.
- A mixed positive/negative witness under `--jobs 8 --batch-size 16` retained exactly 4/4 records.
  The complete accounted object-expression run retains exactly 2,042 records: 1,818 runnable
  variants plus 224 policy skips. Its 300 parse-negative variants all pass, yielding 856 pass, 880
  fail, 82 refuse, and 224 skip overall.
- This is runner correctness, not a JavaScript semantic gain. The authoritative full baseline had
  already passed 8,023 of the current parse-negative artifact's 8,420 variants; the current parser
  would recover 199 there. No harness-only reclassification is added to the rough compiler gain,
  and the active 30% goal remains incomplete.

## 2026-08-25: canonical escaped object keys add 258 passes

- The TypeScript bridge now exposes canonical identifier-name text separately from raw source
  ranges. Upstream `Node.Text()` decodes escapes such as `bre\\u0061k` to the JavaScript property
  key `break`; raw `ts-text` remains unchanged for source diagnostics and syntax inspection.
- Static object shapes and dynamic DSL property publication now consume the same canonical key.
  The frontend still owns only representation: object creation continues to call
  `SetNamedProperty`/the existing property DSL, and no JavaScript property semantics were
  open-coded.
- `test262-results-object-expression-canonical-names-v2-2026-08-25.jsonl` covers all 1,818 variants
  in `language/expressions/object`: 556 pass, 1,165 fail, 97 refuse, and 224 policy-skip. Against the
  retained v1 artifact, exactly 258 failures become passes and no pass regresses: 172 ordinary
  escaped-IdentifierName variants and 86 covered-IdentifierName variants.
- The bounded native witness compiles and executes `bre\\u0061k` as `break`, and `coil test` is
  green at 48/48. The Node differential oracle cannot be used for that one bounded source because
  its TypeScript-annotation stripper damages escaped names before `:`; the complete Test262 run is
  the differential evidence. The rough cumulative post-baseline gain is now +931. The active 30%
  goal remains incomplete until a fresh authoritative full run proves it.

## 2026-08-25: per-operation abrupt exits and role-based reduce calls add 70 passes

- Expanded JSL now records pending-exception exits immediately after nested JavaScript calls and
  builtins, including the complete caller-visible memory at that control point. The frontend
  publishes those recorded controls into its existing catch/propagation targets. This prevents a
  later operation in the same macro from overwriting the first abrupt completion, while keeping
  the operation and its throw conditions entirely in `lib/**/*.jsl`.
- Abrupt collection is explicitly a frontend-expansion mode. Nested macros inherit it, standalone
  DSL function construction forces it off and restores the caller mode, and `ThrowValue` remains
  excluded because source `throw` already owns and publishes that structurally abrupt edge. This
  avoids both malformed standalone returns and duplicate publication from `NO-NODE` control.
- Generic `reduce` and `reduceRight` calls now identify receiver, callback, and optional initial
  value with `TS-ROLE-ARGUMENT` rather than outer-child positions. This is frontend structure only;
  all reducer behavior still goes through `ArrayReduce*` and `ArrayReduceRight*` in the DSL.
- `test262-results-array-reduce-final-v1-2026-08-25.jsonl` is the complete 517-variant reduce
  cohort: 216 pass, 295 fail, and 6 refuse. Against the retained pre-change artifact, exactly 70
  failures become passes and no pass regresses. The symmetric reduceRight cohort is retained as
  `test262-results-array-reduce-right-final-v1-2026-08-25.jsonl`: 220 pass, 293 fail, and 4 refuse;
  no pre-change reduceRight artifact exists, so no unsupported delta is claimed.
- Two focused native witnesses pass: borrowed explicit-initial routing and preservation of a
  throwing `length` getter across the no-initial reducer path. `coil test` is green at 48/48. The
  broad native module still contains its known open failures and is not the bounded gate. The rough
  cumulative post-baseline gain is now +673, but the active 30% goal remains incomplete until a
  fresh authoritative full Test262 run proves it.

## 2026-08-25: the runnable parse-negative corpus is green

- JavaScript static semantics now carry generator context through nested arrow parameters, reject
  `YieldExpression` outside generators, reject `await` identifier references inside class static
  blocks, and reject a private identifier on the left of a nested `in` chain. The scanner also
  resolves the ambiguous consecutive-`async` recovery: `async async()` and `async async =>` remain
  valid continuations, while a second `async` with neither continuation is diagnosed.
- `test262-results-negative-parse-current-v20-2026-08-25.jsonl` is the complete retained corpus:
  all 8,216 runnable variants pass, 0 fail, and 204 module-policy variants remain skipped. V19
  contributed seven AST-context gains and v20 the final two scanner-context gains, with no
  regression. Against v13, the current parser work converts all 37 failures to passes while all
  8,179 existing passes remain passes.
- These are parser/static-semantics checks in the TypeScript bridge. They do not implement any
  JavaScript runtime operation in the frontend and do not alter DSL ownership. The bounded gate is
  green at 48/48. The active 30% full Test262 goal remains incomplete.

## 2026-08-25: scanner-level restricted line terminators add 8 passes

- The TypeScript parser recovers from a line terminator after `throw` or before arrow `=>` without
  retaining the corresponding ThrowStatement/ArrowFunction node, so AST-local early-error checks
  could never fire. The JavaScript bridge now uses the upstream TypeScript scanner's token ranges
  to enforce those two ECMAScript `[no LineTerminator here]` restrictions. Scanner trivia handling
  keeps comments, strings, templates, and regular expressions out of ad-hoc source matching.
- The complete parse-negative corpus in
  `test262-results-negative-parse-current-v18-2026-08-25.jsonl` has 8,207 passes, 9 failures, and
  204 policy skips. Against v17, exactly 8 failures become passes, all 8,199 existing passes remain
  passes, and no result regresses. Across the three current parser commits, the corpus moved from
  8,179/37 to 8,207/9.
- A separate complete `Array.prototype.reduce` investigation is retained in
  `test262-results-array-reduce-current-v1-2026-08-25.jsonl` through v3. Borrowed calls with an
  explicit initial value currently pass the callback itself as the initial accumulator; role-based
  argument indexing produced 64 gains but exposed 12 no-initial regressions. The deeper invariant
  is that `fng-jsl-call` checks pending exceptions only after a whole expanded macro: a throwing
  `length` getter can therefore be overwritten by the later empty-reduce `%Throw`. The experiment
  was fully removed rather than preserving gains with a knowingly wrong overload. The proper fix
  is per-operation abrupt-exit collection in JSL lowering, published to the frontend catch target.
- The bounded gate is green at 48/48. The active 30% full Test262 goal remains incomplete.

## 2026-08-25: restricted identifiers and switch/loop grammar add 11 passes

- JavaScript bridge static semantics now reject `yield` as an identifier reference or label in
  strict code, `async` as the expression left side of a `for-of` head, and a second default clause
  in one switch statement. These checks operate on parser structure and execution context only;
  they do not implement JavaScript operations outside the DSL.
- The complete parse-negative corpus in
  `test262-results-negative-parse-current-v17-2026-08-25.jsonl` has 8,199 passes, 17 failures, and
  204 policy skips. Against v16, exactly 11 failures become passes, all 8,188 existing passes remain
  passes, and no result regresses. The gains are seven strict-`yield` variants, two `async` for-of
  variants, and two duplicate-switch-default variants.
- Restricted-line-break checks for `throw` and arrow syntax were investigated but not retained:
  the upstream parser does not construct the corresponding statement/function nodes after those
  grammar errors, so node-local checks were unreachable and produced zero transitions. Those
  cases require scanner-level recovery rather than pretend AST coverage. The bounded gate remains
  green at 48/48. The active 30% full Test262 goal remains incomplete.

## 2026-08-25: missing JavaScript early errors add 9 passes

- The TypeScript parser accepts several JavaScript productions whose ECMAScript static semantics
  require a SyntaxError. The JavaScript bridge now diagnoses multiple lexical declarations in a
  `for-in`/`for-of` head, duplicate top-level lexical names, duplicate data-property definitions
  of `__proto__`, and cover-initialized names in object literals. These are parser/static-semantics
  checks only; no JavaScript runtime operation moved out of `lib/` or was open-coded.
- Object-literal recovery diagnostics run only when the upstream parser has not already diagnosed
  the source. This matters because its recovered AST represents malformed computed shorthand like
  `{ [a = 0] }` similarly to a cover-initialized name; adding a second synthetic diagnostic changed
  the bridge result for two already-recognized negative tests.
- The complete parse-negative corpus is retained in
  `test262-results-negative-parse-current-v16-2026-08-25.jsonl`: 8,188 pass, 28 fail, and 204 are
  policy-skipped. Against v13, exactly 9 failures become passes, 8,179 passes remain passes, 28
  failures remain failures, and no pass regresses. The gains are two variants each for multiple
  lexical `for-in` bindings, duplicate `__proto__`, cover-initialized names, and duplicate script
  class bindings, plus one strict `let` lexical-name collision.
- Rebuilding `native/typescript-go-bridge/main.go` explicitly with
  `tools/build-typescript-go-bridge.sh` is required before Test262 measurement; otherwise the runner
  can link the previous archive while rebuilding the Coil harness. The bounded gate is green at
  48/48. The active 30% full Test262 goal remains incomplete.

## 2026-08-25: empty class elements add 8 passes

- Class child validation rejected the standard empty class element (`;`) as unsupported syntax.
  It now admits and structurally ignores semicolon children while continuing to validate every
  constructor, method, accessor, and field. There is no JavaScript operation to delegate for an
  empty element, so this change belongs entirely in frontend structure and adds no DSL semantics.
- A native differential witness pins multiple empty elements around a constructor and method. The
  complete union of retained class-expression and class-statement refusal files is preserved in
  `test262-results-empty-class-elements-v1-2026-08-25.jsonl`: 8 authoritative failures become
  passes and 450 clear the refusal but still fail downstream at execution. No pass regresses.
  `coil test` is green at 48/48. The active 30% full Test262 goal remains incomplete.

## 2026-08-25: stable JSON namespace identity adds 62 passes

- `JSON` was resolved as an intrinsic for direct `parse` and `stringify` calls but had no value
  materialization, so ordinary property writes, borrowed methods, and generic Array receivers sent
  `NO-NODE` into JSL. `JSONObjectValue` now gives it a stable, object-tagged `%BuiltinObject 22`
  identity. Frontend changes are structural routing only; generic reads and writes remain DSL
  `GetProperty` and `SetProperty` operations.
- `ObjectPrototypeToString` now derives `[object JSON]` from that stable DSL identity. A native
  differential witness pins identity, branding, property persistence, and a borrowed generic Array
  callback together.
- The complete authoritative-baseline JSON `NO-NODE` cohort is retained in
  `test262-results-json-no-node-cohort-v1-2026-08-25.jsonl`: 62 failures become passes and 60 remain
  failures. There is no overlap with the previously measured 94 Math/object-branding gains, so
  these related slices prove 156 unique failed-to-passed transitions. `coil test` is green at
  48/48. The active 30% full Test262 goal remains incomplete.

## 2026-08-25: stable Math identity and DSL-owned object branding add 60 passes

- Ordinary reads of the intrinsic `Math` namespace previously lowered to `NO-NODE`; only direct
  recognized Math calls existed structurally. `MathObjectValue` now gives the namespace a stable,
  object-tagged `%BuiltinObject` identity, while frontend lowering only routes identifier and
  generic property access to that identity. Property reads and writes remain JSL `GetProperty` and
  `SetProperty` operations.
- Borrowed `Object.prototype.toString.call(value)` is now recognized structurally alongside the
  existing borrowed Object prototype methods. The new `lib/object/to-string.jsl`
  `ObjectPrototypeToString` operation owns primitive, callable, Array, Math, and ordinary-object
  branding; the Math result is derived from stable DSL identity rather than frontend syntax.
- The exact former Array-map corruption now passes in both modes in
  `test262-results-math-object-v2-2026-08-25.jsonl`. The complete authoritative-baseline cohort of
  `NO-NODE` failures whose source references Math is retained in
  `test262-results-math-no-node-cohort-v1-2026-08-25.jsonl`: 60 failed variants become passes and
  161 remain failures, with zero regressions. The gains include both modes of Math receivers for
  `every`, `filter`, `forEach`, `indexOf`, `lastIndexOf`, `map`, `reduce`, `reduceRight`, and
  `some`.
- The complete adjacent authoritative-baseline cohort containing a direct borrowed
  `Object.prototype.toString.call(...)` is retained in
  `test262-results-object-prototype-tostring-v1-2026-08-25.jsonl`: 48 of 546 prior nonpasses now
  pass. Fourteen overlap the Math cohort, so the two exhaustive targeted cohorts prove 94 unique
  failed-to-passed transitions for this implementation, not 108.
- `coil test` is green at 48/48. The active 30% full Test262 goal remains incomplete; these 60
  Math-cohort gains and 94 unique combined targeted gains are not presented as a new authoritative
  full-suite percentage.

## 2026-08-25: literal computed and static public fields add 20 passes

- Public class fields now accept computed string/numeric literal names. The frontend preserves the
  key expression structurally and delegates key coercion and own-property definition to the JSL
  `DefineField` operation. Dynamic computed names remain refused because their keys must be
  evaluated once at class definition and retained for each construction.
- Static public fields with absent or primitive-literal initializers are initialized exactly once
  at class declaration/expression evaluation on the constructor value, again through
  `DefineField`. Callable and other effectful static initializers remain explicit refusals while
  callable-value reachability is unresolved; static members are excluded from instance
  initialization.
- The retained targeted artifact
  `test262-results-class-computed-literal-fields-v2-2026-08-25.jsonl` has 20 passes among 52
  variants. Against the prior complete class artifacts, exactly 20 failures become passes, 32
  remain failures, and no pass regresses. The bounded gate is 48/48. The active 30% full Test262
  goal remains incomplete.

## 2026-08-25: public instance fields initialize through the JavaScript DSL

- Class declarations and expressions now admit the deliberately bounded public-instance-field
  subset: identifier, string, and numeric names with optional initializers. The frontend only
  preserves class-member structure and initialization order. `DefineField` in
  `lib/abstract/property.jsl` owns the JavaScript operation, including `ToPropertyKey` and
  `%DefinePropertyValue`, so inherited setters are not invoked. Static, computed, private, and
  derived-class fields remain explicit unsupported boundaries rather than acquiring partial
  semantics.
- A native differential witness pins field initialization before the constructor body. Across the
  complete class-expression and class-statement subtrees, 46 prior failures become passes, 2,495
  prior passes remain passes, and no pass regresses. The retained artifacts are
  `test262-results-class-expressions-fields-v1-2026-08-25.jsonl` (22 gains) and
  `test262-results-class-statements-fields-v1-2026-08-25.jsonl` (24 gains).
- The broader admission also exposes downstream work rather than hiding it: 212 prior frontend
  refusals now reach execution or later compiler phases, including 141 `SIGSEGV` results and nine
  graph/selection failures across the two cohorts. The active 30% full Test262 goal remains
  incomplete.

## 2026-08-25: classic for loops preserve omitted clauses

- Classic `for` lowering indexed the compact AST child list as initializer, condition, increment,
  and body. Omitted clauses collapse that list, so `for (;;) { ... }` sent its block body to
  expression lowering as the condition (`bridge kind 242`). The TypeScript bridge now exposes the
  incrementor role, and both labeled and unlabeled lowering obtain all four clauses by role;
  omitted conditions become constant true and omitted initializers remain normal completion.
- Replayed the complete prior bridge-kind-242 cohort in
  `test262-results-classic-for-roles-v1-2026-08-25.jsonl`: all 499 variants clear the refusal, 78
  pass, and 421 reach deeper execution failures. The bounded gate is 48/48. JavaScript operations
  remain DSL-owned; this change only preserves syntax structure. The active 30% goal remains
  incomplete.

## 2026-08-25: authoritative full suite reaches 22.30 percent

- The complete retained `test262-results-current-full-v4-2026-08-25.jsonl` run has 18,743 passed,
  57,026 failed, 8,275 refused, and 6,542 policy skips among 84,044 executed variants. This is
  22.30%, up 1,560 passes from v3 and 1,406 from the prior 20.63% checkpoint. Reaching 30% requires
  6,471 additional passes. Execution took 1,627.451 seconds; total time was 1,634.851 seconds.

## 2026-08-25: callable unbox preserves bare functions and closure environments

- The closure-environment ABI checkpoint narrowed every `Unbox(t-fun)` to `JSV-CLOSURE`. That
  fixed materialized closures but made ordinary bare-function callbacks trap: the authoritative
  `test262-results-current-full-v3-2026-08-25.jsonl` run had 17,183 passes (20.45%), with 1,385
  prior passes becoming failures while 1,231 prior failures became passes.
- `Unbox(t-fun)` now selects the callable-union representation. Both native encoders remove the
  shared 48-bit callable payload without narrowing it to either concrete tag; the preceding
  callable cast or ABI contract establishes that the value is a function or closure. Exact-tag
  unboxes remain checked. The implementation is compiler representation logic only; JavaScript
  operations remain wholly DSL-owned.
- Replaying all 1,387 regressed variants retained in
  `test262-results-callable-union-regressions-v3-2026-08-25.jsonl` recovers 1,366 passes, with 21
  deeper failures remaining. The complete arrow-function destructuring cohort improves from
  294/454 to 304/454 in `test262-results-arrow-dstr-callable-union-v6-2026-08-25.jsonl`. The bounded
  gate is 48/48. The active 30% full-suite goal remains incomplete.

## 2026-08-25: numeric ordinary-object keys no longer use Array storage

- Element lowering previously selected `%ArrayLoad`/`%ArrayStore` whenever the key was numeric,
  regardless of the receiver. Ordinary objects such as `{0: 0}` therefore read and wrote packed
  Array storage instead of their JavaScript property table. The frontend now chooses that
  representation only for a receiver proven to be an Array; every other receiver delegates to
  DSL `GetProperty`/`SetProperty`, including `ToPropertyKey` canonicalization.
- The direct retained witness moved from two failures to two passes for `{0: 0}[0]`. A separate
  generic `Array.prototype.reduce` witness still exposes incorrect accumulator transport after the
  property read, so reducer conformance is not claimed by this checkpoint. The active 30% full
  Test262 goal remains incomplete.

## 2026-08-25: control-context validation adds 88 negative-parse passes

- Added ancestor-based early errors for `return`, `break`, `continue`, and active labels. Function
  and class-static-block boundaries reset control targets; labeled continues must denote iteration
  statements; unlabeled breaks accept loops or switches; duplicate active labels are rejected.
- The retained complete negative corpus result is
  `test262-results-negative-parse-current-v9-2026-08-25.jsonl`: 8,023 passed, 193 failed, no
  refusals, and 204 policy skips among 8,216 variants in 3.766 seconds. This checkpoint adds 88
  passes. The active 30% full-suite goal remains incomplete.

## 2026-08-25: declaration and ordinary-function early errors add 45 passes

- Generalized the function-expression static-semantics pass to function declarations and ordinary
  functions. Async/generator contextual bindings, formal/body lexical collisions, and forbidden
  `super` references now share one implementation across declaration and expression forms;
  ordinary functions receive the `super` checks without acquiring async/generator restrictions.
- The retained complete negative corpus result is
  `test262-results-negative-parse-current-v8-2026-08-25.jsonl`: 7,935 passed, 281 failed, no
  refusals, and 204 policy skips among 8,216 variants in 3.685 seconds. This checkpoint adds 45
  passes. The active 30% full-suite goal remains incomplete.

## 2026-08-25: strict binding semantics add 119 negative-parse passes

- Added one strict-context binding pass over variable declarations, parameters, binding elements,
  function/class names, and catch bindings. It reuses `strictAt`, recursive `BoundNames`, and the
  existing strict-reserved identifier set, so directive-prologue, class-implied strictness, and
  nested function contexts share one rule.
- The retained complete negative corpus result is
  `test262-results-negative-parse-current-v7-2026-08-25.jsonl`: 7,890 passed, 326 failed, no
  refusals, and 204 policy skips among 8,216 variants in 3.613 seconds. This checkpoint adds 119
  passes across variable, class, function, arrow, generator, catch, reserved-word, and directive
  families. The active 30% full-suite goal remains incomplete.

## 2026-08-25: class accessors reach DSL-owned property semantics

- Class validation and prototype indexing now admit getter/setter members. Prototype metadata
  records data/getter/setter kind; accessor publication delegates to the existing
  `DefineGetterProperty`/`DefineSetterProperty` DSL operations, while closed-world ordinary method
  dispatch explicitly excludes accessor entries.
- Replayed all 1,016 source files whose authoritative full-run failure named `get method()` or
  `static get method()`. The retained result is `test262-results-class-accessors-v2-2026-08-25.jsonl`:
  1,888 variants now reach execution and 144 reach deeper generator/rest refusals instead of
  failing at accessor validation. No variant in this all-failing cohort passes yet, so this is an
  enabling checkpoint rather than a pass-rate gain. The active 30% goal remains incomplete.

## 2026-08-25: authoritative full suite reaches 20.63 percent

- Ran the complete current Test262 corpus after the parser/static-semantics checkpoints. The
  retained result is `test262-results-current-full-v2-2026-08-25.jsonl`: 17,337 passed, 58,595
  failed, 8,112 refused, and 6,542 policy skips among 84,044 executed variants. Execution took
  1,638.398 seconds; total time including the worker build was 1,645.603 seconds.
- The authoritative pass rate is 20.63%, up from the stale pre-checkpoint 11.39% baseline. Reaching
  30% at the current denominator requires 25,214 passes, or 7,877 additional passes. The largest
  actionable shared cohort is destructuring/function-like execution: class expression and
  statement destructuring alone contain 5,152 failures, including 1,952 getter declarations
  refused at frontend structure indexing. Related object, function, generator, arrow, loop, and
  declaration templates repeat the same semantics. The active 30% goal remains incomplete.

## 2026-08-25: async-arrow early errors add 20 negative-parse passes

- Added async-arrow static semantics for contextual `await` bindings and identifier references,
  forbidden `AwaitExpression` in formals, `super` calls and properties, and formal/body lexical
  collisions. Identifier-reference classification excludes declaration, property-name, and label
  positions; traversal propagates through nested arrows while stopping at ordinary functions and
  classes, matching the grammar context.
- The retained complete async-arrow result is `test262-results-async-arrow-v2-2026-08-25.jsonl`:
  60 passed, four unrelated positive runtime failures, no refusals, and 27 policy skips among 64
  executed variants. The retained complete negative corpus result is
  `test262-results-negative-parse-current-v6-2026-08-25.jsonl`: 7,771 passed, 445 failed, no
  refusals, and 204 policy skips among 8,216 variants in 3.231 seconds. This checkpoint adds all
  20 previously open async-arrow variants. The active 30% full-suite goal remains incomplete.

## 2026-08-25: lexical declaration grammar adds 49 negative-parse passes

- Added structural lexical-declaration checks for required `const` initializers outside
  `for-in`/`for-of` heads, forbidden `let` bound names, and lexical declarations in labeled
  statement position. Strict assignment targets now consistently use the existing complete
  strict-reserved identifier predicate.
- The retained focused `const/syntax` and `let/syntax` result is
  `test262-results-lexical-declaration-syntax-2026-08-25.jsonl`: 90 passed and 20 unrelated
  positive runtime/compiler failures among 110 variants. The retained complete negative corpus
  result is `test262-results-negative-parse-current-v5-2026-08-25.jsonl`: 7,751 passed, 465
  failed, no refusals, and 204 policy skips among 8,216 variants in 3.050 seconds. This checkpoint
  adds 49 passes. The active 30% full-suite goal remains incomplete.

## 2026-08-25: function-expression early errors add 83 negative-parse passes

- Added shared static semantics for async and generator function expressions: contextual
  `await`/`yield` bindings, forbidden `AwaitExpression`/`YieldExpression` in formal parameters,
  `super` calls and properties, formal/body lexical-name collisions, and strict `eval`/`arguments`
  names. The checks walk AST structure with nested function/class boundaries and contain no
  Test262 paths or expected answers.
- The complete async-generator expression directory moved from 172 to 218 passes, closing all 46
  negative-parse variants previously open there. The retained complete negative corpus result is
  `test262-results-negative-parse-current-v4-2026-08-25.jsonl`: 7,702 passed, 514 failed, no
  refusals, and 204 policy skips among 8,216 variants in 3.100 seconds. The 83 total gains also
  cover async-function and generator expression families. The active 30% full-suite goal remains
  incomplete.

## 2026-08-25: current complete negative-parse corpus reaches 7,619 passes

- Rebuilt the retained negative-only corpus from the authoritative Test262 checkout and ran all
  8,216 available variants after the RegExp, object-method, and destructuring checkpoints. The
  retained result is `test262-results-negative-parse-current-v3-2026-08-25.jsonl`: 7,619 passed,
  597 failed, no refusals, and 204 module-policy skips in 2.839 seconds.
- This is 317 more passes than the preceding complete run, including 83 gains outside the focused
  directories. The largest remaining families are async-generator expressions (46), class
  statements (44), variable statements (33), and continue/break/return/labeled control-flow
  contexts (88 combined). The active 30% full-suite goal remains incomplete.

## 2026-08-25: assignment destructuring is validated recursively

- Added assignment-pattern validation only at assignment and `for-in`/`for-of` target sites.
  Array/object rest targets must be simple and final, array rest rejects a trailing comma/elision,
  nested patterns recurse, strict reserved targets include computed-key references, and shorthand
  properties distinguish identifier references from property names. Loop declarations reject
  initializers in `for-of`/`for-in` heads.
- The retained complete assignment/for-of/for-in destructuring result is
  `test262-results-destructuring-early-errors-v3-2026-08-25.jsonl`: 277 passed, 1,004 positive
  execution failures, 503 refusals, and no policy skips among 1,784 variants. All 134 failures from
  these directories in the current complete negative-parse run now pass. The final strict-target
  tranche added 12 with no pass lost across the complete cohort. The active 30% goal remains
  incomplete.

## 2026-08-25: object methods share function-like early errors

- Added one method-declaration static-semantics pass for forbidden `super()` in parameters and
  bodies, async/generator reserved bindings, `yield` expressions in generator parameters, and
  intersections between formal `BoundNames` and direct body `LexicallyDeclaredNames`. It composes
  the same structural helpers used by class and formal-parameter checks.
- The retained complete object method-definition result is
  `test262-results-object-method-early-errors-v1-2026-08-25.jsonl`: 203 passed, 131 positive
  execution failures, 34 refusals, and 101 policy skips among 368 executed variants. All 44
  failures in this family from the current complete negative-parse run now pass. The active 30%
  goal remains incomplete.

## 2026-08-25: Unicode-set reserved punctuators are validated

- Added a `v`-mode character-class scanner with nested-class depth, escaped-character handling,
  the eight reserved single punctuators, and the reserved doubled punctuator set. This implements
  the Unicode-set grammar change directly from pattern structure.
- The retained complete `RegExp.prototype.unicodeSets` result is
  `test262-results-regexp-unicode-sets-v2-2026-08-25.jsonl`: 58 passed, 14 positive runtime/API
  failures, two existing refusals, and one policy skip among 74 variants. All 56 previously failing
  negative-parse variants now pass. The active 30% goal remains incomplete.

## 2026-08-25: RegExp literal grammar and named groups are checked statically

- Added pattern-level named capture/reference analysis with Unicode identifier decoding, forward
  references, unresolved-reference checks, duplicate names that can participate together, and
  alternative-aware duplicate handling. Added separate Unicode identity-escape validation.
- Added a linear RegExp grammar pass for atom/quantifier placement, quantified assertions,
  Unicode control/decimal/code-point escapes, class-range endpoints, malformed braces, inline
  modifier shape, and raw line/paragraph separators. These checks operate on literal pattern text
  and flags, independent of Test262 metadata or paths.
- The retained complete literal directory result is
  `test262-results-regexp-literals-v3-2026-08-25.jsonl`: 374 passed and 102 positive
  runtime/frontend failures among 476 variants, with no refusals or skips. All 178 negative-parse
  failures from the formal-parameter checkpoint now pass: 108 named-group and 70 general literal
  variants. The final grammar pass added 68 with no pass lost across the complete cohort. The
  active 30% goal remains incomplete.

## 2026-08-25: Unicode property escapes enforce ECMAScript grammar

- Added RegExp Unicode-property validation for exact binary property names, general-category
  aliases, script/script-extension values, malformed braces and property/value forms, class-range
  endpoints, and Unicode `v` properties-of-strings restrictions. Doubled-backslash forms are
  handled as Unicode quantifier grammar rather than misclassified as property escapes.
- Added `native/typescript-go-bridge/unicode_properties.go`, generated from Unicode 16.0.0
  `PropertyValueAliases.txt`, so all 336 canonical long and short script values are accepted even
  when the host Go toolchain carries an older Unicode table. The bridge build copies this explicit
  production input alongside `main.go`; it deliberately does not copy the separate probe program.
- The retained complete property-escape directory result is
  `test262-results-regexp-property-escapes-v4-2026-08-25.jsonl`: all 326 negative-parse variants
  pass, up from zero in the formal-parameter checkpoint. The other 880 variants remain positive
  runtime/frontend RegExp work, with no refusals or policy skips. The active 30% goal remains
  incomplete.

## 2026-08-25: class private environments close the negative-element family

- Added one source-level `AllPrivateNamesValid` traversal. Class heritage is checked against the
  outer private environment; the body sees that environment extended with every private bound name
  declared by the class; nested functions inherit it; and nested classes establish the same staged
  heritage/body boundary recursively. Private declaration names are not mistaken for uses, while a
  private identifier in an object binding property is rejected by grammar.
- The retained complete class-element result is
  `test262-results-class-elements-private-environments-v8-2026-08-25.jsonl`: 1,420 passed, 3,044
  failed, no refusals, and 717 policy-skipped among 4,464 executed variants. Exactly 156 variants
  moved failed-to-passed from the reserved-binding checkpoint, with no pass lost.
- All 700 class-element negative failures from the formal-parameter checkpoint now pass. The four
  class static-semantics commits converted those 700 failures without weakening tests or consulting
  Test262 paths; remaining class-directory failures are positive runtime/frontend support work.
  The active 30% goal remains incomplete.

## 2026-08-25: class methods propagate reserved binding contexts

- Reused the bridge's recursive `BoundNames` expansion to reject `await` bindings in async class
  methods and `yield` bindings in strict class method code. The check operates only at declaration
  binding sites, decodes escaped identifier spelling through the AST, preserves async boundaries,
  and does not mistake property names or references for bindings.
- The retained complete class-element result is
  `test262-results-class-elements-reserved-bindings-v7-2026-08-25.jsonl`: 1,264 passed, 3,200
  failed, no refusals, and 717 policy-skipped among 4,464 executed variants. Exactly 80 variants
  moved failed-to-passed from the special-method checkpoint and no passing variant was lost.
- The three class static-semantics commits now convert 544 of the earlier 700 class-element
  negative failures. The active 30% goal remains incomplete.

## 2026-08-25: class field and special-method contexts enforce lexical restrictions

- Added boundary-aware class-element traversal for field-initializer `ContainsArguments`, illegal
  `super()` in fields and non-constructor methods, `super()` in a base-class constructor, and
  `super.#private`. Arrow functions retain the surrounding lexical context; ordinary functions and
  nested classes stop the traversal. Static methods named `prototype` and async, generator, getter,
  or setter methods named `constructor` are also diagnosed from member structure.
- The retained complete class-element result is
  `test262-results-class-elements-special-methods-v6-2026-08-25.jsonl`: 1,184 passed, 3,280 failed,
  no refusals, and 717 policy-skipped among 4,464 executed variants. This is 364 new passes over the
  preceding 820-pass class checkpoint, with zero passing variants lost across all 5,181 records.
- Together the two class static-semantics checkpoints convert 464 of the formal-parameter
  checkpoint's 700 class-element negative failures. The remaining negative cases concentrate in
  context-sensitive `await`/`yield`, private-name environments, and direct-eval context. The active
  30% goal remains incomplete.

## 2026-08-25: class bodies enforce declaration-set early errors

- Added one class-body static-semantics pass for duplicate constructors, duplicate private bound
  names (while permitting one getter/setter pair), forbidden private `#constructor`, and forbidden
  public field names `constructor` and static `prototype`. The checks inspect AST declarations and
  never consult Test262 paths or expected outcomes.
- Across both complete class-element directories, the retained result is
  `test262-results-class-elements-early-errors-v4-2026-08-25.jsonl`: 820 passed, 3,644 failed, no
  refusals, and 717 policy-skipped among 4,464 executed variants. Against the formal-parameter
  checkpoint's 1,392 comparable negative variants, exactly 100 moved failed-to-passed and no pass
  was lost; 600 class-element negative variants remain open.
- `native/typescript-go-bridge/main.go` is not an input dependency of the cached bridge archive.
  Measuring this change required explicitly running `tools/build-typescript-go-bridge.sh` before
  rebuilding the Test262 worker; the stale `v2` and `v3` artifacts are not valid patch measurements.
  The active 30% goal remains incomplete.

## 2026-08-25: formal parameters share one static-semantics pass

- Added function-level formal-parameter early errors across declarations, expressions, arrows,
  object methods, class methods, accessors, and constructors. The pass handles rest initializer,
  rest position and trailing comma, non-simple parameters with a `use strict` directive, duplicate
  bound names under strict/non-simple/arrow/method rules, inherited class/function strictness, and
  strict `eval`/`arguments` bindings. Binding names are expanded recursively from AST patterns.
- The complete negative-parse corpus is retained in
  `test262-results-negative-parse-formal-parameters-checkpoint-2026-08-25.jsonl`: 6,118 passed,
  2,332 failed, no refusals, and 205 module-policy skips. Exactly 492 variants moved to passing from
  the RegExp-flags checkpoint, with no lost pass.
- Holding the authoritative full baseline's other outcomes fixed now projects 15,452 passes among
  90,377 non-skipped variants, or 17.10%. The active 30% goal remains incomplete.

## 2026-08-25: RegExp literal and inline modifier flags are validated

- Added RegExp flag grammar checks at JavaScript parse time. Trailing literal flags are limited to
  unique `dgimsuvy` code points with mutually exclusive `u`/`v`. Inline modifier groups accept
  only the `(?ims-ims:...)` form, require at least one flag, reject duplicates and overlap between
  add/remove sets, and do not confuse lookarounds, named groups, or noncapturing groups with
  modifiers.
- The complete negative-parse corpus is retained in
  `test262-results-negative-parse-regexp-flags-checkpoint-2026-08-25.jsonl`: 5,626 passed, 2,824
  failed, no refusals, and 205 module-policy skips. Exactly 166 variants moved to passing from the
  embedded-statement checkpoint, with no lost pass.
- Holding the authoritative full baseline's other outcomes fixed now projects 14,960 passes among
  90,377 non-skipped variants, or 16.55%. The active 30% goal remains incomplete.

## 2026-08-25: embedded statements enforce declaration grammar

- Added structural early errors for declarations used directly as `if`, loop, and `with` bodies.
  Class and lexical declarations are never embedded statements; async/generator declarations are
  rejected; ordinary functions retain only the Annex-B sloppy-`if` exception; and label chains
  ending in functions are rejected in embedded positions.
- The complete negative-parse corpus is retained in
  `test262-results-negative-parse-embedded-statements-checkpoint-2026-08-25.jsonl`: 5,460 passed,
  2,990 failed, no refusals, and 205 module-policy skips. Exactly 265 variants moved to passing from
  the redeclaration checkpoint, with no lost pass.
- Holding the authoritative full baseline's other outcomes fixed now projects 14,794 passes among
  90,377 non-skipped variants, or 16.37%. The active 30% goal remains incomplete.

## 2026-08-25: block and switch redeclarations use scope-level name analysis

- Added ECMAScript-style block/case-block redeclaration checks. The pass collects direct
  `LexicallyDeclaredNames`, recursively collects `VarDeclaredNames` without crossing function or
  class boundaries, recursively expands binding-pattern names, and reports duplicate lexical names
  or lexical/var intersections. This is one scope algorithm, not a matrix of declaration pairs.
- Both complete focused redeclaration directories pass 316/316. The complete negative-parse corpus
  is retained in `test262-results-negative-parse-redeclaration-checkpoint-2026-08-25.jsonl`: 5,195
  passed, 3,255 failed, no refusals, and 205 module-policy skips. Exactly 318 variants moved to
  passing from the private-delete checkpoint, including ten redeclarations outside the focused
  directories, with no lost pass.
- Holding the authoritative full baseline's other outcomes fixed now projects 14,529 passes among
  90,377 non-skipped variants, or 16.08%. The active 30% goal remains incomplete.

## 2026-08-25: deleting a private reference is an early error

- Added the ECMAScript early error for `delete` applied to a private-reference property access.
  Parentheses are unwrapped structurally, and the property name must be an AST private identifier;
  the check is independent of class shape, member spelling, and Test262 path.
- The complete negative-parse corpus is retained in
  `test262-results-negative-parse-private-delete-checkpoint-2026-08-25.jsonl`: 4,877 passed, 3,573
  failed, no refusals, and 205 module-policy skips. Exactly 384 variants moved to passing from the
  binding-rest checkpoint, with no lost pass.
- Holding the authoritative full baseline's other outcomes fixed now projects 14,211 passes among
  90,377 non-skipped variants, or 15.72%. The active 30% goal remains incomplete.

## 2026-08-25: binding rest grammar is checked once for every syntax context

- Added JavaScript-mode early errors for the two universal binding-rest invariants: a rest element
  cannot carry an initializer and it must be the final element of its array or object binding
  pattern. The check uses `BindingElement` structure and its ordered parent list, so it applies
  uniformly to functions, methods, classes, loops, declarations, catches, and assignment forms.
- The complete negative-parse corpus is retained in
  `test262-results-negative-parse-binding-rest-checkpoint-2026-08-25.jsonl`: 4,493 passed, 3,957
  failed, no refusals, and 205 module-policy skips. Exactly 1,104 variants moved to passing from the
  assignment-target checkpoint, with no lost pass.
- Holding the authoritative full baseline's other outcomes fixed now projects 13,827 passes among
  90,377 non-skipped variants, or 15.30%. This remains a projection until the next full run, and the
  active 30% goal remains incomplete.

## 2026-08-25: ECMAScript assignment targets are checked structurally

- Added a JavaScript-mode `AssignmentTargetType` early-error pass at assignment, update, and
  `for-in`/`for-of` target sites. Identifiers and non-optional property/element accesses are simple
  targets; destructuring patterns are accepted only where the grammar permits them; strict-mode
  `eval` and `arguments`, optional chains, and all other expression forms are rejected. Annex
  call-target compatibility remains limited to sloppy non-logical assignments instead of leaking
  into `&&=`, `||=`, or `??=`.
- The complete focused assignment-target directory is retained in
  `test262-results-negative-parse-assignment-target-final-2026-08-25.jsonl`: 615 passed, 6 failed,
  and 6 module-policy skips. Only two negative cases remain, both context-sensitive `yield`; the
  other four failures are positive execution witnesses for properties of call results.
- The complete negative-parse corpus is retained in
  `test262-results-negative-parse-assignment-target-checkpoint-2026-08-25.jsonl`: 3,389 passed,
  5,061 failed, no refusals, and 205 module-policy skips. This is an exact gain of 583 passing
  variants over the dynamic-import checkpoint. Holding the authoritative full baseline's other
  outcomes fixed projects 12,723 passes among 90,377 non-skipped variants, or 14.08%. The active
  30% goal remains incomplete.

## 2026-08-25: dynamic import early errors are checked structurally

- Added JavaScript-mode AST early errors for dynamic import grammar: bare `import`, unsupported
  `import.NAME` forms, invalid argument counts, spread arguments, construction with `new`, and use
  as assignment or update targets. Checks use TypeScript-Go node kinds, parent links, call
  expressions, argument nodes, and assignment operators; no Test262 paths or expected outcomes are
  consulted.
- The complete retained dynamic-import negative cohort is
  `test262-results-negative-parse-dynamic-import-complete-2026-08-25.jsonl`: 716 passed and one
  failed across 717 variants. The only remaining failure is `yield` used as the import-options
  expression, which belongs to the general context-sensitive yield early-error pass.
- The complete negative-parse corpus was rerun and retained in
  `test262-results-negative-parse-dynamic-import-checkpoint-2026-08-25.jsonl`: 2,806 passed, 5,644
  failed, no refusals, and 205 module-policy skips. Against the parser-only checkpoint, exactly 434
  variants moved failed-to-passed and no pass was lost. Holding the previous full-run outcomes
  fixed projects 12,140 passes among 90,377 non-skipped variants, or 13.43%; a full run is still
  required to combine all post-baseline changes authoritatively.

## 2026-08-25: negative parse tests execute against the real frontend parser

- Negative parse metadata is no longer blanket-skipped. The runner assembles the original source
  without harness or function wrapping, prepends only the strict directive for strict variants,
  and sends it through a marked request on the existing persistent native worker. The worker opens
  it in JavaScript mode through the same TypeScript-Go bridge used by compilation and reports PASS
  only when that parser emits a diagnostic. No path, expected filename, or test answer is baked in.
- The complete retained negative-parse cohort is
  `test262-results-negative-parse-2026-08-25.jsonl`: 2,372 passed, 6,078 failed, no refusals, and
  205 module-policy skips; all 8,450 executable variants completed in 3.530 seconds after build.
  The failures are primarily ECMAScript static-semantics/early-error rules that TypeScript-Go's
  parser accepts and that a dedicated frontend early-error pass must diagnose.
- Relative to the authoritative full baseline, this converts the former 4,453 one-record policy
  skips into 8,450 actual variant outcomes. Holding other outcomes fixed gives 11,706 passes out of
  90,377 non-skipped variants, 12.95%; the next full run is required to combine this with the class
  checkpoint and establish the new authoritative rate. The active 30% goal remains incomplete.

## 2026-08-25: ordinary class definitions and construction reach native execution

- Added stable bridge kinds and semantic class-member enumeration for class declarations,
  expressions, constructors, and properties. The frontend indexes an ordinary class as its
  constructor function, supports explicit and synthesized empty constructor bodies, binds class
  declarations through the existing callable namespace, and roots class methods through explicit
  constructor/prototype metadata edges. Runtime constructor/prototype operations remain in the
  existing JSL-backed object path; no JavaScript operation was open-coded in the frontend.
- Added an explicit validation boundary around the landed slice. Heritage, fields, static blocks,
  private elements, decorators, and other unsupported class elements are recoverable frontend
  refusals instead of entering graph construction. Fixing the default-class self-body resolution
  cycle reduced class-cohort SIGSEGV outcomes from 9,832 in the first experiment to one.
- The retained complete statement/expression class cohort is
  `test262-results-class-slice-safe-2026-08-25.jsonl`: 36 passed, 9,885 failed, 134 refused, and
  3,363 policy-skipped across 10,055 executed variants. The prior full-suite baseline had no class
  family among its reported passing leaders; these 36 exact passes are the first measured class
  checkpoint, not a claim of complete class semantics.
- Instance method metadata is indexed and reported by the new `frontend_callable_metadata` profile,
  but methods are not yet observable on the published class prototype in the Test262 harness. That
  is the next class subproblem. The active 30% goal remains incomplete.

## 2026-08-25: authoritative full-suite baseline after binding-pattern work

- Completed all 93,209 generated Test262 variants and retained every result in
  `test262-results-current-full-2026-08-25.jsonl` plus its machine-readable `.summary.json`.
  Outcomes are 9,334 passed, 53,774 failed, 18,819 refused, and 11,282 policy-skipped. Among the
  81,927 non-skipped variants, 11.39% pass; reaching the active 30% goal requires 24,579 passes,
  or 15,245 more than this baseline.
- The run took 1,701.370 seconds: 7.576 seconds of one-time build and 1,693.794 seconds executing
  the corpus. This supersedes the 2026-08-24 full-run baseline of 7,663 passes and 22,799 refusals.
- Current top mutually exclusive failure categories are pipeline execution (37,263), bridge kind
  zero (16,440), frontend unsupported syntax/code 1001 (10,742), selection (894), AArch64 encoding
  (630), and SIGSEGV (1,807). Class declarations and expressions account for 9,691 bridge-kind-zero
  refusals, making ordinary class support the next structural target. The implementation trace
  confirms existing constructor/prototype machinery can be reused, but class binding, constructor
  synthesis, method publication, resolution, and source-order execution must be added together;
  merely assigning bridge enum values would only turn refusals into later failures.

## 2026-08-25: binding-pattern expressions participate in lexical resolution

- Added a structural resolution walk for computed property names and binding-element initializers.
  It runs before the pattern's leaves enter the active binding stack and is used by both ordinary
  declarations and formal parameters. This fixes computed local-identifier keys reaching graph
  lowering as unresolved `NO-NODE`; evaluation and key conversion remain frontend structure plus
  DSL `ToPropertyKey` semantics.
- The object-rest differential witness now excludes a property through a computed local identifier
  and agrees with Node. The complete 806-variant destructuring cohort is retained in
  `test262-results-binding-expression-resolution-dstr-2026-08-25.jsonl` and remains 84 passed,
  686 failed, 36 refused, and 158 policy-skipped; this structural fix neither gains nor regresses a
  case in that method-only cohort.

## 2026-08-25: computed binding keys use a semantic bridge role

- Extended the TypeScript-Go bridge's existing `EXPRESSION` role to
  `ComputedPropertyName.Expression`. Object binding lowering now requests that semantic role instead
  of assuming child zero, which is punctuation in this AST shape and previously produced
  `NO-NODE` at the `ToPropertyKey` DSL boundary.
- The object-rest native differential witness now uses a computed string-literal exclusion and
  agrees with Node. A computed local-identifier key still exposes a separate object-declaration
  name-resolution issue and is not claimed by this checkpoint.

## 2026-08-25: object binding rest copies enumerable own properties in JSL

- Added DSL `ObjectRest` / `ObjectRestKeyExcluded`, implementing `CopyDataProperties` over the
  runtime's stable own-key view. It creates an ordinary object, skips syntax-excluded keys and
  non-enumerable properties, invokes getters through ordinary `GetProperty`, and defines copied
  values as writable, enumerable, configurable data properties.
- The frontend evaluates and canonicalizes each binding key once, uses it for extraction, and
  appends its tagged value to a DSL Array passed to `ObjectRest`; `...rest` recognition remains
  structural. Ordinary variable declarations now route object patterns through the same recursive
  binder already used by formal parameters instead of treating the pattern as a scalar name.
- Added a native differential witness for renamed exclusions, getter invocation exactly once,
  copied values, and absent excluded keys. It agrees with Node.
- The complete `language/expressions/object/dstr` cohort is retained in
  `test262-results-object-rest-dstr-2026-08-25.jsonl`: 806 variants completed in 19.646 seconds with
  84 passed, 686 failed, 36 refused, and 158 policy-skipped. Against the array-rest checkpoint,
  4 moved failed-to-passed, all 80 prior passes stayed passing, and every refused/skipped variant
  was unchanged. Both modes now pass ordinary data copying and non-enumerable omission. The getter
  Test262 cases still fail in the unrelated `propertyHelper` descriptor path even though the
  standalone getter witness passes.

## 2026-08-25: array binding rest drains its iterator in JSL

- Added DSL `IteratorRestArray`, which owns the complete rest-binding operation: repeated iterator
  stepping, completion tests, value extraction, ordinary Array allocation, and append stores. The
  frontend recognizes only the structural `...` binding element and lowers it to that operation;
  no JavaScript value semantics were added to compiler code.
- Added a native differential witness covering a method parameter with a preceding elision, rest
  length, all retained element values, and the fixed head binding. It agrees with Node.
- The complete `language/expressions/object/dstr` cohort is retained in
  `test262-results-array-rest-dstr-2026-08-25.jsonl`: 806 variants completed in 9.865 seconds with
  80 passed, 690 failed, 36 refused, and 158 policy-skipped. Against the committed parameter-pattern
  baseline, 18 moved failed-to-passed; all 62 prior passes stayed passing and every refused/skipped
  variant was unchanged. Passing cases include direct, elided, exhausted, nested-array, nested-rest,
  and nested-object rest bindings in both default and strict modes.
- The focused seven-file upstream rest set is retained in
  `test262-results-array-rest-focused-2026-08-25.jsonl`: 8 passed and 6 failed. The remaining six
  are abrupt custom-iterator cases and require the broader iterator protocol/error propagation,
  not ordinary Array rest consumption.
- The exhaustive native execution module still has an unrelated pre-existing failure in
  `tagged_constants_and_boolean_results_keep_their_javascript_representation` (`undefined + null`
  produces the wrong representation). The new focused native witness passes independently.

## 2026-08-25: formal parameter patterns have distinct ABI slots and lexical leaves

- Added a parameter-symbol index to the native frontend. Each formal still occupies exactly one
  JavaScript ABI slot and one synthetic incoming symbol, while every identifier inside a binding
  pattern receives its own lexical symbol for resolution, capture analysis, and storage. Pattern
  leaves can no longer shift later argument ordinals or alias one another.
- Function entry now applies the existing default-parameter operation to the incoming formal first,
  then walks array/object binding structure. Object coercion and property extraction delegate to
  DSL `ObjectCoercible`, `ToObjectValue`, and `GetProperty`; the bridge exposes a binding element's
  distinct property-name role so `{x: y}` reads `x` and binds `y`.
- Added a native differential witness combining shorthand, renamed, and nested object parameter
  bindings. Exact Test262 witnesses for null/undefined coercibility and renamed property binding
  pass in both default and strict modes.
- The complete `language/expressions/object` cohort is retained in
  `test262-results-2026-08-25T06-18-51-389Z.jsonl`: 1,518 variants completed in 112.101 seconds with
  194 passed, 1,222 failed, 102 refused, and 387 policy-skipped. Against the accessor checkpoint,
  56 moved failed-to-passed and 6 moved passed-to-failed, a net gain of 50.
- The six losses are defaulted empty-pattern cases whose previous passes skipped BindingInitialization
  entirely. Performing the required coercibility operation exposes a scheduler SIGSEGV in their
  large harness graphs; the missing semantics are not restored to preserve misleading passes.
- Gate: `coil test` passed 48/48.

## 2026-08-25: object-literal accessors execute through DSL descriptor semantics

- Added TypeScript bridge/indexing support for object-literal getter and setter declarations. The
  frontend builds callable values and routes definitions through new DSL-owned
  `DefineGetterProperty` / `DefineSetterProperty` operations; ordinary `GetProperty` and
  `SetProperty` remain the only implementation of invocation semantics.
- Fixed the generic materialized-closure publication contract exposed by captured accessors. A
  closure now carries an explicit memory dependency covering its initialized environment and all
  preserved active capture state. Verification checks that dependency and selection schedules it
  before exposing the environment pointer. Previously exact source calls masked the race by
  threading logical captures directly, while a DSL polymorphic call could read a zero
  `__closure_target` and trap.
- Added a native differential witness combining a captured getter, captured setter mutation, and
  receiver property reads. It agrees with Node for `main(7) == 25`.
- The complete `language/expressions/object` cohort is retained in
  `test262-results-2026-08-25T06-01-15-992Z.jsonl`: 1,518 variants completed in 107.464 seconds with
  144 passed, 1,272 failed, 102 refused, and 387 policy-skipped. Against the prior retained cohort,
  50 moved refused-to-passed, 37 moved refused-to-failed, and no passing variant regressed.
- Gate: `coil test` passed 48/48.

## 2026-08-25: Function callable values cross one unambiguous tagged ABI

- Removed the numeric collision between dynamic-receiver calls and captured-callable layouts by
  moving `CALL-ABI-CAPTURE-BASE` above both receiver ABI tags. Backend call selection now boxes
  JavaScript receiver/captured slots only when their source representation is genuinely raw.
- JSL declarations now enforce `dyn` as the tagged JavaScript-value ABI at both builtin and public
  call boundaries. String-producing ideal nodes and string unboxes explicitly report their raw
  managed-pointer representation, and deferred `Box(Phi)` distribution is restricted to inferred
  boxes so an explicit representation contract is not silently erased.
- Existing bounded native witnesses for direct `.bind` and
  `Function.prototype.call.bind(Object.prototype.hasOwnProperty)` remain green. The complete
  `built-ins/Function` cohort retained in
  `test262-results-2026-08-25T05-33-12-288Z.jsonl` completed 867 variants in 18.899 seconds: 56
  passed, 766 failed, 45 refused, and 13 policy-skipped. Against identical variants in the retained
  full baseline, 50 changed failed-to-passed and 26 changed passed-to-failed, a net gain of 24.
- The 26 losses are invalid/dynamic `Function` constructor and related call/apply cases. Their old
  passes depended on raw arguments accidentally throwing along the expected path; tagged arguments
  now expose the real missing dynamic-source compilation semantics. They are honest failures and
  are not papered over to preserve a misleading count.
- Gate: `coil test` passed 48/48. Frontier remained intentionally red at its two open bugs.

## 2026-08-25: checked unboxes stay below their guards

- Fixed a backend GCM correctness bug exposed by the assembled
  `Object/getOwnPropertyDescriptor/length.js` Test262 helper. An explicit `Unbox` could float from
  its guarded `Cast` into an earlier block and trap on a value whose type-test arm was false.
- `Unbox` and `ArrayUnbox` ideal nodes now use the existing control-anchor mechanism. Anchor lookup
  follows their value chain through `Cast`; backend-inserted `MI-JSUNBOX` conversions with
  `NO-NODE` remain movable. This is deliberately not an opcode-wide pin, which caused unrelated
  def/use placement failures in large helper graphs.
- Added a native machine regression: a boxed integer takes the guarded arm and unboxes to 7, while
  a boxed string takes the false arm and returns 0 without executing the checked unbox.
- The exact Test262 witness no longer traps in `isEnumerable`'s speculative numeric unbox. It now
  advances to a distinct call-boundary bug: function 3 passes a raw object pointer as argument 1
  to function 1, whose parameter expects a boxed object. The observed call site is object offset
  `0x5ed90`; this follow-on failure is not claimed as passing.

## 2026-08-24: large Test262 helpers clear CFG selection and AArch64 call reach

- Selection now recognizes a folded guard with one explicit `CProj` side exit and one direct
  non-projection fallthrough. A refinement-only projection with no CFG successor remains in the
  current block so its pinned effects are scheduled without inventing a terminator. This clears
  the default-mode `CProj.0` failure in the exact
  `Object/getOwnPropertyDescriptor/length.js` helper case.
- AArch64 polymorphic dispatch no longer uses `ADR` to reach generated function bodies. `ADR` has
  a signed +/-1 MiB range, and the full Test262 helper produces about 1.42 MiB of code; the wrapped
  target landed in the original read-only Mach-O mapping and faulted on instruction fetch. The
  encoder now materializes a fixed-width signed delta from a local `ADR` anchor and adds it to the
  anchor, so copied in-memory images remain position independent at any code size.
- Native child failures now report their wait status and whether any output was observed. The
  exact case progressed from selection failure, through bad-address status 10, to a later status 5
  trap. Both default and strict variants reach runtime; neither is claimed as passing.
- The remaining trap is inside `isEnumerable`: declared argument 1 (`name`, native Parm 4) arrives
  carrying a function-tagged value and is eventually numerically unboxed. The uniform call layout
  saves arguments before polymorphic dispatch and dispatch only clobbers x12-x17, so the next
  investigation is the pre-call value/allocator path for that argument rather than the new
  range-safe address materialization.
- Retained exact result snapshots are
  `test262-results-object-gopd-refinement-collapse-2026-08-24.jsonl` and
  `test262-results-object-gopd-range-safe-2026-08-24.jsonl`.

## 2026-08-24: property-helper captured statics are real callables

- Published zero-capture JSL callable adapters for `Object.getOwnPropertyNames` and
  `Array.isArray`. Their bodies delegate to the existing DSL operations; the frontend only selects
  the callable value for exact intrinsic property access. Direct-call semantics remain unchanged.
- Permanent native differential witnesses capture each static in a local alias and call it.
  `getOwnPropertyNames` preserves own-key order and array contents; `isArray` distinguishes an
  array from an ordinary object.
- The exact `Object.getOwnPropertyDescriptor/length.js` helper case progressed again. Strict mode
  reaches native runtime; default mode now exposes a selection terminator at `CProj.0` node 17320.
  Retained results are in
  `test262-results-object-gopd-array-is-array-2026-08-24.jsonl`; neither variant passes yet.

## 2026-08-24: zero-capture callable values clear selection and retain runtime codes

- Zero-capture JSL `closure` expressions now lower to the callable's bare `Fun`; captured callables
  retain the materialized environment path. This removes empty environment allocation, gives
  intrinsic built-ins stable identity, and avoids pinning a useless `New` to branch-local control.
- Fixed machine edge-copy verification across multiple function owners. Selection deliberately
  keeps a node-dense owner-tagged cache, so later owners may overwrite an earlier input's cache
  entry; verification now accepts either the live owner cache or persistent vreg provenance. It
  still checks the exact phi, source node, owner, and permitted floating-point widening.
- The exact `Object.getOwnPropertyDescriptor/length.js` case now clears the former `CProj.1`
  selection failure in both variants. It reaches native execution and currently fails by crashing
  or producing no answer, so this is not claimed as a Test262 pass.
- Test262's native runner now preserves a failed program's numeric answer in single and batch
  output, and the JavaScript driver applies its existing assertion decoder. This case yields zero,
  not an encoded assertion, but future encoded runtime failures retain assertion site, kind, and
  compact actual/expected values in JSONL.
- Focused native witnesses for aliased `Object.getOwnPropertyDescriptor` and first-class
  `String.prototype.indexOf` metadata both pass. Exact retained results are in
  `test262-results-object-gopd-diagnostic-2026-08-24.jsonl`.

## 2026-08-24: dynamic Object descriptor arguments preserve tagged source values

- Replaced blind `n-box!` calls across Object descriptor/create/name operations with the frontend's
  representation-aware dynamic argument boxer. Explicit JavaScript arguments at Parm 3+ are now
  structurally recognized as tagged by the uniform receiver ABI. A permanent native differential
  test carries an object and key through source parameters before descriptor lookup.
- Started an exact rerun of the 5,241-file property-helper cohort with retained results in
  `test262-results-property-helper-argc-2026-08-24.jsonl`. It was stopped after 3,416 variants when
  newly executable 40k-50k-node helper graphs projected roughly another 30 minutes. The retained
  prefix has 2,818 failures, 594 policy skips, and 4 refusals; it is evidence, not a full-cohort
  result and must not be compared as one.
- The formerly isolated argc check now proceeds into descriptor verification. A direct witness
  shows the next property-helper blocker for many cases: methods such as
  `String.prototype.anchor` are still syntax-only direct-call paths and evaluate as `undefined`
  when used as first-class function values. Descriptor lookup then correctly rejects that value.
  First-class built-in method publication is the next broad surface strike.
- Gate: `coil test` passed 48/48. Frontier remained intentionally red at 0/2.

## 2026-08-24: source calls transport actual argc and expose `arguments.length`

- Extended the uniform JavaScript receiver ABI with hidden actual argc at Parm 2; declared source
  and callable-JSL parameters now begin at Parm 3. Call sites capture argc before fixed-arity
  normalization, so omitted arguments remain distinguishable from explicit `undefined`.
- Added DSL-owned `NewArgumentsObject`, which publishes `length` through the ordinary property
  model. The frontend recognizes only the structural `arguments` binding. Raw Parm representation
  normalization lives at the JSL lowering boundary, not as open-coded JavaScript semantics.
- Keyed property stores and deletes now participate in frontend property-memory alias tracking.
  Permanent backend witnesses prove both a single argc value and distinct values across repeated
  receiver calls; native differential coverage proves independently compiled arities 0, 1, 2,
  and 3 agree with Node.
- Gate: `coil test` passed 48/48. Frontier remained intentionally red at 0/2. Repeated calls that
  each materialize and read an arguments object in one source program still fail and are not
  claimed by this strike; the complete property-helper cohort has not yet been rerun.

## 2026-08-24: Test262 property-helper publication reaches the argc frontier

- Published callable JSL wrappers for `Array.prototype.join`, `Array.prototype.push`, and
  `Object.prototype.propertyIsEnumerable`, completing the four bound methods initialized by
  Test262's `propertyHelper.js`. Existing runtime properties still win; intrinsic fallback applies
  only to absent properties on the exact Object and Array prototype identities.
- Ran the complete 5,241-file property-helper cohort with retained results in
  `test262-results-property-helper-after-2026-08-24.jsonl`: 9,195 executable variants finished in
  272.037 seconds, with 0 passed, 7,084 failed, 2,111 refused, and 594 policy-skipped. Against the
  same variants in the prior full report, 96 moved from refusal into execution, but none passed.
- A one-file full-harness isolation proves the first runtime blocker is `arguments.length` inside
  `verifyProperty`, not bound-method initialization. The current source ABI has no actual-argc
  channel, so it cannot implement `arguments.length`, omitted-versus-explicit-`undefined`, or
  general variadic `call`/`bind` correctly. Adding that channel and building the arguments object
  through DSL-owned semantics is the next architectural strike.

## 2026-08-24: Test262's bound `hasOwnProperty` helper is first-class JSL

- Added JSL callables for `Function.prototype.call`, `Function.prototype.bind`, and
  `Object.prototype.hasOwnProperty`; ordinary property lookup remains authoritative, and intrinsic
  fallback happens only when the requested runtime property is absent.
- The exact high-fan-out Test262 shape
  `Function.prototype.call.bind(Object.prototype.hasOwnProperty)(object, key)` now compiles and
  agrees with Node in a permanent native differential test. The implementation uses captured JSL
  closures and dynamic receiver dispatch rather than frontend syntax recognition or open-coded
  JavaScript semantics.
- This strike is intentionally fixed-arity: the current native JavaScript call ABI carries values
  but no argument count, so a callee cannot distinguish omitted arguments from explicit
  `undefined`. General variadic `call` and `bind` require an argc channel or an equivalent universal
  argument-vector ABI; they are not claimed here.
- The prior full Test262 report contains 7,387 records whose retained diagnostic reports missing
  global `Function`. That is an affected upper bound, not a pass delta: `propertyHelper.js` also
  initializes bound `Array.prototype.join`, `Array.prototype.push`, and
  `Object.prototype.propertyIsEnumerable`, which remain subsequent blockers.

## 2026-08-24: JSL callable closures use the source closure ABI

- Added `:captures [name ...]` to `callable` declarations and a checked `(closure Callable value ...)` expression. Non-callables and wrong capture arities are rejected before lowering.
- Creator and callee derive one deterministic environment shape: `__closure_target` followed by tagged capture fields. Creation uses `n-materialized-closure!`; entry unboxes hidden Parm 0 and loads captures through alias-typed memory Args, matching source closures rather than inventing a second representation.
- On-demand linking follows closure targets, and callable bodies remain subject to the existing `:transitioning` effect contract.
- Gate: `coil test` passed 48/48. Frontier remained intentionally red at 0/2.

## 2026-08-24: JSL can declare JavaScript-callable functions

- Added a `callable` top-level declaration kind alongside `builtin` and `macro`.
- Callable bodies use the established JavaScript ABI: hidden environment at Parm 0, `this` at receiver Parm 1, and declared arguments beginning at Parm 2. Ordinary builtins still reject `this` as unbound.
- JavaScript-callable JSL functions remain in dynamic target discovery; implementation-only JSL builtins remain excluded. This is the non-capturing prerequisite for DSL-owned `Function.prototype.call`; captured callable construction for `bind` is next.
- Gate: `coil test` passed 47/47. Frontier remained intentionally red at 0/2.

## 2026-08-24: exact calls materialize rest arrays through JSL

- Added a rest bit to `FeFunction`; `...xs` remains one final formal in the native ABI rather than being silently treated as an ordinary scalar parameter.
- Exact and closed-world method call sites now evaluate all source arguments first, preserve fixed formals, and materialize surplus values with DSL `NewArray` and `ArrayOfAppend1`. Array allocation, growth, tagging, and stores remain owned by `lib/array/build.jsl`.
- Surplus expressions are lowered dynamically rather than under the rest array's declared type. Empty rest arrays and fixed-prefix exclusion have permanent JavaScript native differential coverage; the frontier witness covers a closure-valued exact call. Multiple distinct rest callees in one function still expose a call-normalization defect and are not claimed here.
- Removed `rest-parameters-are-unimplemented.js`; the frontier is now 2 open bugs. Polymorphic calls whose runtime target may have a rest formal still require a target-sensitive ABI and are not claimed by this strike.
- Gate before promotion: `coil test` passed 46/46. The frontier rest witness compiled, executed natively, and agreed with Node.

## 2026-08-24: array binding patterns use DSL iterator semantics

- Added stable bridge kinds for `BindingElement`, `ArrayBindingPattern`, and `ObjectBindingPattern`; the frontend no longer receives array binding patterns as anonymous kind zero.
- Replaced the one-declaration/one-symbol assumption with recursive binding-name indexing and lexical resolution. Pattern leaves get independent symbols, so nested declarations and loop headers use the same scope machinery.
- Lowered array pattern extraction through `GetIterator`, `ArrayIteratorNext`, and `IteratorValue` from `lib/array/iterator.jsl`. The frontend owns only recursive binding structure; it does not open-code iteration or indexed-read semantics.
- Added permanent native differential coverage for ordinary, nested, and `for-of` array binding patterns. Removed `for-of-destructuring-pattern.js`; the frontier is now 3 open bugs.
- Gate: `coil test` passed 46/46. Before promotion, the frontier case compiled, executed natively, and agreed with Node; the remaining frontier was intentionally red at 0/3.

## 2026-08-24: lexical loop closures and the AArch64 closure ABI

- Fixed scalar loop entry arms that loaded captured cells through loop-header memory. Entry values are now snapshotted before loop memory phis are installed, so phi inputs are defined on their actual incoming edges.
- Implemented CreatePerIterationEnvironment structure for captured `let`/`const` loop-header bindings. The body and increment receive distinct fresh cells; closures retain the body cell and therefore observe `0, 1, 2`, not the final `3`.
- Brought AArch64 dynamic callable dispatch into parity with x64: `JSV-CLOSURE` is callable, ordinary objects are not, and only hidden environment argument 0 is retagged to `JSV-OBJECT` before entering the closure body.
- Added a permanent native differential witness and removed `closure-capturing-a-loop-variable.js`; the frontier is now 4 open bugs.
- Gate: `coil test` passed 46/46. Frontier: `coil test --suite frontier` remained intentionally red, 0/4. The broader `tests/native-execution-test.coil` currently remains red at 32/49 on unrelated pre-existing cases; the promoted loop-closure case was proven green by the identical frontier harness before promotion.

## 2026-08-24: `for (target of iterable)` assignment targets

- Expanded for-of/for-in validation from declaration-only bindings to ordinary identifier, named-property, and computed-property assignment targets; destructuring remains explicitly refused.
- The loop graph now carries existing local targets and writes each successful `IteratorValue` through `fng-lvalue-write`. Property and element semantics therefore remain delegated to JSL rather than being open-coded in control-flow lowering.
- Added a permanent native differential witness covering `for (x of xs)`, `for (o.v of xs)`, and `for (o[k] of xs)`.
- Removed `repros/open/for-of-into-an-existing-binding.js`; the frontier is now 5 open bugs.
- Gate: `coil test` passed 46/46. Frontier: `coil test --suite frontier` remained intentionally red, 0/5. The report generator confirmed the removed repro and regenerated both derived status documents.

# Handoff: move JavaScript semantics into the DSL

## DEAD IF ARMS NO LONGER CAUSE 6,316 SELECTION FAILURES (2026-08-24, latest)

The Test262 selection cohort exposed two layers of misleading diagnostics before the compiler bug:
`machine=4/N` means `MSEL-TERMINATOR` at item N, not operand slot 4, and construction-time items are
ideal nodes or CFG blocks rather than machine instructions. The backend and native harness now keep
construction and verifier result domains distinct and retain targeted block/node diagnostics.

The dominant root cause was reachability collapsing an ideal `If` to one machine-CFG successor
while terminator selection still demanded both CProj targets. The machine CFG is authoritative;
every one-successor block now emits `MI-JMP`, and verification accepts that canonical form. A direct
backend regression pins a dead true arm selecting as one jump and one return with no `MI-CBR`.

Across the exact 6,788-variant / 3,433-file cohort, selection failures fell from 6,603 to 633
(90.4%), `MSEL-TERMINATOR` fell from 6,316 to 361 (94.3%), 75 variants became passes, and runtime
fell from 11m41.61s to 5m53.84s. The residual 361 terminator cases are not the same bug: their live
Region has both an `If` and a `Loop` as direct control users, which the current unique-successor CFG
walk cannot represent. Residual selection counts are 361 terminator, 220 unsupported, 50
dependency, and 2 call failures.

## TEST262 FAILURES HAVE A COMPLETE RECORDED-REASON INVENTORY (2026-08-24, latest)

`tools/analyze-test262-results.mjs` turns a retained JSONL run into
`docs/TEST262-FAILURE-INVENTORY.md`: every non-passing record is assigned to its most specific
retained reason, with variant count, distinct-file count, recorded wall time, dominant test
families, and examples. The report explicitly marks coarse evidence as coarse. In particular,
30,304 `RUNTIME-FAILED` variants lack assertion diagnostics, and the historical 6,596 selection
failures lack the machine/node lines printed after the headline diagnostic. The runner now retains
those native diagnostic lines in new result records so targeted selection reruns can be clustered
by actual failure shape before fixes are attempted.

## TEST262 RESULTS ARE PERSISTENT BY DEFAULT (2026-08-24, latest)

`tools/run-test262.mjs` now appends every per-variant result to a unique timestamped
`test262-results-*.jsonl` file by default and writes category totals to its adjacent summary JSON.
The runner announces both absolute paths, explicit `--results FILE` remains available and is
required for `--resume`, and `--quick` is the deliberate opt-out when persistence is unwanted.
Conflicting `--quick --results` and `--quick --resume` invocations are rejected rather than silently
discarding requested evidence.

## INSTRUCTION SELECTION EXCEEDS THE SIMPLE BASELINE (2026-08-23, latest)

The final late-GCM gap was not the backward scan or a missing worklist. The large witness completed
late placement in one round, but every movable instruction walked `latest -> earliest` twice:
`mu-dominates?` first validated dominance, then the placement loop traversed the identical idom
path to choose the minimum-loop-depth block. Simple's `_doSchedLate` validates and chooses during
one idom walk. AOT Kit now does the same through `ms-gcm-best-late-block`.

On the 54,612-node / 120,293-machine-instruction witness, late GCM fell from approximately 201.2 ms
to 120.1 ms and total selection from approximately 280 ms to approximately 200 ms. Three
unprofiled two-variant repetitions produced six selection measurements with a 200.735 ms median.
Normalized to Simple chapter 23's 32,378 nodes, that is 54.030 ms versus Simple's measured 67.228
ms selection+GCM baseline: AOT Kit is 19.6% faster on the agreed normalized comparison.

The fixed-seed 1,000-file sample retained exactly 145 passed, 946 failed, 466 refused, and 199
policy-skipped outcomes. Aggregate selection CPU fell from 4,571.424 ms before the Simple-driven
selection work to 3,360.055 ms, a 26.5% reduction.

Final invariant evidence: the bounded gate is 46/46, backend motion is 10/10, backend selection is
16/16, and the frontier remains the same 11 intentionally failing bugs. The exhaustive suite had
two stale integration errors (`v-count-ins`/`v-count-outs` were missing test measurements and
`native_harness` gave Darwin's void `sys_icache_invalidate` an `i64` return); after repairing those,
it runs to completion at 399 passed / 49 broad native failures. Those failures are not presented as
green and remain outside both the bounded gate and the 11-case frontier.

Backend selection tracing is now opt-in rather than production work. `tools/run-test262.mjs
--profile ...` passes `--profile` through both one-shot and persistent native-worker paths and
retains all `AOTK_PROFILE phase=selection_*` records. Normal runs skip selection trace formatting
and monotonic-clock calls. Alternating runs measured only about 0.5 ms median tracing overhead, so
tracing was fixed for honesty but was not used to explain the architectural speedup.

## SELECTION MEMOIZATION IS NODE-DENSE AND EFFECT WALKING ALLOCATES NOTHING (2026-08-23, latest)

The next comparison against Simple found another fundamental mismatch: AOT Kit eagerly initialized
three `function-count * graph-node-count` tables before demand selection. Simple has one memo entry
per reached graph node. AOT Kit now uses one node-indexed memo with explicit owner tags. Functions
are selected sequentially, so a shared constant can be remapped for the next owner without retaining
an owner-by-node matrix; owner-local values and phis remain stable for the entire owner selection.

Memory-effect chain selection also no longer allocates and frees an `ArrayList` for each unseen
chain. It uses a reentrant MachineUnit stack with saved lengths, so nested selection preserves the
caller's suffix and all capacity is reused. Finally, edge-copy construction and resolution traverse
each owner's block successor adjacency instead of scanning every machine edge once per owner.

The bounded gate remains 46/46. The fixed 1,000-file sample retained exactly 145 passed, 946 failed,
466 refused, and 199 policy-skipped outcomes. Its aggregate selection CPU fell from the earlier
4,571.424 ms baseline to 3,552.976 ms in the latest parallel run, while parallel wall timing remained
too noisy for phase attribution. The single-worker large witness is stable at 278.807--282.101 ms
total selection; strict emission is 40.122 ms and GCM 230.909 ms. Normalized to Simple's 32,378
nodes, strict combined selection is about 75.1 ms versus Simple's 67.2 ms. The remaining measured
gap is still emission/control materialization, not GCM.

## INSTRUCTION SELECTION NOW FOLLOWS SIMPLE'S SCHEDULING SHAPE (2026-08-23, latest)

The instruction-selection investigation used SeaOfNodes/Simple chapter 23 as the baseline rather
than optimizing the old phase structure in place. The backend now maintains def/use adjacency,
computes early placement once, drives late placement from ready uses, derives memory
anti-dependencies from ideal-memory adjacency, and materializes block order once after placement.
Repeated early refresh, unconditional late fixed points, Cartesian read/write scans, the pre-GCM
pack, and the pre-GCM anti-dependency build are gone. Production Test262 compilation skips backend
verification while normal tests retain it.

The large witness `language/expressions/property-accessors/S11.2.1_A4_T9.js` has 54,611 ideal
nodes, 120,293 machine instructions, and 8,687 blocks. Its variants measured 273.292 ms and 283.441
ms total selection. The strict variant used 39.982 ms for emission, 225.387 ms for GCM, and 0.945
ms for final anti-dependency publication. Simple chapter 23 measured 5.965 ms selection plus 61.263
ms GCM for 32,378 nodes. Normalized by node count, AOT Kit's GCM is 60.7--61.7 ms and at parity;
combined selection is 73.6--76.3 ms, leaving a 10--14% gap in rewrite/emission rather than GCM.

The fixed-seed 1,000-file sample (`seed=2621000`, 16 workers, `--batch-size 8`) completed 1,557
executable variants in 10.327 seconds wall time. Aggregate selection CPU was 4,571.424 ms:
1,676.376 ms machine construction, 1,830.652 ms emission, 881.332 ms GCM, and 22.691 ms final
anti-dependencies. Outcomes were 145 passed, 946 failed, 466 refused, and 199 policy-skipped.

The remaining target is emission: on the large witness, preselection costs 27.7--29.2 ms and the
separate terminator pass costs 8.6--9.1 ms. GCM is no longer the architectural outlier.

## GENERATED MACH-O EXECUTION NO LONGER LINKS OR PAYS GATEKEEPER PER CASE (2026-08-23, latest)

Darwin Test262 execution now writes the already-verified Mach-O object but does not link it into a
new executable. A stable prebuilt `native/gc/in-memory-driver.c` parses that object, copies its text
onto W^X pages, resolves every external AArch64 branch relocation through a nearby absolute-jump
veneer, registers stack maps/layouts with the GC, and calls the generated kernel through
`aot_gc_enter1`. The same assessed host path is reused; generated programs remain separate child
processes, so crashes and 2-second timeouts cannot take down the persistent compiler worker. Linux
retains its existing ELF/Clang path.

The 20-variant passing smoke stayed 20/20, with warm median native execution 6.85 ms, compiler
phases 18.50 ms, and zero Clang-link phases. End-to-end warm request latency fell from the earlier
436 ms to 174 ms. The requested pinned, sorted 100-file Test262 slice produced 191 variants in
9.20 s at 14 workers (0 passed, 158 failed, 24 refused, 9 policy-skipped); this Annex B prefix is
pathological and included eight runtime failures plus two bounded 2-second timeouts. Treating it as
representative exactly as requested, the corpus's 53,872 files extrapolate to 4,956 seconds, or
82.6 minutes, at the same concurrency. No generated case reported a Clang-link phase.

Top-level tracing now includes `aarch64_encoding`, `macho_publication`, and `native_cleanup`. The
longest record in that 100-file run, Annex B RegExp legacy-accessors `index/prop-desc.js`, reproduced
at 7.64 s default and 7.34 s strict. AArch64 encoding consumed 5.90 s per variant and Mach-O
publication 1.17 s; frontend graph construction was 97-107 ms, allocation 69-74 ms, selection
47-53 ms, and isolated native execution only 8.7-9.0 ms. The previously unexplained delay is
therefore compiler backend work, not execution, linking, cleanup, or protocol overhead.

The Simple-style linearization design is recorded in `docs/LINEAR-BACKEND-PUBLICATION.md`. The
first implementation replaces production `be-reg-of`/`be-spill-of`/`be-owner-of` instruction
searches with the allocator's dense `mra-*` tables (retaining an explicit legacy-fixture fallback),
and publishes dense block byte offsets during sizing so branch lookup is constant time. On the same
31,847-instruction witness, default fell from 7.643 s to 1.851 s (4.1x) and strict from 7.336 s to
1.348 s (5.4x). AArch64 encoding fell from about 5.90 s to 0.784/0.672 s (7.5x/8.8x). Mach-O
publication fell from about 1.17 s to 0.428/0.370 s because publication also used the scan-based
register helper. Remaining work is recorded relocations and one-time metadata materialization.

## CROSS-PLATFORM MONOTONIC TRACING AND PERSISTENT-WORKER BREAKDOWN (2026-08-23, latest)

`src/monotonic.coil` is now the single profiler clock. Coil compile-time target selection uses
`(= (primitive/target-os) `linux)` to emit Linux `CLOCK_MONOTONIC` (`1`) or Darwin's (`6`), with
no C shim and no runtime platform probing. The native harness, frontend, selector, node optimizer,
and machine-CFG profiler all use that helper. This removes Darwin's negative/huge profile values
caused by hard-coded Linux clock ID `1`; the final gate/frontier logs contained zero negative or
13+-digit `ns` values. `tools/run-test262.mjs` also measures worker readiness entirely in Node's
monotonic clock domain instead of subtracting timestamps from different processes.

A 20-variant, one-worker tiny-program run passed 20/20. Warm medians were 494.3 ms wall, 32.2 ms
compiler phases, 36.7 ms Clang link, and 295.2 ms native execution. Within compilation, graph
construction was 18.1 ms, indexing 4.0 ms, selection 3.9 ms, and allocation 2.4 ms. Cold worker
startup varied substantially between runs (296.5-574.8 ms), so it is not a stable compiler cost.

The native-execution trace now splits `popen` spawn, wait-to-first-output, and `pclose` reap. On a
20-variant warm run their medians were 0.225 ms, 194.575 ms, and 0.254 ms respectively. A control
experiment with a freshly linked trivial Mach-O took 203.3 ms on first launch, then 5.6, 4.5, 4.1,
and 3.5 ms on repeated launches. The apparent execution cost is therefore macOS first-launch
assessment of each newly linked binary, not time spent executing the tiny JavaScript program.

Witness: `coil test` passed 46/46. `coil test --suite frontier` remained intentionally red with
0/11 passing, preserving all currently recorded open bugs.

## UNREACHABLE JAVASCRIPT FUNCTION BODIES ARE NEVER BUILT (2026-08-23, latest)

The closed-world frontend now computes exact function reachability before graph publication. The
walk starts from `main` and executable top-level initializers, follows resolved function symbols,
nested declarations/expressions, and default-parameter initializers, while indexing, captures,
effects, and diagnostics still see the complete source. Only reachable bodies and function objects
are published; this moves dead-function elimination ahead of graph construction instead of first
building, analyzing, verifying, selecting, and finally killing every unused Test262 include helper.
No JavaScript operation or DSL lowering changed.

The profiled TypedArray representative requested 48 functions but could reach only 29. Its graph
fell from 70,901 to 42,732 nodes, graph build from 1.072 s to 0.607 s (-43.4%), analysis from
2.075 s to 1.134 s (-45.3%), and attempt time from 3.927 s to 2.289 s (-41.7%). On the 20-variant
slow TypedArray shard, exact status/category parity held while user CPU fell from 70.32 s to 36.64 s
(-47.9%) and wall time from 7.68 s to 4.34 s (-43.5%).

The fixed 177-record sample also retained exact path+variant status/category parity (16 passed, 95
failed, 49 refused, 17 skipped). User CPU fell from 83.03 s to 71.03 s (-14.5%), wall time from
6.67 s to 5.71 s (-14.4%), frontend graph from 44.684 s to 36.017 s (-19.4%), graph build from
12.796 s to 9.781 s (-23.6%), analysis from 21.305 s to 15.792 s (-25.9%), and verification from
3.806 s to 2.766 s (-27.3%). The mandatory gate remains 46/46 green; frontier reaches all seven
intentional JavaScript failures with no infrastructure failure.

## PROVEN-FOLD SEEDS ONLY VISIT OPERATIONS THAT CAN TRANSFORM (2026-08-23, latest)

The frontend's proven-fold seed no longer sends every already-analysed node through the complete
compute/idealize/GVN pipeline. Exact opcode metadata records which operations have a nontrivial
idealizer; foldable nodes are seeded only when their settled type is constant, and a settled
`CProj` is seeded only when its own or sibling arm is `XCtrl`. Nodes affected by an earlier rewrite
still enter through the worklist, so type propagation and proof-dependent follow-up rewrites are
unchanged. The `CProj` idealizer also checks whether either rewrite is structurally possible before
asking for a proof snapshot. This changes compiler structure only; no JavaScript operation or DSL
lowering changed.

On the profiled TypedArray representative, proven-fold candidates fell from roughly 450,000 to
348,000 and proof queries from roughly 133,000 to 42,000 with identical graph shape and failure
category. The fixed 177-record sample retained exact path+variant status/category parity (16
passed, 95 failed, 49 refused, 17 skipped). Aggregate frontend analysis fell from 23.950 s to
21.305 s (-11.0%), including fold from 9.776 s to 8.248 s (-15.6%); user CPU fell from 88.05 s to
83.03 s and wall time from 6.98 s to 6.67 s at 14 workers. Against the original fixed benchmark,
successful-variant mean is now 0.652 s versus 20.512 s (31.4× faster), though the original corpus
had 14 successes and the current parity baseline has 16, so status parity is asserted only against
the immediately preceding checkpoint. The mandatory gate remains 46/46 green.

## DIVERGED LOCAL WORK RECONCILED ONTO REMOTE MAIN (2026-08-23, latest)

The former local `main` at `b631e3f` is preserved as
`backup/local-divergence-2026-08-23`; `main` now follows remote commit `bcb36b1`. The lines had
diverged by 20 local and ultimately 26 remote commits, with broad conflicts across the frontend, backend,
runtime, and DSL. Remote is the functional base: its exception, descriptor/accessor, Test262,
x86-64/Linux, and compiler-performance work supersedes the narrower local implementations.

Six local bug witnesses were rerun through remote's real native differential pipeline after
rebuilding the pinned TypeScript-Go bridge. The accessor-definition and source try/catch cases now
agree with Node and are pinned in `native-execution-test.coil`. Four remain open and were registered
in the frontier: for-in machine-CFG verification, numeric conditional call results, a boolean
heap-read crash across mutation, and inherited data properties. `tools/js-probe.coil` was retained
and adapted to the current allocator API as the single-file differential tool. The generated
frontier report records the resulting 11 open bugs.

The report integrity test counts all 11 files correctly, but its renderer aborts before comparison
when `nh-status` reaches the pre-existing shorthand-method repro: the frontend's unsupported object
literal element path aborts instead of returning `NH-REFUSED`. The two reports were updated from
the individually measured statuses; fixing that recoverability defect is required before the
byte-for-byte generator check can become green on this platform.

## FRONTEND BUILTIN CLASSIFICATION REJECTS BY NAME BEFORE RECURSING (2026-08-23, latest)

Call-result inference no longer recursively infers an unrelated method receiver before checking
whether its property name can belong to the Number, String, Array, or iterator builtin family.
Closed-world static-method AST queries are also cached by their exact receiver-symbol/property-name
key. This is structural frontend work only; JavaScript operations and all DSL lowering are
unchanged. Profiling the slowest record in the highest-total frontend cluster identified four
`Function.prototype.call.bind(...)` initializers that each spent 53–59 ms classifying only 488
nodes; each now takes 26.6–28.8 ms with identical graph shape and failure category.

The 20-variant slow `TypedArray/prototype` shard retained exact path+variant status/category parity.
Aggregate graph build fell from 23.328 s to 20.099 s (-13.8%), total frontend graph from 70.719 s
to 65.915 s (-6.8%), and summed attempt duration from 77.500 s to 72.392 s. The fixed 177-record
sample also retained exact parity (16 passed, 95 failed, 49 refused, 17 skipped); graph build fell
from 13.859 s to 13.075 s, while other frontend phases were noisy under 14-way contention and are
not claimed as an improvement. The mandatory gate remains 46/46 green. Frontier reaches all seven
intentional JavaScript failures with no platform infrastructure errors.

## SELECTION ABI CLASSIFICATION NO LONGER RESCANS THE IDEAL GRAPH (2026-08-23, latest)

Selection now classifies parameter FP/ABI positions from the machine unit's compact live-call list
and each Fun's direct parameter uses, rather than repeatedly scanning all ideal nodes. Source
argument, parameter ABI/stack, and allocation ordinals are cached once per selection run. On the
slow Object representative, selection emission fell from about 1.27–1.29 s to 0.44 s and total
selection fell from about 2.23–2.36 s to 1.37–1.39 s, with the same runtime-failure result and
identical graph shape. The 19-variant Object shard retained exact status/category parity while
aggregate emission fell from 25.88 s to 8.21 s and selection from 44.01 s to 25.50 s. The fixed
177-record benchmark also retained exact parity; selection fell from 7.099 s to 6.599 s. The
mandatory gate remains 46/46 green, and frontier reaches all seven intentional JavaScript failures
without platform infrastructure errors.

## MEMORY-ORDER VERIFICATION USES ITS INDEPENDENT DIRECT INDEX (2026-08-23, latest)

The selection verifier now answers memory-producer placement queries from its independently rebuilt
owner/node instruction lists instead of rescanning the complete machine prefix for every memory
dependency. On the slow `Object/defineProperty/15.2.3.6-4-321.js` representative, selection fell
from about 4.05–4.20 s to 2.23–2.36 s and selection verification itself fell from about
1.04–1.10 s to 0.204–0.209 s, with the same runtime-failure outcome and identical graph shape.
A 19-variant slow Object shard retained exact status/category parity while aggregate selection fell
from 77.47 s to 44.01 s. The fixed 177-record benchmark also retained exact parity; aggregate
selection fell from 8.785 s to 7.099 s. The mandatory gate remains 46/46 green, and frontier still
reaches its seven intentional JavaScript failures without platform infrastructure errors.

## SELECTION DEPENDENCY REPAIR USES DIRECT INDICES (2026-08-23, latest)

Selection's late-memory-dependency repair now uses the existing direct owner/node instruction
index rather than repeatedly scanning the entire machine unit. Its independent verifier builds a
verifier-owned per-function memory-read index, preserving the check while avoiding a whole-unit
scan for every memory write. On the fixed 177-record Test262 benchmark, all path+variant statuses
and categories match exactly (16 passed, 95 failed, 49 refused, 17 policy-skipped), while aggregate
selection time fell from 9.857 s to 8.785 s. Measured Array reduce repair cases improved from about
229 ms to 160 ms and from about 680 ms to 345 ms. The mandatory gate remains 46/46 green; frontier
reaches all seven intentional JavaScript failures with no platform infrastructure failure.

## COMPLETE TEST262 RUN MEASURED; TEN MINUTES REMAINS OPEN (2026-08-23, latest)

A clean run covered all **53,578** upstream files at Test262
`3655e7464de3d52643ecddd4b5f9f4f3e7f62398` and produced **93,209** path/variant records:
**7,393 passed, 51,746 failed, 22,788 refused, and 11,282 policy-skipped**. The larger record count
than the old 82,278-record run is intentional: catchable-exception tests are now attempted rather
than policy-skipped. With 14 persistent workers, 2 GiB per worker, and the original whole-run
30-second timeout, elapsed time was **58:11.80** (46,729.06 s user, 1,272.17 s system, 1,379,908 KiB
maximum runner RSS). There were **60** execution timeouts. This is an authoritative complete run,
and it proves the under-ten-minute goal is not yet met.

The retained semantic/performance change is entirely in `lib/**/*.jsl`. `ToLength` now maps NaN
to zero rather than the upper saturation bound. Built-in constructor and method identities are
shared DSL builtins instead of being re-expanded at every use, and constructor/prototype/Error
initialization uses direct own-property creation rather than generic `[[Set]]` (which can invoke an
inherited setter). The exact fixed 100-file sample now runs in **22.84 s** (88.30 s user, 2.66 s
system, 121,980 KiB maximum RSS), with all **177/177** path+variant status/category outcomes equal
to the prior persistent-worker snapshot: **16 passed, 95 failed, 49 refused, 17 skipped**. This is
about **6.7×** faster than the roughly 154-second proof-snapshot baseline.

The full run consumed 48,570.25 aggregate attempted-variant seconds. Measured phase totals are:
frontend graph 22,069.0 s (including analysis 12,122.4 s and graph build 7,728.2 s), selection
5,627.5 s, allocation 2,728.9 s, graph verification 2,001.2 s, scheduling 1,988.9 s, ELF publication
1,417.6 s, clang linking 1,107.7 s, and x86 encoding 411.6 s. At 14 cores, reaching ten minutes
requires another roughly 5.7× CPU reduction; frontend graph construction/analysis is the dominant
remaining root. Closed-world batching and a compact property-helper substitution were measured and
rejected: batching recompiles failing groups during bisection, while the helper changed failure
categories without enough speedup. Callback-bearing property operations also cannot simply become
shared builtins because their memory effects are caller-local.

Artifacts are under `.amp/in/artifacts/test262-performance-latest/`: the 166 MiB full JSONL,
summary, resource report, aggregate phase/slow-tail report, exact fixed sample, fixed JSONL,
resource report, and zero-diff parity report. The mandatory gate is **46 passed, 0 failed**.
Frontier reaches all seven currently registered intentional bugs as **0 passed, 7 failed**, with no
Linux/x86-64 infrastructure failure.

## FULL TEST262 UNDER TEN MINUTES IS NOT YET ACHIEVED (2026-08-22, latest)

The complete upstream corpus is 53,578 JavaScript files excluding `_FIXTURE.js`. A direct
16-worker run had reached 16,345 records after roughly 43 minutes, including 210 variants that
consumed the old 120-second compile+execute timeout. Native execution now has its own two-second
bound, and the harness can compile same-policy/include/assertion groups into independently invoked
entry functions with adaptive standalone fallback so batching never inherits a neighbor's refusal
or runtime failure. A 24-variant comparison produced exactly the same path+variant status/category
map as the ordinary runner.

Batching is not yet the answer for the failing majority: a measured full-corpus attempt was stopped
after 2m16s with 11,452 records (11,282 policy skips, 166 failures, 4 refusals, no completed batched
passes), because compile failures forced recursive singleton fallback. The checkpoint is under
`.amp/in/artifacts/test262-full-batched/`. This was stopped rather than allowed to become another
multi-hour run.

Additional semantics-preserving compiler work since the 10.88× snapshot removed edge×node Phi
selection and verification, block×instruction packing, global x86 label scans, cross-function
allocator/live-root scans, and duplicate verifier adjacency construction. On the unchanged fixed
100-file benchmark, standalone mode improved from 1:20.08 to **56.21s** with exact aggregate
outcomes (**14 passed, 97 failed, 49 refused, 17 skips**). A 32-function passing batch dropped from
55.31s to 12.02s before the latest scheduler/allocator work. These are real improvements, but the
full-run projection remains above ten minutes: failed standalone variants still dominate, and the
fixed sample consumes 222.05 CPU-seconds. The remaining measured roots are frontend graph/fold
(102.25 CPU-seconds on the fixed sample), allocator verification (5.1s of a 6.3s allocation on the
17,883-vreg reverse tail), and pairwise local schedule construction/independent verification.

Current standing checks: `coil test` is **46 passed, 0 failed**; frontier reaches all seven current
intentional assertions as **0 passed, 7 failed**, with no platform infrastructure failure.
`lib/**/*.jsl` remains unchanged by this performance work.

## FIXED TEST262 NATIVE COMPILE BENCHMARK IS 10.88× FASTER (2026-08-22, latest)

The exact fixed-seed 100-file upstream Test262 sample (160 attempted default/strict variants plus
17 policy skips, four workers, warm cache, unchanged 120 s timeout and 4 GiB child limit) now runs
in **1:20.08**, down from **14:31.44**: **10.88× wall-clock faster**. CPU fell from 3478.60 s user +
9.79 s system to 316.63 s user + 4.09 s system; peak observed child RSS remains essentially
unchanged at 123,032 KiB versus 123,196 KiB. All 177 path/variant keys and all aggregate outcomes
match: **14 passed, 97 failed, 49 refused, 17 policy-skipped**. There are zero status changes. The
20 category changes expose work hidden by the baseline timeout/segfault (12 timeout→selection,
4 timeout→verification, 2 timeout→runtime-failed, 2 segfault→verification); none turns a failure
into a refusal or skip.

The measured roots were structural compiler rescans, not JavaScript semantics. Selection GCM and
its independent verifier now use dense def/use and owner/node indices; scheduling uses direct
def/use edges, ready heaps, and packed liveness checks; allocation uses a packed interference graph
and sparse live set. Frontend constant-proofing computes one O(nodes+edges) proof snapshot per
transformation sweep instead of revisiting 18.2 million transitive cone nodes on the slow passing
case. Dynamic callback arity discovery dropped from 353,452,204 whole-graph parameter probes to
direct Fun def-use walks, and closed-world target discovery is cached after all frontend Fun roots
exist. Machine CFG adjacency, RPO, and independent verification now derive packed indices in linear
passes rather than block×edge, edge×edge, and block×ideal-node scans. `lib/**/*.jsl` is unchanged;
the optimization changes compiler structure only.

Standing verification with Coil current main: `coil test` is **46 passed, 0 failed**. Frontier
reaches all seven current intentional JavaScript assertions as **0 passed, 7 failed**, with no
xcrun, Mach-O, encoder, ELF-link, or host-runtime infrastructure failure. The benchmark command,
raw JSONL, exact sample, resource report, parity report, complete phase distributions, and patch
are preserved under `.amp/in/artifacts/test262-performance-final/`.

## ACCESSORS AND BORROWED ARRAYLIKE CALLBACKS RUN THROUGH THE DSL (2026-08-22, latest)

Ordinary property records now carry accessor getter/setter edges and an accessor attribute bit.
`DefineProperty`, `GetProperty`, `SetProperty`, descriptor validation, non-configurable redefinition,
`GetOwnPropertyDescriptor`, and the two-phase `DefineProperties` algorithm remain composed in
`lib/**/*.jsl`; the runtime additions only store/query descriptor representation. Dynamic getter,
setter, and captured-callback invocation crosses the x86-64 boxed JavaScript call ABI. A missing
property's `-1` attribute sentinel is no longer mistaken for an accessor, and frozen accessors keep
their descriptor-kind bit.

Array `map`, `filter`, `forEach`, `some`, `every`, `find`, and `findIndex` now derive length,
presence, and values through shared ArrayLike operations in the DSL. This makes borrowed calls such
as `Array.prototype.forEach.call({1: 11, length: "2"}, callback)` operate on the explicit receiver
rather than accidentally passing the built-in function identity as the source. Length coercion now
passes through DSL `ToNumberValue` before the runtime truncation capability, including user
`valueOf`/`toString` methods. In the 25-file forEach shard that previously reached graph corruption,
the current runner passes **28 variants**, with 20 honest runtime failures and 2 refusals. This is a
focused measurement, not a claim of 4,000 newly passing variants; a comparable broad run is still
required before making that claim.

The default gate remains below one minute: `coil test` is **46 passed, 0 failed in 47.75 s**. The
frontier reaches all seven current intentional JavaScript bugs as **0 passed, 7 failed in 43.10 s**,
with no xcrun, Mach-O, encoder, ELF-link, or Linux runtime infrastructure failure. Focused accessor,
setter, descriptor-identity, borrowed ArrayLike iteration, and captured-callback native execution
agrees with Node.

## DATA DESCRIPTORS AND QUOTED PROPERTY KEYS RUN THROUGH THE DSL (2026-08-22, latest)

The native property representation now records writable, enumerable, and configurable bits for
ordinary and indexed array properties. `Object.defineProperty`, `defineProperties`,
`getOwnPropertyDescriptor`, `getOwnPropertyNames`, `create`, `hasOwnProperty`, and
`propertyIsEnumerable` are composed in `lib/**/*.jsl`; the runtime exposes only property storage
and attribute operations. Writes honor non-writable properties, deletes honor configurable, array
length/string-index attributes are represented, and Object enumeration filters enumerable keys.
Accessor descriptors and the complete built-in prototype/property inventory remain open.

Quoted object-literal keys are now published to the DSL property heap without their source quote
characters. This repaired computed access and descriptors for numeric-looking names such as `"0"`.
The first 20 `Object.getOwnPropertyDescriptor` Test262 files improved from **12/40** passing to
**26/40**; the complete directory currently reports **118 passed, 502 failed, 0 refused**. The
remaining directory failures are predominantly accessor descriptors, absent built-in own-property
inventory, primitive coercion/throw cases, and existing verifier/graph failures. This is not yet a
4,000-pass improvement, and no such claim should be made without a completed broad run.

The mandatory loop remains below one minute: `coil test` is **46 passed, 0 failed in 46.57 s**.
Frontier reaches all seven current intentional JavaScript bugs as **0 passed, 7 failed in 41.78 s**,
with no xcrun, Mach-O, encoder, link, or Linux infrastructure failure.

Stable built-in Object/Array prototype identities are now representation primitives, while
constructor/prototype wiring, ordinary-object and array prototype initialization, `isPrototypeOf`,
and borrowed `Object.prototype.hasOwnProperty.call`/`propertyIsEnumerable.call` semantics live in
the DSL. The frontend only recognizes those exact structural call identities. Focused upstream
Array prototype inheritance and `isPrototypeOf` variants pass, and the first 100
`Object.defineProperty` files now report **102 passed, 98 failed, 0 refused**. A broad ES5 sample
started against an older runner became invalid when lib files changed during its execution; its
later “JSL runtime library did not load” results must not be used as a baseline or progress claim.

## TEST262 ITERATION IS SUB-MINUTE AND COERCION/ERROR FOUNDATIONS ARE NATIVE (2026-08-22, latest)

The mandatory edit loop remains below one minute: `coil test` is **46 passed, 0 failed in 45.56 s**
in this orb. Test262 runs now report per-variant duration and exact pipeline phase, and machine
selection failures print the instruction op, owner, block, graph node, arguments, definitions, and
polymorphic target summary. The runner loads only the referenced assertion methods from the local
bootstrap harness. This is closed-world dependency elimination, not altered assertions: an Array
case that previously exceeded a 10 s timeout now reaches its real runtime failure in **8.99 s for
both variants**. A four-case batching experiment was discarded after measurement showed the
backend's larger-graph costs outweighed harness reuse.

JavaScript Number constants, Boolean conversion, Number/Boolean wrapper internal slots, and
Number-hint `valueOf`/`toString` coercion are implemented in `lib/**/*.jsl`. Raw managed pointers
are boxed at the representation boundary instead of being mistaken for tagged values. Default
object/function numeric coercion and basic wrappers execute natively; an 18-variant Number-constant
shard and focused wrapper/coercion witnesses pass. Polymorphic call verification now agrees with
the encoder's deliberate all-live-owner dispatch instead of rejecting stale dead function ids in
the conservative type summary.

Unbound identifier reads now raise catchable `ReferenceError` objects at runtime rather than being
indexing refusals, and built-in Error `instanceof` is delegated to DSL-owned constructor identity.
The exact four default/strict unbound-reference variants that were previously frontend code 1003
now pass. Pure proven-number arithmetic no longer retains impossible pending-exception branches:
the frontend records only the numeric representation refinement while `JsAdd` and all coercion
meaning remain in the DSL. Test262's large all-checks-in-one coercion files still expose quadratic
graph/allocation growth and user-callback throws through a non-inlined coercion builtin remain an
open boundary; no 4,000-pass claim has been made yet.

Final standing verification: `coil test` is **46 passed, 0 failed in 45.56 s**. Frontier reaches
all seven current intentional JavaScript bugs as **0 passed, 7 failed**, with no xcrun, Mach-O,
encoding, link, or Linux infrastructure failure.

## THE MANDATORY GATE IS BOUNDED BELOW ONE MINUTE (2026-08-22, latest)

The former default compiled all 46 test modules into one 3.1 GiB runner before executing 442 tests.
Compilation alone measured **85.92 s**, and broad native capability/execution tests each consumed
about 130 CPU-seconds rebuilding and linking many JavaScript programs. That made the standing-order
gate take many minutes even when nothing failed.

Plain `coil test` now builds one explicit gate aggregator: DSL ownership and complete library
lowering, frontend indexing/graph checks, and a TypeScript → selection → allocation → x86-64 encode
→ direct host execution witness. It is **46 passed, 0 failed in 44.87 s** from a cold invocation in
this orb. The previous 442-test coverage remains unchanged under `coil test --suite full`; the red
work queue remains `coil test --suite frontier`. `AGENTS.md` names which command belongs in the
per-edit loop and when the exhaustive suite is warranted.

## DSL-OWNED `FOR ... IN` UNLOCKS TEST262 PROPERTY HELPERS (2026-08-22, latest)

The native frontend now accepts a single declared identifier in `for ... in`, resolves its right
hand side outside the loop binding, and reuses the existing iterator/control graph. It does not
open-code enumeration: `ObjectKeys`, `GetIterator`, `ArrayIteratorNext`, `IteratorComplete`, and
`IteratorValue` remain the operations in `lib/**/*.jsl`. `GetIterator` now has one tagged-value
parameter contract and performs its representation unbox inside the DSL.

Statically shaped object literals now publish their initial named properties through DSL
`SetNamedProperty` in addition to their fast slots, and later static writes keep that observable
property heap synchronized. That makes own-key enumeration and computed reads see the same values
as static reads. The node-differential regression covers `const` and `var` bindings, nesting,
labels, and `continue`; the former frontier repro now answers node's 9 and was retired. The derived
frontier is seven open bugs. Current enumeration is a snapshot of own keys; inherited prototype
keys and mutation-sensitive `EnumerateObjectProperties` remain future completeness work.

The first 100 lexicographic Test262 paths still report **0 passed, 2 failed, 180 refused, 9
skipped**, but the 38 earlier `for (var ... in ...)` refusals are gone and now reach later harness
dependencies, chiefly unsupported `Function`, `Date`, RegExp, and `Reflect`. The two actual failures
remain both modes of Annex B `String.prototype.anchor`, at the pre-existing NO-NODE graph boundary.

## PACKED ALLOCATION VERIFICATION UNBLOCKS LARGER TEST262 GRAPHS (2026-08-22, latest)

`mra-verify!` no longer duplicates its quadratic interference matrix as one i64 per boolean cell.
Its exact pre-rebuild snapshot is now a bitset, retaining cell-by-cell corruption detection at
1/64 the storage. GDB identified the old verifier-only copy as the 2 GiB failure: a 4,934-vreg
Test262 program reserved another 256 MiB while coloring despite using about 405 MiB resident.

The byte-identical upstream `assert-throws-null-fn.js` case, which contains three sequential caught
assertion failures and previously exhausted the runner's 2 GiB cap, now passes default and strict at
that original cap. The complete synchronous upstream `assert-throws-*` sample is now **18 passed,
2 failed, 1 skipped**. Only `assert-throws-custom-typeerror.js` fails, in both modes, because an
aliased built-in Error identity cannot yet serve as a polymorphic constructor; the `$262` same-realm
case remains policy-skipped. The pinned runner is **16 passed, 0 failed, 0 refused, 0 skipped** over
eight upstream files.

Final verification with current Coil: `coil test` is **441 passed, 0 failed**; allocation is
**10 passed, 0 failed**; focused Test262 harness is **9 passed, 0 failed**. The frontier remains the
intentional **0 passed, 8 failed**, with the same seven named refusals and 26-vs-25 disagreement and
no infrastructure failure.

## ORDINARY CONSTRUCTOR IDENTITY MAKES ASSERTION FAILURES CATCHABLE (2026-08-22, latest)

Synthesized ordinary function prototypes now receive their standard `constructor` property through
`InitializeFunctionPrototype` in `lib/abstract/errors.jsl`. A statically known `new F()` whose
constructor never reads `this` now also gets its prototype link; the old receiver-type guard left
such objects disconnected. Custom Error-like constructors therefore retain exact function identity,
and Test262 assertion failures thrown as ordinary `Test262Error` objects can themselves be checked.

Two more byte-for-byte upstream harness cases are pinned: `assert-throws-custom.js` and
`assert-throws-incorrect-ctor.js`. The focused runner now executes **14 passed, 0 failed, 0 refused,
0 skipped** over seven files in default and strict modes. The full synchronous upstream
`assert-throws-*` sample improved from 2/20 to **16 passed, 4 failed, 1 skipped**. The four failures
are two files in both modes: aliased/polymorphic Error construction and three sequential invalid
callback assertions currently exhaust graph memory; the `$262` same-realm case is policy-skipped.
Those gaps remain visible rather than weakening `assert.throws`.

Final verification with current Coil: `coil test` is **439 passed, 0 failed**; focused native is
**35 passed, 0 failed**; focused Test262 harness is **8 passed, 0 failed**; DSL ownership remains
**4 passed, 0 failed**. The frontier remains the intentional **0 passed, 8 failed**, with the same
seven named refusals and shortest-round-trip disagreement and no infrastructure failure.

## BUILT-IN ERROR IDENTITY UNBLOCKS `assert.throws` ATTEMPTS (2026-08-22, latest)

The seven built-in Error names now resolve to distinct function-tagged constructor identities.
`new Error`/`EvalError`/`RangeError`/`ReferenceError`/`SyntaxError`/`TypeError`/`URIError` allocates
and initializes `message`, `name`, and `constructor` through `NewErrorObject` in
`lib/abstract/errors.jsl`; the frontend only identifies syntax and passes the constructor kind.
The Test262 bootstrap now performs the upstream assertion's essential checks: the callback must
throw an object whose constructor is exactly the expected constructor. The runner no longer skips
every `assert.throws` file by policy.

The byte-for-byte upstream `test/harness/assert-throws-native.js` case is pinned and passes in both
default and strict modes through native x86-64. An exploratory run over the synchronous upstream
assert-throws harness directory produced **2 passed, 18 failed, and 1 skipped**. The remaining
failures are visible work (especially custom constructor identity and assertion-failure paths), not
manufactured passes; one `$262` case remains policy-skipped. String `repeat` RangeError cases now
attempt compilation rather than skipping, but expose an existing JSL loop graph failure in a
callback (SIGSEGV/timeout), which was not hidden.

Final verification with current Coil: `coil test` is **436 passed, 0 failed**. The opt-in frontier
is the intentional **0 passed, 8 failed**: seven named syntax/bridge refusals and the existing
shortest-round-trip disagreement (`ours=26`, `node=25`), with no platform, encoding, link, or
runtime infrastructure failure. The focused native suite is **34 passed, 0 failed**, the focused
Test262 harness suite is **6 passed, 0 failed**, and the runner executes **10 passed, 0 failed,
0 refused, 0 skipped** across the five pinned upstream files in default and strict modes.

## CATCHABLE EXCEPTIONS CROSS NATIVE FRAMES (2026-08-22, latest)

Catch-only `try` statements now lower to explicit exceptional graph edges on Linux x86-64. A
boxed pending exception lives in the runtime and is relocated as a GC root; generated calls query
that state before consuming their result, exceptional-only returns no longer contaminate the
callee's ordinary return ABI, and catch entry atomically takes and clears the value. Source throws,
nested catch/rethrow, a `%Throw` originating in a JSL definition, and a callback throw crossing a
JSL array operation all agree with Node through the native ELF harness. The same runtime-call
dependency convention is encoded on AArch64 so this work does not knowingly regress the existing
backend.

JavaScript meaning remains in `lib/**/*.jsl`: source `throw` invokes `ThrowValue`, and transitive
throwability is derived as a fixed point over the JSL call graph. The frontend owns only syntax,
scope, state snapshots and exceptional control transport. The DSL ownership gate still reports an
empty list of frontend-open-coded JavaScript operations.

This is a substantial Test262 foundation, not complete exception conformance. `finally` is still
refused because it requires completion records for return/throw/break/continue. At this milestone
the runner still skipped `assert.throws`; the newer section above records its subsequent enablement.
A 40-file exploratory catch sample produced 5 native passes, 16 honest failures and 32 refusals;
the failures/refusals expose unrelated Annex B binding semantics, empty statements, `eval`,
`for-in`, and built-in Error names rather than platform or exception-transport failures.

Verification on Linux x86-64 with the freshly built Coil main compiler:

* `COIL_META_CACHE=0 coil test tests/native-execution-test.coil` — **32 passed, 0 failed**, including
  five exception transport witnesses.
* `COIL_META_CACHE=0 coil test tests/jsl-test.coil` — **38 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil` — **4 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**: the same
  seven named frontend refusals and 26-vs-25 semantic disagreement, with no infrastructure failure.
* `COIL_META_CACHE=0 coil test` — **433 passed, 0 failed**. The first run correctly caught the
  changed derived witness count; `docs/WHAT-WORKS.md` was regenerated before this green rerun.

## STRING SEARCH POSITIONS LIVE IN THE DSL (2026-08-21, latest)

`String.prototype.indexOf`, `includes`, `startsWith`, `endsWith`, and `lastIndexOf` now pass boxed
optional positions into `lib/string/*.jsl`. The DSL owns ToIntegerOrInfinity, clamping, negative and
infinite positions, the `endsWith` undefined-to-length default, and `lastIndexOf`'s distinct
NaN-to-+Infinity rule. `lastIndexOf`'s forward scan stops at the converted position, including for
an empty needle. The frontend now accepts the real optional arities, but only reports absence and
boxes representation; it does not interpret the values.

Complete reruns of all five upstream Test262 method directories produced **88 passed, 40 failed,
80 refused, and 43 skipped**, versus 48 passed, 34 failed, 126 refused, and 43 skipped before this
change. Forty refusals became native passes. Six refusals became honest failures: four
object-valued `lastIndexOf` positions expose the existing missing ToPrimitive/`valueOf` support,
and the large multi-assertion `indexOf/position-tointeger.js` now reaches graph construction but
exhausts the compiler's bounded allocator instead of stopping at its former encoder refusal.

The merged full-corpus artifact at `.amp/in/artifacts/test262-current.jsonl` now contains **2,591
passed, 8,596 failed, 48,074 refused, and 23,017 skipped** across the same 82,278 unique records.
This is an honest incremental rerun: unsupported object coercion and compiler scaling were not
special-cased into passes.

Verification on Linux x86-64:

* Coil main `bbac459` produced byte-identical stage-2/stage-3 x64 compilers. `.agents/setup` could
  not install it because Coil's own upstream x64 behavioral gate currently reports 53 passed and
  three build failures (`closure-lib.coil`, `defclosure.coil`, and `sums-deep.coil`). This
  repository's suites were run with that freshly built stage-2 compiler; the upstream Coil gate
  failure is not hidden or attributed to this repository.
* Complete upstream String `indexOf`, `includes`, `startsWith`, `endsWith`, and `lastIndexOf`
  directories — **88 passed, 40 failed, 80 refused, 43 skipped**.
* `COIL_META_CACHE=0 coil test tests/jsl-test.coil --no-fork` — **38 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil --no-fork` — **4 passed, 0 failed**,
  with no frontend-owned JavaScript operation.
* `COIL_META_CACHE=0 coil test tests/native-differential-test.coil --no-fork` — **1 passed, 0
  failed**, including the new optional-position probes against Node.
* `COIL_META_CACHE=0 coil test` — **428 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**: the same
  seven named frontend refusals and 26-vs-25 semantic disagreement, with no infrastructure
  failures.

## ARRAY SEARCH `fromIndex` AND `substr` COUNT LIVE IN THE DSL (2026-08-21, latest)

`Array.prototype.indexOf`, `includes`, and `lastIndexOf` now pass the boxed `fromIndex` value into
`lib/array/read.jsl`, where ToIntegerOrInfinity, negative-relative indexing, infinities, bounds,
empty-array coercion ordering, string value comparison, and SameValueZero are implemented. An
explicit `undefined` remains distinguishable from an omitted `lastIndexOf` argument. The frontend
only reports argument presence and builds the graph; it does not decide JavaScript meaning.

`String.prototype.substr` likewise passes its boxed count to `lib/string/substring.jsl`. Omitted
and explicitly `undefined` counts return the remainder, while other values use the existing DSL
conversion and clamp operations. The remaining surrogate-pair cases need proper UTF-16 code-unit
string representation and were not approximated in the frontend.

Complete upstream reruns of the three affected array-search directories plus the `substr`
directory improved the full-corpus baseline from 2,475 to **2,551 passed**. The merged incremental
artifact is `.amp/in/artifacts/test262-current.jsonl`, with **2,551 passed, 8,590 failed, 48,120
refused, and 23,017 skipped** across the same 82,278 unique path/variant records. This includes 72
array-search failures and four refusals becoming passes. Four formerly passing object-valued
`fromIndex` cases now fail honestly because evaluating the argument exposes the existing missing
ToPrimitive/`valueOf` support; their old passes resulted from ignoring `fromIndex` entirely.

Verification on Linux x86-64:

* Focused upstream empty-array coercion-ordering and `substr(..., undefined)` cases — **8 passed**.
* Complete affected array-search directories — **190 passed, 516 failed, 94 refused, 28 skipped**.
* Complete upstream `substr` directory — **10 passed, 2 failed, 8 refused, 5 skipped**; both
  failures are the known UTF-16 surrogate-pair boundary.
* `COIL_META_CACHE=0 coil test tests/jsl-test.coil --no-fork` — **38 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil --no-fork` — **4 passed, 0 failed**,
  with no frontend-owned JavaScript operation.
* `COIL_META_CACHE=0 coil test tests/native-differential-test.coil --no-fork` — **1 passed, 0
  failed**.
* `COIL_META_CACHE=0 coil test` — **428 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**: the same
  seven named frontend refusals and 26-vs-25 semantic disagreement, with no infrastructure
  failures.

## COMPLETE TEST262 CORPUS NOW HAS AN HONEST NATIVE BASELINE (2026-08-21, latest)

The runner can now attempt every actual test file in an upstream Test262 checkout with bounded
parallel native compilation, incremental JSONL results, and resume. It excludes `_FIXTURE.js`
module support files (which are inputs to tests, not tests themselves), accepts CR/CRLF metadata,
uses PID-specific object/executable paths, caches immutable C bridge objects by tracked-source
freshness, and cleans up after crashes and timeouts. On Linux each worker has a 30-second timeout
and a 2048 MiB address-space limit, so malformed generated programs are recorded instead of
exhausting the machine. None of these outcomes is turned into a pass.

The complete attempt used Test262 revision `3655e7464de3d52643ecddd4b5f9f4f3e7f62398` and selected
53,578 tests. Default/strict expansion plus one policy record for unsupported protocol tests
produced 82,278 unique results:

* **2,475 passed** through frontend, Machine IR, native x86-64 encoding, ELF linking, runtime, and
  execution.
* **8,656 failed**, led by 6,164 `jsl argument 0 is NO-NODE` graph corruptions, 1,724 runtime
  failures, 492 compiler `SIGSEGV`s, 104 declaration-initializer graph corruptions, 79 compiler
  `SIGABRT`s, and 65 timeouts.
* **48,130 refused** rather than approximated. The largest indexed reasons are frontend codes 1001
  (23,354) and 1003 (20,462), followed by unsupported bridge kinds and 1,615 pipeline refusals.
* **23,017 skipped** for explicit unimplemented Test262 protocol: 11,876 catchable-exception
  assertions, 5,523 async tests, 4,453 negative parse tests, 843 modules, 290 `$262` host-object
  tests, and 32 negative runtime tests.

The durable evidence is `.amp/in/artifacts/test262-full.jsonl` with aggregate totals in
`.amp/in/artifacts/test262-full.jsonl.summary.json`. All 82,278 `(path, variant)` keys are unique;
there are no fixture-file or metadata-parser failures. `docs/TEST262.md` documents range,
parallelism, timeout, memory-limit, result, and resume options. This is a full-corpus **attempt and
baseline**, not a conformance claim: exact top-level Script semantics, modules, async completion,
negative phases, fresh realms, `$262`, and catchable exceptions remain real implementation work.

No JavaScript operation was added to the runner, native harness, or frontend. These changes are
process isolation, object preparation, metadata, and reporting only; `lib/**/*.jsl` remains the
sole owner of JavaScript semantics.

Final Linux x86-64 verification:

* `npm run test262 -- --jobs 4 --test262 /tmp/test262 tests/test262/cases` from an empty native C
  object cache — **8 passed, 0 failed, 0 refused, 0 skipped**, with no leaked per-process files.
* The full incremental command — expected nonzero because unsupported and broken tests are not
  hidden — **2,475 passed, 8,656 failed, 48,130 refused, 23,017 skipped**.
* `COIL_META_CACHE=0 coil test tests/test262-harness-test.coil --no-fork` — **5 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil --no-fork` — **4 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test` — **428 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**: seven
  listed frontend refusals and the listed 26-vs-25 disagreement, with no platform, encoding,
  linking, or runtime infrastructure failure.

## ACTUAL TEST262 FILES RUN THROUGH THE NATIVE RUNNER (2026-08-21, latest)

The prior section's single Test262-shaped fixture was not an answer to “can this run Test262
tests?” A real command now reads upstream YAML frontmatter, expands requested includes, selects
default/strict variants, assembles the native entry, and reports PASS/FAIL/REFUSED/SKIP:

```
npm run test262 -- --test262 /path/to/test262 TEST_OR_DIRECTORY...
```

Four byte-for-byte upstream files from Test262 revision
`3655e7464de3d52643ecddd4b5f9f4f3e7f62398` are pinned under `tests/test262/cases/`: division,
modulus, and multiplication line-terminator tests plus the compare-array harness include test. Each
passes in both default and strict mode, so the focused command performs eight actual Test262
executions through native frontend, Machine IR,
x86-64 encoding, ELF publication/linking, runtime, and GC trampoline. The Coil gate independently
runs all four source files against Node.

The runner does not turn missing support into green. A frontend refusal makes the command fail;
module/async/negative variants are visibly skipped; a runtime throw/crash fails. It prints the
current function-body entry limitation before every run because exact top-level Script semantics
are not implemented yet. `docs/TEST262.md` records that boundary and the exact source provenance.
Try/catch now has a stable bridge kind and is rejected during indexing instead of aborting in graph
construction.

No JavaScript semantics were added to runner/frontend code. Metadata, include expansion, variant
selection, and process status are harness policy. Arithmetic and assertion value operations still
reach `lib/**/*.jsl`; the four DSL ownership invariants remain green and the exact open-coded
semantic debt remains empty.

Focused verification on Linux x86-64:

* `npm run test262 -- --test262 /tmp/test262 tests/test262/cases` — **8 passed, 0 failed, 0
  refused, 0 skipped**.
* `COIL_META_CACHE=0 coil test tests/test262-harness-test.coil --no-fork` — **5 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil --no-fork` — **4 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/frontend-native-graph-test.coil --no-fork` — **4 passed, 0
  failed**.
* `COIL_META_CACHE=0 coil test` — **428 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**, with the
  same seven named frontend refusals and one 26-vs-25 semantic disagreement; no harness, platform,
  encoding, linking, or runtime infrastructure failure.

## TEST262 CORE HARNESS REACHES NATIVE X86-64 EXECUTION (2026-08-21, latest)

The first Test262 runner slice now assembles the exact upstream `sta.js`, a deliberately bounded
`assert.js`, and a fixture into the repository's `main(n)` entry ABI, then sends that source through
the real frontend, x86-64 encoder, ELF linker, GC trampoline, and process execution. The assertion
slice runs ordinary `assert`, exact SameValue behavior (including NaN and signed zero),
`assert.sameValue`, `assert.notSameValue`, global `compareArray`, and `assert.compareArray`.
Vendored harness files retain their Ecma copyright notices and the Test262 BSD license.

This exposed a real frontend collision: `object.name()` was rejected whenever an unrelated
top-level function declaration was also named `name`. Test262 defines both global `compareArray`
and `assert.compareArray`. Receiver validation no longer guesses a target from that spelling; the
graph builder continues to resolve indexed methods and otherwise performs the JavaScript property
load and dynamic call.

This is an honest synchronous-script foundation, not a claim that arbitrary Test262 tests run yet.
Frontmatter policy, requested includes, strict/module variants, negative parse/runtime phases,
async completion, fresh realms, and `$262` remain runner work. The upstream `assert.js` also uses
`try`/`catch` for diagnostic formatting and `assert.throws`; the bridge can identify TryStatement,
but the native frontend and runtime do not yet implement catchable exception transport. The local
assertion subset therefore omits `assert.throws` rather than reporting false conformance.

Verification on Linux x86-64:

* `COIL_META_CACHE=0 coil test tests/test262-harness-test.coil --no-fork` — **1 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test` — **423 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**, with the
  same seven listed frontend refusals and one 26-vs-25 semantic disagreement; no infrastructure
  failures.

## LINUX X86-64 RUNS THE COMPLETE NATIVE JAVASCRIPT HARNESS (2026-08-21, latest)

Linux x86-64 now owns a complete host-native path from the target-neutral Machine IR through
`src/backend_x64.coil`, ELF64 `ET_REL` publication in `src/backend_elf.coil`, the SysV runtime/GC
entry trampoline, native linking, and execution. It uses neither QEMU nor cross-AArch64 artifacts.
The earlier “first arithmetic slice” note below is retained as history and is superseded by this
section.

The x64 encoder now covers the machine operations exercised by the full JavaScript native harness:
integer and floating arithmetic/comparisons/conversions, NaN-box tests and box/unbox, loads/stores,
branches and edge copies, SysV frames/spills/callee saves, direct and polymorphic calls, runtime
string/array/property calls, and allocation. Direct calls are resolved in raw executable bytes and
also carry ELF RELA relocations. Runtime calls are undefined ELF symbols; polymorphic dispatch calls
are internal fixups and receive no external relocation. Unsupported instructions fail atomically
with an exact op/node/owner/instruction/location diagnostic.

Two ABI boundaries found by actual execution are worth preserving. Internal generated-code calls
have independent eight-GPR/eight-FPR argument lanes plus compact stack overflow, while C runtime
calls use SysV registers and preserve allocator-visible XMM callee colors. After `push rbp`, the
first incoming stack argument is at `frame + 16`, not the AArch64-derived `frame + 8`; the wrong
offset read the return address as JSON.stringify's ninth argument. Focused raw-byte tests now select
host-native bytes and portable mmap flags, while structural AArch64 encoder tests remain AArch64.

Verification on Linux x86-64:

* `COIL_META_CACHE=0 coil test tests/native-execution-test.coil` — **27 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test` — **422 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**. Seven are
  the listed frontend refusals and `shortest-round-trip-digits.js` is the listed 26-vs-25 semantic
  disagreement; there are no xcrun, Mach-O, ELF, encoding, linking, runtime, or platform failures.

## LINUX X86-64 NOW HAS AN ELF64 RELOCATABLE-OBJECT PUBLISHER (2026-08-21, latest)

`src/backend_elf.coil` publishes the existing x86-64 Machine IR code as ELF64 `ET_REL`: `.text`,
local function and global `kernel`/`aot_text_start` symbols, `R_X86_64_PC32` RELA call fixups, the
unchanged `aot_stackmap` and `aot_layout` payloads, and a non-executable-stack note. It deliberately
reuses `backend_macho`'s metadata producers and pre-publication model verifier, so Linux does not
fork the GC/runtime contract. `native/gc/runtime.c` now selects ELF section-start symbols off Apple.

## LINUX NOW EXECUTES ITS FIRST REAL X86-64 JAVASCRIPT ARTIFACT (2026-08-21, latest)

The Linux path is native x86-64, with no QEMU and no cross-architecture execution. The new
`src/backend_x64.coil` maps the allocator's first integer colors onto the SysV AMD64 argument and
caller-saved registers and encodes moves, 64-bit immediates, add/subtract/multiply/negate, and
return. Unsupported machine operations fail with `BER-ENCODING`; they are not silently omitted.
`tests/frontend-native-graph-test.coil` now compiles
`function main(n) { return n * 3 + 7; }`, maps the emitted x86-64 bytes executable, calls them in
process with the host C ABI, and observes 22 for 5 and 4 for -1. The same test retains the existing
AArch64 encoder on non-x86-64 hosts. The focused suite is 3/3 green on this Linux orb.

This is the first host-native encoder slice, not yet the full Test262 harness. The linked harness
still needs the remaining machine operations, SysV spill/callee-save/call lowering, an ELF64
relocatable-object writer, and an x86-64 GC entry/stack-map contract. Those are the next platform
milestones; claiming the Mach-O/AArch64 harness works on Linux before they exist would be false.

## FRESH AMP ORBS INSTALL THE COMPLETE TOOLCHAIN (2026-08-21, latest)

`.agents/setup` now installs the Debian prerequisites, Go 1.25.14, the current Coil `main`
compiler and standard library, npm dependencies, and the pinned `typescript-go` C archive. The
Coil install is accepted only after its upstream no-LLVM bootstrap reaches a byte-identical
stage-2/stage-3 fixpoint and passes the x64 behavioral gate. A commit marker skips that
three-stage bootstrap on a warm snapshot while still fetching `main`; the measured cold setup was
5m12s and the second run was 2.73s. `.agents/resume` performs only the fast tool availability check
and completed in under 0.01s. A clean non-interactive login shell resolved `coil` and `go` from
`~/.local/bin` and Node from the orb toolchain.

The TypeScript-Go bridge now force-links portably from its ordinary static archive. Apple embeds
its framework linker options in the archive member that needs them; Linux receives no Darwin
flags. `native/platform_compat.c` supplies the non-Apple instruction-cache symbol and host mmap
flags. This removes the old pre-test Linux linker boundary; product execution now reaches the
host-native backend boundary described above.

## SIX MORE DEFECTS, A HARNESS THAT STOPPED CALLING A SEGFAULT "0", AND A FRONTIER THAT RUNS (2026-08-19, latest)

`coil test` is **417 passing, 0 failing**. Each fix falsifies on its own; each is pinned by a case
in `tests/native-execution-test.coil`, which is now 27 deftests. **The frontier list this session
opened is empty again**: both items on it were fixed, and (6) turned out not to be about callbacks
or nesting at all. The frontier that REMAINS is eight genuinely failing tests -- see (7).

### 0. A CRASHED PROGRAM WAS REPORTED AS THE ANSWER 0, and it hid the two worst bugs below

`nh-shell-integer` read the child's first output line with `fgets` and handed it to `atoll`. A
segfaulting program prints nothing, `atoll("")` is 0 -- so every probe whose expected answer
happened to be 0 PASSED on a program that never ran, and every other probe reported `ours=0`, which
reads as a wrong computation and sends the search after the arithmetic. `pclose` returns the wait
status and the driver returns 0 on every path it completes; anything else is now refused by name.
**Both remaining bugs on the old frontier list turned out to be crashes, not wrong answers.**

### 1. A loop whose body always returns did not compile

`while (i < 2) { return x; }` fails `g-verify` with `VERR-IN-PROGRESS`, and so do the `for`,
`do`/`while` and `for ... of` forms. `fng-loop` writes the Loop's back edge from the control the
body fell out with, and a body that never falls out left `NO-NODE` there -- which is exactly what
`n-in-progress?` tests. The back edge is not MISSING, it is UNREACHABLE, and the graph has a node
that says so: `XCtrl`. `loop-compute` reads slot 1 alone, so the loop stays as reachable as its
entry, and the carried phis meet a proven-dead path.

### 2. Dropping a region path skipped a phi, leaving a 3-input Phi on a 2-input Region

Fixing (1) made a loop back edge PROVABLY dead for the first time, which reached
`region-remove-path!` -- and it walked the region's out list once, forward, while `n-del-use!` is a
SWAP remove. Dropping a loop's back-edge arm routinely vacates an entry: a memory phi's back edge
is a store chain whose own memory input is that phi, so releasing the arm kills the chain, the
chain releases the phi, and the phi releases the region. The last entry lands in the vacated slot
and a single forward pass never looks at it again. It surfaced as `phi-compute` reading the region
past its end -- "n-in: input index out of range" -- from `for (let i = 0; i < 2; i++) { return x; }`.
Both that scan and `region-reduce-phis!` now restart after every removal.

### 3. A closure that captures the ENTRY function's parameter dereferenced the raw argument

`fng-compile-function!` materializes a heap CELL for every parameter a nested closure captures --
behind `(if top-level 0 ...)`, and the entry function is compiled top-level. Its parameters stayed
bare `Arg` nodes, `fng-closure-expression` stored the RAW ARGUMENT into an environment slot typed
as a cell pointer, and the callee read that slot with a `Cast` plus a `Load`.
`function main(n) { let f = () => n; return f() | 0; }` dereferenced the integer 5. **SIGSEGV**, and
before fix (0) it was reported as the answer 0.

### 4. A callback could not see -- or be seen by -- the caller's cells and closure environments

`jl-mem` is the JavaScript PROPERTY heap, the one state a `.jsl` definition can name, and it was
the only memory edge a callback `Call` carried. A callback runs USER code, which reaches a captured
variable's CELL and a closure ENVIRONMENT's fields, each on its own alias. Nothing tied those to
the call, so the caller's stores into them had no consumer and were deleted as dead. One hole, two
ends:

```js
let b = 2; [3, 4].map(v => (v + b) | 0)          // the env slot was never written; the callee
                                                  // dereferenced it -- SIGSEGV
let acc = 0; [3, 4].forEach(v => { acc += v; })  // the cell store died the same way, and the read
                                                  // after the loop saw the initial value
```

`jsl-decl-calls-back?` (new, `src/jsl.coil`) is a fixpoint over the call graph in the shape of
`jsl-decl-uses-memory?`; `fng-callback-outer-memory` builds the merge; `jl-call-mem` names it on the
`Call`. Three things had to be exactly right, and each was found by a program that stopped
compiling:

- **The property heap is EXCLUDED from the outer merge.** `jl-call-mem` merges it with the
  definition's own `jl-mem`, so including it twice puts two states on ONE alias inside one
  `MemMerge`. That is ambiguous by construction -- `fng-alias-leaf` takes whichever it finds first
  -- and selection refused `[1, 2, 3].flatMap(x => x)` on the result array's `ArrayMark`.
- **It is merged AT THE CALL, not at the `fng-jsl-call` seam.** Merging it into the memory handed
  IN is tidier and makes it the entry arm of the definition's loop memory phi; `ArrayFilter`'s
  resize-before-and-after-the-loop shape then fails placement, and
  `[1, 2, 3, 4].filter(v => v > lo)` -- which compiles and answers correctly -- stopped compiling.
- **On the way back the property heap is the exception in the OTHER direction.** It is taken from
  the body, because `ArrayMap` builds its result array through that chain; re-anchoring it too left
  those stores with no consumer and deleted every element the map had written. Every OTHER alias
  re-anchors at the CallEnd, exactly as an ordinary JavaScript call does.

### 5. A memory state belongs to ONE function, and the block query is not what says so

`ms-node-block` answers "this owner's entry block" for any node with NO control input, and a memory
node usually has none -- slot 0 of `Store`/`Load`/`MemMerge` is a control anchor that is null in
practice. That is a sensible PLACEMENT default and a useless OWNERSHIP test, and
`ms-preselect-function!`'s dynamic-effect sweep was using it as one: it walks EVERY node in the
graph, so a store belonging to `main` answered "entry block of owner 1" and a JSL builtin adopted
it. Selecting it there walked into a memory `Phi` on one of `main`'s loops, which
`ms-preallocate-phis!` marks seen for `main` and not for that owner, and the whole program was
refused with `MSEL-UNSUPPORTED`.

`forEach` and `flatMap` in ONE function was the witness, and only once (4) existed to reach that
phi. `ms-memory-chain-owner` (new) asks the chain instead: a `Phi`'s region, an `Arg`'s anchor and
any pinned effect's control all map to a block, and a block names its function. Nothing else moved
-- a chain that names no function still falls back to the block query, exactly as before.

### 6. `xs: number[]` was not an array, and the bridge had no kind for it

The TypeScript bridge maps `ast.Kind*` to its own numbers and simply had **no case for
`KindArrayType`**, so an array TYPE annotation arrived as kind 0 and `fng-type-tag` answered
`FNG-DYNAMIC`. Everything that decides "is this an array" asks `fng-infer`, which asks that -- so
`xs.push(9)` on an array-typed PARAMETER was not an array method at all. It took the generic path,
loaded `push` out of the runtime property table, found nothing, and dispatched `undefined`: `brk`
on the callee tag test. Every method, and a function declared to RETURN `number[]` the same way.

**This is what "a callback created inside a non-top-level function traps in dispatch" actually
was.** A callback is only ever written on a method, and the array in `main` is usually a literal,
so the frontier entry named the two things that happened to be true of the repro. `xs.push(9)` with
no callback and no nesting fails identically. `fng-number-array-symbol?` has been reading the type
node's TEXT for a trailing `"[]"` since before this kind existed; that is what it was working
around.

Two places had to name `FNG-ARRAY` where they had been reading `FNG-DYNAMIC` by accident: an
array-typed FIELD must keep a tagged slot (a raw one holds a pointer the GC scan skips), and an
array ARGUMENT must still be boxed (a `Parm` is a tagged JavaScript value). The Go bridge is
rebuilt with `tools/build-typescript-go-bridge.sh`.

### 7. And the practice that let two fixed bugs stay filed as open

`repros/open/` is a directory of known bugs, one hand-written `.js` file each, and **nothing ran
it**: `tools/js-repro` was deleted with the interpreter and the paragraphs stayed. By the time
anyone looked, two of the four were fixed and still filed, one of them by a change made hours
earlier in this same session.

**The bugs are real failing tests now.** `tests/frontier/open-bugs-frontier.coil` has one deftest
per open bug, each asserting the CORRECT answer, so all eight are RED:

```
coil test --suite frontier        # 0 passed; 8 failed, and that is the honest number
```

The first draft of this was an expected-failure suite -- assert each bug is still BROKEN, keep the
gate green. That is the standard pattern and it is wrong here for one specific reason: fixing a bug
would turn a GREEN thing RED, and the remedy would be to go edit a test. That teaches "red means go
edit the bug list". These go the other way: fix the bug, the test goes green, and it stays as the
regression test it already was. Nothing is promoted and nothing is deleted.

It is `default = false` in `Coil.toml`, because a permanently red `coil test` stops answering the
question the everyday gate exists for -- did MY change break something. **That is the only reason,
and it is the one thing about this design that could let the frontier drift out of sight, so
`AGENTS.md` makes running it a standing order and the gate prints the count on every run:**

```
=== THE FRONTIER: 8 OPEN BUGS ===
  coil test --suite frontier   -- eight failing tests, and they are the work queue.
```

What watches the corpus on every gate is `tests/native-frontier-test.coil`, which is green and does
two things:

- derives each bug's status through the real pipeline and compares `docs/NATIVE-FRONTIER.md` byte
  for byte, so a bug that is fixed, that regresses, or that merely changes HOW it is broken turns
  the gate red with a diff naming the file;
- refuses to pass if `repros/open/` and the failing suite disagree in either direction -- a bug
  with no test, or a test whose repro was deleted. All four behaviours are falsified by hand.

Making the corpus runnable at all needed two changes. `nh-shell-integer` split into a fatal form
and a reporting one (`nh-status`), because the execution suite wants to die on a crash and this one
wants to record it. And `for (const k in o)` and `for await` got real bridge codes: they returned
kind 0 -- the bridge's "no code for this", shared with every syntax it has not been taught -- whose
frontend catch-all is an `abort`, and an abort cannot be observed without forking, which deadlocks
on the live Go runtime (`tests/native-capability-test.coil` records that attempt). With real codes
they refuse at indexing, recoverably, and the diagnostic names the construct.

### The shape all six had in common

Five of the six are one side of a boundary disagreeing with the other while each side is
internally consistent -- verifier versus builder, selection versus scheduling, caller versus
callee, one owner's blocks versus another's, the bridge's kind table versus the frontend's type
tags. The sixth, (0), is the reason the others took as long as they did: a measurement that reports
a crash as a number makes every one of those look like arithmetic.

## THE EVALUATOR IS DELETED, AND WITH IT EVERY JAVASCRIPT-SEMANTICS GATE

2026-08-18, owner's decision, executed in full: `src/eval.coil` (4,373 lines), `src/jsarray.coil`,
`src/jsobject.coil`, `src/js_probes.coil`, the evaluator's half of `src/jsstring.coil` (493 -> 170
lines, now only the compiler's string-CONSTANT table), `tools/js-repro`, `tools/js-sweep`, and
every test that ran a program through the interpreter. **8,700 lines.**

The argument, which is correct: this is an ahead-of-time compiler, the interpreter shipped
nothing, no `src/` module ever imported it, and it was one of the two hand-written copies of every
primitive that `docs/DEMOLITION.md` exists to delete. Removing it halves that duplication in one
move — every primitive now has exactly ONE implementation, the C case in `native/gc/runtime.c`,
with `lib/` owning everything composed above it.

**WHAT THIS COSTS, STATED PLAINLY SO NOBODY DISCOVERS IT BY SHIPPING A BUG.** `coil test` is 568
-> **390 passing, 0 failing**, and what was lost is the entire ability to check that a JavaScript
program computes the right answer:

- the differential against node (`js-source-prop`, 23 tests) — gone
- the fuzz property that generated programs and compared them with node — gone
- the 48-repro sweep (`tools/js-repro`) — gone
- the DSL's own execution tests (`jsl-test` kept 38 of 67; the 29 that RAN a definition are gone)
- memory-SSA semantics (`mem-test` kept 6 of 30), the b06-b14 ideal suites, `jsstring-test`

What survives is real but narrow: the compiler's structure (types, verifier, graph text round-trip,
selection, scheduling, register allocation) and roughly 70 assertions that execute machine code
for arithmetic, control flow, calls and object memory. **A green tree no longer means the compiler
is correct.** It means it is internally consistent.

## THE GATE IS BACK, AND IT RUNS MACHINE CODE (2026-08-19)

`tests/native-execution-test.coil` — eleven tests now. It takes TypeScript source, runs it through the
frontend and the whole backend, writes a Mach-O object, links it with `xcrun clang` against
`native/gc/runtime.c` and `trampoline.S`, executes the binary, and compares its answer with node's
for the same source text. **It is the only test in this repo that runs the artifact we ship.**

It needed no new machinery. The three legs already existed and had never been joined:
`frontend-native-graph-test`'s `fe-native-new`/`frontend-native-build!`, `linked-object-test`'s
`fopen` + `popen` + clang, and a `popen` of `node -e`. The Phase A sketch in an earlier version of
this file (mmap the code and hand-patch `BL` relocations through thunks) was unnecessary — the
system linker resolves them.

**Falsified before trusted**: change `(%Lt u 65)` to `(%Lt u 66)` in `lib/string/case.jsl` and
`string_case_is_a_dsl_loop_and_it_runs_on_the_cpu` fails while the arithmetic case still passes.

Strike 1 is now verified end to end: `"AbZ@[a".toLowerCase()` has no implementation in the compiler
and none in C, so the answer can only come from `lib/string/case.jsl` over the two atoms. The
emitted object's only undefined symbol is `_aot_js_string`.

## `for ... of` LOWERS, AND FOUR COMPILER DEFECTS FELL OUT OF MAKING IT RUN (2026-08-19)

`coil test` is **414 passing, 0 failing**. The feature is four small pieces; the four bugs are the
session, and **not one of them needs `for ... of` to reproduce.** Each was found by compiling a
program, running it, and comparing with node.

### The feature

ECMAScript's own desugaring, not an index loop written in the frontend:

    GetIterator(xs)                 once, before the Loop
    ArrayIteratorNext(it)           at the loop header
    IteratorComplete(result)        the If -- so the BODY is the FALSE arm, the mirror of every
                                    other loop here
    IteratorValue(result)           bound to the loop variable inside the body arm

All four are in `lib/array/iterator.jsl`, over the `ArrayValues`/`ArrayIteratorNext` that
`xs.values()` already used. **The iterator is why this needs no synthetic counter**: a loop-carried
value in this builder is a phi over a SYMBOL, `fng-assigned!` derives the carried set from the
source, and there is no symbol for a counter the source never wrote. The iterator keeps its index in
an internal slot, so the state crosses the back edge through the memory phis `fng-loop` already
builds for every loop. `fng-loop` gained two parameters rather than a 140-line copy.

The bridge maps `KindForOfStatement` to kind 250 (250 was the one number free between `TSK-FOR` and
`TSK-LABELED`) and answers kind 0 -- "no code for this", which the frontend refuses by name -- for
`for await`, whose protocol is a different lowering. `fe-for-of-binding-valid?` refuses an
assignment target and a destructuring pattern for the same reason: both would otherwise reach the
graph builder as a declaration list it would read the wrong child of. `fe-resolve-node!` gained a
case so the ITERABLE resolves in the enclosing scope and the binding is popped at the loop's end;
the default child walk did neither.

`GetIterator` throws a TypeError for a non-array, because there are no Symbols here and so no
@@iterator to look up. It THROWS rather than iterating zero times: `for (const c of "abc")` is a
real program this cannot run yet, and an empty body would look like a correct answer.

### The four defects

1. **A dynamic key read is a JavaScript value** (`be-js-dynamic-boundary?`). It kept a second,
   shorter list of "which ops produce a tagged word" beside `n-rep-of`, and `PropLoadKey` was in one
   and not the other. So an `If` on `o[k]` tested the RAW word, and a tagged `false` is a non-zero
   bit pattern: `o[k] ? 100 : 200` answered 100 while `String(o[k])` printed "false" and `o.a` was
   right. The predicate asks `n-rep-of` first now; the hand-written list survives only for the ops
   it leaves UNKNOWN, whose representation is not structural (a `Call`, an open `Phi`).
2. **An operation that ends the process may not be hoisted** (`ms-anchored-memory-op?`). `JsThrow`
   lowers to a runtime call that never returns, and its only consumer is the Phi joining its arm
   with the other one -- so nothing kept it inside its guard and `ms-gcm-place!` moved it to the
   shallowest block between its inputs and that Phi. A `for ... of` inside another loop therefore
   aborted with "uncaught JavaScript throw" before the first iteration. **The version whose outer
   loop ran ZERO times aborted too**, and that is what said the throw was unguarded rather than
   mis-answered; the disassembly then showed the call in the entry block's straight line with the
   `cbz` that should have skipped it two thousand instructions later, reading the already-thrown
   result out of its stack slot.
3. **One backward pass is not a fixpoint** (`ms-gcm-place!`). Placement walks instructions last to
   first, so a value's uses are normally settled before the value -- but the deferred phi boxes
   `fng-distribute-deferred-phi-boxes!` creates are NEW instructions consumed by OLD ones, so a use
   sits at a lower index and moves after the def has already read its block. `ms-gcm-placement-valid?`
   recomputes the latest use and refused with MSEL-PLACEMENT: latest 6 at placement, 4 at
   verification. It repeats until nothing moves, bounded at 8 rounds.
4. **An allocation and a field store must not erase the runtime property heap** (`fng-object`,
   `fng-lvalue-write`). Both rebuilt the memory merge from the declared FIELD aliases alone, so the
   dynamic aliases fell out of it -- and `fng-current-memory` answers a missing alias by
   MANUFACTURING A FRESH `Arg`, which starts that alias's store chain over from nothing. An array
   literal therefore kept only its LAST element store whenever an element expression touched another
   alias. **This is the one to remember**: `let xs = [{v: 1}, {v: 2}]` had a hole at index 0 and
   nothing anywhere said so, and `[(o.v = 1, 5), (o.v = 2, 6)]` is the same bug with no objects in
   the array at all. `fng-lvalue-write` now calls `fng-preserve-active-memory`, which is the third
   place that merge was written by hand and the only one that was right.

Also pinned, and also not for-of: `Load` for a static shape slot is anchored to its control now
(`n-load-at!`). Unanchored, GCM hoisted `o.v` out of the loop while the `Unbox` producing its
pointer stayed inside -- a dependency `ms-gcm-place!` refuses.

Six new cases in `tests/native-execution-test.coil` (22 there now), and **all four fixes falsify
independently** -- each was reverted with the others in place and exactly the expected pins failed:

| revert | fails |
|---|---|
| `JsThrow` out of `ms-anchored-memory-op?` | `for_of_inside_another_loop`, `for_of_break_and_continue` |
| `be-js-dynamic-boundary?` back to the op list alone | six, including `a_dynamic_key_read_is_a_javascript_value` |
| the dynamic-alias loop in `fng-object` | `an_element_expression_that_writes_memory_keeps_the_array` |
| the GCM round bound from 8 to 1 | `for_of_break_and_continue` |

The two that need no `for ... of` are pinned in their own non-for-of shapes, so deleting for-of
would not take them with it.

## SEVEN MORE FIXES, ALL FOUND BY RUNNING PROGRAMS (2026-08-19, later still)

`coil test` is **407 passing, 0 failing**. `docs/NATIVE-DIFFERENTIAL.md` is **49 of 53 agreeing with
node**, up from 45. Every fix below was found by compiling a program, running it, and comparing --
not one of them by reading code.

### The theme, again, in a new direction

Last session's was "a type is not a representation". This session's is its converse: **a type that is
NARROWER must not lose a capability the wider one had.** Four of the seven are that sentence.

1. **An array returned from a function was not an array** (`be-array-value?`). A `Call` has lattice
   type `dyn` and the `Cast` the frontend puts on its result carries the declared `obj`, so
   `(x) => [x, x]` handed back a value every runtime tag test called an ordinary object:
   `r instanceof Array` false, `String(r)` "[object Object]". It now follows the bounded call graph
   the way `be-function-return-kind-fuel` does. **It had been blocking a correct definition**:
   `Array.prototype.flatMap` is FlattenIntoArray with depth 1 -- spread a mapped element that is an
   array, append one that is not -- and written that way it asks `%IsArray` about the callback's
   result, so it could not be written at all while the answer was wrong. The definition it replaced
   unboxed every mapped value as an object and read its length, which is right for `x => [x, x]` and
   produces the EMPTY array for `x => x`.
2. **A declared `:ret` is a representation contract** (`jl-builtin-call`), the other half of the
   parameter rule that landed earlier. A `Call` computes `dyn` whatever its callee returns, so a
   `lib/` definition declared `:ret int` -- a RAW machine integer -- read as tagged everywhere
   downstream, and two consumers disagreed about one word:
   `"abcdef".lastIndexOf("c")` returned 2 correctly and `lastIndexOf("c") | 0` answered 0.
3. **A value spanning representation classes is not a raw scalar** (`ml-kind-for-type`). It asked
   about `VK-OBJ` alone, so `num|str` -- what `x + 1` on an `any` parameter produces -- was a raw
   SCALAR. The function then had no single return tag and **`String(f(1))` failed selection
   outright**. `undefined|number`, which is every `at` and `codePointAt`, was classified the same
   wrong way.
4. **A string-position argument is ToString of what was passed** (`fng-string-argument`). The
   expression went through untouched, so `"abcdef".localeCompare(1)` handed a raw machine integer to
   `%StringCompare` and `[1,2,3].join(1)` used one as a separator.
5. **A conditional expression must box its arms.** `n > 0 ? "yes" : 5` merged a raw string pointer
   with a raw integer into one Phi. `String(v)` gave the runtime's tag dispatch an untagged `5` and
   printed "2.4703282292062327e-323" -- the double whose bit pattern is 5, twenty-three characters
   where node prints one. `??` boxed its arms already; the ternary did not.
6. **`s[i]` on a string is not an array load.** It took the ordinary element path, so `GetElement`
   ran `%ArrayLoad` over a string pointer and EVERY index answered `undefined`. Three things had to
   change together and each was wrong alone: `StringElement` in `lib/` (which is neither `charAt`
   -- empty string out of range -- nor `at` -- negative indices count from the end); the verifier,
   which accepted only an object, function or undefined RECEIVER and so refused
   `s[i].charCodeAt(0)` outright while the same call on a `dyn` receiver had always been fine; and
   `fng-infer`, which called `s[i]` dynamic, so the method dispatched generically and answered 0.
7. **A method callee is a property read like any other** (`fng-call`). It went straight to
   `GetNamedProperty` -- the runtime property table -- while an object LITERAL stores its properties
   into static shape slots, so the load never saw the store. It now uses `fng-field-load-value`, the
   same function an ordinary `o.get` read uses, which picks the slot when the field is statically
   known and the table when it is not. **This did not fix the program it was found by**; see below.

Each is pinned in `tests/native-execution-test.coil`, which is 15 tests now, and every pin carries
BOTH shapes where two shapes fail in opposite directions -- `flatMap(x => x)` beside
`flatMap(x => [x, x])`, `lastIndexOf("c")` beside `lastIndexOf("c") | 0`. One of a pair passing
proves nothing about the other; that is how the `flatMap` definition got written wrong twice.

### FIXED, AND IT WAS THE BIGGEST: A FUNCTION FROM THE HEAP CAN BE CALLED

Every object method in the language used to return nothing. **Two independent bugs, and the first
hid the second completely.** The disassembly is what found both; no amount of reading the selector
would have, because the selector was marking these calls polymorphic correctly and the ENCODER
disagreed with it.

**ONE — a sign-bit collision in the call encoding.** A polymorphic call is encoded in `MInst.imm` as
the COMPLEMENT of its target set, and `be-poly-call?` recovers which kind of call it is from the
SIGN: negative is a dispatch, non-negative names an owner to call directly. That is injective for
every 63-bit set and it collides for exactly one input. An unconstrained `fun` type carries `fidxs`
of -1, its complement is 0, and 0 is "direct call to owner 0" -- which is always the entry function.
A callable loaded from the heap has precisely that type, because closed-world inference does not
follow a function through a store. So every such call compiled to `bl _kernel` and branched into
`main`. `be-call-target-summary` maps the unconstrained set to 0, "no summary, dispatch over every
function" -- a value the dispatcher already understood -- and emission and `ms-call-target-valid?`
now read it from one function so they cannot drift.

**TWO — a generic call's ABI is all tagged.** With the dispatch reaching the right function,
arguments arrived as 0. The callee is unknown and every JavaScript function's parameters are `dyn`,
but the unknown-callee path passed the raw expression: `o.add(4)` emitted `mov x2, #4`, and the
callee tag-tested x2, found no tag, and answered nothing. **The receiver survived**, because it is
boxed on its own path -- which is exactly why `this.v` worked while `k` did not, and why fixing only
the dispatch looked like most of a fix.

Pinned as `a_function_from_the_heap_can_be_called_on_the_cpu`: thirteen shapes including `this`,
arguments alongside `this`, two-argument methods, two methods on one object, a callback stored into
a dynamic property, a method returning an object, a nested `o.inner.get()`, and an array of
functions called in a loop. Both fixes falsify independently.

A third, smaller one landed with them: **a method callee is a property read like any other**. It
went straight to `GetNamedProperty` -- the runtime property table -- while an object LITERAL stores
into static shape slots, so the load never saw the store. It now uses `fng-field-load-value`, the
same function an ordinary `o.get` read uses.

### The shape of what these three had in common

Every one was a place where two sides of a boundary disagreed about a representation, and BOTH sides
were individually self-consistent: selector versus encoder, caller versus callee ABI, store path
versus load path. None of them is findable by reading one side. That is the argument for the
execution suite over the structural one, and it is why the remaining sections of this file describe
witnesses rather than theories.

### PREVIOUSLY OPEN, NOW FIXED -- kept for the narrowing method

The narrowing that got there, recorded because the method transfers:

```js
function main(n: number): number { let o = {get: () => 7}; return (n + o.get()) | 0; }
function main(n: number): number { let o = {v: 3, get: function() { return this.v; }};
  return (n + o.get()) | 0; }
function main(n: number): number { let a: any[] = [function() { return 42; }];
  return (n + a[0]()) | 0; }
```

All three answered 0. What narrowing established, before the disassembly settled it:

- **The stored value is correctly tagged.** `typeof o.f` is "function" and `typeof a[0]` is
  "function". So the `Box`, the `Store` and the load are all fine.
- **Direct calls work.** `let f = function() { return 7; }; f()` is right, and so is passing a
  function as an ARGUMENT and calling the parameter -- both resolve to a target and never dispatch.
- **It is the POLYMORPHIC dispatch path** (`be-poly-call-*` in `backend_aarch64.coil`). A receiver
  call is `CALL-ABI-DYNAMIC-RECEIVER`, which is polymorphic unconditionally, and `a[0]()` has no
  static target either.
- **The call HAPPENS.** No target match would `brk` -- the dispatcher emits `cbnz x13, +2; brk` --
  and the program does not trap. So a target was selected and called, and the RESULT is wrong:
  `String(r)` of the returned value is the EMPTY string, not "42" and not "0". That points at the
  return-tag fixup after the `blr` (`be-poly-return-code` and the `csel` chain that ORs the tag
  back on), not at the dispatch itself.

Nothing in either derived report exercises this, because both sweep METHODS on built-in receivers.
The last bullet was WRONG, and instructively so: "the call happens, so it is the return-tag fixup"
assumed the `bl` it saw was the dispatch. It was not a dispatch at all -- it was a direct branch to
`main`, and there was no `blr` anywhere in the function. Four correct deductions and one wrong
inference from an absence; the disassembly cost less than the reasoning did.

### The frontier that is refused rather than wrong

**THIS LIST IS NOW EIGHT FAILING TESTS.** `coil test --suite frontier` runs one per bug, each
asserting the answer node gives, all red. `docs/NATIVE-FRONTIER.md` is the derived status table and
`repros/open/` is the corpus both are built from. Two entries had already been FIXED and were still
filed as open when this was written -- a `forEach` callback mutating an enclosing local, repaired
hours earlier the same day, and `String(1e21)`'s exponential switch. Both are pinned in
`tests/native-execution-test.coil` now.

What remains open, as of the last regeneration -- but read the report, not this paragraph:

- `for (const k in o)` and `for await`, both refused by name at indexing. They used to abort on
  "bridge kind 0", the bridge's code for every syntax it has not been taught; giving each a real
  code is what made the refusal recoverable and therefore testable.
- `for (x of xs)` writing an existing binding, and `for (const [a, b] of xs)`.
- **Shorthand methods** (`{ get() { ... } }`) are refused during indexing.
- **A closure capturing a loop variable** does not compile.
- **Rest parameters** are refused rather than bound to nothing.
- **`String(1/3)`** is 19 characters against node's 18 -- the shortest-round-trip digit generator
  the `%.17g` path is not. `String(1e21)` was the other half of that repro and now agrees.

### What the derived report still records as disagreeing

`sort(x => x)` is a probe artifact and may never be fixable: the comparator is inconsistent, so
node's resulting order is unspecified. `sort((a, b) => a - b)`, `sort((a, b) => b - a)` and `sort()`
all agree with node and are pinned. `keys`/`values`/`entries` return iterators, which stringify as
"[object Array Iterator]"; there is no iterator object here to give that name.

## LOOPS COMPILE, AND EVERY METHOD IS NOW RUN AGAINST NODE (2026-08-19, later)

`coil test` is **403 passing, 0 failing**. Three things landed, in this order, and the third is only
possible because of the first two.

### 1. `String(anArray)` -- the last 11 cells, and the report is 216/216

`String([1, 2, 3])` is `"1,2,3"` through `Array.prototype.toString`, and nothing implemented it: the
runtime's ToString is a tag dispatch that answers `"[object Object]"` for every tagged object, which
is right for an object and unfixable inside the primitive for an array, because the array case reads
the ELEMENTS. So `ToStringValue` in `lib/abstract/coercions.jsl` asks `%IsArray` and hands that case
to `ArrayToStringValue`.

Four compiler changes were needed to make that definition compile at all, and each is a rule:

- **`%IsArray` folds in ONE direction** (`arraytest-compute`). A value whose kinds exclude `VK-OBJ`
  cannot be an array, so the test is a constant `false` -- which is what makes the array dispatch
  free at the overwhelming majority of `ToStringValue`'s call sites. The other direction is NOT
  available: the lattice has no bit separating an array from a plain object, so "is an array" stays
  a structural question.
- **`ToString` of a RAW OBJECT POINTER** (`backend_select`). An object arrives as a bare pointer and
  the runtime dispatches on a tag, so it is tagged at the selection site with the same tag
  `be-js-tag-for-value` derives for a `Box`. **`-1` is the failure sentinel and a tag is not a small
  number** -- `JSV-ARRAY` is a negative 64-bit pattern, so `(< tag 0)` rejects every object tag there
  is. That mistake cost an hour, twice.
- **A function nothing calls is not part of this program** (`g-kill-uncalled-functions!`, new).
  `mu-build-program!` builds EVERY live `Fun` -- deliberately, because a callable whose identity
  escapes as a value has no direct call edge -- so an uncalled function was selected, scheduled,
  allocated and EMITTED. It became reachable the day a `lib/` macro first named a `builtin`:
  `ToStringValue` is inlined into `JsAdd`, so `n + 1` pulled the join builtin's `Fun` into its graph,
  the `ArrayTest` folded to false, the `Call` died with the arm, and the FUNCTION remained. The pass
  keeps whatever is reachable from `Start`/`Stop` -- which is the right question, because a function
  stored in a field or merged in a `Phi` is reachable through that value -- and unpins the `Parm`s
  before killing, since a `Parm` is pinned for life by `jl-bind!`.
- **Recursion in `lib/` is a `builtin`, never a macro.** `ArrayToStringValue` reaches itself:
  `String([1, [2, 3]])` is `"1,2,3"`, because converting an element that is an array joins it again.
  A macro cannot -- `jsl-check-macro-cycles` refuses it by name -- and a builtin is a call, which
  terminates. It carries a **cycle stack**, pushed and popped, so `let a = [1]; a.push(a);
  String(a)` is `","` as node says rather than an infinite recursion, and `String([b, b])` for one
  array `b` is still `"1,1"` -- an append-only visited list gets the second case wrong.

`docs/NATIVE-CAPABILITY.md` is now **216 of 216 cells compiling, 0 selection failures, 0 verifier
rejections.**

### 2. NOT ONE JAVASCRIPT LOOP COMPILED, and nothing in the repo said so

`for`, `while`, `do`, nested, empty -- every one failed selection with `BER-UNSUPPORTED-OPCODE op
Phi`. It was invisible because every probe in the derived report is straight-line and every
execution case was written by hand. **Two computes disagreeing about what ANY means:**

- **`n-ty-settled?` conflated "at a fixpoint AT ANY" with "not analysed yet".** A value inside a
  proven-dead region computes ANY for ever -- no path reaches it, so it has no value -- so every
  input cone containing one was "unsettled", so `n-in-proven-xctrl?` never proved anything, so the
  dead region was never dropped, and the live `Phi` merging it kept an ANY arm selection has no rule
  for. Loops are where that shape occurs, because a loop's guards are unknown while its back edge is
  unbuilt. Two flags separate the states: `analysed` (has `g-analyze!` finished) and `provingctrl`
  (this is a CONTROL question, not a value one). **Both are needed** -- relaxing it for value folding
  too let a loop's carried phi be replaced by its entry constant, and `a[i]` became `a[0]`.
- **`CallEnd` answered ANY for `~ctrl`** (`ty-high?` where `ty-unanalysed?` was meant). On the
  control axis "unanalysed" and "proven unreachable" are both high and are not the same claim.

**One thing was tried and REVERTED, and the property test is why.** Asking `if-compute`'s control
before its predicate looks obviously right and is not monotone: control falling from a dead type to
`bot` makes the answer RISE from `[~ctrl ~ctrl]` to ANY. `if_compute_is_monotone_in_both_slots`
printed the exact witness pair. The two fixes above make loops compile without it.

### 3. A loop counter used as an INDEX was silently wrong

Compiling was only half of it. A loop's carried phi has ONE arm while the body is lowered, so every
"is this tagged?" test answered from half a phi, and three separate decisions got it wrong:

- `i++` wrote a raw DOUBLE back into a phi whose entry arm was a raw INT (`fng-machine-number-value?`
  said "raw" from the entry `0`). One phi, two register classes. Every integer consumer read the
  double's bit pattern, **whose low 32 bits are zero for any small integer**, so `a[i]` and
  `s.charCodeAt(i)` indexed 0 on EVERY iteration: `[4,5,6]` summed to 12 and `"abcdef"` hashed to
  six copies of `"a"`.
- `i = i + 1` produced a TAGGED phi, and the `int`-parameter seam skipped the coercion for the same
  reason. `a[i]` at least failed `g-verify` ("ArrayLoad slot 3 is tagged, needs raw-num");
  `s.charCodeAt(i)` compiled and read the NaN box as an index.
- The `int`-parameter coercion itself produced a raw FLOAT for a parameter declared `int`.
  `fng-to-number-operand` answers a double, and both are "raw-num" to the verifier.

Fixed with one structural predicate, `fng-open-loop-phi?` -- a phi on a `Loop` whose slot 2 is still
`NO-NODE` is conservatively "not a machine number" and "may be tagged" -- plus `BitOr(x, 0)` at the
`int` seam. Where the counter really is an integer the guards fold and the loop is the same two
instructions. **The `(BitOr)` debt went 2 -> 3 and is recorded**; it is representation rather than
meaning, and it is counted anyway because a debt that can be argued away silently was never watched.

### The harness, and what it now covers

`tests/native_harness.coil` (new) holds the three legs, and both suites use it. Two costs made the
old copy unaffordable at scale and are gone:

- **It recompiled `native/gc/runtime.c` per program.** 0.25s each against 0.05s to link an object
  already compiled. The runtime, the trampoline and the driver are built once.
- **It spawned a node per program.** `native/js-oracle/oracle.c` -- written for the deleted fuzzer,
  never called since, 0.076ms per case against 63ms of process startup -- is the oracle now.
- **macOS charges ~0.69s to assess the FIRST execution of each freshly linked binary** and 3ms
  thereafter. Measured. `nh-link!` and `nh-exec!` are separate so a suite can link one binary and
  run it many times, which is what makes the sweep below affordable at all.

**`tests/native-differential-test.coil` (new) runs every method the frontend dispatches against
node.** Same derived list as the capability report, same read-the-compiler technique; each method is
tried at the arity the frontend states and the first argument list that BOTH compiles and runs under
node is the one recorded. The probe **hashes `String(r)` character by character** -- a length is
blind to what these definitions decide, and a length-only test stayed green when `join`'s separator
was changed from `","` to `";"`. Eight probes per program, one binary per chunk: 45s for one
54-probe function against 19s spread over seven, because the analyse/fold fixpoint is superlinear.

`docs/NATIVE-DIFFERENTIAL.md` is checked in and compared byte for byte, exactly like the capability
report. **45 of 53 methods agree with node; 8 do not**, and that is the honest number:

| call | what happens |
|---|---|
| `"abcdef".lastIndexOf(1)` | answers 0 where node says -1 -- a `builtin` with a loop, `:ret int`, read as the wrong machine word |
| `"abcdef".localeCompare(1)` | 0 where node says 1, same shape |
| `[1,2,3].join(1)` | a non-string separator is not coerced |
| `[1,2,3].flatMap(x => x)` | see below |
| `[1,2,3].sort(x => x)` | an inconsistent comparator; node's order is unspecified, so this row may never be fixable |
| `[1,2,3].keys/values/entries` | iterators stringify as `[object Array Iterator]`; we have no iterator object |

**AN ARRAY RETURNED FROM A FUNCTION IS NOT ARRAY-TAGGED, and it is the root of two of those.**
`be-function-return-tag` derives the tag from the return value's TYPE, and an array and a plain
object are ONE type. Witness, three lines, all disagreeing with node:

```js
function main(n: number): number { let f = (x: any) => [x, x]; let r: any = f(1);
  return (n + (r instanceof Array ? 100 : 200)) | 0; }   // ours 200, node 100
function main(n: number): number { let f = (x: any) => [x, x]; let r: any = f(1);
  return (n + String(r).length) | 0; }                    // "[object Object]"
function main(n: number): number { let v = [1,2]; let r: any = v.map(x => [x, x]);
  return (n + String(r).length) | 0; }
```

`be-js-tag-for-value` is the structural answer and swapping it in gets the tag right -- and then
`instanceof Array` is STILL false, so the tag is not the only place the decision is made. That is
where the next session starts. `ArrayFlatMap`'s one-line correct body is written out in a comment
above the definition, blocked on exactly this: it makes `flatMap(x => x)` right and
`flatMap(x => [x, x])` wrong, and trading a common case for a rare one is not a fix.

### What the sweep cannot see

The differential probes ONE call per method with a generic argument. It says nothing about a second
argument, an empty receiver, a negative index, or any two methods composed. It is a floor that did
not exist this morning, not a conformance suite.

## FOUR COMPILER FIXES, AND 113 -> 205 OF 216 CELLS (2026-08-19)

Every one was found by reading `docs/NATIVE-CAPABILITY.md`, reproduced as a single program, and
checked by running the compiled binary against node. **Verifier rejections are now 0.**

1. **`ToString` decided on TYPE where it had to decide on REPRESENTATION** (`backend_select.coil`).
   Its `cond` asked the type which machine word a value was, so `num` -- strictly more information
   than `dyn` -- fell to the unsupported arm, and narrowing a type LOST a capability. Worse, a
   tagged value with a narrow type walked into the wrong arm: a NaN out of `charCodeAt` is typed
   float-only and IS tagged, so it reached `FROM-DOUBLE-BITS`, which read the NaN box as an IEEE
   double and printed nineteen characters where node prints "NaN". Representation is the first
   question now, and `n-rep-of` answers it.
2. **A value spanning representation classes must already be tagged** (`be-kinds-must-be-tagged?`).
   There are three raw forms -- number, string pointer, object pointer -- and `undefined`/`null`/
   `true` have none, so a kind set touching two classes can only be a tagged word and boxing it
   again is the identity. **The first version of this rule was unsound**: it said the tag-only
   class ALONE was enough, which made `Box(Const undefined)` a no-op, and `String(v.at(99))`
   printed one character instead of "undefined". It compiled, it ran, and it was wrong by 8 --
   `tests/native-execution-test.coil` is what said so, within a minute. Strictly more than one
   class is the rule.
3. **A `Box` is not foldable to a `Const`** (`node.coil`). `Box(Const undefined)` has a constant
   type -- there is only one undefined -- so `g-fold-proven!` replaced it with the constant and
   deleted the tagging it existed to perform. A `Phi` merging it with a boxed string then held a
   raw immediate on one arm and a tagged word on the other, and nothing objected because both arms
   were individually well typed. DSL-OWNERSHIP records the same trap for `box-compute`'s TYPE; this
   is the transformation half of it. **Vetoing the fold un-hid two further bugs that the fold had
   been accidentally papering over** -- which is the argument for the veto, not against it.
4. **A declared parameter type is a representation contract** (`fng-jsl-call`). `(start int)` means
   a raw machine integer, and call sites passed whatever the expression produced -- for
   `"abcdef".slice(-2)` a BOXED -2, because unary minus reaches the DSL and comes back tagged. The
   graph failed `g-verify` with "Add slot 1 is tagged, needs raw-num". Coercion now happens once at
   the single DSL call seam, driven by the callee's declared parameter types, instead of being
   repeated per method and forgotten for the next definition.

And two beyond the compiler:

- **`StringCharCodeAt` called an in-bounds-only atom out of bounds** (`lib/string/char.jsl`). Its
  comment claimed `%StringCharCode` answers NaN itself. It does -- by returning a TAGGED NaN where
  the in-range case returns a raw code unit. One primitive, two machine representations, chosen at
  run time; nothing downstream can be right about both. Guarded in the DSL, where the bounds belong.
- **A dead loop is not dead code until something says so** (`g-sweep-unreachable!`). `n-kill!`
  refuses a node that still has users and every node in a Phi cycle has one, so a `lib/` definition
  whose result goes unread stayed live, reachable from no root, and `v-pass-leaks` refused the
  graph -- `"abcdef".toLowerCase()` compared only against `undefined` did not compile. The sweep
  breaks the cycles, then kills them, and REFUSES TO RUN if anything unreachable has an effect. It
  runs at the end of the build: inside the analyse/fold fixpoint the function's own memory `Arg`s
  are not wired to the `Return` yet and every one of them looks unreachable.

**What is left is 11 cells with one cause**: `String(anArray)` -- every array method that answers an
array, plus `split`. JavaScript says `String([1,2,3])` is `"1,2,3"` via `Array.prototype.toString`,
and nothing implements that conversion. It is a missing feature rather than a defect, and it wants
`ArrayJoin` reached from `ToStringValue` in `lib/` rather than a special case in the frontend.

### And what does not compile is now DERIVED, not listed

`tests/native-capability-test.coil` reads the method names out of `frontend_native_graph.coil`'s
own dispatch tables -- the same read-the-compiler technique `dsl-ownership-test` uses to count
opcodes -- compiles a program for each under four usage shapes, and writes
**`docs/NATIVE-CAPABILITY.md`**: 216 cells, checked in, compared on every run. Add a method to the
frontend and a row appears with no edit.

Today: **113 cells compile, 94 die in instruction selection, 9 in the verifier.**

Three drafts of that file were wrong before it was right, and the wrongness is the lesson:

1. Consuming every result with `r === undefined` reported `toLowerCase` broken while the execution
   suite was compiling and running it. Comparing a STRING against undefined is what did not compile.
2. Consuming every result with `String(r).length` reported all 54 methods fine, while a realistic
   `substring` program does not compile at all.
3. **"Compiles" is a property of a PROGRAM, not of a method.** Hence four columns, and rows that
   disagree across them: `substring` compiles converted and fails in arithmetic; `charCodeAt` is
   the other way round. A column that fails everywhere is about the column -- `then indexed` mostly
   measures whether you can index the receiver at all.

`docs/STATUS.md` remains true and useless on this question: it says `push`, `map` and `reduce` are
done, meaning a definition exists in `lib/` and the frontend calls it. The derived report is what
says whether the backend can compile the result.

**Do not add a fork to that file.** The obvious design runs each probe in a forked child so an
`abort` becomes a row rather than taking the suite down, the way `gtext-test` observes `g-parse`'s
abort. It was built, it worked several times, and then it HUNG -- the frontend is the typescript-go
bridge and forking a live Go runtime deadlocks. A hang has no diagnostic at all. What replaces it:
the probe derives each string method's ARITY from the same table and only makes calls the frontend
accepts, and never passes an empty argument list to an array method (`v.map()` aborts on a callback
that is not there).

## The dead-code sweep that followed (2026-08-19)

With the interpreter gone, a great deal of the repo was reachable from nothing. All of it was
deleted, with `coil check` as the verifier and the suite green after each step:

- **`workflow/`** — 34 tracked JSON milestone contracts for the B00-B15 shell-gate regime that was
  deleted on 2026-08-13. Pure archaeology.
- **`tests/js-source-prop.coil` and `src/js_templates.coil`** — the JS fuzz property's generator and
  its 90-odd node-verified program templates. The property itself died with the interpreter, so
  these described a fuzzer that no longer existed. Its one surviving test (the rest-parameter
  refusal, which needs no oracle) moved into `tests/frontend-native-graph-test.coil`. **When the
  fuzz property is rebuilt on the native harness, recover `js_templates.coil` from git — it is
  400 lines of templates each verified against node.**
- **35 orphaned `n-*!` node builders**, `%UnboxBool` and `%PropDeleteNamed` (JSP 47 and 62, now in
  `jsp-retired?`), and **69 functions across 16 `src/` modules whose names appeared nowhere
  outside their own definitions** — 694 lines. Two of those were capability rather than plumbing
  and are worth knowing about: **`g-inline-small!` (the small-function inliner) and
  `n-specialize-fun!`/`spec-*` (the call specializer) were called by nothing.** They were reachable
  only from tests that ran the interpreter, so the product never invoked either. They are in git if
  a future optimizer wants them; nothing was optimizing anything with them in the tree.
- **10 `lib/` definitions with no caller** — ArrayIota, ArrayMapDouble, ArrayRepeat, BoxedInf,
  BoxedNegInf, FltCeilFrom, FltFloorFrom, FltTrunc, NegInfinity, NewObject. `ToBoolean` stays: it
  is the DSL half of checklist F2 (`Boolean(x)`).

**And the sweep found a real bug in the ratchet.** `dsl-ownership-test`'s `lib-files` list held 31
paths for 34 `.jsl` files, so every call made from `lib/math/platform.jsl`, `lib/math/rounding.jsl`
and `lib/object/enumeration.jsl` was invisible to the no-dead-definition check. Their callees looked
dead and had been parked on the orphan allowlist — `ObjectCoercible`, `FltAbs`, `IntAbs`, `IntSign`,
`FltSign`, `BoxedNaN` were never dead at all. **The allowlist was absorbing a detector bug.** The
list is complete now and the allowlist is down to two entries.

Totals for the day: **15,202 deletions across 101 files.** `coil test` 390 passed, 0 failed.

Strikes 0 and 1 landed earlier the same day and are still correct as source changes: the string
atoms exist and `lib/string/case.jsl` is a DSL loop over them, with the ops and both hand-written
copies gone. Their evaluator halves were deleted hours later along with everything else, so the
`ev-string-atom`/`ev-cached-value-op?` machinery described further down this file no longer
exists — the graph property it exposed (an allocation must be control-pinned) is recorded in
DEMOLITION Part 5 and still holds.

---

## The mandate, stated here so it is not a pointer

**Every JavaScript semantic moves into `lib/`.** The frontend lowers *syntax* into structure:
control flow, scoping, memory and alias plumbing, the call ABI, closures, shapes,
REPRESENTATION. The meaning of every operator, coercion and builtin belongs to the DSL, reached
through `fng-jsl-call*`. **The DSL's expressiveness is never the limit** — a `%` primitive is the
correct way to reach a runtime capability it cannot spell (`%ToFixed` was added this way; a
regexp engine is the one still owed). **Do not accept a partial conversion as done**, and **no
fast path in the frontend** — the specialisation lives in the definition and folds when types
prove.

## Current state of the debt (all ratcheted in tests/dsl-ownership-test.coil)

| opcode | count | what it is |
|---|---|---|
| `Eq` | 1 | dynamic-callee identity compare — tag bits ARE function identity here |
| `Lt` `Le` | 0 | — |
| `Add` `Sub` `Mul` `Div` `Mod` `Minus` `Not` `BitAnd` `BitXor` `BitNot` `Shl` `Shr` `UShr` | 1 each | `fng-static-global-value`, the literal-only constant evaluator (numeric operands enforced) |
| `BitOr` | 2 | the above plus `fng-int-value`'s index coercion |

`DSL-OWED` is empty. Of Phase 1's six helpers: `fng-equal-value` and `fng-bin` are DELETED,
`fng-condition-expression` is renamed `fng-condition-representation` (`If` owns truthiness
end-to-end; the helper only boxes a raw string pointer). Three remain — `fng-number-value`,
`fng-int-value`, `fng-to-number-operand` — reachable only from the declared-type boundary
(`fng-expression-expected`), array index/length positions, and parameter defaults.

## What landed this session, most recent first

- **DEMOLITION S0 — the string atoms.** `StringAlloc`/`StringSetUnit` (OPTAG 91/92, JSP 94/95,
  `%StringNew`/`%StringSetUnit`, JSSOP 0/1 which the C already had). The evaluator's string heap
  grew a `filled` counter and refuses BOTH an out-of-order write and a read of a partial string,
  because the native runtime already refused both and a silent divergence there would only show
  up in the product. Two traps, both now in DEMOLITION Part 5: an allocation or mutation must be
  CONTROL-PINNED (`(jl-ctrl)` in `jl-prim`) *and* on the evaluator's per-control cache chain
  (`ev-cached-value-op?`), because the evaluator recomputes a floating value node at every demand
  — op-class 2 is necessary and not sufficient; and `ev-effect-op?` is the WRONG list to join,
  since it means "publishes a memory state" and an atom answering a string fails that with
  `EV-MEM`.
- **DEMOLITION S1 — case.** `lib/string/case.jsl` is a loop over the atoms; ops `StringLower`/
  `StringUpper`, `ev-string-case`, `jss-ascii-case!`, JSSOP 21/22 and the C case are all gone
  (runtime.c 2,274 → 2,261). The file's old comment claimed case mapping was an irreducible
  Unicode table — it was an ASCII shift open-coded twice, and the comment now says so. Retiring
  an op leaves a hole in a DENSE SCANNED id space: `op-tag-retired?` and `jsp-retired?` declare
  it, or `gparse-op`/`jsp-find` walk into a number with no row.
- **The syntax migration's one casualty**: the Aug 17 commit stripped the leading spaces inside a
  multi-line string literal in `tests/js-source-prop.coil`, so the lifted-JS pin no longer matched
  the emitter. Restored. The rest of that commit's reindentation was code, not string content.

### Before the demolition, the operator migration

- **`++`/`--`** are `ToNumberValue` then `JsAdd`/`JsSub` (spec: ToNumeric then a NUMERIC add,
  never concat; postfix returns the COERCED old value). The write-back representation stays the
  frontend's, decided structurally with `fng-machine-number-value?`.
- **Object spread** — each `...a` is one `ObjectAssignSource` step (the definition Object.assign
  repeats). Two supporting rules: a program containing spread disables static object layouts
  (enumeration reads the runtime property table; shape slots are invisible to it), and a
  certainly-SHAPE-ROOT object never takes `fng-unique-field-index`'s static-shape name-guess.
- **`instanceof Object` / `instanceof Array`** — name-dispatch (only when the name has no user
  binding) to `InstanceOfObjectValue`/`InstanceOfArrayValue` in lib/abstract/property.jsl.
- **`Number.prototype.toFixed`** — the owed number-formatting primitive, built: `%ToFixed`
  computes round(x·10^f) EXACTLY on the double's binary decomposition, ties away from zero
  (printf rounds ties to even and cannot express the spec). Mirrored in `ev-to-fixed`
  (eval.coil) and `aot_js_to_fixed_format` (native/gc/runtime.c). ≥1e21 delegates to ToString
  and inherits repros/open/large-double-tostring-not-exponential.js.
- **`String.prototype.replace`** (string pattern, first occurrence) — `StringReplaceFirst`.
- **Equality, whole**: `===`/`!==`/`==`/`!=`/`!` and `switch` matching are
  `StrictEqual`/`StrictNotEqual`/`LooseEqual`/`LooseNotEqual`/`LogicalNot`. Deleted
  `fng-equal-value`, `fng-loose-equal`, `fng-nullish-equal` and the number/number and
  string/string fast paths. `StringEquals` is interior to the DSL now.
- **Conditions hold no semantics** — `If` owns truthiness (evaluator `rt-truthy?`; selection
  dispatches tagged→VALUE-TRUTHY, float→MI-FTRUTH, int→zero test). String conditions box.
- **`fng-static-global-value` is numbers-only** — its qualifier refuses `true + 1` etc., which
  fall to the ordinary top-level path where the DSL owns the coercions.
- Earlier in the session: the arithmetic migration landed green (declared-type coercion at
  `fng-expression-expected`, `n-rep-of` as the one representation classifier shared by verifier
  and idealize, `Box(tagged)` peels as identity, `Unbox` folds vetoed for certainly-tagged).

## The compiler was updated mid-session, and the fallout is instructive

The coil binary (and its stdlib) changed at 21:28 on 2026-08-16. Four things broke, none of them
new code:

1. **Reader**: `\xNN` escapes now need `\xNN;`; `SexpKind` gained `KView` (jl-float-bits match).
2. **`fng-coerce-to-alias` keyed on a momentary `n-ty` read** whose value depended on peephole
   visit order; the order changed and `o.x = acc` after `acc += 1` stored a tagged word raw.
   Fixed structurally with the boxed walk. **Build-time decisions key on SHAPE, never on a
   mid-construction type read** — this trap has now bitten twice.
3. **The stdlib hashmap masks buckets with `hash & (cap-1)`** and `hash-step`'s FNV multiply
   leaves low bits structured: ty-intern went quadratic and ns.js ran 90+ CPU-minutes.
   `ty-hash-finalize` (splitmix64 finalizer) now ends every repo-owned KeyOps hash
   (ty, gvn, ev-array-slot). ns.js: 1:38, correct. Any new custom hash must end in it.
4. **Two fields sharing one alias** left a duplicate entry in control snapshots' active lists;
   divergent states under one alias appeared once processing order changed
   (repros/shared-field-alias-snapshot-duplicate.js). `fng-control-aliases!` dedupes.

## Traps that cost real time (cumulative)

- **A type is not a representation.** `n-rep-of` (node.coil) is the one answer; the verifier and
  the idealizations read the same table. A Phi with an absent arm is UNKNOWN by design.
- **Build-time type reads are momentary state.** Key on shape/structure: the boxed walk,
  `fng-machine-number-value?`, `fng-shape-root-object?`.
- **An `If`'s control operand is read before an argument-position JSL call runs** — the call
  inlines guard diamonds that ADVANCE control. Lower the call first, then build the If
  (both switch lowerings record this).
- **The ratchet counter is textual** — a comment saying `(Add)` counts.
- **Piping `coil test` output masks its exit status** — check before committing.

## Tools

`tools/` is `dot-dump.coil` (renders the corpus as Graphviz) and `build-typescript-go-bridge.sh`.
`js-repro` and `js-sweep` were evaluator drivers and are gone. **There is no tool that compiles a
`.ts` to an object file** — the only place a program becomes machine code today is inside a
deftest. Phase A's first step gives that back.

## Next, in order

0. **`for...of`**, above: the pieces exist (`ArrayValues`, `ArrayIteratorNext`, and loops compile)
   and the bridge rebuild is 2.5 seconds, verified. It is refused by name rather than wrong, which
   makes it the largest REMAINING gap now that heap callables work.
2. **DEMOLITION strike 2** — `StringFromCodeUnit`, `StringConcat`, `StringEq` as DSL loops over
   the atoms, then delete the three ops and both copies of each. `%StringConcat` has 52 uses in
   `lib/` and `%StringEq` 6, all of which stay as calls to the new `builtin`s. This is the first
   strike where `ns.js` (2:07 today, gate budget ~2 minutes) may go over: raise the budget in the
   protocol deliberately rather than treating it as a hang. Then S3–S8 in order.
3. **Phase 1 residue**: convert the three remaining coercion helpers' sites to unconditional
   DSL calls (`ToNumberValue`/`ToInt32`) and let folding remove them — the mandate's own
   prescription — then delete the helpers. Then **split `Op`** so arithmetic/comparison/bitwise
   variants are unnameable outside `jsl_lower` (big mechanical refactor across node/eval/verify/
   backend/gtext/templates; the exhaustive-match compiler drives it; consider hivemind with the
   test suite as gate).
4. **The regexp engine** — the last owed `%` primitive family (String.replace/match/split with
   RegExp patterns). `Boolean(x)` to give `ToBoolean` its caller.
5. **Open repros**: closure-capturing-a-loop-variable, rest-parameters,
   undefined-for-these-values, large-double-tostring-not-exponential (wants the real
   shortest-round-trip digit generator; the native side prints %.17g noise today).
6. The stdlib's own `bytewise-hash` likely shares the low-bits weakness — that fix belongs in
   the compiler repo.
# TEST262'S 30,304 RUNTIME FAILURES ARE A BROAD SEMANTICS POPULATION, NOT SELECTION

The retained full run has 30,304 generic runtime-failed variants across 15,933 files. A
300-file, 15-family stratified rerun produced 554 variants: 541 remained generic runtime
failures, nine exposed selection failures, three crashed, one exposed graph corruption, and
none passed. The exact exclusive capability breakdown and work queue are in
`docs/TEST262-RUNTIME-FAILURES.md`. The blocking observability defect is now precise: native
assertion failures do not carry assertion kind, expected/actual values, or source identity back
to the runner, so finer root-cause claims would currently be guesses.
# TEST262 RUNTIME FAILURES NOW RETAIN THROWN VALUES, MESSAGES, AND DECODED PROPERTIES

`tools/run-test262.mjs` enables the native runtime's existing `AOT_TRACE_THROW` path in standalone
and persistent workers. `native/gc/runtime.c` prints property names and decoded JavaScript values;
a witnessed assertion failure now retains its `Test262Error.message` in JSONL instead of collapsing
to `RUNTIME-FAILED`. Attempts to add assertion-kind and actual/expected properties reproduced the
open property-store/control-fanout selection failure even when centralized in the error constructor,
so the standard passing assertion harness was restored. Exact actual/expected capture is now a
named dependency on that compiler fix, not an unrecorded observability gap.
# OBSERVED RUNTIME DATA POINTS FIRST TO FUNCTION, DESTRUCTURING, AND CALLBACK CALLS

The 300-file stratified corpus was rerun with throw tracing. Of 554 variants, 461 produced
structured throws; 371 were `ReferenceError`, including 211 for a missing `Function` binding.
Eighty remained untraced runtime failures, concentrated in destructuring (34), function/declaration
cases (18), Temporal (14), and Array callbacks (10). The prioritized work queue and non-extrapolation
caveat are recorded in `docs/TEST262-RUNTIME-FAILURES.md`. The next core implementation target is
the ordinary Function intrinsic/prototype surface, followed by destructuring's untraced exits and
Array callback receiver/call semantics.
## 2026-08-24: complete observed Test262 run and failure reduction

Ran all 93,209 runner-policy variants with retained diagnostics: 7,663 passed, 51,465 failed, 22,799 refused, and 11,282 policy-skipped. Wall time was 946.374s. The complete mutually exclusive breakdown and prioritized work order are in `docs/TEST262-FULL-BREAKDOWN.md`; raw records and exhaustive aggregation are retained at `test262-results-observed-full-2026-08-24.jsonl` and `test262-full-breakdown-2026-08-24.json`.
## 2026-08-24: object shorthand and method syntax cross the bridge

Measured all 20,629 retained `frontend-bridge-kind-0` refusals by path and source shape. Classes dominate with 9,913 variants; object expressions are next at 1,200. Added stable bridge kinds for object-literal method declarations (304) and shorthand property assignments (305), then taught Coil indexing, capture/reachability, static/dynamic object construction, and DSL property publication to treat `{method(){}}` as a closure-valued property and `{value}` as `{value: value}`. Rebuilt the Go bridge. The bounded gate remains 46/46 green. The method frontier no longer refuses at bridge/index/graph construction; it now reaches the pre-existing `ArrayResize` selector defect and fails `MSEL-OWNER` on a `MI-JSARRAY` whose block membership disagrees with block 87. Frontier remains honestly red at 0/11.
## 2026-08-24: selector anti-dependencies unlock object methods and for-in

Fixed `MSEL-MEMORY-ORDER` on `ArrayResize`: the selector seeded anti-dependencies only from reads attached to the write's exact ideal memory inputs, missing earlier aliasing reads that reached the write through another memory-Phi arm. The builder now completes each write's deduplicated set with all earlier aliasing reads in the owner that dominate it, matching the independent verifier's semantic predicate. This moved both `shorthand-method-in-an-object-literal.js` and `for-in-has-no-bridge-kind.js` to agreement with Node. Both are pinned in `tests/native-execution-test.coil`, removed from `repros/open/` and the frontier suite, and the generated frontier is now 9 open bugs. Evidence: native frontier index 3/3 green, bounded gate 46/46 green, frontier 0/9 expected red.
# 2026-08-24: prototype data writes execute; JSL bound closures remain the Function blocker

- Fixed `Ctor.prototype.x = value` by executing every top-level prototype assignment in source
  order through the ordinary lvalue and DSL property path. Prototype indexing remains call-target
  metadata only; it no longer substitutes for JavaScript execution.
- Closed `an-inherited-data-property-reads-as-undefined.js`: the exact program now returns Node's
  `132`, and is pinned in `tests/native-execution-test.coil`.
- Investigated Test262's 7,470 missing-`Function` failures. The high-fan-out harness operation is
  `Function.prototype.call.bind(method)`. JSL can invoke a first-class callable, but cannot create
  a callable closure capturing a target, receiver, or bound arguments. The proper next step is a
  JSL closure-construction form integrated with the existing Closure ABI, not a frontend rewrite
  of the harness expression.
# 2026-08-24: numeric Phi returns use their selected representation

- Closed `a-numeric-ternary-return-cannot-be-called.js`. Return-tag classification used the
  lattice type directly, so `num` (`int|flt`) had no tag and selection refused `Box(Call(...))`.
- It now asks the existing representation-aware value classifier. A numeric Phi normalized to a
  GPR returns as an integer; one normalized to an FPR returns as a double. The exact repro returns
  Node's `17` and is pinned in `tests/native-execution-test.coil`.
# 2026-08-24: Object extensibility moved from accidental callable IDs into JSL

- Closed `a-boolean-read-is-recomputed-after-a-write.js`; it now returns Node's `8`.
- `Object.isExtensible` and `Object.preventExtensions` had no implementation. Unknown `Object.*`
  members were all fabricated as opaque function kind 37, which could collide with source callable
  IDs and crash. Unknown methods are no longer synthesized.
- Added runtime capability operations for the object [[Extensible]] slot, exposed as JSL primitives.
  `ObjectIsExtensibleValue` and `ObjectPreventExtensionsValue` in `lib/abstract/property.jsl` own
  primitive handling and JavaScript results. The frontend owns only name and argument sequencing.
- The permanent witness covers read-before-write ordering, primitive false, transition to
  non-extensible, writes to existing properties, and rejection of new properties.
# 2026-08-24: Function call/bind moved onto first-class JSL closures

- Added `Function` as a frontend intrinsic identity, while keeping its observable constructor,
  prototype, `call`, and `bind` properties in `lib/function/call-bind.jsl`.
- `Function.prototype.bind` now returns the captured callable environment introduced by the JSL
  `closure` form; invoking it exercises the ordinary dynamic closure ABI rather than a frontend
  rewrite of the Test262 harness idiom.
- Added a native differential witness for direct `call` and `Function.prototype.call.bind` over a
  source callable. Existing opaque built-in method identities still need migration to callable JSL
  values before the Test262 property helper can invoke `Object.prototype.hasOwnProperty` this way.
# 2026-08-24: captured JSL bind closures execute natively

- Added the `Function` intrinsic and a JSL-owned `Function.prototype.bind` implementation for the
  first exact two-argument invocation shape. `FunctionBind1` returns a boxed materialized closure;
  `BoundFunction2` captures the target and bound receiver and uses ordinary dynamic dispatch.
- Compact source functions are indices rather than heap objects, so the runtime prototype chain
  cannot represent their inherited Function methods. Central JSL `GetProperty` now supplies
  `bind` only when ordinary lookup reports the property missing; own/runtime properties still win.
- A permanent native differential witness proves closure allocation, both capture loads, target
  dispatch, and execution. It answers Node's `12` for `add.bind(object)(2, 3)`.
- The investigation also isolated the next ABI defect: a bound tagged object receiver reaches a
  source function whose shaped `this` load expects a raw pointer. Callable rest parameters are
  also required before `bind` can support arbitrary bound and invocation argument counts.
# 2026-08-24: source receiver prologues accept boxed dynamic receivers

- Receiver-aware source functions now normalize Parm 1 with `Unbox`; this is identity for the raw
  pointer exact callers already supplied and removes tags from JSL/dynamic-call receivers.
- Field lowering recognizes that normalized `Unbox` as ordinary `this`, avoiding the old lexical-
  this path's second unbox. Actual lexical captures remain environment `Load` nodes.
- Strengthened the native bind witness from an ignored receiver to `this.base`; the captured JSL
  closure now forwards a boxed bound object into a shaped source-function load and agrees with
  Node at `12`.
## 2026-08-24: core built-in method publication starts with a real callable

- `String.prototype.indexOf` now loads from the intrinsic prototype as its actual receiver-aware
  JSL closure rather than an opaque metadata-only stand-in. The frontend still refuses `.call`
  whose receiver is a dynamic local alias, so aliased invocation is not claimed by this slice.
- Both DSL-owned publication sites define `length` and `name` with the runtime's spec-correct
  non-writable, non-enumerable, configurable attribute mask. Object static method identities now
  carry names as well as lengths.
- Added a native differential witness that checks both complete descriptors. This is the first
  member of the systematic Array/String prototype publication strike; the full Test262 pass-rate
  goal remains open.
- The first exact Test262 property-helper probe exposed that `SetProperty` ignored the writable bit
  on data descriptors. It now leaves non-writable properties unchanged and stores only when bit 1
  is present; the native method witness also attempts and rejects mutation of `length`.
- A four-way helper isolation then proved the captured `Object.getOwnPropertyDescriptor` primordial
  was still an opaque identity with no executable body. `ObjectGetOwnPropertyDescriptorValue` now
  publishes a caller-local closure for the real `ObjectGetOwnPropertyDescriptor2` callable adapter,
  which delegates to the existing DSL operation. Constructing the closure inside the shared
  `BuiltinMethodValue` builtin was measured and rejected because the value did not survive that
  call boundary as an executable closure.
- Four minimized native helper stages now pass independently: aliased descriptor invocation,
  descriptor own-name enumeration, configurable method-length deletion, and `arguments.length` in
  two distinct helpers. The exact Test262 `Object/getOwnPropertyDescriptor/length.js` case advanced:
  default mode now fails selection at `CProj.1` node 19813, while strict mode reaches a remaining
  opaque runtime failure. The exact retained result is
  `test262-results-object-gopd-callable-2026-08-24.jsonl`; neither variant is claimed passing.
# 2026-08-25: JSL loops enter after their initializers

`jl-loop` captured its control entry before lowering initializers, although an initializer may move
control through DSL calls and dynamic guards. The loop then bypassed the initializer's exit Region
while consuming its Phi as data, leaving a reachable value with a CFG sink that instruction
selection correctly refused. Capture now occurs after every initializer. A native `reduceRight`
witness pins the invariant.

- `coil test`: 48/48 green.
- `reduceRight` Test262 cohort: 2 -> 32 passing; selection failures 362 -> 4 across 517 variants.
- Result: `test262-results-array-reduceright-entry-fix-2026-08-25.jsonl`.
- The exhaustive suite exposed a stale five-argument `n-call-receiver!` verifier test; its explicit
  zero `argc` now matches the six-argument API without changing the malformed-receiver assertion.
# 2026-08-25: reducers preserve receivers and use the JavaScript callback ABI

The four reducer DSL macros were the outliers among Array callback methods: they wrapped an already
coercible receiver through `ObjectFromValue`, losing representation-specific indexed storage, and
invoked callbacks through the old `(call callback ...)` form. They now retain `ObjectCoercible(src)`
and use `call-dynamic-with-receiver`, matching `map`, `filter`, `forEach`, `some`, and `every`.

- Six focused array/object/direct/generic witnesses pass in both default and strict variants.
- `reduceRight`: 32 -> 136 passing across 517 variants (+104).
- `reduce`: 128 passing across 517 variants.
- Results: `test262-results-array-reduceright-dsl-runtime-fix-2026-08-25.jsonl` and
  `test262-results-array-reduce-dsl-runtime-fix-2026-08-25.jsonl`.
# 2026-08-25: Binding-element defaults now survive object-pattern lowering

- Added the TypeScript bridge role for `BindingElement.initializer` and structural lazy default
  lowering through the DSL-owned `IsUndefinedValue` operation. Object patterns now pass the whole
  BindingElement to the binder instead of stripping it to its name, matching the existing array
  pattern path and preserving defaults for recursive bindings.
- The complete arrow-function destructuring cohort moved from 136/454 to 156/454 passing, with
  refusals unchanged at 16. Results are retained in
  `test262-results-arrow-dstr-defaults-v3-2026-08-25.jsonl`; the net gain is 20 variants.
- The bounded gate remains 48/48 green. The remaining cohort is dominated by 204 native status-5
  failures, now the next shared execution target rather than being hidden as missing defaults.
# 2026-08-25: Generic closure calls now pass the materialized environment ABI

- A materialized closure is tagged `JSV-CLOSURE`, but callable entry unboxed hidden slot 0 as an
  object and then as a bare `JSV-FUNCTION`. Both are wrong: the closure tag's payload is the
  environment object. Callable entry now validates/strips the closure tag and casts that payload
  to the statically known environment shape before loading captured cells.
- This is compiler structure, not JavaScript meaning: no operation moved out of `lib/`. Selection
  maps the sole `Unbox(t-fun)` environment seam to `JSV-CLOSURE`, so both AArch64 and x86-64 use
  their existing checked-unbox instruction.
- The complete arrow destructuring cohort moved from 156/454 to 294/454 passing, a gain of 138
  variants in `test262-results-arrow-dstr-call-env-v5-2026-08-25.jsonl`. The previously dominant
  204 status-5 traps largely became passes or honest iterator/getter semantic failures.
# 2026-08-25: array spread is structurally represented and DSL-owned (+4 direct passes)

- The TypeScript bridge now gives `SpreadElement` and `SpreadAssignment` stable kinds instead of
  collapsing both into bridge kind 0. Array literals lower source-order grammar only; the new JSL
  operations `ArrayLiteralAppend`, `ArrayLiteralElide`, and `ArrayLiteralSpread` own live-length
  growth, holes, `GetIterator`, iterator stepping, completion, and value extraction.
- Complete `language/expressions/array` measurement is persisted in
  `test262-results-array-spread-v2-2026-08-25.jsonl`: 30 passed, 74 failed, 0 refused across 104
  variants. Against the pre-fix v1 run: 26 passed->passed, 4 refused->passed, 40 refused->failed,
  34 failed->failed, and no regression. The 40 deeper failures are now observable runtime work.
- `coil test`: 48/48 green. The goal remains 30% on the authoritative full suite; this commit is
  incremental progress, not completion.
# 2026-08-25: for-of declaration patterns use the binding support already implemented (+96)

- `fe-array-binding-pattern-valid?` no longer rejects declaration-pattern defaults, rest,
  elisions, nested arrays, or nested objects that `fng-bind-pattern!` already executes through
  JSL-owned iterator, default, rest, and property operations. This removes stale frontend policy;
  it does not add or open-code JavaScript meaning in the validator.
- Complete `language/statements/for-of/dstr` results are persisted in
  `test262-results-for-of-dstr-bindings-v1-2026-08-25.jsonl`: 193 passed, 890 failed, 12 refused
  across 1,095 variants. Against authoritative full v4 for the exact variants: 96
  `frontend-code-1001 -> passed`, 97 passed->passed, and no regression.
- `coil test`: 48/48 green. The next related gap is assignment destructuring such as
  `for ([a, b] of xs)`, which still needs a structural assignment-pattern lowering path.
# 2026-08-25: for-of array assignment patterns reach execution (+2, 119 deeper)

- Indexing now admits recursively valid array assignment patterns in `for ... of`/`for ... in`.
  Graph lowering distinguishes holes, rest, defaults, nested arrays, and ordinary lvalue leaves;
  all iterator consumption and rest/default value operations reuse JSL.
- Complete `language/statements/for-of/dstr` results are persisted in
  `test262-results-for-of-dstr-assignment-v2-2026-08-25.jsonl`: 195 passed, 878 failed, 22 refused
  across 1,095 variants. Against the prior binding checkpoint: 2 frontend failures became passes,
  119 frontend failures reached native execution, 10 reached their nested unsupported `yield`,
  193 existing passes stayed green, and no pass regressed.
- A direct `for ([a, b] of [[...]])` witness exposed a separate selection defect: an effect-only
  iterator-result branch leaves `PropStoreKey` pinned to a `CProj` absent from the machine CFG.
  That witness is not checked in as green; the persisted cohort is the evidence for this step.
# 2026-08-25: strict `with` and identifier deletion are parser early errors (+9 Test262)

- The JavaScript-mode TypeScript bridge now diagnoses `with` statements in strict code and strict
  `delete IdentifierReference`, including arbitrarily parenthesized identifier references. These
  are syntax-directed early errors, so they belong in the parser bridge rather than `lib/**/*.jsl`:
  no JavaScript operation is evaluated when either source form is validly rejected.
- `tests/typescript-js-abi-test.c` pins both diagnostics in the bounded bridge gate.
- Exact targeted result is
  `test262-results-strict-with-delete-v4-2026-08-25.jsonl`: 9 passed, 0 failed, 0 refused,
  0 skipped. The same nine variants were failures before this change.
- `coil test`: 48 passed, 0 failed.
- `coil test --suite frontier`: expected two open bugs remain
  (`for-await-has-no-bridge-kind`, `shortest-round-trip-digits`).
# 2026-08-25: optional tagged templates and mixed coalescing are early errors (+24 Test262)

- JavaScript-mode parser diagnostics now reject a tagged template whose tag is an optional-chain
  node or whose tagged-template node carries a direct `?.` token. Parentheses remain explicit in
  the upstream AST, so valid parenthesized tags are not conflated with an optional chain.
- Unparenthesized mixing of `??` with `&&` or `||` is rejected in either AST associativity. The
  check examines only direct binary children, preserving valid explicitly parenthesized mixtures;
  the bounded ABI gate includes a valid grouped control.
- Exact targeted result is
  `test262-results-optional-tag-coalesce-v2-2026-08-25.jsonl`: 24 passed, 0 failed,
  0 refused, 0 skipped. All 24 variants were failures in the saved negative-parse frontier.
- These are syntax-directed early errors in the parser bridge, not runtime JavaScript semantics;
  no operation belongs in `lib/**/*.jsl` for programs rejected before evaluation.
# 2026-08-25: strict object shorthand rejects reserved IdentifierReferences (+9 Test262)

- `ShorthandPropertyAssignment` now receives the strict IdentifierReference early error for
  `yield` and future-reserved words. This deliberately uses a narrower predicate than strict
  bindings: `{eval}` and `{arguments}` remain valid references even though binding those names in
  strict code is forbidden.
- The bounded ABI gate pins both the rejected `({interface})` form and accepted `({eval})` control.
- Exact targeted result is
  `test262-results-strict-object-shorthand-v1-2026-08-25.jsonl`: 9 passed, 0 failed,
  0 refused, 0 skipped. All nine variants failed in the saved negative-parse frontier.
# 2026-08-25: lexical loop heads enforce BoundNames/VarDeclaredNames (+22 Test262)

- `for`, `for-in`, and `for-of` lexical heads now compose the bridge's existing recursive
  `BoundNames` and `VarDeclaredNames` helpers. Duplicate head bindings and a head binding colliding
  with a `var` declared by the loop body are parser early errors.
- `VarDeclaredNames` stops at nested function/class boundaries, so legitimate shadowing in a nested
  function remains accepted; the bounded ABI gate pins that control alongside both invalid forms.
- Exact targeted result is
  `test262-results-loop-lexical-early-errors-v2-2026-08-25.jsonl`: 22 passed, 0 failed,
  0 refused, 0 skipped. All 22 variants failed in the saved negative-parse frontier.
# 2026-08-25: catch parameters enforce duplicate and lexical-name early errors (+6 Test262)

- Catch clauses now reject duplicate names in `BoundNames(CatchParameter)` and intersections with
  `LexicallyDeclaredNames(CatchBlock)`, including direct function declarations.
- The check intentionally does not compare against `VarDeclaredNames`; `catch (x) { var x; }`
  remains valid and is pinned as a bounded ABI control.
- Exact targeted result is `test262-results-catch-early-errors-v1-2026-08-25.jsonl`:
  6 passed, 0 failed, 0 refused, 0 skipped. All six variants failed in the saved negative-parse
  frontier.
# 2026-08-25: class static blocks enforce their isolated syntax context (+26 Test262)

- Class static blocks now reject `arguments`, direct `await`, direct `yield`, direct `super()`, and
  bindings named `await`. The traversal stops at ordinary function bodies and nested static-block
  boundaries while retaining arrow-function context where required.
- TypeScript represents the prohibited static-block `yield` as either `YieldExpression` or an
  IdentifierReference depending on the enclosing grammar context; both structural forms are
  covered.
- `ContainsArguments` traverses nested-class heritage and computed names because those evaluate in
  the enclosing context, but does not enter nested class method bodies. Bounded controls pin valid
  `arguments` and `await` uses inside nested ordinary functions/methods.
- Exact targeted result is `test262-results-static-block-context-v2-2026-08-25.jsonl`:
  26 passed, 0 failed, 0 refused, 0 skipped. All 26 variants failed in the saved negative-parse
  frontier.
# 2026-08-25: private accessor pairs must agree on staticness (+8 Test262)

- Class-wide private-name state now records staticness in addition to getter/setter kind. The sole
  valid duplicate private declaration remains one getter plus one setter, and that pair must both
  be instance members or both be static members; the rule is independent of declaration order.
- The bounded ABI gate pins a mismatched pair and a valid matched static pair.
- Exact targeted result is `test262-results-private-accessor-staticness-v1-2026-08-25.jsonl`:
  8 passed, 0 failed, 0 refused, 0 skipped. All eight variants failed in the saved negative-parse
  frontier.
# 2026-08-25: strictness follows AST directive prologues and lexical context

- Script strictness now scans the complete AST Directive Prologue, so preceding string directives
  no longer hide a later `"use strict"`. Function strictness shares the same helper.
- Assignment-target and destructuring early errors now query `strictAt(node)` rather than only
  top-level script strictness. Nested strict functions/accessors therefore reject strict assignment
  targets while sloppy `eval = 1` remains accepted; bounded ABI controls pin all three cases.
- Focused result `test262-results-strict-directive-assignment-v1-2026-08-25.jsonl` is 3 passed,
  0 failed, 0 refused, 0 skipped.
- The authoritative saved negative-parse rerun is
  `test262-results-negative-parse-current-v10-2026-08-25.jsonl`: 8,135 passed, 81 failed,
  0 refused, 204 skipped among 8,216 variants. Relative to v9: 112 failed-to-passed,
  8,023 passed-to-passed, 81 failed-to-failed, 204 skipped-to-skipped, zero regressions.
# 2026-08-25: formal parameters enforce getter arity and yield context (+18 Test262)

- Getter definitions now reject every non-empty formal parameter list, including defaulted
  parameters that the upstream parser had accepted during recovery.
- Every function-like parameter is rejected when it contains a `YieldExpression`; strict parameter
  expressions also reject `yield` represented as an IdentifierReference. Sloppy
  `var yield; function f(x = yield) {}` remains accepted and is pinned as a bounded control.
- Full negative-parse result `test262-results-negative-parse-current-v11-2026-08-25.jsonl`:
  8,153 passed, 63 failed, 0 refused, 204 skipped. Relative to v10: 18 failed-to-passed,
  8,135 passed-to-passed, 63 failed-to-failed, 204 skipped-to-skipped, zero regressions.
# 2026-08-25: new.target and super enforce lexical execution contexts (+14 Test262)

- `new.target` is accepted only when lexical parent traversal reaches a non-arrow function before a
  static-block/source boundary; arrows inherit the surrounding context. Its property token must be
  the literal source spelling `target`, so escaped spellings are rejected even when they decode to
  the same identifier value.
- `super` property access is accepted in method/accessor/constructor bodies, class field
  initializers, and static blocks, with arrows inheriting that context. Computed member names do not
  incorrectly acquire the member body's super context.
- `super()` is accepted only in the body (or nested arrow body) of a constructor whose class has
  heritage. Bounded controls pin ordinary-function `new.target` and derived-constructor forms.
- Full negative-parse result `test262-results-negative-parse-current-v12-2026-08-25.jsonl`:
  8,167 passed, 49 failed, 0 refused, 204 skipped. Relative to v11: 14 failed-to-passed,
  8,153 passed-to-passed, 49 failed-to-failed, 204 skipped-to-skipped, zero regressions.
# 2026-08-25: Script goal rejects module-only syntax (+12 Test262)

- JavaScript Script mode now rejects static import declarations, export declarations/assignments,
  and `import.meta`. Dynamic `import()` remains valid and is pinned as a bounded control.
- This also rejects the remaining malformed import-defer declarations under the actual Script goal;
  upstream already rejected the other malformed defer productions independently.
- Full negative-parse result `test262-results-negative-parse-current-v13-2026-08-25.jsonl`:
  8,179 passed, 37 failed, 0 refused, 204 skipped. Relative to v12: 12 failed-to-passed,
  8,167 passed-to-passed, 37 failed-to-failed, 204 skipped-to-skipped, zero regressions.
## 2026-08-25: Test262 `early` SyntaxError negatives use the pre-execution path

- Extended the production Test262 metadata policy from parse-only negatives to the two
  pre-execution phases defined for this runner: `parse` and `early`, while requiring the expected
  constructor to be `SyntaxError`. Other early-error constructors remain explicit policy skips;
  runtime and resolution negatives are not misclassified as parser tests.
- Renamed the native-worker protocol from parse-negative to pre-execution-negative so the boundary
  describes what it actually proves: parser/static-semantics rejection before any Script executes.
- A focused `negative: { phase: early, type: SyntaxError }` witness passed in default and strict
  variants. A deliberately unsupported `early` + `ReferenceError` witness was skipped with an
  explicit policy reason rather than falsely passing.
- The complete checked-in Test262 case set remained 28 passed, 0 failed, 0 refused, 0 skipped in
  `/tmp/test262-local-preexecution-regression.jsonl`. The bounded gate remained 49/49 green and the
  frontier retained only its two recorded open bugs.
- Exact runtime-negative support is deliberately separate. The correct next step is to classify
  the existing structured uncaught-exception record by its JavaScript `name` property and require
  an exact metadata-type match; accepting any nonzero process result would hide crashes and wrong
  exception constructors.
## 2026-08-25: runtime-negative Test262 completion uses real Script records

- Recognized runtime-negative metadata is transported to the native compiler without changing the
  assembled harness or test source. The entry graph installs a host completion boundary before
  Script declaration instantiation and evaluation, so exceptions escaping any real Script record
  merge through the ordinary exception path; normal completion is an explicit host failure.
- JavaScript-visible matching remains DSL-owned. Built-in error constructors expose their standard
  `name` property, and `ThrownConstructorNameMatches` performs ordinary property access before
  comparing the thrown value's constructor name with the expected constructor's name. The native
  runtime only transports success/failure and does not inspect JavaScript object layout. A
  constructor mismatch becomes a dedicated host failure completion without manufacturing new
  JavaScript state.
- The expected side of runtime-negative matching is now the canonical constructor-name string from
  DSL `BuiltinConstructorName`, rather than allocating a second constructor and reading its own
  property. The thrown side still performs ordinary `constructor.name` access as required.
- Runtime kind 7 names harness-defined `Test262Error`. It uses the same constructor-name matching
  path as native Errors, so the runner no longer policy-skips that official negative type or needs
  object-layout knowledge of the harness constructor.
- `/tmp/aotk-runtime-negative-complete.jsonl` is the complete current runtime-negative phase: 14
  pass, 40 fail on actual parser/runtime behavior, and 8 module variants remain policy-skipped.
  No synchronous Script variant is skipped for an unsupported expected constructor type. The 24
  non-module `Test262Error` variants specifically produce 14 passes and 10 Annex B HTML-comment
  parser failures instead of the former policy skips.
- Ordinary named functions now receive their standard non-writable, non-enumerable, configurable
  `name` data property through DSL `InitializeOrdinaryFunctionName`. The frontend contributes only
  the structurally inferred source name and invokes the DSL for top-level declarations and closure
  materialization; there is no `Test262Error` name special case. The initializer explicitly boxes
  the managed string at the property-value boundary.
- Focused witnesses now distinguish all three runtime-negative outcomes: matching `TypeError`
  passes, wrong `RangeError` fails with host exit 72, and normal completion fails with host exit 71.
  The retained JSONL is `/tmp/aotk-runtime-negative-name-v2.jsonl`. Modules, async completion,
  resolution negatives, complete early errors, fresh-realm isolation, and `$262` remain protocol
  work; the active Test262-runner goal is not complete.
- The persistent protocol's `?K:` runtime-negative prefix must retain multi-Script compilation;
  treating it as a separate alternative to `@` concatenated harness and test records and changed
  directive/declaration semantics. `?K:` now carries both the expected kind and multi-Script mode.
- DSL abrupt collection also fed descriptor 101's tagged JavaScript boolean directly to ideal
  `If`. Since tagged false is nonzero, successful primitive calls entered their captured exception
  arms. `jl-check-pending!` now unboxes the transport value to a machine boolean, matching the
  already-correct frontend pending check.
- The complete current Test262 run is retained in
  `test262-results-full-runtime-negative-wip-2026-08-25.jsonl`: 90,598 variants produced 20,747
  passes, 54,391 failures, 8,936 refusals, and 6,524 policy skips in 72m44s. Excluding Temporal gives
  81,308 variants: 20,747 pass, 46,888 fail, 7,149 refuse, and 6,524 skip. The non-Temporal pass rate
  is 25.52% of all classified variants, 27.74% excluding policy skips, or 30.67% among attempted
  pass/fail variants. This is a stopping-point measurement, not evidence that runtime negatives are
  complete.
- Fresh-Realm isolation does not require restarting the expensive compiler worker. Each variant is
  published and executed in a fresh native child process, while only parsing/compilation metadata
  stays resident. The checked-in `realm-isolation-poison.js` and `realm-isolation-clean.js` pair is
  intended to run on one worker with `--batch-size 2`; the second must not observe the first test's
  `Object.prototype` mutation.
- Full runs now default to concise per-variant output instead of replaying every native stderr
  timing/profile line. JSONL persistence and extracted failure diagnostics are unchanged;
  `--verbose` opts into the raw stream for focused debugging, and `--quiet` still suppresses
  successful result lines.
- Module parse/early negatives use a dedicated `^path` persistent protocol operation and the
  TypeScript bridge's forced external-module indicator. They receive one `module` variant and must
  reject before execution; module linking, resolution, and runtime evaluation remain explicitly
  unsupported.
## 2026-08-25: function text now has an owned multi-record snapshot

- `backend_function_text` can snapshot every encoded machine function into one flattened owned
  store: exact text bytes, frame sizes, relative internal/external relocations, safepoint offsets,
  and final root locations survive without retaining machine IR.
- The store intentionally labels numeric function symbols as compilation-local link identities,
  not cache keys. Source and JSL function ids can move when an independently indexed Script has a
  different callable count. Cross-compilation lookup remains disabled until the frontend assigns
  explicit semantic namespaces; silently hashing layout-dependent bytes would not make reuse safe.
- The bounded object witness requires one record per machine function, exact aggregate text size,
  matching function ranges/symbols, and retained call plus safepoint metadata. This advances the
  honest shared-code linker boundary without combining tests, wrapping source, or sharing executed
  Realm state.
## 2026-08-25: semantic function identity survives the complete backend

- A `Fun` may carry an explicit identity triple `(namespace, unit, local)` independently of its
  temporary closed-world function index. Selection copies it onto the machine function, and the
  owned function-text store retains it with bytes and relocation metadata.
- Existing raw graphs remain explicitly `EPHEMERAL`; matching function numbers cannot accidentally
  become cache hits. A bounded witness proves a source identity survives graph construction,
  selection, encoding, extraction, and multi-record snapshotting.
- Source/JSL producers are not wired yet. Source identities must use each original Script record,
  and JSL identities need declaration identity plus a library ABI fingerprint. Cache lookup stays
  disabled until both producers and dependency validation are complete.
## 2026-08-25: source identities are stable across graph namespaces

- Every lowered source `Fun` now receives `(SOURCE, record fingerprint, record-local callable)`.
  The fingerprint covers the exact original Script root, not the concatenated Test262 parser
  input, and callable order resets per Script. Unchanged official harness records therefore keep
  the same identity when tests, includes, or graph function bases differ.
- A focused frontend witness compiles the same independent Script at graph bases 64 and 192 and
  requires identical semantic identities despite different closed-world function ids. The host
  dispatcher remains ephemeral and cannot enter the reusable-function cache.
- This is identity metadata only. No cache hit is enabled yet; retained functions still need JSL
  identities plus explicit layout/global dependency validation before image linking is safe.
## 2026-08-25: JSL identities cover the complete checked library

- JSL functions now use `(JSL, checked-library fingerprint, declaration ordinal)`, independent of
  their graph namespace base. The fingerprint covers every declaration name, label, kind, return,
  parameter name/type, capture name, transitioning bit, and complete ordered body tree.
- Floating literals contribute their exact reader-retained IEEE bits. Lists, vectors, keywords,
  symbols, strings, C strings, integers, and view nodes have distinct tags, so structurally
  different checked libraries cannot alias through a lossy scalar conversion.
- The complete library, including macros, is one unit because macro bodies are inlined into other
  declarations. The fingerprint is computed once per lowering session and used by both eager and
  lazy JSL function opening. A frontend witness now compiles the same `JsAdd`-using Script at two
  graph namespace bases and requires `JsAdd` to retain the same JSL unit/local identity while its
  temporary fidx moves. This is still metadata only; dependency validation and cache linking remain
  disabled.
## 2026-08-25: internal relocations retain semantic target identities

- Retained direct-call and polymorphic-address relocations now carry the target function's full
  `(namespace, unit, local)` identity in addition to the current image's numeric symbol. A future
  linker can resolve dependencies across independent compilations without assuming equal graph
  function numbers.
- External runtime relocations remain explicitly ephemeral semantic targets: their operation and
  operation-specific immediate already resolve through the runtime ABI rather than a JavaScript or
  JSL function identity.
- The bounded call witness requires the source target's exact identity to survive extraction.
  Cache insertion/lookup is still disabled until every internal target is non-ephemeral and layout
  dependencies are represented.
## 2026-08-25: cache insertion has a strict dependency audit

- Extracted text now has a named cacheability result. Ephemeral owners, internal dependencies on
  ephemeral functions, and unresolved shape allocations are rejected. Only identified functions
  whose internal targets resolve by semantic identity are eligible.
- Runtime `MI-NEW` is deliberately rejected for now: it embeds compilation-local shape id and size
  through variable-width MOV sequences. Fixed-width shape relocations are required before
  allocation-heavy functions can be reused safely.
- Runtime strings carry content through ordinary machine values rather than compiler string-table
  addresses, and external runtime calls already resolve through the stable runtime ABI. A bounded
  witness proves the ephemeral host is rejected while an identified pure source function is
  eligible.
## 2026-08-26: fixed-width runtime shape encoding was reverted

- The attempted fixed-width `MI-NEW` encoding passed object-model tests but the broader native
  execution module produced only 9/82 passes; allocation-heavy children exited 86 without protocol
  output. Restoring the old executor did not change that result, isolating the regression to shape
  encoding rather than linked-image execution.
- Variable-width shape/size materialization is restored. `MI-NEW` functions are again explicitly
  uncacheable, and shape relocations are not extracted. A future implementation must carry a focused
  native allocation witness while changing branch offsets, not infer correctness from byte counts.
## 2026-08-25: retained records have an identity-resolving text linker

- The function-text linker lays out owned records into a fresh image, resolves semantic internal
  call and polymorphic-address targets, repatches fixed-width shape id/size operands against the
  current shape table, and retains external runtime sites explicitly for publication.
- Fresh ephemeral host/test records resolve only by current-image symbols. Reusable source and JSL
  records resolve by `(namespace, unit, local)`, so graph function numbers do not cross the
  separate-compilation boundary.
- A bounded byte-level witness snapshots a two-function program, rebuilds its image, and checks the
  repatched `BL` against the linked target start. The image is not executable until retained
  external runtime sites are resolved and stack maps are rebased; runner integration stays off.
## 2026-08-25: linked images own rebased GC metadata

- Image assembly now copies frame sizes and rebases every retained safepoint PC onto the linked
  function start. Root windows, kinds, registers, and spill offsets are copied into image-owned
  arrays, so GC registration no longer needs the old machine IR or compilation layout.
- The linker witness requires the rebuilt call image's safepoint owner/PC/root count to match the
  retained function-relative record after layout. External runtime branches are still explicitly
  unresolved; the next integration step is for `native_harness` to install its existing veneers
  from the image's site/op/aux stream and serialize/register this image metadata.
## 2026-08-25: retained GC metadata now covers the runtime format

- Function records and linked images now retain frame size, callee-save mask, and callee-save count.
  Root records retain the original vreg identity in addition to kind and final register/spill
  location. These were required fields in the existing runtime stack-map format and were missing
  from the initial extraction model.
- The linker witness cross-checks all function unwind fields against the machine unit. The next
  step can serialize the existing stack-map schema from image-owned metadata without consulting
  liveness, allocation, or machine instructions.
## 2026-08-25: linked images serialize the existing GC metadata schema

- Retained safepoints now include original machine-instruction id and opcode, and linked functions
  retain exact text size. Image assembly serializes stack-map v2 and layout v1 byte streams with
  the same headers and record widths as ordinary memory publication.
- A bounded witness requires linked metadata sizes to equal the existing model's computed sizes and
  checks stack-map magic, site count, and function count directly from serialized bytes. Runtime
  registration can therefore consume linked-image metadata without a schema fork.
## 2026-08-26: linked ARM64 execution remains disabled after focused failure

- A linked-image executor exists and uses the existing runtime-symbol table, but it is not selected
  by isolated execution. The focused native suite passed only 9/82 before linked children exited
  without protocol output, proving a remaining text/metadata equivalence defect.
- Product/Test262 execution was restored immediately to `nh-exec-memory-checked!`; no fallback or
  silent acceptance hides the linker failure. The linker stays behind bounded byte-level tests
  until complete original-vs-linked image and metadata equivalence names the defect.
## 2026-08-26: reusable functions now declare ABI at the definition

- The graph stores immutable parameter and return type windows for separately compiled functions.
  Backend parameter register classes and return representation consult the declaration before
  closed-world callers, removing the first caller-dependent machine-code input.
- Source callables inside independently compiled Script units declare their JavaScript ABI: tagged
  environment, tagged receiver, raw argc, tagged explicit arguments, and tagged completion. Script
  entries declare zero parameters and tagged completion. The public native `main` entry retains its
  separate raw host ABI. Test262 source and harness records remain untouched.
- JSL functions derive declarations from checked parameter and `:ret` annotations, including the
  callable hidden slots. Legacy graph tests without declarations retain inferred behavior.
- A bounded witness calls one declared function with incompatible integer and string evidence and
  requires its parameter and return classes to remain boxed. This is the stable representation
  boundary required before retained text can be reused across tests.
- Internal call and code-address relocations now retain the target ABI expected by their encoded
  caller. Image linking requires both semantic identity and ABI compatibility, so a stale retained
  caller cannot silently bind to a same-source function with different register or return classes.
# 2026-08-26: singleton Test262 records now use the internal Script ABI

- `nh-try-compile-scripts?` no longer lowers an ordered multi-record Test262 input as an ordinary
  raw-host native function. It indexes the complete `ts-open-scripts` AST, lowers its synthetic
  entry through `frontend-native-build-dispatched-script!`, and finishes that prepared graph through
  the existing source-free host `Start` bridge.
- This preserves record boundaries, source order, and the shared Script global environment. It does
  not concatenate source, introduce JavaScript wrappers, or alter the official harness.
- This is a correctness prerequisite for reuse, not yet the reuse itself: immutable harness/JSL
  bodies still need an external-function import boundary so cache hits skip lowering and selection.
- The graph now records an explicit imported-function bit, and the retained store exposes exact
  cache lookup by semantic identity plus ABI. Nothing marks a function imported yet: activation is
  intentionally gated on teaching graph verification, CFG construction, selection, and snapshots
  that an imported declaration has no local body.
- Retained function snapshots now have an explicit append operation. Ordinary clients still replace
  the store; the persistent worker can eventually keep a validated cache prefix and append only the
  current compilation's locally emitted records before linking.
- Semantic relocation lookup now searches an appended archive newest-first, and linked execution
  finds the newest ephemeral symbol-zero host `Start` instead of assuming record zero. A retained
  prefix therefore cannot redirect execution or an ephemeral call into an older compilation.
- `mfts-truncate-records!` removes an appended suffix from every record and flattened payload table,
  including bytes, relocations, safepoints, and roots. This is the memory-bounded request boundary
  required by a persistent Test262 worker.
- Machine functions now distinguish imported semantic targets explicitly. CFG construction gives an
  imported graph function an identity-bearing, zero-block machine owner instead of walking its local
  body; this preserves the existing owner-based call relocation model. Imports are still inactive
  until verification and snapshot emission explicitly skip those zero-block owners.
- Verification now admits the one-input imported `Fun` declaration shape only with a declared ABI
  and non-ephemeral semantic identity. Machine verification accepts zero blocks only for imported
  owners, and retained snapshots omit those owners, leaving their definitions to the cache prefix.
- AArch64 direct calls to imported owners now emit the ordinary relocatable `BL` placeholder and
  semantic call relocation even though no local target offset exists. Invalid non-imported targets
  remain encoding failures; the retained linker is solely responsible for resolving imports.
- Retained archives can now compact in place to one cacheable semantic identity kind, copying and
  rebasing bytes, relocations, safepoints, and roots before truncating all discarded payload. The
  Test262 worker will use the JSL-specific wrapper so no first-test Script/source state survives in
  the immutable cache prefix.
- A persistent, graph-reset-independent import catalog now carries retained semantic identities from
  the backend store to JSL lowering. Requiring a cataloged JSL declaration opens and ABI-declares its
  `Fun`, marks it imported, and skips its body; no JavaScript operation is moved out of the DSL.
## 2026-08-26: dynamic dispatch is runtime-resolved; callable constants remain the cache boundary

- AArch64 and x86-64 polymorphic JavaScript calls no longer emit a closed-world ladder over every
  function in the compilation unit. Both decode the callable value, preserve prepared ABI
  arguments across `_aot_js_dispatch_resolve`, call its returned address indirectly, and normalize
  the result using the return code published in version-3 function metadata. AArch64 and ELF
  publication retain the resolver as an ordinary external relocation.
- This does not batch JavaScript. Test262 still parses ordered harness/test files as distinct Script
  records, compiles one test suffix, links immutable text in memory, and executes in a fresh forked
  child with fresh runtime state. The focused upstream String concat witness passes default and
  strict variants through that production path.
- Expanding the deterministic seed from 45 non-callback records to all 76 JSL records exposed the
  next separate-compilation invariant: callback-bearing JSL can embed callable ids in boxed Fun
  constants and closure target fields. Seed compilation and Script compilation assign different
  numeric JSL ids, so remapping linked metadata alone is insufficient; those machine-code
  immediates require semantic callable-identity relocations. The unsafe expansion was removed and
  the focused witness returned to 2/2 passing.
- A sparse high-bit JSL namespace was rejected immediately because graph function lookup is dense;
  its first bounded frontend build took 16.3 seconds and was interrupted before it could recreate
  the prior high-memory failure. A compact JSL-prefix/source-suffix experiment also changed existing
  frontend ABI assumptions and did not solve every embedded id, so it too was removed rather than
  weakening tests.
- On the identical 100-file String cohort, runtime resolution with the safe 45-record seed takes
  58.486s for 199 variants versus 58.744s before this work. Results are status-identical at 82
  passed, 117 failed, zero refused. Artifact: `/tmp/aotk-resolver-string-100.jsonl`. The 0.4% wall
  change is noise-level evidence: the large speed recovery depends on callable-id relocations and
  admitting callback-bearing JSL, not merely shortening dispatch code.
- The bounded gate is 51/51 and the frontier remains the expected two open bugs. Runtime resolver
  tracing is opt-in with `AOT_TRACE_DISPATCH`; normal execution emits nothing.
## 2026-08-26: retained Script execution is correct again; compiled harness caching is next

The official-semantics Test262 path still evaluates each test as an independent Script in a fresh
forked child. It does not concatenate sources, wrap tests in functions, reuse a JavaScript-visible
Realm, or synthesize a receiver. The persistent parent retains compiler artifacts only.

The full 76-record JSL cache crash was an encoder metadata bug. Imported machine functions have
zero blocks and emit no text, but AArch64 and x86-64 function-range publication still asked for
`mu-function-block(imported, 0)`. That out-of-range block-order lookup created a fake function entry
inside an emitted function and truncated its retained record. Both encoders now publish imported
functions as `code-start=-1, code-size=0` and exclude them from emitted-function boundary searches.

Focused proof:

- Test262 `built-ins/String/prototype/concat/S15.5.4.6_A6.js` now passes both default and strict
  variants with all 76 JSL records retained.
- Result: `/tmp/aotk-focused-import-range-fix-20260826.jsonl`.
- Before the fix, owner 16 was recorded as `[455216, 483336)` while its valid block-3456 target was
  at 673292. The target label was unique and correctly owned; the false boundary came from an
  imported zero-block function.
- `coil test`: 51/51 green. `coil test --suite frontier`: the exact two expected open bugs.

Warm independent-Script timing, one persistent worker, retained JSONL, identical lexical 100-file
cohort (182 executable variants plus 9 policy skips):

- Total execution: 52.565 s; retained-row wall sum 51.831 s.
- Median: 147 ms/variant; p95: 1,156 ms/variant.
- Per executable variant: selection 62.05 ms, allocation 48.49 ms, suffix snapshot 42.80 ms,
  frontend analysis 41.42 ms, scheduling 40.34 ms, frontend graph construction 23.68 ms.
- Native execution itself is 4.91 ms/variant; image linking is below the dominant phases.
- Result: `/tmp/aotk-100-independent-production-snapshot-20260826.jsonl`.

This cohort is the lexical Annex B prefix and is not representative of pass rate (0 passed,
98 failed, 84 refused, 9 skipped), but it is valid throughput evidence and completed without the
former retained-image crash. Removing the temporary whole-unit/per-function branch audit changed
the same cohort from 53.131 s to 52.565 s, only 1.1%; snapshot diagnostics were not the main cost.

The next speed boundary is compiled Test262 harness Scripts. Retained JSL functions are imported
correctly, but every test still parses, expands JSL macros into, optimizes, selects, schedules,
allocates, encodes, and snapshots the standard harness sources again. The standards-preserving
design is to cache compiled harness Script records by exact source identity, link them with each
freshly compiled test Script, and execute the ordered Script records in every fresh child/Realm.
Caching native Script artifacts is legitimate; sharing a Realm, wrapping, concatenating, or
skipping harness evaluation is not.
## 2026-08-26: independent Test262 workers recover throughput without changing semantics

- Rejected whole-graph Script batching remains disabled: it combines compiler graphs, grew to
  3.37 GiB RSS on the 100-file witness, and does not provide the isolation contract we need.
- Tested exact-source native-body reuse as a separate-compilation boundary. It reduced the second
  String concat variant's compiler phases dramatically, but three imported source bodies caused a
  native crash. Capture-free narrowing did not fix it, proving that source records still contain a
  compilation-local invariant not represented by the relocation model. The activation was removed;
  no Test262 source body is currently reused across compilations.
- The linked image now owns its resolved host-entry byte offset. Execution no longer consults the
  mutable machine-text archive after cache compaction, which is the correct lifetime boundary
  independent of future caching work.
- Correct parallelism already exists at the worker boundary. The runner defaults to
  `min(8, availableParallelism())`; every worker compiles each original Script independently and
  executes it in a fresh forked child.
- On the identical lexical 100-file cohort (182 executable variants and 9 policy skips), one worker
  took 52.565 s of execution and eight workers took 11.774 s: 4.47x higher throughput. The eight
  worker run additionally paid an 8.916 s one-time build, for 20.691 s total.
- `/tmp/aotk-100-independent-production-snapshot-20260826.jsonl` and
  `/tmp/aotk-100-independent-jobs8-20260826.jsonl` have byte-equivalent sorted
  path/variant/status/category/detail projections: zero outcome changes.
- Focused semantic witness after removing unsafe source reuse:
  `/tmp/aotk-focused-safe-baseline-20260826.jsonl`; default and strict both pass.
## 2026-08-26: Test262 requests now have fresh compiler state and crash-safe warm seeds

- Complete retained baseline: `/tmp/aotk-full-independent-jobs8-20260826.jsonl`.
  86,719 executable variants plus 6,403 policy skips completed in 3,730.481 s execution
  (62m10s): 19,617 passed, 57,263 failed, 9,839 refused.
- The baseline rebuilt the supposedly persistent JSL seed 18,589 times, costing 4,184.872 aggregate
  seconds. Compiler aborts killed the seed-owning server; Node respawned it for later requests.
- More importantly, compiling successive tests in one mutable server was observably order-dependent.
  A fresh-request full run changed 1,279 failed results to passed and 623 passed results to failed.
  Test262 tests require fresh Realm/test state, and compiler request state must be fresh as well if
  reset is not proven complete; the old throughput path did not meet that standard.
- `tools/test262-native.coil` now initializes immutable JSL machine text in a warm supervisor and
  forks one compilation child per Script request. Compiler assertions/signals are request-local;
  each child starts from the same copy-on-write seed, and JavaScript execution remains isolated.
- Request children establish their own process groups and publish their PID. Node timeouts now kill
  only that request, retain the supervisor, and remain categorized as `TIMEOUT` rather than signal 9.
- Crash witness: `/tmp/aotk-warm-supervisor-crash-witness-3-20260826.jsonl`. Two SIGABRT variants
  are followed by two passing String concat variants on one server; the seed is compiled once.
- Timeout witness: `/tmp/aotk-warm-supervisor-timeout-witness-2-20260826.jsonl`. Two forced
  one-second timeouts are followed by two passes on one server; exactly one 209.044 ms seed build.
- Complete fresh-request profile before the final timeout-process-group refinement:
  `/tmp/aotk-full-warm-supervisors-jobs8-20260826.jsonl`. It produced 20,272 passes, 56,991 failures,
  and 9,456 refusals, but took 5,162.677 s execution (86m03s). The cause is explicit: 506 requests
  reached the 30-second timeout versus 64 before, accounting for about 31.6 wall minutes at eight
  workers. A representative `Map/valid-keys` variant still produced no frontend phase after 120 s.
- Timed-out source sizes range from 351 bytes to 3.2 MiB, while observed passing variants take up to
  12.1 s, so source-size skipping or an aggressively shorter default timeout would be dishonest.
  The next efficiency target is the pre-frontend parser/open path that can fail to complete, followed
  by selection (5,866 aggregate seconds), allocation (4,211 s), frontend analysis (3,862 s),
  scheduling (3,110 s), and cache suffix snapshotting (2,920 s).
- Quiet runs now report completed/total, percentage, elapsed time, throughput, and ETA every minute.
  Retained JSONL remains the authoritative recovery and analysis artifact.
# 2026-08-26: isolated Test262 execution now reuses immutable compiler artifacts by default

- Persistent compiler experiments were rejected and removed from the runner. Same-process reuse
  caused six passed-to-failed transitions on the 1,000-file corpus; reloading the artifact between
  requests caused nine; and compiling in a post-seed fork child stalled permanently at 797/1,791
  records. The supported runner therefore keeps the exec boundary that broad evidence proves.
- Automatic isolated concurrency now caps at 16 rather than 8 (and never exceeds
  `availableParallelism()`); `--jobs N` remains the explicit override. On the same deterministic
  1,000-file corpus, 1,644 variants took 76.731s at 8 jobs, 72.415s at 12, and 68.226s at 16.
  Sixteen jobs was 11.1% faster than eight. `/usr/bin/time -l` reported essentially unchanged
  peak memory footprint (117.5MB at 8 versus 115.8MB at 16); the maximum-resident-set field rose
  from 1.56GB to 1.76GB. This changes scheduling only: every variant remains an isolated process.
- The complete official checkout run retained 93,122 variant records in
  `test262-results-official-isolated-artifact-full-2026-08-26.jsonl`: 21,295 passed, 56,079
  failed, 9,345 refused, and 6,403 policy-skipped. All 86,719 executable variants completed in
  3,515.910s (58m 35.9s) with eight jobs. Median variant latency was 201ms; p90 507ms; p95
  1,642ms; p99 2,067ms; max 30,168ms.
- The retained phase sums identify the remaining cost rather than attributing it to isolation:
  selection 5,087.315s, allocation 4,320.699s, frontend analysis 4,085.404s, scheduling
  3,183.485s, cache suffix snapshots 2,974.777s, and frontend graph construction 2,345.907s.
  Immutable artifact restore was 1,517.697s over 78,196 loads, or 19.409ms/load. Native
  JavaScript execution itself summed to 606.887s. These sums overlap through eight-way parallel
  execution and therefore are not wall-clock components to add.
- Test262 still executes one official Script per isolated native process. There is no source
  concatenation, generated JavaScript wrapper, shared Realm/global state, or receiver rewriting.
- The default runner now restores the validated cross-process JSL compiler artifact. The explicit
  `--no-seed-artifact` control rebuilds that immutable compiler state from source in every process.
- On one deterministic 100-file corpus (162 executable variants), isolated artifact execution took
  5.665s versus 9.337s fresh, a 1.65x end-to-end speedup. Pass/non-pass results were identical:
  all 44 passing variants stayed passing. Detailed failure mechanisms differed on three variants;
  repeated fresh controls showed one affected class-destructuring case is itself nondeterministic,
  alternating between selection refusal and SIGSEGV. That pre-existing compiler bug remains work,
  but artifact reuse does not convert a passing test into a failing test.
## 2026-08-26: Symbol uses a traced primitive identity, not compiler interning

- Symbol representation is the former reserved NaN-box tag whose payload is an ordinary GC
  allocation identity. `%NewObject` supplies uniqueness and `%SymbolFromObject` is a pure retag;
  there is no mutable hidden counter and no execution-time dependency on compiler intern tables.
- Runtime code owns only tagging, tracing, truthiness, and identity-preserving property-key
  mechanics. Construction, description coercion, conversion errors, `typeof`, `ToPropertyKey`,
  constructor properties, construct rejection, and well-known Symbol values live in `lib/`.
- The frontend only distinguishes intrinsic call syntax from construct syntax and routes both to
  the corresponding DSL operations. Identifier reads materialize the DSL constructor value.
- The complete `test/built-ins/Symbol` cohort against a correctly relinked runtime produced 154
  executable variants: 8 passed, 144 failed, 2 refused, and 15 policy-skipped in 34.994s. Both
  uniqueness variants pass with distinct traced allocation payloads; both Symbol-description
  TypeError variants and both construct-rejection variants pass. Evidence is retained at
  `results/test262-symbol-fixed-runtime-2026-08-26.jsonl`.
- The first cohort result was invalid because Coil reused
  `.coil/build/native/2232296025890215446/source.o` after both `native/gc/runtime.c` and its
  `js-value.h` dependency changed. Repeated `coil build`, including after touching the source,
  relinked the stale object; the executable lacked the new runtime strings and operation 122 fell
  through to `undefined`. Manually rebuilding that declared object with `AOT_IN_MEMORY_HOST`
  produced a binary containing the branch and immediately changed uniqueness from 0/2 to 2/2.
  This needs a Coil native-source dependency invalidation bug report; it must not be worked around
  in JavaScript semantics.
- Next Symbol work is constructor/prototype materialization and primitive boxing. The current
  failures show missing `length`, prototype methods/accessors, registry methods, and well-known
  property descriptors; these are DSL semantic gaps rather than primitive identity failures.
# 2026-08-27: retained DSL dynamic calls are open-world across seed import

The immutable JSL seed used to lower `call-dynamic-with-receiver` to its callee value when the
seed graph contained no frontend JavaScript function targets. That changed semantics for retained
callables such as `BoundFunction2`: after import they can receive Script functions even though no
such target existed while the library artifact was compiled. `jl-js-call-receiver-core` now always
evaluates the receiver and arguments and emits the dynamic receiver call. Closed-world target
discovery remains only an optimization for the target cast and missing-argument padding.

The captured-callable JSL test now pins a real `CALL-ABI-DYNAMIC-RECEIVER` in the zero-frontend-
target graph. The seeded Test262 witness using
`Function.prototype.call.bind(Object.prototype.hasOwnProperty)` passes in default and strict mode.
The complete Symbol cohort is unchanged at 32 passed, 120 failed, 2 refused, and 15 skipped, so the
fix has zero passed-to-nonpassed transitions. Evidence is retained in
`results/test262-bound-has-zero-target-call-2026-08-27.jsonl` and
`results/test262-symbol-zero-target-call-2026-08-27.jsonl`.

`coil test` is green at 52/52. `coil test --suite frontier` remains red on exactly the two recorded
open bugs: `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.
## 2026-08-27: concrete typed-array intrinsic topology and constructor descriptor

- `lib/typed-array/core.jsl` now materializes stable `%TypedArray%` and
  `%TypedArray.prototype%` identities and links both Int8Array/Uint8Array constructor and
  prototype objects through the standard intrinsic spine. All visible topology remains DSL
  semantics; the frontend and Test262 harness are unchanged.
- `BuiltinConstructorValue` now defines every built-in prototype's `constructor` property with
  attributes 5: writable and configurable, but non-enumerable. Repeated intrinsic materialization
  is idempotent instead of resetting that descriptor through ordinary assignment defaults.
- The complete 44-variant Int8Array/Uint8Array constructor cohort moved from 8 passed / 36 failed /
  0 refused to 12 passed / 32 failed / 0 refused, with zero lost passes. All four
  `prototype/constructor.js` variants now pass. Retained results:
  `results/test262-int8-intrinsic-topology-2026-08-27.jsonl` and
  `results/test262-uint8-intrinsic-topology-2026-08-27.jsonl`.
- The direct intrinsic-topology native witness passes. Test262's `proto.js` variants still abort
  because the harness aliases `Object.getPrototypeOf` before calling it; generic calls through
  that function value are not implemented yet. This is the next shared functionality boundary,
  not a reason to specialize or alter the harness.
- `coil test` is green 52/52. `coil test --suite frontier` remains exactly the expected two red
  bugs: `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.
## 2026-08-27: abrupt targets preserve dynamic JavaScript property memory

- Jump and exception targets previously snapshotted only declared-field memory indices. DSL error
  construction reached `catch`, but the dynamic `JS-PROPERTY-ALIAS` stores that initialized the
  error object's `constructor`, `name`, and `message` were dropped on the abrupt edge.
- Target snapshots now retain dynamic aliases in an explicit negative-tagged entry representation,
  while preserving the established non-negative declared-field-index representation. Capture,
  merge, and snapshot paths decode both through one helper. JavaScript lookup and error semantics
  remain entirely in `lib/`; this is frontend control-state transport, not a harness special case.
- A real core-Test262-harness fixture pins a top-level logical unresolvable read and checks
  `constructor`, `instanceof`, `name`, and `message`. The production runner passes 2/2 default and
  strict variants; evidence is
  `results/test262-unresolvable-logical-regression-2026-08-27.jsonl` and its summary.
- `coil test` is green at 52/52. The legacy standalone Test262 harness module remains independently
  blocked because all ten native cases fail the existing Mach-O byte verifier before execution.
  The former upstream checkout is no longer present (only `tests/test262/cases` is retained), so
  the complete 68-variant logical cohorts could not be rerun at this checkpoint.
## 2026-08-27: ordinary calls and array callbacks now bind JavaScript receivers

- Ordinary function entry now performs `OrdinaryCallBindThis` semantics once: strict functions preserve the supplied receiver, while sloppy functions substitute the stable DSL global for `undefined`/`null` and box primitive receivers. Arrow functions retain lexical receiver handling. The frontend owns only strict/sloppy/arrow structure; substitution and boxing are implemented by `OrdinaryCallBindThisSloppy` in `lib/`.
- Array callback operations now pass the source-level `thisArg` through the DSL for `map`, `filter`, `forEach`, `some`, `every`, `find`, `findIndex`, `flatMap`, and `Array.from`. Reduce operations continue to treat their second argument as the initial accumulator, not a receiver. No Test262 harness behavior was changed.
- The complete `Array.prototype.every` cohort moved from 232 passed / 201 failed to 262 passed / 171 failed across 433 variants. Key-for-key comparison found 31 failed-to-passed transitions. The sole apparent passed-to-failed transition was a nondeterministic pipeline-execution failure; its default and strict variants both passed on isolated rerun, leaving zero reproduced regressions.
- Split direct witnesses pass explicit receiver identity for `every`, `some`, `filter`, `forEach`, `find`, and `findIndex` in both default and strict variants. `map`, `flatMap`, and `Array.from` direct result assertions still signal 11 in result materialization; existing map receiver witnesses and 31 every transitions show callback receiver delivery itself works, so those are separate next targets.
- Authoritative results are `results/test262-array-every-ordinary-this-v2-2026-08-27.jsonl`, `results/test262-array-every-thisarg-v3-2026-08-27.jsonl`, `results/test262-array-every-regression-check-2026-08-27.jsonl`, and `results/test262-array-callback-thisarg-split-2026-08-27.jsonl`, with summaries.
- `coil test` is green at 52/52. `coil test --suite frontier` remains intentionally red at exactly `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.
## 2026-08-27: callback dispatch ABI and three-argument `Array.from` are structurally complete

- The literal-array `map` specialization now boxes its callback before `call-dynamic-with-receiver`, matching every iterative callback macro. The missing boundary made ordinary-object `thisArg` cases signal 11 during the map call; the reduced default/strict witness moved from 0/2 to 2/2.
- `ToObjectValue` now preserves function identity as well as object and array identity. Functions are ECMAScript objects, not primitives to wrap. This closes the remaining sloppy callback receiver gap: `every/15.4.4.16-5-9.js` and `map/15.4.4.19-5-9.js` now pass in both default and strict variants.
- The structural `Array.from` recognizer now admits four AST children (callee plus source, map function, and `thisArg`). Its lowering already evaluated all three source arguments and delegated to DSL `ArrayFrom` plus `ArrayMap`; the old three-child bound incorrectly diverted valid calls to generic dispatch. Copy, map, and explicit-receiver reductions now pass 6/6.
- The final complete `Array.prototype.map` cohort reports 234 passed / 189 failed / 2 refused / 2 policy-skipped across 425 variants. Compared with the first post-callback-ABI run, function identity adds exactly one failed-to-passed transition with every other variant unchanged.
- The complete `Array.from` cohort reports 4 passed / 82 failed / 2 refused / 1 policy-skipped across 88 variants. Its remaining failures are broader constructor and array-like semantics, not the fixed three-argument recognizer. Official `flatMap/thisArg-argument.js` passes; a separate conditional-array callback return still traps and is the next dynamic return-typing target.
- Authoritative results: `results/test262-array-map-boxed-callback-2026-08-27.jsonl`, `results/test262-array-map-callback-receiver-final-2026-08-27.jsonl`, `results/test262-array-from-thisarg-complete-2026-08-27.jsonl`, `results/test262-array-from-thisarg-structural-2026-08-27.jsonl`, `results/test262-function-thisarg-identity-2026-08-27.jsonl`, and `results/test262-flatmap-thisarg-upstream-2026-08-27.jsonl`, with summaries.
- `coil test` is green at 52/52. `coil test --suite frontier` remains intentionally red at exactly `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.
## 2026-08-27: array-kind proof follows boxed conditional returns

- `be-array-value?` now follows `Box` nodes with bounded fuel. A callback returning `condition ? [value] : []` produces a Phi that is boxed before its function `Return`; call-graph array proof stopped at that representation boundary, so `flatMap` tagged the callback result as an ordinary object and trapped in append-or-spread. Direct calls happened to work because their consumers used the runtime tag rather than proving the callee return kind.
- The focused matrix covers direct conditional and statement-form array returns plus both forms through `flatMap`. It moved from 6 passed / 2 signal-5 failures to 8/8. The bounded differential witness now pins the all-array conditional callback alongside scalar, array, and heterogeneous flatMap returns.
- Against the retained earlier full-suite slice, the complete 47-variant `flatMap` cohort is cumulatively 7 passed / 40 failed / 0 refused, up from 2 passed / 43 failed / 2 refused. Those five transitions include callback receiver fixes from the preceding checkpoint; there is no matching upstream all-array conditional-return file, so this section does not misattribute the aggregate gain to the one-node backend change.
- A generic array-like loop conversion was tested and reverted after it regressed `thisArg-argument.js [strict]` with no upstream gains. A canonical `Array.prototype.flatMap` callable/prototype-value experiment was also reverted: its direct metadata probes passed, but Test262 `verifyProperty` still hits a separate composed mutation/control defect and yielded zero complete-file transitions.
- The next isolated defect is abrupt callback-result consumption in `flatMap`: direct calls, `every`, and `map` propagate the same thrown callback value, while `flatMap` signals 5 when its append-or-spread branch consumes that exceptional call result.
- Authoritative results: `results/test262-conditional-array-return-reduction-2026-08-27.jsonl`, `results/test262-conditional-array-return-final-2026-08-27.jsonl`, and `results/test262-array-flatmap-box-transparent-2026-08-27.jsonl`, with summaries.
- `coil test` is green at 52/52. `coil test --suite frontier` remains intentionally red at exactly `for-await-has-no-bridge-kind` and `shortest-round-trip-digits`.
## 2026-08-27: SameType, SameValue, and Object.is are JSL-owned and executable

- `SameType` now treats ordinary objects, arrays, and callables as the single ECMAScript Object
  type while preserving the represented primitive type boundaries. `SameValue` implements string
  value equality, object/symbol identity, NaN equality, and reciprocal-based `+0`/`-0` distinction
  in JSL. `IsStrictlyEqual` now delegates its type boundary to `SameType`.
- `Object.is` routes structurally from the frontend to the canonical JSL built-in; the frontend
  contains no comparison policy. Its focused witness falsifies the common signed-zero mistake and
  covers NaN, numbers, strings, and object identity in native-vs-Node execution.
- The complete 21-file Object.is Test262 directory retains 42 variants: 22 pass and 20 fail. Exact
  before/after comparison preserved all 22 passes and all 20 failures with no cohort drift or pass
  regression. Publication metadata/constructor checks, unsupported harness helpers, and Symbol
  execution remain named limitations rather than filtered tests.
- Coverage is 2,655/2,655 classified: 2,536 blocked, 11 partial, and 108 complete. Mapped evidence
  is 129/198 passing, and public-algorithm closure improves from 525 blocked + 1 partial to 524
  blocked + 2 partial.
- `coil balance --no-typecheck --strict --write` repaired the delimiter-only nesting error in the
  new comparison forms after the normal typechecked repair correctly refused the mid-edit file.

## 2026-08-27: foundational coercion/equality claims have focused and pinned evidence

- `Get`, `ToString`, `ToNumber`, and `IsStrictlyEqual` now have canonical pinned JSL provenance,
  explicit partial deviations, verified per-operation lowering, and focused real-source native-vs-
  Node witnesses. Together with `IsCallable`, these turn five high-unlock items from opaque blocked
  classifications into exact supported slices without claiming their missing receiver/value kinds.
- The direct `===`/`!==` Test262 cohort retains 118 expanded variants: 77 pass and 41 fail. The
  exact before/after comparison reports 77 `passed->passed`, 41 `failed->failed`, no cohort drift,
  and zero pass regressions. BigInt, `eval`, and one separate execution failure remain visible.
- Mapped evidence now totals 156 variants across ToBoolean and IsStrictlyEqual: 107 pass and 49
  fail. Coverage is still zero-gap, with 2,539 blocked, eight partial, and 108 complete items.
- A primitive receiver through `Function.prototype.call` exposed
  `VERR-CALL-RECEIVER-TAG`. It is filed as the executable
  `function-call-primitive-receiver-tag.js` frontier bug because it blocks an honest public
  ToObject witness. The frontier now contains four genuine failures.

## 2026-08-27: the pinned normative ledger has zero classification gaps

- The schema-2 raw ledger records clause hierarchy (`parentId`, `ancestorIds`, `topLevelId`) and
  direct prose counts, so reviewed rules can classify semantic families without title guessing or
  generated-signature noise.
- Exact-count, dependency-backed rules now classify all 2,655 normative items: 1,140 JSL, 626
  frontend, 88 runtime, 21 host, and 780 composite. The candidate queue is empty. This does not
  claim implementation: at that milestone 2,543 remained blocked, four were partial, and 108 were
  complete.
- `IsCallable` is now a named partial JSL operation with pinned provenance, an explicit callable-
  Proxy deviation, verified dependency-closure lowering, and a focused native-versus-Node source
  witness. Attempts to claim ToObject and Get were withdrawn when their public witnesses failed;
  no failing witness was converted into evidence.
- Coverage still reports 525 of 526 public algorithms blocked and one partial. The next work is
  dependency-ordered implementation, not more classification.
# 2026-08-28: Stage 5 begins with ordered machine result captures on both targets

- Multi-result ideal calls now lower to one `MI-CALL` anchor followed by one
  `MI-CALL-RESULT` per declared slot. Selection publishes the complete projection group at the
  call site. AArch64 and x86-64 encode the same private compiler ABI: result slot
  `i` occupies canonical GPR/FPR color `i` for multi-result linkage, while scalar external linkage
  retains its platform ABI.
- Multi-result calls no longer perform scalar return normalization, which could overwrite a later
  result before capture. Both target encoders accept the bounded two-leaf Record witness.
- A host-native execution attempt did not return and was stopped. It is deliberately not claimed
  as passing or left in the green suite; diagnosing that generated control/ABI failure is the next
  Stage 5 task before the native exit condition can be met.
- Attempts to impose capture/parallel-copy constraints in the existing scheduler and allocator
  made the retained-library gate crash after scheduling. Those unproven constraints were removed;
  the bounded two-result witness remains green, but the mandatory project gate is currently red
  (75/76) at `an_immutable_jsl_seed_artifact_restores_a_clean_compiler_process`. Stage 5 therefore
  needs a first-class result-location/parallel-copy phase, not more allocator masks.
# 2026-08-28: backend scaling refactor is now a closed-pipeline contract

- `docs/BACKEND-SCALING-REFACTOR.md` records the full refactor required by the 864-second
  mislabelled scheduling/liveness cliff. The earlier `vreg-node` reverse-map work was an optional
  cache over partial vregs and retained `ml-kind-for-vreg-scan`; it did not make provenance total.
- An independent `gpt-5.6-sol` xhigh audit corrected the initial scheduler diagnosis: active local
  scheduling already uses adjacency and a ready heap. The remaining inventory includes global
  memory anti-dependency scans, reorder/repack repair, function×node indexes, per-query liveness
  scans, dense quadratic interference, encoder fallbacks/cross-products, quadratic root sorting,
  and per-function instruction rescans in retained-text extraction.
- The plan requires typed complete MachineValue construction, table-driven opcode constraints,
  frozen phase products, deletion of all production rediscovery/default paths, explicit dependency
  tokens, bounded liveness, sparse/hybrid allocation, closed encoding/publication, and reachable
  content-addressed JSL artifacts. Warm tiny compilation must complete through publication below
  750 ms and spawn/first result below one second, with structural work counters and zero fallbacks.
## 2026-08-28 — memory anti-dependencies and allocation are closed indexed products

- Replaced selection's per-write whole-machine scan with ideal-memory and owner-local read
  adjacency. On the 517,309-instruction seed, `selection_antideps_final` is about 11 ms and the
  candidate count is 179,493, down from 4.207 s and 934,201,044 candidates.
- Replaced the sparse interference graph with a Torque-style conservative interval sweep. The
  allocator now stores zero interference edges/adjacency entries; allocation tests independently
  replay exact CFG liveness against published registers and spills.
- Fixed ABI-register exclusion is derived from exact liveness at fixed definitions, so holes in a
  conservative interval cannot invent conflicts between mutually exclusive ABI values.
- Replaced the per-function whole-unit scan for outgoing result-pointer slots with one instruction
  pass plus a dense function flag table. Allocation publication fell from roughly 0.45 s to 4 ms.
- The new spill shape exposed an AArch64 size-model bug: polymorphic calls emitted captured-result
  parallel moves but did not count them. `be-inst-words` now includes those moves; the large seed
  encodes, saves, reloads, and executes.
- Witnesses: allocator 10/10 green; bounded gate 81/81 green. Large cold seed: selection ~0.53 s,
  local scheduling ~0.18 s, liveness ~1.07 s, allocation ~1.48 s, AArch64 encoding ~0.08 s.
  Allocation previously measured 8.45 s with 143,806,380 directed adjacency entries. Warm tiny
  backend phases are microseconds. The remaining cold work is explicit: allocation constraint
  construction and independent verification each replay call liveness, and liveness verification
  remains about 0.43 s.
