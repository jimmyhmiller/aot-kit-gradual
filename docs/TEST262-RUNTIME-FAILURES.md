# Test262 runtime-failure inventory

## Runtime assertion observability

The runner now enables `AOT_TRACE_THROW` for both standalone and persistent native workers. The
native runtime prints the thrown value plus named, decoded JavaScript object properties, and the
runner retains the complete throw record in each JSONL result. A failing
`assert.sameValue(6, 7, "six should have been seven")` now reports:

```text
property name=message decoded=string(six should have been seven)
```

Application exceptions report their thrown value and all available object properties. Signals,
compiler failures, and graph corruption remain separate categories. Adding `aotkKind`, `actual`,
and `expected` properties to `Test262Error` was attempted in both assertion bodies and the shared
constructor; both forms currently trigger the open property-store/control-fanout selection bug in
the focused harness. Exact actual/expected capture therefore remains blocked on that compiler fix,
rather than silently degrading the passing harness.

## Baseline

The retained full-suite run in
`test262-results-2026-08-24T17-56-27-345Z.jsonl` contains 30,304
`RUNTIME-FAILED` variants representing 15,933 distinct test files. There are
15,589 default variants and 14,715 strict variants.

These are not selection failures. They reached native execution, but the old
runner recorded only `RUNTIME-FAILED`; it did not preserve the assertion,
exception, return status, or semantic operation that failed.

## Exclusive capability classification

Each baseline failure is assigned to the first matching family below. Counts
therefore sum to exactly 30,304 rather than double-counting tests that exercise
several features.

| Capability family | Variants | Files | Share |
| --- | ---: | ---: | ---: |
| Other built-ins / Annex B | 7,086 | 3,730 | 23.4% |
| TypedArray / ArrayBuffer / DataView | 4,366 | 2,202 | 14.4% |
| Object model / property descriptors | 4,268 | 2,190 | 14.1% |
| Temporal | 3,094 | 1,549 | 10.2% |
| Destructuring | 2,500 | 1,251 | 8.2% |
| Array callback algorithms | 2,270 | 1,148 | 7.5% |
| Functions / calls / closures | 1,916 | 1,193 | 6.3% |
| String semantics | 1,271 | 640 | 4.2% |
| Date semantics | 838 | 432 | 2.8% |
| Proxy / Reflect | 676 | 341 | 2.2% |
| RegExp | 596 | 288 | 2.0% |
| Other language semantics | 486 | 481 | 1.6% |
| Number / Math semantics | 402 | 203 | 1.3% |
| Generators / async syntax | 391 | 208 | 1.3% |
| Symbol | 113 | 61 | 0.4% |
| BigInt | 31 | 16 | 0.1% |

The largest declared Test262 features inside this population are Temporal
(3,151 variants), TypedArray (3,136), destructuring binding (2,206),
Reflect.construct (1,238), Symbol (1,200), generators (1,063), arrow functions
(1,030), BigInt (823), default parameters (806), resizable ArrayBuffer (676),
and Proxy (653). These feature counts overlap and are diagnostic, not totals.

## Stratified rerun

A deterministic sample selected 20 distinct files from each of 15 capability
families, producing 300 files and 554 default/strict variants. Results are in
`/tmp/aotk-runtime-stratified-results-20260824b.jsonl`.

| Result | Variants |
| --- | ---: |
| Generic `RUNTIME-FAILED` | 541 |
| Selection failure | 9 |
| `SIGSEGV` | 3 |
| Graph corruption | 1 |
| Passed | 0 |

This establishes that the dominant population still passes through the native
compiler pipeline. Selection is not the explanation for the roughly 30,000
failures. It also establishes that the newer runner preserves compiler and
signal diagnostics, but the native test assertion path itself still collapses
semantic failures to the same `RUNTIME-FAILED` label.

## What the data says

1. This is a broad JavaScript semantics deficit, not one backend execution bug.
2. Three large, coherent surfaces account for 38.7%: typed storage, the object
   model, and Temporal.
3. Destructuring and callback/call semantics account for another 22.0% and are
   better near-term targets because they can unlock ordinary language and Array
   tests without implementing an entire advanced built-in family.
4. Strict/default duplication is close to two variants per file. Raw variant
   counts should not be mistaken for independent root causes.
5. We cannot honestly classify the generic failures as wrong value, wrong
   exception, missing intrinsic, or memory mutation bug until assertion
   provenance crosses the native boundary.

## Work queue

1. Make the Test262 assertion bridge report assertion kind, source test index,
   expected value/type, and actual value/type before returning failure.
2. Re-run this same stratified corpus and classify concrete failure signatures.
3. Start with destructuring and Array callback/call semantics; these exercise
   shared language machinery and should collapse many tests per fix.
4. Treat TypedArray/ArrayBuffer, object descriptors, and Temporal as explicit
   capability projects rather than debugging them one test at a time.
5. Promote one minimal representative from each concrete signature into the
   frontier before changing semantics.

## Observed 300-file sample: what to fix next

The same 300-file stratified corpus was rerun after runtime throw tracing landed. Its 554 variants
produced 461 structured uncaught-throw records, 80 still-untraced runtime failures, nine selection
failures, three segfaults, and one graph-corruption failure.

Of the 461 observed throws, 371 were `ReferenceError`. Missing globals dominated:

| Missing binding | Sample variants |
| --- | ---: |
| `Function` | 211 |
| `Symbol` | 40 |
| `Proxy` | 36 |
| `RegExp` | 34 |
| `Temporal` | 18 |
| `BigInt` | 16 |
| `Float64Array` | 8 |
| `eval` | 4 |
| `Date` | 2 |

These counts are diagnostic for this deliberately stratified, first-20-per-family sample; they
must not be extrapolated as percentages of the full suite.

The recommended implementation order is:

1. Build the ordinary `Function` intrinsic and `Function.prototype` surface on the existing call
   ABI. Refuse dynamic source construction separately if necessary; do not withhold ordinary
   function identity, prototype, `name`, `length`, `call`, `apply`, and `bind` with it.
2. Diagnose the 34/40 untraced destructuring variants. These are not normal JavaScript throws and
   likely share an iterator/binding execution defect. Destructuring is core language functionality.
3. Fix Array callback invocation and receiver semantics. Twenty sampled Array variants reach an
   assertion with wrong behavior and ten more die without a structured throw.
4. Fix ordinary exception classes and constructor identity. Fourteen sampled BigInt-related tests
   report `Wrong error constructor`; the shared Error hierarchy matters beyond BigInt.
5. Address the compact numeric cluster: 32 sampled Number/Math variants reach assertions, with
   repeated signed-zero, `ceil`/`floor`/`trunc`, coercion, and infinity signatures.
6. Address the compact string cluster: 22 sampled variants reach assertions around repeat,
   surrogate/code-unit handling, method length, and replacement substitution.
7. Defer Temporal, Proxy, Symbol, BigInt, typed arrays, and Annex B until the core profile above is
   healthy, except where a small intrinsic stub is required by shared harness code.
