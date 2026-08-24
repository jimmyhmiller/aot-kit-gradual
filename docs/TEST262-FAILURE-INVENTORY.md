# Test262 failure inventory

## Selection cohort update after one-successor canonicalization

The retained full-run inventory below is the immutable 2026-08-24 baseline. A targeted rerun of
all 3,433 files that had at least one selection failure found that 6,316 of 6,603 reproducible
selection failures were `MSEL-TERMINATOR`. The dominant cause was an ideal `If` whose dead arm had
been removed: the machine CFG correctly contained one reachable successor, while selection still
required two targets. One-successor blocks now emit an unconditional jump.

On the same 6,788-variant cohort, selection failures fell from 6,603 to 633, a 90.4% reduction;
`MSEL-TERMINATOR` specifically fell from 6,316 to 361, a 94.3% reduction. Seventy-five variants now
pass. The remaining cohort is 361 terminator failures, 220 unsupported selections, 50 dependency
failures, and 2 call failures. Most formerly rejected variants now reach the separately classified
runtime-failure bucket, which is progress through the compiler but not a semantic pass.

The 361 remaining terminator failures are a different CFG shape: a live Region directly feeds both
an `If` and a `Loop`, while `be-ctrl-succ` only represents zero or one immediate control successor.
They remain open rather than being hidden by the dead-arm fix.

Source: `/Users/jimmyhmiller/Documents/Code/projects/aot-kit-gradual/test262-results-2026-08-24T17-56-27-345Z.jsonl`

This report classifies every non-passing record by the most specific reason retained by the
runner. Counts are variants; `Files` removes default/strict duplication. A category is not
claimed as a root cause when the native harness did not retain enough evidence.

## Outcome totals

| Outcome | Variants |
|---|---:|
| passed | 7588 |
| failed | 51541 |
| refused | 22798 |
| skipped | 11282 |

There are **54 recorded reason groups** across **85621 non-passing records**.

## Complete reason table

| Recorded reason | Status | Variants | Files | Recorded wall time |
|---|---|---:|---:|---:|
| Runtime failure without assertion diagnostic | failed 30304 | 30304 | 15945 | 10325.4s |
| frontend diagnostic code 1001 | failed 12202 | 12202 | 6186 | 180.2s |
| Frontend unsupported expression syntax [bridge 0] | refused 8707 | 8707 | 4383 | 370.7s |
| selection diagnostic code 1 | failed 6360 | 6360 | 3303 | 1983.6s |
| Frontend unsupported statement syntax [bridge 0] | refused 6223 | 6223 | 3128 | 289.3s |
| Policy gap: async-completion | skipped 5523 | 5523 | 5523 | 0.0s |
| Frontend unsupported object literal element syntax [bridge 0] | refused 4786 | 4786 | 2487 | 173.0s |
| Policy gap: negative-parse-phase | skipped 4453 | 4453 | 4453 | 0.0s |
| Frontend unsupported method receiver syntax [bridge 214] | refused 1066 | 1066 | 535 | 34.5s |
| Native execution: SIGSEGV | failed 919 | 919 | 576 | 90.4s |
| Frontend unsupported array element syntax [bridge 0] | refused 913 | 913 | 457 | 57.0s |
| Policy gap: module-variant | skipped 843 | 843 | 843 | 0.0s |
| graph corruption: jsl argument 0 is NO-NODE | failed 508 | 508 | 304 | 20.1s |
| Frontend unsupported expression syntax [bridge 242] | refused 497 | 497 | 258 | 16.8s |
| Policy gap: $262-host-object | skipped 431 | 431 | 431 | 0.0s |
| frontend diagnostic code 1002 | failed 428 | 428 | 224 | 5.8s |
| selection diagnostic code 2 | failed 234 | 234 | 129 | 13.0s |
| Frontend unsupported expression syntax [bridge -1] | refused 231 | 231 | 121 | 7.6s |
| Frontend unsupported expression syntax [bridge 303] | refused 146 | 146 | 99 | 6.3s |
| frontend diagnostic code 1007 | failed 126 | 126 | 63 | 1.3s |
| Frontend unsupported statement syntax [bridge 255] | refused 122 | 122 | 122 | 3.4s |
| graph corruption: n-kill!: node is pinned | failed 94 | 94 | 47 | 3.1s |
| Frontend unsupported statement syntax [bridge 227] | refused 63 | 63 | 33 | 1.8s |
| frontend diagnostic code 0 | failed 58 | 58 | 36 | 0.9s |
| graph corruption: jsl argument 2+ is NO-NODE | failed 53 | 53 | 27 | 1.7s |
| Native execution: TIMEOUT | failed 47 | 47 | 25 | 1412.0s |
| Native execution: SIGBUS | failed 45 | 45 | 44 | 8.0s |
| graph corruption: declaration initializer evaluated to NO-NODE | failed 40 | 40 | 29 | 1.2s |
| Policy gap: negative-runtime-phase | skipped 32 | 32 | 32 | 0.0s |
| graph corruption: n-in: input index out of range | failed 26 | 26 | 13 | 0.7s |
| Frontend unsupported statement syntax [bridge 96] | refused 18 | 18 | 10 | 0.4s |
| graph corruption: configurable | failed 12 | 12 | 6 | 0.3s |
| graph corruption: writable | failed 12 | 12 | 6 | 0.3s |
| Frontend unsupported statement syntax [bridge 214] | refused 12 | 12 | 6 | 0.2s |
| graph corruption: enumerable | failed 12 | 12 | 6 | 0.2s |
| graph corruption: a.constructor[Symbol.species] = parseInt | failed 10 | 10 | 5 | 0.3s |
| graph corruption: w | failed 10 | 10 | 5 | 0.2s |
| graph corruption: x | failed 10 | 10 | 5 | 0.3s |
| graph corruption: args = arguments | failed 8 | 8 | 8 | 0.2s |
| graph corruption: fromParam = await | failed 4 | 4 | 2 | 0.1s |
| Frontend unsupported statement syntax [bridge 220] | refused 4 | 4 | 2 | 0.1s |
| Frontend unsupported expression syntax [bridge 253] | refused 4 | 4 | 2 | 0.1s |
| graph corruption: index0=index0 | failed 3 | 3 | 2 | 0.1s |
| graph corruption: Number.prototype[1] = isNaN | failed 2 | 2 | 1 | 0.0s |
| Frontend unsupported statement syntax [bridge 224] | refused 2 | 2 | 1 | 0.1s |
| graph corruption: toString | failed 2 | 2 | 1 | 0.1s |
| selection diagnostic code 5 | failed 2 | 2 | 1 | 0.1s |
| Frontend unsupported instanceof right-operand syntax [bridge 79] | refused 2 | 2 | 1 | 0.1s |
| graph corruption: index = index | failed 2 | 2 | 1 | 0.0s |
| graph corruption: x=x | failed 2 | 2 | 1 | 0.0s |
| graph corruption: get | failed 2 | 2 | 1 | 0.0s |
| Frontend unsupported expression syntax [bridge 252] | refused 2 | 2 | 1 | 0.0s |
| graph corruption: g-fold-proven!: folding did not converge | failed 2 | 2 | 2 | 38.0s |
| graph corruption: Function.prototype.caller = fn | failed 2 | 2 | 1 | 0.1s |

## Evidence by reason

### Runtime failure without assertion diagnostic

Variants: **30304**; distinct files: **15945**; recorded wall time: **10325.4s**.

Top test families:

- `built-ins/Array/prototype`: 3423
- `built-ins/TypedArray/prototype`: 2008
- `built-ins/String/prototype`: 1162
- `built-ins/Object/defineProperty`: 915
- `built-ins/DataView/prototype`: 756
- `built-ins/Date/prototype`: 586
- `built-ins/Temporal/PlainDateTime`: 552
- `language/statements/function`: 508

Examples:

- `annexB/built-ins/Date/prototype/getYear/B.2.4.js [default]`
- `annexB/built-ins/Date/prototype/getYear/length.js [default]`
- `annexB/built-ins/Date/prototype/getYear/name.js [default]`

### frontend diagnostic code 1001

Variants: **12202**; distinct files: **6186**; recorded wall time: **180.2s**.

Top test families:

- `language/statements/for-of`: 1057
- `built-ins/RegExp/property-escapes`: 900
- `intl402/Temporal/ZonedDateTime`: 806
- `intl402/Temporal/PlainDate`: 754
- `intl402/Temporal/PlainDateTime`: 744
- `built-ins/Temporal/PlainDateTime`: 660
- `built-ins/Temporal/ZonedDateTime`: 560
- `built-ins/Temporal/PlainDate`: 536

Examples:

- `built-ins/Object/defineProperty/15.2.3.6-3-171-1.js [default]`
- `built-ins/Object/defineProperty/15.2.3.6-4-195.js [default]`
- `built-ins/Object/defineProperty/15.2.3.6-4-38.js [default]`

### Frontend unsupported expression syntax [bridge 0]

Variants: **8707**; distinct files: **4383**; recorded wall time: **370.7s**.

Top test families:

- `language/expressions/class`: 4663
- `built-ins/Temporal/ZonedDateTime`: 588
- `language/expressions/dynamic-import`: 362
- `built-ins/Temporal/Instant`: 336
- `language/statements/class`: 254
- `built-ins/Iterator/prototype`: 226
- `language/expressions/assignment`: 215
- `intl402/Temporal/ZonedDateTime`: 136

Examples:

- `built-ins/Array/from/iter-set-elem-prop-non-writable.js [default]`
- `built-ins/Array/prototype/flatMap/this-value-ctor-object-species-custom-ctor.js [default]`
- `language/expressions/assignment/dstr/obj-id-init-fn-name-class.js [default]`

### selection diagnostic code 1

Variants: **6360**; distinct files: **3303**; recorded wall time: **1983.6s**.

Top test families:

- `built-ins/Array/prototype`: 661
- `built-ins/Object/defineProperty`: 615
- `built-ins/Object/defineProperties`: 514
- `built-ins/Date/prototype`: 246
- `built-ins/String/prototype`: 178
- `built-ins/Temporal/ZonedDateTime`: 144
- `built-ins/Temporal/PlainDateTime`: 120
- `built-ins/Temporal/PlainDate`: 114

Examples:

- `built-ins/AggregateError/message-method-prop.js [default]`
- `annexB/built-ins/String/prototype/link/length.js [default]`
- `annexB/built-ins/String/prototype/sup/name.js [default]`

### Frontend unsupported statement syntax [bridge 0]

Variants: **6223**; distinct files: **3128**; recorded wall time: **289.3s**.

Top test families:

- `language/statements/class`: 4974
- `built-ins/Iterator/prototype`: 268
- `language/expressions/super`: 128
- `staging/sm/class`: 97
- `staging/sm/Iterator`: 92
- `language/expressions/compound-assignment`: 88
- `language/computed-property-names/class`: 58
- `built-ins/Set/prototype`: 32

Examples:

- `language/statements/class/dstr/gen-meth-obj-ptrn-rest-getter.js [default]`
- `language/statements/class/definition/fn-name-accessor-set.js [default]`
- `language/statements/class/dstr/meth-static-dflt-obj-ptrn-rest-skip-non-enumerable.js [default]`

### Policy gap: async-completion

Variants: **5523**; distinct files: **5523**; recorded wall time: **0.0s**.

Top test families:

- `language/statements/for-await-of`: 1140
- `language/statements/class`: 1040
- `language/expressions/class`: 1038
- `language/expressions/async-generator`: 421
- `language/expressions/dynamic-import`: 391
- `language/expressions/object`: 223
- `language/statements/async-generator`: 211
- `built-ins/Array/fromAsync`: 90

Examples:

- `annexB/language/statements/for-await-of/iterator-close-return-emulates-undefined-throws-when-called.js [policy]`
- `built-ins/Array/fromAsync/async-iterable-async-mapped-awaits-once.js [policy]`
- `built-ins/Array/fromAsync/async-iterable-input-does-not-await-input.js [policy]`

### Frontend unsupported object literal element syntax [bridge 0]

Variants: **4786**; distinct files: **2487**; recorded wall time: **173.0s**.

Top test families:

- `language/expressions/object`: 1143
- `built-ins/Temporal/ZonedDateTime`: 158
- `built-ins/Iterator/prototype`: 146
- `built-ins/Temporal/Duration`: 146
- `intl402/Temporal/ZonedDateTime`: 140
- `intl402/Temporal/PlainDate`: 136
- `built-ins/Array/prototype`: 132
- `intl402/Temporal/PlainDateTime`: 128

Examples:

- `built-ins/AggregateError/message-method-prop-cast.js [default]`
- `built-ins/AggregateError/cause-property.js [default]`
- `built-ins/Promise/allSettled/resolve-element-function-name.js [default]`

### Policy gap: negative-parse-phase

Variants: **4453**; distinct files: **4453**; recorded wall time: **0.0s**.

Top test families:

- `language/statements/class`: 653
- `language/expressions/class`: 609
- `language/expressions/dynamic-import`: 376
- `language/expressions/assignmenttargettype`: 310
- `language/literals/regexp`: 186
- `built-ins/RegExp/property-escapes`: 163
- `language/expressions/object`: 163
- `language/block-scope/syntax`: 102

Examples:

- `annexB/language/expressions/template-literal/legacy-octal-escape-sequence-strict.js [policy]`
- `annexB/language/statements/for-in/bare-initializer.js [policy]`
- `annexB/language/statements/for-in/const-initializer.js [policy]`

### Frontend unsupported method receiver syntax [bridge 214]

Variants: **1066**; distinct files: **535**; recorded wall time: **34.5s**.

Top test families:

- `built-ins/String/prototype`: 186
- `built-ins/Temporal/ZonedDateTime`: 76
- `built-ins/TypedArray/prototype`: 64
- `built-ins/Date/prototype`: 58
- `built-ins/Temporal/PlainDateTime`: 58
- `built-ins/DataView/prototype`: 48
- `built-ins/Temporal/PlainDate`: 46
- `built-ins/Number/prototype`: 42

Examples:

- `built-ins/Boolean/symbol-coercion.js [default]`
- `built-ins/Function/prototype/call/S15.3.4.4_A5_T3.js [default]`
- `built-ins/Number/prototype/toPrecision/infinity.js [default]`

### Native execution: SIGSEGV

Variants: **919**; distinct files: **576**; recorded wall time: **90.4s**.

Top test families:

- `language/eval-code/direct`: 109
- `staging/sm/strict`: 68
- `built-ins/Object/getOwnPropertyDescriptor`: 54
- `built-ins/Array/prototype`: 39
- `built-ins/Object/defineProperty`: 26
- `staging/sm/Date`: 22
- `built-ins/Math/min`: 18
- `built-ins/Math/max`: 17

Examples:

- `annexB/built-ins/escape/prop-desc.js [default]`
- `built-ins/AggregateError/prop-desc.js [default]`
- `built-ins/Array/prop-desc.js [default]`

### Frontend unsupported array element syntax [bridge 0]

Variants: **913**; distinct files: **457**; recorded wall time: **57.0s**.

Top test families:

- `built-ins/TypedArray/prototype`: 436
- `built-ins/TypedArrayConstructors/internals`: 102
- `built-ins/Set/prototype`: 70
- `language/expressions/array`: 44
- `staging/sm/TypedArray`: 42
- `built-ins/Temporal/PlainDateTime`: 28
- `built-ins/Temporal/PlainYearMonth`: 26
- `built-ins/Temporal/PlainTime`: 20

Examples:

- `annexB/built-ins/String/prototype/substr/start-and-length-as-numbers.js [default]`
- `built-ins/AsyncIteratorPrototype/Symbol.asyncIterator/return-val.js [default]`
- `built-ins/Iterator/prototype/Symbol.iterator/return-val.js [default]`

### Policy gap: module-variant

Variants: **843**; distinct files: **843**; recorded wall time: **0.0s**.

Top test families:

- `language/module-code/top-level-await`: 249
- `language/import/import-defer`: 97
- `language/expressions/dynamic-import`: 38
- `language/module-code/namespace`: 38
- `language/expressions/import.meta`: 17
- `language/import/import-attributes`: 17
- `language/module-code/import-attributes`: 13
- `language/module-code/ambiguous-export-bindings`: 10

Examples:

- `built-ins/AbstractModuleSource/length.js [policy]`
- `built-ins/AbstractModuleSource/name.js [policy]`
- `built-ins/AbstractModuleSource/proto.js [policy]`

### graph corruption: jsl argument 0 is NO-NODE

Variants: **508**; distinct files: **304**; recorded wall time: **20.1s**.

Top test families:

- `language/statements/with`: 44
- `built-ins/Array/prototype`: 38
- `built-ins/Object/defineProperties`: 34
- `built-ins/Object/defineProperty`: 30
- `built-ins/Object/create`: 28
- `language/eval-code/direct`: 24
- `built-ins/JSON/rawJSON`: 18
- `language/expressions/compound-assignment`: 11

Examples:

- `built-ins/JSON/Symbol.toStringTag.js [default]`
- `built-ins/JSON/isRawJSON/length.js [default]`
- `built-ins/JSON/isRawJSON/name.js [default]`

### Frontend unsupported expression syntax [bridge 242]

Variants: **497**; distinct files: **258**; recorded wall time: **16.8s**.

Top test families:

- `language/statements/for`: 461
- `language/statements/continue`: 14
- `annexB/language/function-code`: 8
- `annexB/language/global-code`: 8
- `staging/decorators/accessor-as-identifier.js`: 2
- `staging/sm/regress`: 2
- `language/statements/variable`: 2

Examples:

- `language/statements/for/dstr/var-obj-ptrn-rest-skip-non-enumerable.js [default]`
- `language/statements/for/dstr/var-obj-ptrn-rest-val-obj.js [default]`
- `language/statements/for/dstr/const-obj-ptrn-rest-skip-non-enumerable.js [default]`

### Policy gap: $262-host-object

Variants: **431**; distinct files: **431**; recorded wall time: **0.0s**.

Top test families:

- `built-ins/Atomics/wait`: 43
- `staging/sm/TypedArray`: 31
- `annexB/language/expressions`: 17
- `annexB/language/global-code`: 17
- `built-ins/Atomics/notify`: 16
- `staging/sm/Iterator`: 14
- `built-ins/TypedArrayConstructors/internals`: 12
- `built-ins/Proxy/construct`: 11

Examples:

- `annexB/built-ins/Array/from/iterator-method-emulates-undefined.js [policy]`
- `annexB/built-ins/Object/is/emulates-undefined.js [policy]`
- `annexB/built-ins/RegExp/legacy-accessors/index/this-cross-realm-constructor.js [policy]`

### frontend diagnostic code 1002

Variants: **428**; distinct files: **224**; recorded wall time: **5.8s**.

Top test families:

- `language/expressions/logical-assignment`: 114
- `language/expressions/exponentiation`: 72
- `built-ins/Array/prototype`: 50
- `language/expressions/class`: 40
- `language/statements/class`: 40
- `built-ins/Temporal/ZonedDateTime`: 24
- `built-ins/Temporal/Duration`: 20
- `language/expressions/object`: 10

Examples:

- `built-ins/Array/prototype/pop/length-near-integer-limit.js [default]`
- `built-ins/Array/prototype/push/clamps-to-integer-limit.js [default]`
- `built-ins/Array/prototype/push/length-near-integer-limit.js [default]`

### selection diagnostic code 2

Variants: **234**; distinct files: **129**; recorded wall time: **13.0s**.

Top test families:

- `built-ins/String/prototype`: 36
- `built-ins/Array/prototype`: 26
- `built-ins/JSON/stringify`: 18
- `staging/sm/JSON`: 16
- `built-ins/String/fromCharCode`: 16
- `language/expressions/compound-assignment`: 14
- `annexB/language/global-code`: 8
- `language/statements/for-in`: 6

Examples:

- `built-ins/Array/prototype/concat/15.4.4.4-5-c-i-1.js [default]`
- `built-ins/JSON/stringify/replacer-function-wrapper.js [default]`
- `built-ins/Array/prototype/concat/15.4.4.4-5-c-i-1.js [strict]`

### Frontend unsupported expression syntax [bridge -1]

Variants: **231**; distinct files: **121**; recorded wall time: **7.6s**.

Top test families:

- `language/expressions/assignment`: 119
- `built-ins/Array/prototype`: 46
- `built-ins/Function/prototype`: 12
- `built-ins/RegExp/prototype`: 6
- `built-ins/Proxy/apply`: 4
- `built-ins/Iterator/prototype`: 4
- `built-ins/String/prototype`: 4
- `language/statements/break`: 4

Examples:

- `language/expressions/assignment/fn-name-lhs-cover.js [default]`
- `language/expressions/assignment/dstr/array-elem-init-fn-name-arrow.js [default]`
- `language/expressions/assignment/fn-name-lhs-cover.js [strict]`

### Frontend unsupported expression syntax [bridge 303]

Variants: **146**; distinct files: **99**; recorded wall time: **6.3s**.

Top test families:

- `language/expressions/assignment`: 144
- `staging/sm/extensions`: 2

Examples:

- `language/expressions/assignment/dstr/obj-prop-elem-init-fn-name-gen.js [default]`
- `language/expressions/assignment/dstr/obj-rest-non-string-computed-property-string-1.js [default]`
- `language/expressions/assignment/dstr/obj-rest-computed-property-no-strict.js [default]`

### frontend diagnostic code 1007

Variants: **126**; distinct files: **63**; recorded wall time: **1.3s**.

Top test families:

- `staging/sm/Math`: 24
- `built-ins/Math/hypot`: 16
- `built-ins/Math/atan2`: 14
- `built-ins/Math/clz32`: 12
- `built-ins/Math/sumPrecise`: 12
- `built-ins/Math/fround`: 10
- `built-ins/Math/acosh`: 6
- `built-ins/Object/defineProperty`: 4

Examples:

- `built-ins/Math/acosh/nan-returns.js [default]`
- `built-ins/Math/atan2/S15.8.2.5_A9.js [default]`
- `built-ins/Math/atanh/atanh-specialVals.js [default]`

### Frontend unsupported statement syntax [bridge 255]

Variants: **122**; distinct files: **122**; recorded wall time: **3.4s**.

Top test families:

- `language/statements/with`: 38
- `language/expressions/dynamic-import`: 18
- `language/statements/function`: 11
- `staging/sm/lexical-environment`: 10
- `built-ins/Proxy/has`: 9
- `staging/sm/regress`: 5
- `language/expressions/assignment`: 5
- `language/expressions/arrow-function`: 3

Examples:

- `built-ins/Proxy/has/trap-is-undefined-using-with.js [default]`
- `built-ins/Proxy/has/call-with.js [default]`
- `built-ins/Proxy/has/return-false-target-prop-exists-using-with.js [default]`

### graph corruption: n-kill!: node is pinned

Variants: **94**; distinct files: **47**; recorded wall time: **3.1s**.

Top test families:

- `built-ins/Error/prototype`: 8
- `built-ins/ArrayBuffer/prototype`: 6
- `language/block-scope/leave`: 2
- `language/statements/continue`: 2
- `language/asi/S7.9_A1.js`: 2
- `staging/sm/Function`: 2
- `built-ins/decodeURI/S15.1.3.1_A1.13_T1.js`: 2
- `built-ins/decodeURI/S15.1.3.1_A1.15_T3.js`: 2

Examples:

- `language/block-scope/leave/for-loop-block-let-declaration-only-shadows-outer-parameter-value-2.js [default]`
- `language/statements/continue/12.7-1.js [default]`
- `language/block-scope/leave/for-loop-block-let-declaration-only-shadows-outer-parameter-value-2.js [strict]`

### Frontend unsupported statement syntax [bridge 227]

Variants: **63**; distinct files: **33**; recorded wall time: **1.8s**.

Top test families:

- `language/statements/for`: 15
- `built-ins/String/prototype`: 8
- `intl402/String/prototype`: 6
- `language/expressions/class`: 4
- `built-ins/TypedArrayConstructors/internals`: 4
- `built-ins/Array/S15.4_A1.1_T10.js`: 2
- `built-ins/Math/round`: 2
- `built-ins/Object/keys`: 2

Examples:

- `built-ins/Array/S15.4_A1.1_T10.js [default]`
- `built-ins/Math/round/S15.8.2.15_A6.js [default]`
- `built-ins/Object/keys/15.2.3.14-5-13.js [default]`

### frontend diagnostic code 0

Variants: **58**; distinct files: **36**; recorded wall time: **0.9s**.

Top test families:

- `language/comments/hashbang`: 5
- `language/expressions/class`: 4
- `language/statements/class`: 4
- `language/literals/string`: 3
- `language/literals/numeric`: 2
- `language/statements/for-of`: 2
- `language/identifiers/part-unicode-16.0.0.js`: 2
- `language/identifiers/part-unicode-17.0.0-class-escaped.js`: 2

Examples:

- `annexB/language/expressions/template-literal/legacy-octal-escape-sequence-non-strict.js [default]`
- `language/literals/numeric/legacy-octal-integer.js [default]`
- `language/literals/numeric/non-octal-decimal-integer.js [default]`

### graph corruption: jsl argument 2+ is NO-NODE

Variants: **53**; distinct files: **27**; recorded wall time: **1.7s**.

Top test families:

- `language/expressions/arrow-function`: 8
- `language/expressions/function`: 8
- `language/expressions/generators`: 8
- `language/statements/function`: 8
- `language/statements/generators`: 8
- `language/expressions/async-generator`: 4
- `staging/sm/Function`: 3
- `language/statements/async-generator`: 2

Examples:

- `language/expressions/arrow-function/dstr/dflt-ary-ptrn-elem-id-init-undef.js [default]`
- `language/expressions/function/dstr/dflt-ary-ptrn-elem-id-init-undef.js [default]`
- `language/expressions/generators/dstr/dflt-ary-ptrn-elem-id-init-undef.js [default]`

### Native execution: TIMEOUT

Variants: **47**; distinct files: **25**; recorded wall time: **1412.0s**.

Top test families:

- `built-ins/Array/prototype`: 16
- `language/expressions/unsigned-right-shift`: 8
- `language/expressions/left-shift`: 7
- `language/expressions/right-shift`: 7
- `built-ins/TypedArray/prototype`: 5
- `staging/sm/String`: 4

Examples:

- `staging/sm/String/string-code-point-upper-lower-mapping.js [default]`
- `built-ins/Array/prototype/sort/stability-2048-elements.js [default]`
- `staging/sm/String/string-code-point-upper-lower-mapping.js [strict]`

### Native execution: SIGBUS

Variants: **45**; distinct files: **44**; recorded wall time: **8.0s**.

Top test families:

- `language/expressions/compound-assignment`: 6
- `staging/sm/strict`: 3
- `built-ins/Math/abs`: 2
- `built-ins/Math/log`: 2
- `built-ins/Math/sin`: 2
- `built-ins/Math/random`: 2
- `built-ins/ArrayBuffer/prop-desc.js`: 1
- `built-ins/Math/floor`: 1

Examples:

- `built-ins/ArrayBuffer/prop-desc.js [default]`
- `built-ins/Math/abs/name.js [default]`
- `built-ins/Math/abs/prop-desc.js [default]`

### graph corruption: declaration initializer evaluated to NO-NODE

Variants: **40**; distinct files: **29**; recorded wall time: **1.2s**.

Top test families:

- `built-ins/String/prototype`: 4
- `built-ins/TypedArray/prototype`: 4
- `language/expressions/assignment`: 3
- `built-ins/Array/prototype`: 2
- `built-ins/JSON/15.12-0-1.js`: 2
- `built-ins/JSON/15.12-0-4.js`: 2
- `built-ins/Object/getOwnPropertyDescriptor`: 2
- `language/statements/try`: 2

Examples:

- `built-ins/Array/prototype/reduceRight/15.4.4.22-9-c-ii-37.js [default]`
- `built-ins/JSON/15.12-0-1.js [default]`
- `built-ins/JSON/15.12-0-4.js [default]`

### Policy gap: negative-runtime-phase

Variants: **32**; distinct files: **32**; recorded wall time: **0.0s**.

Top test families:

- `annexB/language/comments`: 8
- `language/statements/switch`: 6
- `language/eval-code/direct`: 2
- `language/statements/const`: 2
- `language/statements/let`: 2
- `language/statements/using`: 2
- `language/eval-code/indirect`: 1
- `language/global-code/decl-lex-restricted-global.js`: 1

Examples:

- `annexB/language/comments/multi-line-html-close.js [policy]`
- `annexB/language/comments/single-line-html-close-asi.js [policy]`
- `annexB/language/comments/single-line-html-close-first-line-1.js [policy]`

### graph corruption: n-in: input index out of range

Variants: **26**; distinct files: **13**; recorded wall time: **0.7s**.

Top test families:

- `language/statements/do-while`: 10
- `intl402/Temporal/ZonedDateTime`: 4
- `language/asi/do-while-same-line.js`: 2
- `language/statements/break`: 2
- `built-ins/String/S15.5.1.1_A1_T3.js`: 2
- `built-ins/String/S15.5.1.1_A2_T1.js`: 2
- `built-ins/String/S15.5.1.1_A1_T11.js`: 2
- `built-ins/String/S15.5.1.1_A1_T12.js`: 2

Examples:

- `intl402/Temporal/ZonedDateTime/prototype/add/offset-before-1883.js [default]`
- `intl402/Temporal/ZonedDateTime/prototype/subtract/offset-before-1883.js [default]`
- `language/asi/do-while-same-line.js [default]`

### Frontend unsupported statement syntax [bridge 96]

Variants: **18**; distinct files: **10**; recorded wall time: **0.4s**.

Top test families:

- `language/asi/S7.9_A6.1_T6.js`: 2
- `language/asi/S7.9_A6.1_T7.js`: 2
- `language/asi/S7.9_A6.1_T10.js`: 2
- `language/asi/S7.9_A6.1_T11.js`: 2
- `language/asi/S7.9_A6.1_T8.js`: 2
- `language/asi/S7.9_A6.1_T12.js`: 2
- `language/asi/S7.9_A6.1_T9.js`: 2
- `language/asi/S7.9_A6.1_T13.js`: 2

Examples:

- `language/asi/S7.9_A6.1_T6.js [default]`
- `language/asi/S7.9_A6.1_T7.js [default]`
- `language/asi/S7.9_A6.1_T10.js [default]`

### graph corruption: configurable

Variants: **12**; distinct files: **6**; recorded wall time: **0.3s**.

Top test families:

- `built-ins/Object/create`: 4
- `built-ins/Object/defineProperties`: 4
- `built-ins/Object/defineProperty`: 4

Examples:

- `built-ins/Object/create/15.2.3.5-4-142.js [default]`
- `built-ins/Object/create/15.2.3.5-4-145.js [default]`
- `built-ins/Object/defineProperties/15.2.3.7-5-b-105.js [default]`

### graph corruption: writable

Variants: **12**; distinct files: **6**; recorded wall time: **0.3s**.

Top test families:

- `built-ins/Object/create`: 4
- `built-ins/Object/defineProperties`: 4
- `built-ins/Object/defineProperty`: 4

Examples:

- `built-ins/Object/create/15.2.3.5-4-224.js [default]`
- `built-ins/Object/create/15.2.3.5-4-221.js [default]`
- `built-ins/Object/defineProperties/15.2.3.7-5-b-184.js [default]`

### Frontend unsupported statement syntax [bridge 214]

Variants: **12**; distinct files: **6**; recorded wall time: **0.2s**.

Top test families:

- `language/statements/for`: 12

Examples:

- `language/statements/for/S12.6.3_A2.1.js [default]`
- `language/statements/for/S12.6.3_A2.2.js [default]`
- `language/statements/for/S12.6.3_A2.js [default]`

### graph corruption: enumerable

Variants: **12**; distinct files: **6**; recorded wall time: **0.2s**.

Top test families:

- `built-ins/Object/create`: 4
- `built-ins/Object/defineProperties`: 4
- `built-ins/Object/defineProperty`: 4

Examples:

- `built-ins/Object/create/15.2.3.5-4-89.js [default]`
- `built-ins/Object/create/15.2.3.5-4-92.js [default]`
- `built-ins/Object/defineProperties/15.2.3.7-5-b-49.js [default]`

### graph corruption: a.constructor[Symbol.species] = parseInt

Variants: **10**; distinct files: **5**; recorded wall time: **0.3s**.

Top test families:

- `built-ins/Array/prototype`: 10

Examples:

- `built-ins/Array/prototype/filter/create-species-non-ctor.js [default]`
- `built-ins/Array/prototype/map/create-species-non-ctor.js [default]`
- `built-ins/Array/prototype/slice/create-species-non-ctor.js [default]`

### graph corruption: w

Variants: **10**; distinct files: **5**; recorded wall time: **0.2s**.

Top test families:

- `language/expressions/arrow-function`: 2
- `language/expressions/function`: 2
- `language/expressions/generators`: 2
- `language/statements/function`: 2
- `language/statements/generators`: 2

Examples:

- `language/expressions/arrow-function/dstr/dflt-obj-ptrn-prop-obj-init.js [default]`
- `language/expressions/function/dstr/dflt-obj-ptrn-prop-obj-init.js [default]`
- `language/expressions/generators/dstr/dflt-obj-ptrn-prop-obj-init.js [default]`

### graph corruption: x

Variants: **10**; distinct files: **5**; recorded wall time: **0.3s**.

Top test families:

- `language/expressions/arrow-function`: 2
- `language/expressions/function`: 2
- `language/expressions/generators`: 2
- `language/statements/function`: 2
- `language/statements/generators`: 2

Examples:

- `language/expressions/arrow-function/dstr/dflt-obj-ptrn-prop-obj.js [default]`
- `language/expressions/function/dstr/dflt-obj-ptrn-prop-obj.js [default]`
- `language/expressions/generators/dstr/dflt-obj-ptrn-prop-obj.js [default]`

### graph corruption: args = arguments

Variants: **8**; distinct files: **8**; recorded wall time: **0.2s**.

Top test families:

- `language/expressions/function`: 2
- `language/expressions/generators`: 2
- `language/statements/function`: 2
- `language/statements/generators`: 2

Examples:

- `language/expressions/function/arguments-with-arguments-fn.js [default]`
- `language/expressions/function/arguments-with-arguments-lex.js [default]`
- `language/expressions/generators/arguments-with-arguments-fn.js [default]`

### graph corruption: fromParam = await

Variants: **4**; distinct files: **2**; recorded wall time: **0.1s**.

Top test families:

- `language/expressions/function`: 2
- `language/expressions/generators`: 2

Examples:

- `language/expressions/function/static-init-await-reference.js [default]`
- `language/expressions/generators/static-init-await-reference.js [default]`
- `language/expressions/function/static-init-await-reference.js [strict]`

### Frontend unsupported statement syntax [bridge 220]

Variants: **4**; distinct files: **2**; recorded wall time: **0.1s**.

Top test families:

- `language/statements/for`: 2
- `staging/sm/statements`: 2

Examples:

- `language/statements/for/head-init-async-of.js [default]`
- `language/statements/for/head-init-async-of.js [strict]`
- `staging/sm/statements/arrow-function-at-end-of-for-statement-head.js [default]`

### Frontend unsupported expression syntax [bridge 253]

Variants: **4**; distinct files: **2**; recorded wall time: **0.1s**.

Top test families:

- `staging/sm/lexical-environment`: 2
- `language/statements/using`: 2

Examples:

- `staging/sm/lexical-environment/for-loop.js [default]`
- `staging/sm/lexical-environment/for-loop.js [strict]`
- `language/statements/using/syntax/using-for-statement.js [default]`

### graph corruption: index0=index0

Variants: **3**; distinct files: **2**; recorded wall time: **0.1s**.

Top test families:

- `language/statements/for`: 3

Examples:

- `language/statements/for/S12.6.3_A10.1_T1.js [default]`
- `language/statements/for/S12.6.3_A10.1_T2.js [default]`
- `language/statements/for/S12.6.3_A10.1_T2.js [strict]`

### graph corruption: Number.prototype[1] = isNaN

Variants: **2**; distinct files: **1**; recorded wall time: **0.0s**.

Top test families:

- `built-ins/Array/prototype`: 2

Examples:

- `built-ins/Array/prototype/lastIndexOf/15.4.4.15-1-5.js [default]`
- `built-ins/Array/prototype/lastIndexOf/15.4.4.15-1-5.js [strict]`

### Frontend unsupported statement syntax [bridge 224]

Variants: **2**; distinct files: **1**; recorded wall time: **0.1s**.

Top test families:

- `language/expressions/conditional`: 2

Examples:

- `language/expressions/conditional/in-branch-1.js [default]`
- `language/expressions/conditional/in-branch-1.js [strict]`

### graph corruption: toString

Variants: **2**; distinct files: **1**; recorded wall time: **0.1s**.

Top test families:

- `staging/sm/object`: 2

Examples:

- `staging/sm/object/toLocaleString.js [default]`
- `staging/sm/object/toLocaleString.js [strict]`

### selection diagnostic code 5

Variants: **2**; distinct files: **1**; recorded wall time: **0.1s**.

Top test families:

- `built-ins/String/prototype`: 2

Examples:

- `built-ins/String/prototype/concat/S15.5.4.6_A2.js [default]`
- `built-ins/String/prototype/concat/S15.5.4.6_A2.js [strict]`

### Frontend unsupported instanceof right-operand syntax [bridge 79]

Variants: **2**; distinct files: **1**; recorded wall time: **0.1s**.

Top test families:

- `language/expressions/instanceof`: 2

Examples:

- `language/expressions/instanceof/S11.8.6_A6_T2.js [default]`
- `language/expressions/instanceof/S11.8.6_A6_T2.js [strict]`

### graph corruption: index = index

Variants: **2**; distinct files: **1**; recorded wall time: **0.0s**.

Top test families:

- `language/statements/for`: 2

Examples:

- `language/statements/for/S12.6.3_A13.js [default]`
- `language/statements/for/S12.6.3_A13.js [strict]`

### graph corruption: x=x

Variants: **2**; distinct files: **1**; recorded wall time: **0.0s**.

Top test families:

- `language/statements/function`: 2

Examples:

- `language/statements/function/S13.2.1_A7_T4.js [default]`
- `language/statements/function/S13.2.1_A7_T4.js [strict]`

### graph corruption: get

Variants: **2**; distinct files: **1**; recorded wall time: **0.0s**.

Top test families:

- `staging/sm/regress`: 2

Examples:

- `staging/sm/regress/regress-596805-2.js [default]`
- `staging/sm/regress/regress-596805-2.js [strict]`

### Frontend unsupported expression syntax [bridge 252]

Variants: **2**; distinct files: **1**; recorded wall time: **0.0s**.

Top test families:

- `staging/sm/lexical-environment`: 2

Examples:

- `staging/sm/lexical-environment/const-declaration-in-for-loop.js [default]`
- `staging/sm/lexical-environment/const-declaration-in-for-loop.js [strict]`

### graph corruption: g-fold-proven!: folding did not converge

Variants: **2**; distinct files: **2**; recorded wall time: **38.0s**.

Top test families:

- `language/expressions/left-shift`: 1
- `language/expressions/right-shift`: 1

Examples:

- `language/expressions/left-shift/S11.7.1_A4_T4.js [strict]`
- `language/expressions/right-shift/S11.7.2_A4_T4.js [strict]`

### graph corruption: Function.prototype.caller = fn

Variants: **2**; distinct files: **1**; recorded wall time: **0.1s**.

Top test families:

- `built-ins/Function/prototype`: 2

Examples:

- `built-ins/Function/prototype/caller/prop-desc.js [default]`
- `built-ins/Function/prototype/caller/prop-desc.js [strict]`

## Diagnostic gaps that block root-cause classification

- `RUNTIME-FAILED` identifies 30,304 incorrect executions but records no assertion, expected value, actual value, or failing operation. These must be subdivided before semantic fixes can be prioritized honestly.
- Historical selection records retain code/node/machine coordinates but not the following machine and ideal-node diagnostic lines. The runner now preserves those lines for new targeted runs.
- Frontend diagnostic code 1001 retains the rejected source fragment, but the numeric code combines multiple unsupported syntax families. The evidence section and test-family counts expose those families without pretending they are one implementation bug.

## Initial systematic order

1. Re-run the selection-failure files with current diagnostic retention, normalize by failing opcode/node shape, and pin one minimal regression per root cause.
2. Make runtime failures report the failing assertion and actual/expected values, then regenerate this inventory; do not attack the 30,304-record bucket as though it were one bug.
3. Fix graph-corruption groups before unsupported language features because they represent accepted programs violating compiler invariants.
4. Cluster `SIGSEGV` and `SIGBUS` by generated operation and backtrace, then promote each reproducible crash family to the frontier.
5. Treat frontend bridge gaps and protocol skips as feature projects, ordered by distinct files unlocked rather than raw variant count.
