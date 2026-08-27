# Test262 Progress Goals

## Objective

Raise the synchronous, non-module Test262 pass rate from the current 23.40% to at least 30%, then
continue toward a usable JavaScript implementation. Work through the goals below in order unless
new complete-corpus evidence shows that a later goal has greater leverage.

Current authoritative result (`2026-08-25`):

| Outcome | Variants |
|---|---:|
| Passed | 21,152 |
| Failed | 62,662 |
| Refused | 6,565 |
| Skipped | 6,829 |
| Executed | 90,379 |
| Pass rate | 23.40% |

Temporal is not a priority. Excluding `built-ins/Temporal` and `intl402/Temporal`, the current pass
rate is 27.43%: 21,152 passes over 77,115 executed variants.

## Rules for every goal

- JavaScript semantics belong in `lib/**/*.jsl`. The frontend may recognize syntax and construct
  graph structure, but it must not open-code operations that the DSL defines or could define.
- Begin with a retained, complete cohort result. Do not infer impact from a sample.
- Add focused regression witnesses without weakening, deleting, or reclassifying existing tests.
- Run `coil test` after every edit. It must remain green.
- Run `coil test --suite frontier` at the beginning and handoff. Its known failures remain the
  explicit open-bug queue.
- Finish with the same complete cohort and report exact status transitions. A semantic goal is not
  complete if any previously passing variant regresses.
- Retain JSONL results and a generated breakdown. Record measured progress in `HANDOFF.md`.
- Commit each independently verified improvement before beginning the next goal.

## Goal 1: Materialize the script global object and top-level `this`

**Goal statement:** Implement a stable global-object value in the DSL and structurally lower
top-level script `this` to that value, so ordinary property operations, coercions, identity checks,
and descriptor values operate on it without trapping.

**Why first:** All 35 process signal-5 failures in the complete 1,264-variant
`Object.defineProperties` cohort share representative uses of top-level `this`. This is a small,
coherent missing foundation with likely impact beyond that cohort.

**Ownership:** Stable identity and JavaScript-visible behavior belong in `lib/`. Distinguishing
top-level script `this` from function, method, constructor, and lexical-arrow `this` is frontend
structure.

**Complete when:**

- Focused witnesses cover identity, property persistence, boolean conversion, descriptor use,
  ordinary function receiver behavior, and lexical-arrow capture.
- The complete `Object.defineProperties` cohort has no signal-5 failures attributable to global
  `this`.
- The cohort has measurable failed-to-passed transitions and zero passed-to-nonpassed transitions.

## Goal 2: Explain and eliminate exit-code-70 failures

**Goal statement:** Classify every exit-70 runtime failure by the violated runtime invariant, then
fix each shared root cause at its proper DSL, compiler, or runtime layer.

**Why second:** The observability cohort contains eight exit-70 failures. They are now bounded and
distinguishable from crashes, timeouts, assertion failures, and JavaScript throws.

**Ownership:** JavaScript behavior belongs in `lib/`; representation, allocation, encoding, and GC
invariants belong in the compiler/runtime. Do not hide an invariant failure by converting it into a
generic JavaScript result.

**Complete when:**

- Every exit-70 case has a named diagnosis and focused witness.
- The complete source cohorts contain no unexplained exit-70 results.
- Fixes cause no passing regressions.

## Goal 3: Correct the property descriptor model

**Goal statement:** Bring property descriptor conversion, validation, definition, redefinition,
and attribute transitions into agreement with ECMAScript through the DSL implementation.

**Why third:** In `Object.defineProperties` alone, 363 failures are assertion/error-object throws
and 30 are unexpected `TypeError`s. The same semantics are shared by `Object.defineProperty`,
arrays, classes, built-in initialization, freezing, sealing, and reflection.

**Required semantic areas:**

- `ToPropertyDescriptor` field presence and coercion.
- Data versus accessor descriptor validation.
- Defaults for absent descriptor fields.
- Configurable, enumerable, writable, value, getter, and setter transitions.
- Non-configurable property redefinition rules.
- Atomic behavior of `Object.defineProperties` after descriptor collection.
- Array-index and `length` interactions where they share the property-definition path.

**Complete when:**

- Focused DSL/native witnesses cover each invariant above.
- Complete `Object.defineProperty` and `Object.defineProperties` cohorts are retained and compared.
- Every gain is semantic, with zero passing regressions.

## Goal 4: Implement the `Symbol` foundation

**Goal statement:** Implement symbol values, identity, construction rules, property-key conversion,
and the well-known symbols needed by the supported synchronous language surface.

**Why fourth:** Missing `Symbol` directly causes 1,767 ReferenceErrors and indirectly blocks
iterators, reflection, collections, object branding, and protocol dispatch.

**Initial scope:**

- `Symbol()` unique identity and prohibition on constructor use.
- Symbol descriptions and primitive type behavior.
- Symbols as non-string property keys.
- `Symbol.iterator`, `Symbol.toStringTag`, and other well-known symbols required by measured cohorts.
- `Symbol.for` and `Symbol.keyFor` only after ordinary symbol identity and keys are correct.

**Complete when:**

- Symbol behavior is implemented in `lib/`, with only representation primitives added below it.
- Complete Symbol and dependent iterator/property-key cohorts show gains without regressions.
- Missing-global `Symbol` ReferenceErrors are eliminated from supported synchronous tests.

## Goal 5: Build the typed-array and ArrayBuffer foundation

**Goal statement:** Implement a coherent ArrayBuffer and typed-array object model sufficient for
ordinary fixed-length numeric typed arrays before attempting resizable, growable, shared, or
detachment-heavy extensions.

**Why fifth:** Missing `Float64Array` causes 2,614 direct ReferenceErrors and missing `ArrayBuffer`
causes another 996. The upside is large, but the subsystem requires coordinated storage,
constructors, indexed properties, and bounds behavior.

**Initial scope:**

- Fixed-length `ArrayBuffer` allocation and byte storage.
- Numeric typed-array constructors and stable prototypes.
- Indexed reads/writes, `length`, `byteLength`, `byteOffset`, and `buffer`.
- Numeric conversion and element-width behavior.
- Shared generic methods only after indexed storage is correct.

**Deferred scope:** Resizable/growable buffers, shared memory, atomics, and detachment semantics.

**Complete when:**

- Foundation cohorts no longer fail through missing constructors.
- Indexed storage and bounds witnesses pass on native execution.
- Complete fixed-length ArrayBuffer and TypedArray cohorts show no passing regressions.

## Goal 6: Complete the core class frontend and runtime model

**Goal statement:** Support the ordinary class semantics required by class declarations and class
expressions, then expand to private and static elements in measured increments.

**Why sixth:** Class statement and expression paths contain nearly 10,000 failures. This is large
leverage but broader and riskier than the preceding object-model foundations.

**Work order:**

1. Constructors, methods, prototypes, and `new`.
2. `extends`, `super` construction, and `super` property access.
3. Instance and static public fields with correct initialization order.
4. Private fields, methods, and accessors.
5. Static blocks and remaining class early errors.

**Ownership:** Parsing and class-element graph structure belong in the frontend. Property creation,
prototype linkage, construction, receiver checks, and field semantics belong in `lib/`.

**Complete when:** Each stage has a complete retained cohort, focused execution witnesses, exact
transition counts, and no passing regressions before the next stage begins.

## Goal 7: Eliminate compiler correctness failures

**Goal statement:** Reduce instruction-selection and graph-integrity failures to zero for every
frontend-supported synchronous Test262 program.

Current full-run buckets include:

| Compiler failure | Count |
|---|---:|
| Instruction selection | 311 |
| Graph `NO-NODE` | 588 |
| Other graph corruption | 236 |
| Graph folding non-convergence | 23 |

**Work order:**

1. Classify each bucket by exact failing node/op and root graph pattern.
2. Fix frontend graph construction when control, memory, or SSA structure is invalid.
3. Fix selection only when the ideal graph is valid and the machine pattern is genuinely missing.
4. Fix optimizer convergence and invariants rather than increasing arbitrary limits.

**Complete when:** Supported programs either compile and execute or produce a specific frontend
refusal for genuinely unsupported syntax. None may reach graph corruption, selection failure, or
non-convergence.

## Goal 8: Reclassify the full runtime frontier and choose the next semantic families

**Goal statement:** Run the complete suite with structured diagnostics, produce a complete runtime
failure taxonomy, and turn the largest coherent non-Temporal families into new numbered goals.

**Why last in this roadmap:** The previous full run contained 12,799 opaque runtime exits. The
observability fix must first prove itself across the full corpus. The resulting categories, not
guesswork, should determine the next work order.

**Complete when:**

- No result is recorded as bare `RUNTIME-FAILED`.
- Process failures are separated into timeout, signal, signal-like shell exit, ordinary exit, and
  missing output.
- JavaScript throws retain constructor/name/message when representable.
- Each major category has counts, representative paths, and a proposed root cause.
- New goals are added here in measured priority order.

## Milestone: 30% passing

The milestone requires at least 27,114 passing variants if the executed denominator remains
90,379. Because the corpus can change, completion is defined by a fresh complete run reporting at
least 30.00%, not by accumulating estimated gains from focused cohorts.
