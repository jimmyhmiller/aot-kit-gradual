# Handoff: the JSL runtime library, and wiring it into the compiler

32 commits, `2c0b5b0..HEAD`. `./tools/gate.sh` green at 533 tests.

This covers what was built, the design decisions worth knowing before changing anything, the defects
it turned up, and what is left. Read `docs/JSL.md` for the language and `docs/CONVERSION.md` for the
per-operation table; this file is the orientation and the parts that live in neither.

---

## What this is

JSL is a Torque-inspired DSL for writing JavaScript's runtime semantics. A definition in `lib/`
lowers to the same sea-of-nodes ideal graph the TypeScript frontend produces — there is no
JSL-specific node, op, or backend arm anywhere downstream, which is the entire point. `eval.coil`
runs what comes out of it because it is the same graph, and `backend_select.coil` compiles it for
the same reason.

88 declarations across 25 files: 33 `builtin`, 55 `macro`.

**31 JavaScript operations now get their machine code from `lib/`** rather than from a hand-written
IR node: all of `String.prototype` except `split`, all of the read and mutate `Array.prototype`
methods the frontend supports, the one-argument Math family plus `max`/`min`, the string operators
(`length`, `===`, the four relational comparisons, `+`), and the global coercions (`String(x)`,
`parseInt`, `isNaN`, `String.fromCharCode`).

---

## The distinction that matters most

**"Converted" means the frontend EMITS the definition.** It does not mean a definition exists.

For most of this project's history the library was verified against Node, compiled to machine code
by its own gate — and completely unused. `src/frontend_native_graph.coil` built its own IR node for
every builtin, and nothing in `src/` imported `jsl`. The definitions were right and unreachable.

When you add a definition, the question to ask is not "does it pass the JSL gate" but "does any
program compile through it". `tools/jsl-native-gate.sh` answers the first. Only
`tools/native-source-conformance.sh` answers the second.

---

## The reachability inventory — half the library is dead

Measured on 2026-08-09 at `f3f5efe`, as a transitive closure from the names `src/` actually passes
to `fng-jsl-call*`. **88 declarations. 43 reachable. 45 unreachable.** No program can execute the
45; they exist, they pass the interpreter and native gates against Node, and nothing can name them.

This is the same trap the section above describes, still open at a larger scale than that section
admits. `docs/CONVERSION.md` says "all of `String.prototype` except `split`". That sentence is true
only of the **nine method names `fng-string-builtin?` recognises**
(`src/frontend_native_graph.coil:1678`). Twelve more String methods are written and cannot be
called.

### Reachable: 30 roots, 31 operations

The 30 names `src/` emits, plus 13 pulled in transitively (`Clamp` `ToInt32` `SameValueZero`
`IsNumber` `IsNaNValue` `IsNaNNumber` `FltIsNaN` `IntAbs` `FltAbs` `NumLt` `BoxedNaN` `NaN`
`Infinity`). The per-operation table is `docs/CONVERSION.md`.

### Unreachable: 45, in six categories

**A. Blocked only by the frontend's method-name list — 14 operations. ALL FOURTEEN ARE NOW REACHED.**

| Operation | Definition | |
|---|---|---|
| `String.prototype.startsWith` | `StringStartsWith` | reached |
| `String.prototype.endsWith` | `StringEndsWith` | reached |
| `String.prototype.includes` | `StringIncludesFrom` | reached |
| `String.prototype.lastIndexOf` | `StringLastIndexOf` | reached |
| `String.prototype.padStart` | `StringPadStart` | reached |
| `String.prototype.padEnd` | `StringPadEnd` | reached |
| `String.prototype.repeat` | `StringRepeatCount` | reached |
| `String.prototype.replaceAll` | `StringReplaceAll` | reached |
| `String.prototype.trim` | `StringTrim` | reached |
| `String.prototype.trimStart` | `StringTrimStart` | reached |
| `String.prototype.trimEnd` | `StringTrimEnd` | reached |
| `String.prototype.at` | `StringAt` | reached |
| `Array.prototype.at` | `ArrayAt` | reached |
| `Array.prototype.join` | `ArrayJoin` | reached |

It took a name in `fng-string-builtin-arity?` or `fng-array-builtin?`, a dispatch arm in
`fng-string-call` or `fng-array-call`, a result-kind arm in `fng-string-builtin-result`, and three
conformance programs: `string-methods.ts`, `string-transforms.ts`, `array-accessors.ts`. No new
primitive and no new DSL feature.

**The arity is part of the recognizer, not a detail.** `fng-string-builtin-arity?` gives each name
its supported argument counts and REFUSES the rest, so `lastIndexOf(needle, from)` is a frontend
diagnostic rather than a compile that silently drops the `fromIndex` `StringLastIndexOf` cannot
honour. A dropped argument is a wrong answer; a refused name is a message.

**Three seam defects in the library turned up on the way, all of one kind.** A bare `undefined` or
`null` in a JSL body is `Const : undef`, and selection materialises that as the machine word 0 — the
payload with no tag. That is right for a value the compiler knows is undefined and wrong the moment
it meets a tagged one:

- `StringAt` merged an unboxed `%Substring` with a tagged `undefined`. `"abc".at(-1) === "c"` was
  false and `String("abc".at(9))` failed selection outright. Both arms are boxed now.
- `ArrayAt` merged a bare `undefined` with a boxed `%ArrayLoad`.
- `ArrayJoin` compared its element against a bare `undefined` and a bare `null`, so the comparison
  could never match and `[1, undefined, null, 4].join(",")` came out `"1,undefined,null,4"` where
  Node says `"1,,,4"` — the one behaviour that definition exists to get right.
- `RequireObjectCoercible` has the same two comparisons and is still unreachable; fixed anyway.

`ArrayPop` and `ArrayShift` sidestep this trap by being branch-free, and say so in their comments.
An index that can miss cannot be written that way, so **a `dyn`-returning definition whose arms are
not all tagged is the bug to look for first.** `jsl-check` does not catch it; nothing does.

**B. Blocked on the Math descriptor table — 2 operations.** `Math.sign` (`MathSign`) and
`Math.trunc` (`MathTrunc`). `src/jsbuiltin_desc.coil` has 17 `JBI-` ids and neither is among them,
so the frontend cannot compile the call at all. These two are the only Math entries that would be
PURE JSL: `floor`/`ceil`/`round` still bottom out in `OP-JSBUILTIN` through `%FloorNum`, and
`sign`/`trunc` would not.

**C. Blocked on a new frontend intrinsic — 4 operations.** `Number.isNaN`, `isFinite`, `isInteger`,
`isSafeInteger`. Needs `FE-INTRINSIC-NUMBER` in `src/frontend_native.coil:29`.

**D. Written to spec and deliberately bypassed — 1.** `String.prototype.indexOf`, the full entry
with `RequireObjectCoercible` and ToString. The frontend calls the coerced core `StringIndexOfFrom`
directly because `fng-string-builtin?` has already proven the receiver is a string.

**E. Not JavaScript operations — 3.** `ArrayIota` (a conformance-table generator), `ArrayRepeat`,
and `ArrayMapDouble` — `map` with the callback hardcoded to doubling, because JSL has no `%Call`.

**F. Dead helpers and unused abstract operations — 21.** No caller at all: `ToBoolean` `ToLength`
`ToUint32` `ToNumberValue`. Dead because their only callers are: `ClampedIndex` `RelativeIndex`
`IsTrimmable` `RequireObjectCoercible` `IntSign` `FltSign` `FltTrunc` `FltFloorFrom` `FltCeilFrom`
`BoxedInf` `BoxedNegInf` `NegInfinity` `NumEq` `NumLe` `IsFiniteNumber` `IsIntegerNumber`
`IsSafeIntegerNumber`.

### The dynamic-to-number seam: an unbox where the language says a coercion

`let xs = [10, 20]; xs[5] + 1` was a `SIGTRAP` where Node answers `NaN`. The read was correct — the
load answered `undefined` — and the arithmetic then unboxed it as a number.

**An `Unbox` asserts a representation and a coercion converts one, and the frontend used the first
for both.** `fng-number-value` and `fng-int-value` emitted `Unbox : flt` on any dynamic operand, and
`MI-JSUNBOX` traps on a tag it was promised would not be there. ToNumber is what JavaScript
specifies, and it already existed on both sides of the compiler — `ev-to-number-value` in
`eval.coil` and `aot_js_to_number_double` in the runtime implement the same table, and the runtime's
even cites the interpreter's. **The graph was the only place that did not say so.**

Both now go through `ToNumberValue` from `lib/abstract/coercions.jsl`, so this is a conversion as
well as a fix: it is not only `undefined` that works now but the whole table — `null` is `+0`,
booleans are 0 and 1, `"7" * 2` is 14 where it used to be pointer arithmetic.
`tests/native-conformance/value-coercion.ts` has one row per arm.

Two things to know before changing it:

- **The definition is one node on purpose.** The spec's steps 1 and 2 are "if it is already a
  Number, return it", and writing that guard — `(if (IsNumber v) v (%ToNumber v))` — is what keeps
  the runtime call off the numbers, worth 9.6ms to 25.5ms on `call-loop` and 73.3ms to 97.3ms on
  `math-loop`. It is NOT there, because the guard puts a Region and a Phi inside whatever function
  the operand is in, and **`jsl-inline!` emitting control flow inside a non-entry function does not
  survive selection**: `integrated-heap-program.ts` produced a `New` anchored at `Start` and failed
  with `BER-MALFORMED-GRAPH`. Fixing that unlocks the guard, and probably also the trap listed under
  known defects below.
- **Functions grew memory edges.** `%ToNumber` reaches a runtime helper that can touch the heap, so
  any function doing arithmetic on a dynamic operand now threads memory. The `call` fixture in
  `tests/frontend-native-graph-regression.mjs` went from 30 nodes to 34 for that reason, and its
  repin comment says so.

### How to re-measure this

Do not trust a prose count; the last one was wrong. The closure is: extract every
`(builtin|macro NAME` from `lib/*/*.jsl`, take as roots those `NAME`s appearing as a `"NAME"`
literal anywhere in `src/*.coil`, then walk each root's body text for other declaration names until
the set stops growing. Anything outside the closure is unreachable no matter what gate it passes.

---

## Design decisions you should not undo without reading this

### Inlining, not calling

`jsl-inline!` expands a definition's body into the caller's graph. `jsl-call!` emits a real call and
is used by the standalone gates. The frontend uses inlining, and that was measured, not assumed:
routing Math through `jsl-call!` cost `benchmarks/typescript-aot/math-loop.ts` 48.9ms → 75.9ms;
inlining recovered it to 71.0ms. There is no inliner in the optimiser to give that back afterwards.

This is Torque's `macro`/`builtin` split with one difference: **the caller chooses**. The same
definition is a call when another library definition calls it and an inlining when the frontend
emits it, because the frontend is emitting the operation rather than invoking it.

### On-demand lowering

`jsl-require!` pulls a definition and its transitive callees the way a linker pulls objects out of
an archive. Lowering the whole library would put an unreachable `Fun` in every graph, and
`tests/frontend-exact-graph-test.mjs` holds the frontend to exact `g-render` equality. Adding to the
library cannot change the graph built for a program that does not call the addition.

It does **not** shrink the emitted object — selection already drops functions nothing reaches, and
`MathAbs` emits 1135 bytes either way. The graph is what it keeps small.

### The seam is representation, and it is narrower than "everything is NaN-boxed"

A JSL `dyn` parameter holds whatever representation the value already has. A string literal in a
`.jsl` file lowers to `n-string-const!`, a raw pointer, and `%StringIndexOf` reads it as one — so a
string the frontend already has is passed straight through, and boxing it would hand the library a
tagged word where it expects a pointer. Array elements ARE boxed, so a search target is boxed.
Parameters declared `int` take raw machine integers.

Math is the exception: it is boxed both ways, and the result comes back through `ToNumber` rather
than an unbox to `flt`, because `MathAbs` of a boxed integer returns a boxed INTEGER where
`OP-JSBUILTIN` always returned a double. `Math.abs(-7)` takes exactly that path.

### The heap crosses the seam by inlining, and only by inlining

A **called** definition works on a heap that is not its caller's: memory reaches a function as an
`OP-ARG` and never as a parameter (`v-mem-producer?` decides that structurally), so a called
`builtin` synthesises its own empty entry heap. `heapparams` refuses an array arriving as a
parameter for that reason — an `ArrayIndexOf` written that way answered `-1` for an element the
caller had just stored, verified clean, and ran to completion.

Inlining has no such split. The body's nodes ARE the caller's nodes, so there is one memory chain.
**Inlining is the answer to `heapparams`, not a casualty of it** — `jsl-inline!` originally panicked
on any heap-touching definition, which was the call path's reasoning misapplied.

Two consequences: heap-touching definitions must be `macro`s (`jsl-check-heap-shape` enforces it,
exempting macros), and `fng-jsl-call` must record the dynamic alias **before** inlining, because
recording it afterwards leaves the body's loads and stores outside the alias later declared dynamic.

---

## Defects this work exposed — all pre-existing, all in the compiler, not the DSL

Converting operations kept surfacing latent bugs in paths nothing had exercised. This is the
single most useful thing the exercise produced.

1. **Scheduling cycle between a call and its arguments.** The within-block list scheduler's
   order-preserving edges ask `before`, which reads the order the scheduler was invoked to fix. A
   call at instruction 17 consuming a string built at 37 got an edge 17→37 while the data edges ran
   37→26→23→20→17. Nothing could be emitted; the block reported `MSCHED-CYCLE`, repair gave up, and
   the original order survived to fail verification. Fixed by retrying the block without the two
   call/effect clauses, plus refreshing `schedule-order` afterwards so verification describes the
   schedule that exists.

2. **Analysis proved things nothing acted on.** `g-analyze!` only calls `n-compute` — correct for an
   optimistic pass — but nothing ran afterwards, so a node the fixpoint decided was a constant
   stayed a node. `Clamp 0 0 (%StringLen s)` produced a `Phi : int=0`, still pinned to its Region
   inside a loop, so a pure loop-invariant `%StringIndexOf` could not hoist and re-scanned 500,000
   times. `g-fold-proven!` runs the peephole after the fixpoint. **string-loop: 79.4ms → 4.1ms.**

3. **`cmp-compute` had no range reasoning.** Any comparison with a non-constant operand gave up.
   `a < b` is now decided when `max(a) < min(b)` or `min(a) >= max(b)`, and `%StringLen` is typed
   `int=[0..max]`.

4. **A control-anchored heap operation was not held to its anchor.** GCM derives `earliest` from
   value inputs only, and a store's result usually has no consumer, so stores landed at their
   earliest block — a loop *header*, running once per header visit. `(%ArrayLen (ArrayIota 3))`
   answered **4** as machine code on the untouched tree. Reads had the mirror problem: `shift`'s
   load of element 0 was sunk past the loop that overwrites it.

5. **The anti-dependency vector described a pre-placement schedule**, built at end of selection with
   a rule stated in block ids GCM then changes. Rebuilt after placement.

6. **The closed-world function index was the declaration index.** A function index is a bit in a
   64-bit set and `be-call-return-kind-fuel` skips anything at index ≥ 63. Macros — 55 of 88
   declarations, none of which has an `OP-FUN` — each consumed a bit. Adding five array definitions
   pushed `StringIndexOfFrom` past 63, its bit fell outside the mask, the return kind of calls to it
   became unknown, and boxing that result failed selection. It surfaced as `MSEL-UNSUPPORTED` on
   `String.prototype.indexOf`, which is merely the entry whose graph contains the call.

Also fixed in two hand-written copies: `Math.round` was `floor(x + 0.5)`, wrong at
`0.49999999999999994`.

---

## Methodology — the part that actually mattered

**Every gate must be able to fail, and you must prove it by making it fail.** This caught worthless
coverage four separate times, and in each case the test looked fine:

- The first `indexOf` coverage was added to a program that never called `indexOf`. It passed against
  a deliberately broken library.
- `charAt` was tested only at index 9 — out of range, which returns early from a guard before the
  library indexes anything.
- The next attempt read the result with `.charCodeAt(0)`, which returns the first code unit whatever
  the length is, so a `charAt` returning two characters still passed. `.length` is what catches it.
- `substr(-2,1).length` is 1 whether or not the arguments get swapped.

The pattern is always the same: the assertion is real, but the defect it should catch does not
change the observable. **When you convert an operation, injecting the defect is not optional.**

Two claims were also retracted after measurement contradicted them: a length-type refinement I
justified with a story about clamp folding (node counts showed it changed nothing — it was necessary
but for a different reason), and "Math.max stays hand-written because it is variadic" (it is not
variadic in this frontend; `jbi-max-arity` is `jbi-min-arity`).

---

## What is left

### The nondeterministic miscompile — fixed, along with two others

It was not about arrays. `be-node-fp-value?` decides whether a `+` is an integer or a
floating-point add, and it was a recursion carrying **eight units of fuel**; past eight it answered
"no", and the two sides of one expression ask separately, so they disagreed about which register
bank a value lived in. Seven terms were fine, eight failed selection, nine and beyond were silently
wrong — and *differently* wrong on each run once enough values were in flight for the register it
read to be a live one. Chasing it with a differential fuzzer turned up two more defects in the same
seam: `SCVTF` applied to a tagged word when widening a loop Phi's boxed seed, and integer arithmetic
applied to the tag word of a call that returns a boxed value. All three are written up in
[JOURNAL.md](docs/JOURNAL.md#the-representation-seam-three-miscompiles-a-depth-bound-was-hiding),
with what the third one cost and why the fully correct version of it needs a fixpoint the compiler
does not have. `deep-arithmetic.ts` and `unstable-array-sum.ts` hold them; `array-mutation.ts` is
one sum again rather than a workaround.

### Known instability — measured, and it is not a commit

Random `coil test` suites die on **signal 9**, a different suite each time, each passing in
isolation. It was reproduced on 2026-08-09 and then measured rather than guessed at, and the
measurement is the useful part:

- In a roughly twenty-minute window it hit about **one suite per full sweep of the 31**, always the
  child a `deftest` forks, always the first test to run in that suite, with no crash report — and
  64 GB free, so it is neither jetsam nor a test this repo owns.
- Then it stopped. **Thirteen further sweeps — about 400 suite runs — produced zero**: four in a
  worktree at `6be9e3b`, four in a worktree at `e29d712`, three in the working tree with this work
  applied, and three at `e29d712` in that same directory.

Same directory, same toolchain, same suites, opposite results an hour apart. So it does not belong
to a commit, and bisecting for it will waste a day. It is `coil test`'s fork-and-exec of a freshly
written child interacting with something transient in the machine's state. Until the toolchain is
fixed, **a suite that reports signal 9 has reported nothing** — re-run it alone before believing it,
and do not read a gate red on signal 9 as a red gate.

One thing that WAS a real staleness, found while chasing this: `coil`'s `fmt` no longer renders
INT64_MIN as `-0`. `tests/text-test.coil` pinned that defect as a witness, so the suite went red on
an upstream fix. The witness is now recorded as closed rather than deleted — the assertion is what
would notice the day `{d}` loses a digit again.

### Known defects — found while reaching the twelve string methods, none fixed

All three are LOUD (a trap or a refused compile), and all three reproduce at `f3f5efe`.

- **`"ab".repeat(0)` fails verification with `VERR-ARITY`.** A literal zero count makes the
  library's loop provably run zero times, the builder folds it mid-construction, and a Region and
  its Phi are left disagreeing. A zero count in a VARIABLE is fine, which is what
  `string-transforms.ts` uses instead. Same class as the `Box` type-test attempt described under
  the performance gap below.
- **A property read inside a non-entry function traps in arithmetic.**

      type T = { value: number };
      function sum(t: T): number { return t.value + 1; }
      export function main(): number { return sum({value: 41}) | 0; }   // SIGTRAP

  Node says 42. `integrated-heap-program.ts` does the same thing — `tree.value + sum(tree.left)` —
  and compiles, so it is narrower than "property reads in functions". Worth pairing with the
  `jsl-inline!`-in-a-non-entry-function limitation above; they may be one bug.
- **`xs[0] * 1000` without a `| 0`** answers a machine word rather than 10000. `main` returns
  through an integer ABI and the coercion makes the expression floating-point; every program in the
  corpus ends in `| 0`, which is why it has never shown up. It is a harness convention as much as a
  defect, but a program that returns a non-integral expression is not compiled correctly today.

### Two more the fuzzer found, both pre-existing, neither fixed

Both are LOUD — a trap and a refused compile, not a wrong answer — which is why they were left and
written down instead. Both reproduce unchanged at `e29d712`.

- **An out-of-range element read traps instead of answering `undefined`.** `let xs = [10, 20];
  xs[5] + 1` is `SIGTRAP`, from the tag check inside `JSUNBOX`: the load correctly answers
  `undefined` and the arithmetic unboxes it as a number. Node says `NaN`, and `| 0` says 0. Nothing
  in the corpus reads a hole or a past-the-end index into arithmetic — `arrays.ts` reads `sparse[0]`
  and `sparse[2]`, never `sparse[1]` — which is why it has never come up. Fixing it means deciding
  what `undefined` in arithmetic lowers to, which is `ToNumber`, which is a frontend question.
- **An unused loop-carried accumulator fails graph verification with `VERR-LEAK`.**

      let viaLoop = other[0];
      for (let i = 0; i < 3; i = i + 1) { viaLoop = viaLoop + i; }
      return other.length | 0;      // verify=14

  The Phi is live and nothing can reach it. An unused `let` bound to a call, a slice, or plain
  arithmetic is all fine; it takes the loop. Valid TypeScript that will not compile.

### Remaining conversions

Only ONE definition is left to write. Everything else on this list is frontend plumbing to reach
code that already exists — see the reachability inventory above for the full 45.

- **`split`** — the one genuine remaining conversion. It allocates an array, and the frontend's path
  also marks the allocation and publishes a dynamic alias. `%NewArray`/`%ArrayStore` exist; the
  second half has no library counterpart.
- **The 20 written-but-unreachable operations** (categories A, B and C above) — 14 method names, two
  Math table entries, one frontend intrinsic. The definitions are done.
- **libm** (`sqrt`, `pow`, trig, `random`) — not convertible, and should stay that way. `MathFloor`
  earns its place because the library adds the `if (%IsInt v)` guard around `%FloorNum`; `sqrt` would
  get no guard and no rule, only a different spelling of the same call.

### The one real performance gap

`math-loop` is 1.45x slower than before conversion, and the cause is understood: `MathFloor` is
`if (%IsInt v) v else (%FloorNum v)` where `%FloorNum` lowers to the same `OP-JSBUILTIN` the
hand-written form emitted, so the conversion is that node plus a guard. The guard folds only when
the argument's kind is decided, and `i - 500` is `num` — `int|flt`, neither inside `int` nor disjoint
from it — so folding it would be a guess. Removing this needs an analysis that proves integer-ness
of JavaScript arithmetic, not a peephole. Every other benchmark is at parity.

A type test through a `Box` was attempted to close this and reverted. `box-compute` must report
`dyn` (a type here is a kind set with no representation bit, so `t-flt` would claim an FP register
for a tagged word). Reading the boxed value's type structurally is correct in isolation and a unit
test proved it, but folding a guard mid-construction left Region and Phi disagreeing — `VERR-ARITY`
— and `compute` cannot call `n-ty-proven?` at all, since it walks the input cone the analysis is
already walking.

---

## Working in this repo

- **Commit on `main`.** No feature branches; the gate is the safety mechanism.
- **`./tools/gate.sh` green before every commit.** Nothing is marked done while it is red.
- The gates: `jsl-gate.sh` (322 interpreter cases vs Node, with two falsifications built in),
  `jsl-native-gate.sh` (compiles every builtin to machine code, value-checks 14 against a committed
  golden), `native-source-conformance.sh` (whole programs through the real pipeline — **the one that
  proves a conversion is reached**), `benchmark-gate.sh`.
- Adding a primitive means updating five tables in `src/jsl.coil` (const with `JSP-COUNT` bumped,
  name, op, arity, `jsp-mem`), a branch in `jl-prim-mem` in `src/jsl_lower.coil`, and the three
  declaration counts asserted in `tests/jsl-test.coil`.
- The emitter's `selection-item-node=N` diagnostic prints a **machine instruction** index used to
  index the **node** array. It is meaningless; ignore it and instrument `ms-fail!` instead.
