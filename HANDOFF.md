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

### The one thing to chase first

**A nondeterministic miscompile.** A single arithmetic expression of ~20 terms mixing boxed array
elements with unboxed lengths miscompiles, and the answer varies between runs of the same binary — a
pointer reaches the arithmetic while every underlying runtime call is correct. It reproduces with
none of the array work converted. `tests/native-conformance/array-mutation.ts` accumulates into a
local to avoid it and says so. This is a nastier class than anything else here.

### Known instability

The gate is not reliably green: one run in four came back RED and did not reproduce, so the failure
text was never captured. The reported cause is random `coil test` suites dying on **signal 9**, a
different suite each time, each passing in isolation. **It has not been confirmed that this happens
at a commit before this work.** Checking out `6be9e3b` and hammering the gate there would settle it,
and it is worth settling — an intermittently red gate erodes the one contract this project runs on.

### Remaining conversions

- **`split`** — allocates an array, and the frontend's path also marks the allocation and publishes
  a dynamic alias. `%NewArray`/`%ArrayStore` exist; the second half has no library counterpart.
- **`Number(x)` and `Number.*`** — not conversions. There is no `FE-INTRINSIC-NUMBER`, so neither
  reaches any lowering. `NumberIsNaN`, `NumberIsFinite`, `NumberIsInteger` and `NumberIsSafeInteger`
  are written and native-gate verified against Node, and nothing can name them. Reaching them means
  adding a frontend intrinsic — new functionality.
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
