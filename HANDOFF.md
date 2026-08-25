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
