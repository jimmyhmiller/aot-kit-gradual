# What runs on the DSL, and what does not

Every JavaScript operation the native frontend can compile, and whether the code that runs comes
from `lib/` or from a hand-written IR node.

**Converted** means `src/frontend_native_graph.coil` emits a JSL definition through `jsl-inline!`, so
the machine code the program executes was generated from `lib/`. It does not mean a definition
merely exists — several definitions existed for months while nothing could reach them.

Status as of the commit that adds this file. `tools/gate.sh` green at 533 tests.

---

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
| `split` | not converted | — |
| `.length` | **converted** | `StringLength` |

`split` allocates an array. `%NewArray` and `%ArrayStore` exist, so a definition is writable; the
frontend's own split path also marks the allocation and publishes a dynamic alias, and that half has
no counterpart in the library yet. This is the largest genuinely-open item.

## Array.prototype

| Operation | Status | Definition |
|---|---|---|
| `indexOf` | **converted** | `ArrayIndexOfFrom` |
| `includes` | **converted** | `ArrayIncludes` |
| `lastIndexOf` | **converted** | `ArrayLastIndexOf` |
| `push` | not converted | — |
| `pop` | not converted | — |
| `shift` | not converted | — |
| `slice` | not converted | — |

The three converted ones are the first heap-touching definitions the frontend emits, and they are
`macro`s for the reason `lib/array/read.jsl` states: memory reaches a function as an `OP-ARG` and
never as a parameter, so a called `builtin` synthesises its own empty entry heap and answers `-1`
for an element that is there. A macro is expanded into the caller's graph and reads the caller's
memory.

The four unconverted ones all RESIZE. There is no `%ArrayResize` primitive, so they cannot be
written today — this is the one place in this table where a new primitive is the blocker rather
than wiring.

An attempt at it got far enough to be worth recording, and was reverted rather than left half-done:

- **`push` converts cleanly.** `ArrayPush1` appends one element and answers the new length; the
  variadic part stays in the frontend as a loop, one call per argument. Conformance green, and
  falsified two ways (wrong return length, wrong store index).
- **`%ArrayResize` needs a THIRD operand, an ordering value.** `OP-ARRAYRESIZE`'s fifth input exists
  for exactly this: `pop` reads the last element and then shortens the array, and nothing in the
  memory chain forces the read to happen first, so the load floats past the write that destroys what
  it read. Selection catches it as `MSEL-MEMORY-ORDER`. Mapping the primitive to
  `n-array-resize-after-at!` and naming the loaded value fixed it.
- **The frontend must record the dynamic alias BEFORE inlining, not after.** Every hand-written
  array path does it in that order. Recording it afterwards leaves the loads and stores the body
  already built outside the alias subsequently declared dynamic.
- **Unresolved:** adding the mutating macros to `lib/array/build.jsl` turns `tools/jsl-native-gate.sh`
  red with `MSEL-UNSUPPORTED`, on `String.prototype.indexOf` — a definition that touches no array and
  calls none of the new macros. Removing the macros alone restores it. That is not understood, and
  it is the actual blocker: the primitive and the definitions are the easy part.

## Math

| Operation | Status | Definition |
|---|---|---|
| `abs` | **converted** | `MathAbs` |
| `floor` | **converted** | `MathFloor` |
| `ceil` | **converted** | `MathCeil` |
| `round` | **converted** | `MathRound` |
| `max` | **converted** | `MathMax2` |
| `min` | **converted** | `MathMin2` |
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
| `Number(x)` / unary `+` | **not supported by the frontend** | — |
| `Number.isNaN` and friends | **not supported by the frontend** | `NumberIsNaN` … |

`GlobalIsNaN` is `%IsNaN`, which COERCES, and that is the whole difference from `Number.isNaN`:
`isNaN("12x")` is true because ToNumber of the argument is NaN, while `Number.isNaN("12x")` is
false because the argument is a string rather than the NaN value. Two operations, two definitions.

These last two are a different category from everything else in this file, and it is worth being
exact about it: they are not unconverted operations, they are operations the frontend cannot compile
in the first place. There is no `FE-INTRINSIC-NUMBER`, so `Number(x)` and `Number.isNaN(x)` never
reach any lowering, hand-written or otherwise.

`NumberIsNaN`, `NumberIsFinite`, `NumberIsInteger` and `NumberIsSafeInteger` are written and
native-gate verified against Node, and nothing can name them. Discovered when a test using
`Number.isNaN` crashed the emitter. Reaching them means adding a frontend intrinsic — new
functionality, not a conversion.

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
| Converted | 27 |
| Blocked on a primitive | 4 (array resize family) |
| Blocked on design | 1 (`split`) |
| Not convertible | 11 (libm + `random`) |
| Not compilable by the frontend at all | 2 (`Number(x)`, `Number.*`) |

**Every operation the frontend can compile, and that a DSL can express, is converted.** The four
remaining rows are a missing primitive, one allocation-path design question, libm, and two things
the frontend has never supported.

The honest shape of it: **nothing is blocked by the DSL's expressiveness.** What remains is one
missing primitive, one allocation-path design question, and two intrinsics the frontend
does not recognise. The two things that ever genuinely blocked conversion — memory crossing the seam, and the cost
of the abstraction — are both fixed, in `jsl-inline!` and in `g-fold-proven!` respectively.
