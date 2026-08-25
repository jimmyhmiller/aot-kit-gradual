# Full Test262 Breakdown

## Current authoritative baseline: 2026-08-25

The retained current run supersedes the detailed 2026-08-24 baseline below. It completed the same
93,209 generated variants with 9,334 passed, 53,774 failed, 18,819 refused, and 11,282
policy-skipped. Among 81,927 non-skipped variants, the pass rate is 11.39%. The active 30% target is
24,579 passing variants, so this baseline is 15,245 passes short.

Timing was 7.576 seconds of one-time build and 1,693.794 seconds of execution, 1,701.370 seconds
total. The largest current mutually exclusive categories are pipeline execution (37,263), frontend
bridge kind zero (16,440), frontend code 1001 (10,742), async policy skips (5,523), negative-parse
policy skips (4,453), SIGSEGV (1,807), bridge kind 214 (1,091), graph `NO-NODE` argument zero
(996), selection (894), module policy skips (843), and AArch64 encoding (630).

The next structural target is ordinary classes: `language/statements/class` has 5,130 refusals and
`language/expressions/class` has 4,561, nearly all in bridge kind zero. The current raw records and
machine summary are:

- `test262-results-current-full-2026-08-25.jsonl`
- `test262-results-current-full-2026-08-25.jsonl.summary.json`

The sections below remain the complete analysis of the prior run and are retained for comparison;
their counts must not be treated as current.

Run date: 2026-08-24

This is the complete runner-policy corpus, not a sample: all 93,209 generated variants. The runner still policy-skips modules, async completion, negative parse/runtime phases, and tests requiring `$262`.

## Timing

| Phase | Time |
| --- | ---: |
| Build | 7.072 s |
| Execution | 939.302 s |
| Total | 946.374 s (15m 46.374s) |

- Compiled/executed variants: 81,927
- Mean wall time per compiled/executed variant: 11.551 ms
- Throughput: 86.57 compiled/executed variants/s

## Outcomes

| Outcome | Count | All variants |
| --- | ---: | ---: |
| Passed | 7,663 | 8.22% |
| Failed | 51,465 | 55.21% |
| Refused | 22,799 | 24.46% |
| Policy-skipped | 11,282 | 12.10% |

Among the 81,927 non-policy-skipped variants, 9.35% passed, 62.82% failed, and 27.83% were refused.

## Outcomes by corpus area

| Area | Passed | Failed | Refused | Skipped | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| built-ins | 4,068 | 34,878 | 6,171 | 1,112 | 46,229 |
| language | 3,373 | 8,219 | 14,581 | 9,913 | 36,086 |
| intl402 | 0 | 5,488 | 1,204 | 11 | 6,703 |
| staging | 101 | 1,660 | 743 | 151 | 2,655 |
| annexB | 63 | 1,098 | 88 | 75 | 1,324 |
| harness | 58 | 122 | 12 | 20 | 212 |

## Complete mutually exclusive non-pass breakdown

| Reason | Count |
| --- | ---: |
| refused: frontend bridge kind 0 | 20,629 |
| runtime throw: ReferenceError | 20,227 |
| compiler frontend status 3/code 1001 | 12,202 |
| runtime: nonzero exit without diagnostic | 10,095 |
| runtime throw: assertion/error object | 5,592 |
| skipped: async completion | 5,523 |
| skipped: negative parse phase | 4,453 |
| refused: frontend bridge kind 214 | 1,078 |
| skipped: module variant | 843 |
| runtime: SIGSEGV | 829 |
| compiler graph: NO-NODE | 597 |
| refused: frontend bridge kind 242 | 497 |
| skipped: `$262` host object | 431 |
| compiler frontend status 3/code 1002 | 428 |
| compiler selection: control/Region fanout | 362 |
| compiler selection: other | 295 |
| refused: frontend bridge kind -1 | 232 |
| compiler graph: other | 213 |
| runtime throw: opaque value | 185 |
| runtime throw: TypeError | 179 |
| refused: frontend bridge kind 303 | 146 |
| compiler frontend status 3/code 1007 | 126 |
| refused: frontend bridge kind 255 | 122 |
| refused: frontend bridge kind 227 | 63 |
| compiler frontend status 1/code 0 | 58 |
| runtime: SIGBUS | 49 |
| skipped: negative runtime phase | 32 |
| compiler graph: folding did not converge | 23 |
| refused: frontend bridge kind 96 | 18 |
| runtime: timeout | 5 |
| refused: frontend bridge kind 220 | 4 |
| refused: frontend bridge kind 253 | 4 |
| refused: frontend bridge kind 224 | 2 |
| refused: frontend bridge kind 252 | 2 |
| refused: frontend bridge kind 79 | 2 |

The bridge-kind rows total all 22,799 refusals. The compiler/runtime rows total all 51,465 failures. The policy rows total all 11,282 skips.

## Highest-leverage observed missing bindings

| Binding | Count |
| --- | ---: |
| `Function` | 7,387 |
| `Float64Array` | 2,584 |
| `Symbol` | 1,247 |
| `eval` | 1,079 |
| `Date` | 1,052 |
| `Temporal` | 1,024 |
| `ArrayBuffer` | 896 |
| `Proxy` | 604 |
| `RegExp` | 520 |
| `arguments` | 384 |
| `Set` | 286 |
| `Reflect` | 260 |
| `Intl` | 256 |
| `Promise` | 250 |
| `Map` | 226 |
| `Iterator` | 192 |

## Largest non-skip failure families

| Path | Count |
| --- | ---: |
| `language/statements/class` | 5,306 |
| `language/expressions/class` | 4,749 |
| `built-ins/Array/prototype` | 4,487 |
| `built-ins/TypedArray/prototype` | 2,792 |
| `built-ins/String/prototype` | 1,868 |
| `built-ins/Temporal/ZonedDateTime` | 1,802 |
| `built-ins/Object/defineProperty` | 1,613 |
| `built-ins/Temporal/PlainDateTime` | 1,546 |
| `language/expressions/object` | 1,464 |
| `built-ins/Temporal/PlainDate` | 1,304 |
| `language/statements/for-of` | 1,263 |
| `built-ins/Iterator/prototype` | 1,026 |
| `built-ins/DataView/prototype` | 998 |
| `built-ins/Date/prototype` | 970 |
| `built-ins/Object/defineProperties` | 966 |
| `built-ins/RegExp/property-escapes` | 900 |
| `built-ins/RegExp/prototype` | 894 |
| `built-ins/Set/prototype` | 712 |

## Work order

1. Fix frontend bridge kind 0. It refuses 20,629 variants, almost all refusals.
2. Implement `Function` and function construction/call semantics. It is the largest missing binding, while class, closure, callback, and function paths dominate failures.
3. Decode the remaining 10,095 `RUNTIME-FAILED` exits. They are too large to classify honestly without diagnostics.
4. Fix core object/property semantics. Array prototype, object literals, property descriptors, `defineProperty`, and `defineProperties` dominate useful non-Temporal failures.
5. Fix the 657 selection and 833 graph failures before semantic work on affected cases.
6. Eliminate 829 `SIGSEGV`, 49 `SIGBUS`, and 5 timeouts.
7. Add useful globals by leverage: `Symbol`, `eval`, `Date`, `ArrayBuffer`, `Proxy`, `RegExp`, `Set`, `Reflect`, and `Map`. Deprioritize Temporal and Intl as requested.
8. Treat `Float64Array` as a TypedArray harness fan-out marker, not 2,584 independent bugs; address it after the object model.

## Retained artifacts

- Raw per-variant records: `test262-results-observed-full-2026-08-24.jsonl`
- Exhaustive machine-readable aggregation, including every area, two- and three-level path prefix, assertion message, and missing binding: `test262-full-breakdown-2026-08-24.json`
- Reproducible reducer: `tools/analyze-test262-results.mjs`
