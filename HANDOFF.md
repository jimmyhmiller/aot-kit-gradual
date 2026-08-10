# Handoff: getting the last of it out of hand-written IR and into `lib/`

`./tools/gate.sh` green at 533 tests in about 150 seconds, conformance at 30 programs.

**The goal in one sentence: nothing in `src/frontend_native_graph.coil` computes a JavaScript
result.** The frontend's job is to turn syntax into a graph; the semantics of every operation that
graph performs should come from a definition in `lib/`. We are most of the way there, and the rest
is described here in the order it has to happen.

**For "is X done", read [docs/STATUS.md](docs/STATUS.md)** — generated, gate-checked, and derived
from the frontend's own tables. This file is the plan. [docs/JSL.md](docs/JSL.md) is the language,
[docs/CONVERSION.md](docs/CONVERSION.md) is the reasoning behind each conversion already made, and
[docs/JOURNAL.md](docs/JOURNAL.md) has the history.

---

## What is actually left

Six things, and only six. This list was read out of `src/frontend_native_graph.coil` rather than
remembered — every remaining call to an IR constructor that computes a JavaScript result:

| What | Where | Why it is still here |
|---|---|---|
| 11 Math functions | `n-js-builtin!`, one site | `sqrt`, `pow`, `exp`, `log`, six trig, `random` |
| Element read and write | `fng-array-load!` ×1, `fng-array-store!` ×2 | `xs[i]` and `xs[i] = v` — the spec's `[[Get]]`/`[[Set]]` |
| Property read and write | `fng-prop-load!` ×2, `fng-prop-store!` ×3 | `o.p` and `o.p = v`, including the dynamic path |
| `a.length` | `fng-array-length!` ×1 | reads the header directly |
| Array resize | `fng-array-resize!` ×2 | assignment past the end, growing the array |
| Multi-argument `String.fromCharCode` | `n-string-concat!` ×1 | a fold over the argument syntax |

Plus 60 operations that do not compile at all. Those are not "hand-written" — there is nothing to
move — but they are the bulk of the remaining work and the second half of this plan.

`n-string-const!`, `n-array-mark!` and `n-new-obj!` stay. They are allocation and graph
construction, not semantics: there is no JavaScript behaviour in "this literal is a string" that a
definition could express.

---

## Four blockers, and everything else waits on them

These are not a backlog to work through in any order. Each is currently forcing a definition to be
written around it, and three were discovered by trying. **Fix these first.** Each has a minimal
reproducer that fits on one screen; start by making it fail.

### 1. `jsl-inline!` cannot emit control flow inside a non-entry function

    // integrated-heap-program.ts, with the guarded ToNumberValue restored
    function sum(tree: Tree): number { return tree.value + sum(tree.left); }
    // BER-MALFORMED-GRAPH: a New anchored at Start, MSEL-DEPENDENCY

A definition containing an `if` expands fine in `main` and does not survive selection inside another
function. It is why `ToNumberValue` is one bare `%ToNumber` node instead of the spec's own
`(if (IsNumber v) v (%ToNumber v))` — which costs `call-loop` 9.6ms → 25.5ms and `math-loop` 73.3ms
→ 97.3ms, on every dynamic arithmetic operand in the program.

**What it unlocks:** the guard, and every future definition with a branch emitted anywhere but the
entry function — which is most of them. **This is the highest-value fix in the file.** Start with
the `New` anchored at `Start`: `jl-const` pins constants to `(g-start)`, which is the whole graph's
start rather than the containing function's, and see whether that is what puts the allocation in the
wrong owner.

### 2. A merge whose two arms both write the heap leaves an untyped memory Phi

    (if c (let [(i (%ArrayStore a 0 x))] a)
          (let [(i (%ArrayStore a 0 y))] a))
    // MSEL-UNSUPPORTED on a Phi still carrying ANY

`jl-mem-phi` builds the merge and its type is never computed. Every heap-touching definition in
`lib/` today happens to write on only one arm of any branch it contains, which is why nothing had
exercised it — and why `StringSplit` had to be rewritten as one loop with one unconditional store.
That is a real constraint on how a definition may be phrased, not a style note.

**What it unlocks:** `concat`, `fill`, `reverse`, `splice`, `unshift`, `flat`, `Array.from` — every
allocating definition that wants a branch. Ten operations directly, and the shape of every one
written after.

### 3. A constant that folds a branch during construction desynchronises a Region and its Phi

    "ab".repeat(0)     // VERR-ARITY
    "abc".split()      // VERR-ARITY, when the argument count is passed in as an int

A literal that makes a branch provably dead is folded while the graph is still being built, and the
Region loses an input the Phi still has. It is why `split` is two definitions chosen by argument
count rather than one taking a flag.

**What it unlocks:** flags and counts as parameters, which is the natural way to write half the
remaining definitions. It also removes a class of "works with a variable, fails with a literal" bug
that will keep costing debugging time.

### 4. JSL has no `%Call`

`ArrayMapDouble` exists in `lib/` with the callback hardcoded to doubling, as a placeholder for the
shape a real `map` will have. A definition cannot take a function as an argument.

**What it unlocks:** `map`, `filter`, `forEach`, `reduce`, `reduceRight`, `find`, `findIndex`,
`some`, `every`, `sort`, `flatMap` — eleven operations, and the largest single block on the
not-supported list. This is a language feature rather than a bug fix: it needs a primitive, a
calling convention through `jsl-inline!`, and a decision about whether the callback is inlined at
the call site. It can be — the frontend knows the function statically in the common case.

---

## Then, in this order

Each step says what "done" means, because "converted" has meant three different things in this repo
and only one of them is true.

**Done means: `docs/STATUS.md` moves a row to `done`, a program in `tests/native-conformance/`
exercises it, and an injected defect in the definition turns that program red.** The third clause is
not optional — see the rules below.

### A. The heap accessors — `xs[i]`, `xs[i] = v`, `o.p`, `o.p = v`, `a.length`, resize

These are six of the remaining hand-written operations and they are one family: the spec's `[[Get]]`
and `[[Set]]`. `%ArrayLoad`, `%ArrayStore`, `%ArrayLen` and `%ArrayResize` already exist, and
`ArrayAt`, `ArrayPop` and `ArraySlice` already use them, so the definitions are short. What makes it
worth doing is not the code moved but what the definitions can then say in one place: a hole reads
`undefined`, a negative index is a property and not an element, a write past the end grows. Those
rules are spread across the frontend today.

Do this after blocker 2 — an element write that may or may not grow the array is exactly a branch
with a heap write on both arms.

### B. Multi-argument `String.fromCharCode`

The smallest item on the list. The single-argument case already goes through `StringFromCharCode`;
the loop over additional arguments folds with `n-string-concat!`. It is a fold over the argument
SYNTAX, like `push`, so the loop stays in the frontend — but each step should call `StringConcat`
rather than build the node.

### C. The 60 that do not compile

Ordered by what each group needs, which is how `docs/STATUS.md` groups them:

1. **After blocker 4** — the eleven callback methods. Biggest single win, and the most-used
   JavaScript in real code.
2. **After blocker 2** — the ten allocating array methods.
3. **Frontend intrinsics** (12) — `Object.keys`, `JSON`, `parseFloat`, `Infinity` as an identifier,
   `codePointAt`. Each is the `Number` pattern: a constant in `fe-intrinsic-name`, a recognizer, a
   dispatch arm, a definition. `Number` took an afternoon and four of its definitions already
   existed, so this is the cheapest block per operation.
4. **New syntax** (13) — template literals, destructuring, spread, `for...of`, `class`,
   `try`/`catch`, arrow functions, `typeof`. Frontend work with little or no library component;
   `try`/`catch` needs the throw path to become a real unwind.
5. **A regex engine** (6) and **a bigger runtime** (8) — `Map`, `Set`, `Promise`, generators,
   `Symbol`, `BigInt`, `Date`, modules. These are projects, not tasks.

### D. libm, last, and only if you want it

The 11 hand-written Math functions are the only rows on `docs/STATUS.md` that compile and are not
from `lib/` — the whole `hand-written` column, and nothing else in the compiler is in it. Moving them means one of two things, and neither is a conversion in the sense the other
rows are:

- **A rename.** There is no `%SqrtNum` — the primitive table stops at `%FloorNum`, `%CeilNum` and
  `%RoundNum` — so this means ADDING one per function, each lowering to the same `OP-JSBUILTIN` the
  frontend emits today, and wrapping it. `MathFloor` earns its wrapper because the library adds the
  `if (%IsInt v)` guard; `sqrt` has no guard and no rule. Eighteen new primitives, five table edits
  each, to make the checklist read `done` without changing a single instruction that runs.
- **The actual algorithms in JSL.** A Newton iteration for `sqrt`, range reduction and a polynomial
  for `exp`/`log`/trig, written in the DSL over `flt`. This is what "everything runs out of `lib/`"
  honestly means, and the DSL can nearly express it already: `%Add`/`%Sub`/`%Mul`/`%Div` and the
  comparisons all work over `flt`, and `%FloorNum` gives you range reduction. What is missing is bit
  access to the exponent — the standard way to get a good initial estimate and to scale by a power
  of two — so expect to want a `frexp`/`ldexp` pair or raw f64 bit moves.

  The hard part is not the algorithm, it is the last bit. `tools/jsl-gate.sh` compares against Node
  exactly, and a correctly-rounded libm is a research-grade problem. Budget for either matching
  Node's exact bits or changing that gate to an ULP tolerance, and decide which BEFORE writing the
  first polynomial.

**Recommendation: the second or neither.** The first is bookkeeping that makes the checklist lie. If
you take the second, do `sqrt` alone first and find out what the last-bit disagreement costs before
committing to the trig functions.

---

## Rules that must not be broken

Each was learned by breaking it, and each cost hours.

**A `dyn`-returning definition must have the same representation on every arm.** A bare `undefined`
or `null` in a JSL body is `Const : undef`, which selection materialises as the machine word 0 — the
payload with no tag. Merge that with a boxed value and the Phi is a tag on one path and a plain
integer on the other, which verifies clean and is read as whichever the consumer assumes. It cost
`StringAt`, `ArrayAt` and `ArrayJoin` — the last of which answered `"1,undefined,null,4"` where Node
says `"1,,,4"`. Write `(%Box undefined)`. `jsl-check` does not catch this; nothing does.

**Every gate must be able to fail, and you must prove it by making it fail.** Not "the assertion
looks right" — inject the defect and watch the gate go red. This caught worthless coverage six
separate times, most recently on `split`, where two injected defects survived the first test file
and needed a second one that reads the pieces back rather than counting them.

**An operation the frontend does not name is unreachable no matter what gate it passes.** Twenty
definitions sat in `lib/`, spec-annotated and verified against Node, that no program could call.
`tools/jsl-native-gate.sh` says a definition compiles; only `tools/native-source-conformance.sh`
says a program reaches it. `docs/STATUS.md` is generated and gate-checked so this cannot silently
recur.

**Put the arity in the recognizer.** `fng-string-builtin-arity?` refuses `lastIndexOf(needle, from)`
because `StringLastIndexOf` cannot honour a `fromIndex`. A dropped argument is a wrong answer; a
refused name is a message.

**Types describe REPRESENTATION, not just the value set.** `box-compute` reports `dyn` and not
`flt`, because a type carries a register class. And `n-ty` is not a proof while the graph is being
built: ANY means "not analysed yet" and sits above every concrete type, so `ty-isa ANY num` is true
and reads exactly like a proof that a value is already a machine number.

**A `Parm` is a tagged JavaScript value.** Anything handed to a callee that reads it through a
declared type has to arrive boxed, and an object literal written in argument position has to be
built with the parameter's shape or the callee's `Load#0` reads a field that is not there. Both were
`SIGTRAP` and a silent 0 respectively, on three lines of ordinary TypeScript.

**Every corpus program ends in `| 0`.** `main` returns through an integer ABI. A test that returns a
non-integral expression compares garbage.

---

## Known defects — all reproduce at `f3f5efe`, none fixed

- **`a === a` is true when `a` is NaN.** `let a = Math.sign(NaN); a === a` is 1 natively, 0 in Node.
  `cmp-idealize` excludes floats by name for exactly this reason, so it is the dynamic
  strict-equality path comparing boxed words. `IsNaNValue` in `lib/abstract/conversions.jsl`
  documents the same fact from the library's side and routes around it; nothing routes around it for
  user code.
- **The global `isNaN` on a dynamic array element does not compile.** `isNaN(v[0])` inside a ternary
  is `MSEL-TERMINATOR`. `%IsNaN` is the coercing primitive and reaches the runtime; a call in a
  ternary condition over a dynamic element is the shape that fails.
- **A dynamic property read off a passed object answers 0.** `function get(t: any) { return t.value; }`
  called with an object literal. The typed-shape path is fixed; this one needs the dynamic property
  alias to reach the callee's memory `Arg`.
- **`.length` on an array-typed parameter answers 0.** The declared type does not reach `fng-infer`
  inside the callee, so it takes the generic property path instead of `ArrayLen`.
- **An unused loop-carried accumulator fails verification with `VERR-LEAK`.** The Phi is live and
  nothing can reach it; it takes a loop, and an unused `let` bound to anything else is fine.
- **Random `coil test` suites die on signal 9.** Measured, not guessed: not a commit, not jetsam —
  `coil test`'s fork-and-exec of a freshly written child. `tools/gate.sh` re-runs a suite that
  reports it, up to three times, matching on the OUTPUT text, because `coil test` survives its own
  child and exits 1 like any assertion failure.

---

## Working in this repo

- **Commit on `main`.** No feature branches; the gate is the safety mechanism.
- **`./tools/gate.sh` green before every commit.** It takes about 150 seconds. If it takes materially
  longer, something has regressed in the gate itself, and that is worth chasing: a gate people avoid
  running is not a gate.
- **The benchmark gate is opt-in: `./tools/gate.sh --bench`.** It was 242 seconds of a 700-second
  gate and it fails on nothing.
- **Regenerate the checklist when you change what compiles:** `node tools/status.mjs`. The gate
  fails if you forget.
- The gates: `jsl-gate.sh` (322 interpreter cases vs Node, two falsifications built in),
  `jsl-native-gate.sh` (compiles every builtin, value-checks 14 against a golden),
  `native-source-conformance.sh` (**the one that proves a conversion is reached**), `ts-gate.sh`,
  `status.mjs --check`.
- **Adding a primitive** means five tables in `src/jsl.coil` (const with `JSP-COUNT` bumped, name,
  op, arity, `jsp-mem`), a branch in `jl-prim-mem` in `src/jsl_lower.coil`, and the declaration
  counts in `tests/jsl-test.coil`.
- **Adding a definition** means a file, a line in `lib/index` (**the order is part of the format** —
  a declaration's position becomes its closed-world function index), and the counts in
  `tests/jsl-test.coil`.
- The emitter's `selection-item-node=N` diagnostic indexes the node array with a MACHINE instruction
  index. It is meaningless; ignore it and instrument `ms-fail!`. The emitter's `-999` seed dumps the
  ideal graph, which is usually what you actually want.
