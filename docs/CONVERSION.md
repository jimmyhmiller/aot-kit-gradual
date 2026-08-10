# What runs on the DSL, and what does not

**The checklist is [STATUS.md](STATUS.md), which is generated and gate-checked.** Go there for
"is X done". This file is the reasoning behind the rows — why an operation is written the way it is,
what it cost, and what it broke on the way — which is the part a generator cannot produce.


## String.prototype

| Operation | Status | Definition |
|---|---|---|
| `charAt` | **converted** | `StringCharAt` |
| `charCodeAt` | **converted** | `StringCharCodeAt` |
| `indexOf` | **converted** | `StringIndexOfFrom` |
| `slice` | **converted** | `StringSlice` |
| `substring` | **converted** | `StringSubstring` |
| `substr` | **converted** | `StringSubstr` |
| `toLowerCase` | **converted** | `StringToLowerCase` |
| `toUpperCase` | **converted** | `StringToUpperCase` |
| `split` | **converted** | `StringSplit`, `StringSplitWhole` |
| `.length` | **converted** | `StringLength` |
| `startsWith` | **converted** | `StringStartsWith` |
| `endsWith` | **converted** | `StringEndsWith` |
| `includes` | **converted** | `StringIncludesFrom` |
| `lastIndexOf` | **converted** | `StringLastIndexOf` |
| `padStart` | **converted** | `StringPadStart` |
| `padEnd` | **converted** | `StringPadEnd` |
| `repeat` | **converted** | `StringRepeatCount` |
| `replaceAll` | **converted** | `StringReplaceAll` |
| `trim` | **converted** | `StringTrim` |
| `trimStart` | **converted** | `StringTrimStart` |
| `trimEnd` | **converted** | `StringTrimEnd` |
| `at` | **converted** | `StringAt` |

The last twelve rows were written, spec-annotated and Node-verified for months while
`fng-string-builtin?` listed nine method names and none of these were among them, so no program
could call any of them. They are covered by `string-methods.ts` and `string-transforms.ts`.

`fng-string-builtin-arity?` carries each name's supported argument counts and REFUSES the rest:
`lastIndexOf(needle, from)` is a frontend diagnostic rather than a compile with the `fromIndex`
dropped, because `StringLastIndexOf` has no way to honour it and a silently ignored argument is a
wrong answer.

`split` was the largest open item and the last hand-written IR node in the frontend with JavaScript
semantics in it. What made it look blocked was the allocation — the hand-written path built its own
`New`, marked it an array and published a dynamic alias — and the library has had that since
`ArraySlice`: `%NewArray` lowers through `n-array-mark!` on a real control anchor, and
`fng-jsl-call` publishes the alias for any definition `jsl-name-uses-memory?` reports, before the
body is built rather than after.

**Two definitions, chosen by argument count.** `"abc".split()` is `["abc"]` and `"abc".split("")` is
`["a","b","c"]`, and no separator VALUE distinguishes them — comparing against `undefined` would
compare a raw string pointer against a tagged word. Passing the count in as an `int` parameter
compiles for every case but that one, where the literal 0 folds the library's mode arithmetic during
construction and leaves a Region and its Phi disagreeing.

**One loop and one store, and that shape is forced.** Written the readable way — a branch per case,
each arm allocating and writing — it does not compile: a merge whose two arms both wrote the heap
leaves a memory Phi that never gets a computed type, and selection refuses it with
`MSEL-UNSUPPORTED` on a `Phi` still carrying ANY. Every other heap-touching definition happens to
write on only one arm of any branch it contains, so nothing had exercised it.

## Array.prototype

| Operation | Status | Definition |
|---|---|---|
| `indexOf` | **converted** | `ArrayIndexOfFrom` |
| `includes` | **converted** | `ArrayIncludes` |
| `lastIndexOf` | **converted** | `ArrayLastIndexOf` |
| `push` | **converted** | `ArrayPush1`, `ArrayLength` |
| `pop` | **converted** | `ArrayPop` |
| `shift` | **converted** | `ArrayShift` |
| `slice` | **converted** | `ArraySlice` |
| `at` | **converted** | `ArrayAt` |
| `join` | **converted** | `ArrayJoin` |

Every converted entry is a `macro`, and it has to be, for the reason `lib/array/read.jsl` states: memory
reaches a function as an `OP-ARG` and never as a parameter, so a called `builtin` synthesises its own
empty entry heap and answers `-1` for an element that is there. A macro is expanded into the caller's
graph and reads the caller's memory.

The mutating four are covered by `tests/native-conformance/array-mutation.ts`, which exists because
`arrays.ts` covers none of what they got wrong: it has no `shift` at all, no zero-argument `push()`,
and no empty receiver. Each of the four was falsified — twelve injected defects, every one of which
turns the conformance gate red.

**Three of them are better than what they replace, not merely relocated.**

- `pop` and `shift` now handle the EMPTY array. The hand-written `pop` resized a length-0 array to
  -1; the hand-written `shift` clamped the new length at 0 but still returned whatever the load of
  index 0 found. Spec step 3 is a CLAMP here rather than a branch — on an empty array the index is 0,
  a load past the end already reads `undefined`, and resizing to 0 changes nothing. Written the
  spec's own way, as `(if (%Le len 0) undefined ...)`, it is a Phi over `Const undefined` and a boxed
  load, and the representation seam does not carry that: `popped * 10 + values[0]` answered one low.
- `slice`'s bounds are `Clamp`, the same two lines `StringSlice` uses, where the frontend had
  `fng-slice-bound` — a third implementation of the negative-index rule that no test compared to the
  other two.

**Two costs, both stated rather than hidden.** `shift` moves the elements down in a LOOP where the
hand-written path emitted one bulk `OP-ARRAYCOPY`; JSL has no bulk-copy primitive and adding a
machine-surface op whose only caller is that line would be the wrong trade. And `push` keeps its
argument loop in the frontend, because that loop is over the SYNTAX — a variadic JSL signature would
have to be unrolled per call site anyway.

**What it took beyond the definitions.** `%ArrayResize`, whose third operand is an ORDERING value
rather than data, and three backend defects that had nothing to do with JSL and everything to do
with a shape nothing had compiled before — a heap write inside a loop whose length is read
afterwards. All three are written up in [JSL.md](JSL.md#three-backend-defects-the-mutating-entries-exposed):
global code motion ignoring a control anchor, the memory anti-dependency vector describing a
pre-placement schedule, and the closed-world function index being spent on macros. The last is the
one that made this look impossible: it surfaced as `MSEL-UNSUPPORTED` on `String.prototype.indexOf`,
a definition that uses none of the new entries.

**One defect found on the way, since fixed.** A single arithmetic expression of about twenty terms
mixing boxed array elements with unboxed lengths miscompiled, and the answer varied between runs of
the same binary while every underlying array runtime call was correct. The cause was not in the
arrays: `be-node-fp-value?` decided whether a `+` is integer or floating-point by a recursion
carrying eight units of fuel, and past eight it answered "no", so the two sides of one expression
disagreed about the register a value lived in. It is a marked walk now, with no bound. Chasing it
turned up two more defects in the same seam; all three are written up in
[JOURNAL.md](JOURNAL.md#the-representation-seam-three-miscompiles-a-depth-bound-was-hiding) and
covered by `tests/native-conformance/deep-arithmetic.ts` and `unstable-array-sum.ts`.
`array-mutation.ts` is one sum again.

## Math

| Operation | Status | Definition |
|---|---|---|
| `abs` | **converted** | `MathAbs` |
| `floor` | **converted** | `MathFloor` |
| `ceil` | **converted** | `MathCeil` |
| `round` | **converted** | `MathRound` |
| `max` | **converted** | `MathMax2` |
| `min` | **converted** | `MathMin2` |
| `sign` | **converted** | `MathSign` |
| `trunc` | **converted** | `MathTrunc` |
| `sqrt`, `pow`, `exp`, `log` | **not convertible** | — |
| `sin`, `cos`, `tan`, `asin`, `acos`, `atan` | **not convertible** | — |
| `random` | **not convertible** | — |

The bottom three rows are libm calls and a PRNG, not JavaScript semantics. There is no algorithm
for a DSL to express: `%FloorNum` lowers to the same `OP-JSBUILTIN` a hand-written `Math.floor`
emitted, and the library's contribution to `MathFloor` is the `if (%IsInt v)` guard around it, which
is real. For `sqrt` there would be no guard and no rule — only a different spelling of the same
call. Converting them would add a name and remove nothing.

## Globals and coercions

| Operation | Status | Definition |
|---|---|---|
| `String(x)` | **converted** | `ToStringValue` |
| `parseInt(s, radix)` | **converted** | `ParseIntValue` |
| `isNaN(x)` | **converted** | `GlobalIsNaN` |
| `String.fromCharCode(c)` | **converted** | `StringFromCharCode` |
| implicit ToString at `+` | **converted** | `ToStringValue` |
| `Number(x)` | **converted** | `ToNumberValue` |
| `Number.isNaN` | **converted** | `NumberIsNaN` |
| `Number.isFinite` | **converted** | `NumberIsFinite` |
| `Number.isInteger` | **converted** | `NumberIsInteger` |
| `Number.isSafeInteger` | **converted** | `NumberIsSafeInteger` |
| ToNumber at an arithmetic operand | **converted** | `ToNumberValue` |
| unary `+` | not supported by the frontend | — |

`GlobalIsNaN` is `%IsNaN`, which COERCES, and that is the whole difference from `Number.isNaN`:
`isNaN("12x")` is true because ToNumber of the argument is NaN, while `Number.isNaN("12x")` is
false because the argument is a string rather than the NaN value. Two operations, two definitions.

`Number` is a frontend intrinsic now, which is what those five rows took. Until it was, the
receiver had no resolution and a program naming `Number.isNaN` crashed the emitter; the four
definitions had been written and native-gate verified the whole time.

The predicates are UNBOXED at the seam. Each `builtin` ends in `%Box`, so it answers a tagged
boolean, and a tagged boolean used as a condition goes through the `JSSOP-VALUE-TRUTHY` runtime call
where the global `isNaN` beside it compares a raw machine word. One expression holding both failed
selection. `fng-number-static` unboxes to `t-bool` so every predicate has one representation.

`Number()` with no argument is `+0` rather than NaN, which is the one place it differs from
ToNumber of `undefined`.

## Operators

| Operation | Status | Definition |
|---|---|---|
| string `===` / `!==` | **converted** | `StringEquals` |
| string `<` `>` `<=` `>=` | **converted** | `StringCompare` |
| string `+` | **converted** | `StringConcat` |

All four relational operators are one `StringCompare` against zero, which is why there is one
definition rather than four. `===` is CONTENT equality: two separately allocated strings with the
same code units are equal, and an identity comparison would answer false for every row of
`tests/native-conformance/string-operators.ts`.

## Not operations at all

`n-string-const!`, `n-array-mark!`, `n-js-throw!` — graph construction and allocation bookkeeping,
with no JavaScript semantics to express.

`n-to-number!` also survives in two places, and it is NOT an unconverted `Number(x)`: it unboxes the
result of a JSL Math definition, which returns a boxed integer for an integer input where
`OP-JSBUILTIN` always returned a double. It is part of the seam, not an operation.

---

## Summary

| | count |
|---|---|
| Converted | 53 |
| Blocked on design | 0 |
| Not convertible | 11 (libm + `random`) |
| Written, and unreachable | 0 |

**Every operation the frontend can compile, and that a DSL can express, is converted, and there is
no longer a written definition a program cannot reach.** What is left is libm.

The count moved from 31 to 52 without a single new definition being written. Twenty of the
twenty-one were already in `lib/`; what they needed was a name in a recognizer, a dispatch arm and a
conformance program. The twenty-first is ToNumber at the arithmetic seam, which was a hand-written
`Unbox` doing the wrong thing rather than a missing definition.

The honest shape of it: **nothing is blocked by the DSL's expressiveness, and nothing is blocked on a
missing primitive any more.** The three things that ever genuinely blocked conversion — memory
crossing the seam, the cost of the abstraction, and the absence of `%ArrayResize` — are fixed, in
`jsl-inline!`, in `g-fold-proven!`, and in the primitive table respectively.
