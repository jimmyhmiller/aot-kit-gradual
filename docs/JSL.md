# JSL: the JavaScript library language

Dynamic JavaScript calls require descriptor-driven adapters rather than raw indirect calls. See
[JavaScript call descriptors in JSL](CALL_DESCRIPTORS.md) for the DSL and ABI contract.

**STATUS: PARTIAL.** Built: the reader, the checker, the expression core, `builtin`, `macro` with
inlining, `:labels`/`goto`/`:otherwise`, `loop`/`recur`, multi-file loading through `lib/index`,
ranged diagnostics, and the transition check over the lowered graph (`src/jsl.coil`, `src/jsl_lower.coil`, `lib/`,
`tests/jsl-test.coil`). Designed here and **refused by name** by the checker: `class`, and every
memory-touching, allocating or JS-calling primitive. Nothing in this file describes code that
does not exist without that refusal being real and tested.

JSL is the language the JavaScript runtime library is written in. A `.jsl` file declares builtins
and abstract operations; the compiler lowers them into the same ideal graph the frontend produces,
so `src/eval.coil` runs them and `src/backend_*.coil` compiles them with no per-builtin arm in
either.

---

## Why there is a language here at all

Today a JavaScript builtin costs an **opcode**, plus a case arm in `node.coil` (`op-name`,
`op-gvn?`, `op-foldable?`, `compute`, `idealize`, …), plus an arm in `verify.coil`, plus an arm in
`gtext.coil`, plus an arm in `eval.coil`, plus an arm in `backend_select.coil`. Counted over the
JS-surface opcodes that exist now, that is **287 dispatch sites for about thirty builtins** — very
close to ten sites each, spread over five modules and three languages.

`OP-JSBUILTIN` and `jsbuiltin_desc.coil` were the first attempt to escape that, and they show
exactly where the escape stops: the descriptor model covers seventeen `Math` functions because they
all share the shape `(f64, f64) -> f64`. Nothing that allocates, throws, calls back into
JavaScript, or touches memory fits, so `Array.prototype.map` cannot be a descriptor. It would have
to be an opcode, with its ten arms.

ECMAScript is roughly a thousand builtins. So:

> The op count must stop growing with the **ECMAScript** surface and grow with the **machine**
> surface instead. The machine surface is about sixty ops and is already built. The ECMAScript
> surface then grows in `.jsl` files, where an entry costs one definition and **zero** dispatch
> arms.

Two consequences do more work than the site count, and either alone would justify the language.

**A builtin that lowers to the ideal graph can be inlined and specialised into user code. An opcode
plus a C function never can.** This is the entire performance thesis of a JIT-free compiler. V8 makes
`arr.map(f)` fast because TurboFan inlines the Torque-generated graph and specialises it; under
[D1](DECISIONS.md#d1-closed-world-verified-types-speculative-monomorphisation-with-generic-backups)'s
closed world the callback is *statically known*, so the same inlining is stronger here than it is
in V8 and needs no speculation to justify it.

**One implementation, both execution modes.** An opcode needs a Coil arm in `eval.coil` and a
selection arm in `backend_select.coil`. Those are two implementations of one behaviour, and
[D12](DECISIONS.md#d12-the-oracle-has-to-run-the-program)'s differential oracle structurally cannot
catch a bug that is present in both. A `.jsl` definition is one graph; the evaluator and the
backend consume the same nodes they already know.

---

## Where the design comes from, and where it deliberately diverges

V8's equivalent is **Torque**: 96 `.tq` files covering nearly all of `Array.prototype`,
`String.prototype`, TypedArray, Promise, Proxy, the iterator helpers and the RegExp plumbing, each
written against the ECMAScript spec with the spec step cited in a comment. That corpus is read as
an *executable specification*. It is not translated:

- Torque compiles to CodeStubAssembler C++, so `base.tq` is about 1,850 lines of which roughly 70%
  are `extern` declarations binding to hand-written C++. That extern layer is the porting cost, and
  it is large because CSA is machine-level.
- Our IR is not machine-level. `PropLoad`, `ArrayStore`, `StringConcat`, `Box`, `TypeTest`,
  `Safepoint` are already ops, and `n-prop-load!`, `n-array-store!`, `n-new-obj!`, `n-call!`,
  `n-if-arms!` are already the builder API the frontend calls. **The JSL primitive layer is
  ~60 primitives that already exist, not ~500 that would have to be written.**
- A third of `array-map.tq` is `ArrayMapPreLoopLazyDeoptContinuation` and friends. Under D1 there
  is no deoptimisation machinery at all, so that third is a dead concept here and is dropped rather
  than ported.

What is taken is the *factoring*: spec-shaped abstract operations, a fast path guarded by structured
exits into a generic path, and an effect annotation that says whether a callable may call JavaScript
or move the heap.

Three Torque ideas map onto decisions this project already made, which is the reason the fit is
worth having rather than a coincidence:

| Torque | Here |
|---|---|
| `labels` / `otherwise` — structured exit to a slow path | [D4](DECISIONS.md#d4-guards-are-control-flow-not-a-node-kind): a guard is `If` + `Cast`, and a slow path is an ordinary CFG path carrying a cold hint |
| `transitioning` — may call JS, may move the heap | [D2](DECISIONS.md#d2-gc-abstract-ir-nodes-collector-policy-chosen-at-lowering): exactly the question of where a `Safepoint` goes and which refs it relocates |
| class declarations generating field offsets and GC visitors | `shape.coil`: a transition tree that allocates a field's alias at the introducing edge ([D10](DECISIONS.md#d10-a-shape-allocates-a-fields-alias-at-the-edge-that-introduces-it)) |

Torque's fourth idea, its type system, is **not** taken. Torque had to invent one to mirror C++
object layouts. `ty.coil` already has an interned lattice with `meet`/`join`/`isa`, and it is
richer than Torque's: it carries integer ranges, function-index sets and shape sets on independent
axes. A JSL type annotation is therefore not a new notation. It is `text.coil`'s exact form,
verbatim, parsed by `ty-parse`. There is one type system in this project and JSL does not add a
second.

---

## The surface

`.jsl` is read with Coil's bundled `coil.reader`, per
[D6](DECISIONS.md#d6-the-first-driver-is-a-minimal-dynamic-core-language-in-s-expression-syntax)'s
reasoning that s-expressions cost approximately zero parser work. The surface is ordinary Coil
syntax: `[...]` for parameter lists and `let` bindings, `:keyword` for options, `"..."` for strings.

This was not always free. The first version of this file was written against the old `coil.sexp`,
which had no bracket delimiters (`[` and `]` read as bare symbols and a bracketed list silently
mis-parsed), no comment syntax (`;` was an ordinary token byte, so a documented `.jsl` file read as
a stream of `;;` symbols), and no string tokenization (a quoted run split on whitespace, so
`"two words"` came back as two symbols). Working around those cost a quote-aware comment stripper
and an encoding of whitespace and parens inside quoted runs as control bytes, purely so an error
message could contain a space. `coil.reader` replaced `coil.sexp` on 2026-08-07 with real `KVec`,
`KStr`, `KKw` and `KFloat` tokens plus comment skipping, and all of that machinery was deleted.

Two properties still shape the design:

- **A type annotation is a symbol or a string.** `dyn` and `int=0` are legal bare; anything with a
  bracket or a space is written `"int=[0..9]"`. Both go to `ty-try-parse`, so the type notation has
  exactly one definition and JSL cannot drift from `text.coil`'s printed form.
- **A quoted token is a type in `:params`/`:ret` and a string literal everywhere else.** The two
  positions never overlap, so nothing is ambiguous.

`coil.reader` also carries `lo`/`hi`/`source` on every node and returns a `Diag` on malformed input,
which `jsl-read!` keeps as `JSL-ERR-PARSE` rather than retelling.

**Every refusal carries a source range**, which the roadmap requires of unsupported input. A
current-form cursor is stamped at each walk entry and `jsl-fail!` copies it, so the range is the
innermost form that was under inspection rather than the whole declaration — a range covering the
file is a range that tells a reader nothing. `jsl-load-index!` registers each unit's path against
the source id the reader stamps on its nodes, so a multi-unit library's diagnostics name the file:

```
lib/string/index-of.jsl:412-419: JSL-ERR-UNBOUND at "needle"
```

A definition, from `lib/string/index-of.jsl` — the whole of `String.prototype.indexOf`:

```clojure
;; https://tc39.es/ecma262/#sec-string.prototype.indexof
(builtin String.prototype.indexOf
  :transitioning true
  :params [(this dyn) (search dyn) (position dyn)]
  :ret    int
  (let ((s      (%ToString (RequireObjectCoercible this)))
        (needle (%ToString search))
        (pos    (%ToInteger position)))
    (StringIndexOfFrom s needle pos)))

;; Steps 5-7, over already-coerced arguments, shared with startsWith/endsWith/includes.
(builtin StringIndexOfFrom
  :params [(s dyn) (needle dyn) (start dyn)]
  :ret    int
  (%StringIndexOf s needle (Clamp start 0 (%StringLen s))))
```

`builtin` gets its own `OP-FUN` and is reached through `OP-CALL`; the optimiser may still inline it,
because the world is closed. `macro` has no `OP-FUN` at all: its body is lowered *again*, at each
call site, with its parameters bound to the caller's already-lowered argument nodes. That is real
inlining with no cloning machinery — re-lowering from source is simpler than copying a graph and
automatically correct, because the source is the only description of the macro that exists.

A macro is the only kind that may carry a label, because a label is a control edge into the
caller's CFG and a control edge cannot cross a call boundary. Torque draws the same line for the
same reason.

```clojure
(macro Positive :params [(x dyn)] :labels [Bail]
  (if (%Lt x 0) (goto Bail) (%Mul x 10)))

(builtin classify :params [(x dyn)] :ret dyn
  (Positive x :otherwise -1))
```

`goto` parks the current control on the label's pending list and marks the path *diverged*; nothing
further is built on it. The destination does not exist inside the macro — it is built at the **call
site** out of every exit that reached the label, marked cold ([D4](DECISIONS.md#d4-guards-are-control-flow-not-a-node-kind)),
and joined to the normal exit with a Region and a Phi. That is the whole of Torque's `otherwise`: a
macro names where it gives up, and the caller decides what giving up means.

Two things the checker enforces that are easy to get wrong. A macro that reaches itself has no
fixed point, so `jsl-check-macro-cycles` runs a three-colour DFS over the macro call graph and
reports `JSL-ERR-MACRO-RECURSION` **before** anything is lowered — a depth cap in the lowering
would report the wrong thing (a legal deep nest) at the wrong time (after nodes had been built).
And a macro body is lowered in the caller's lowering state, so the binding lookup carries a *frame
floor*: without it a macro would see its caller's `let` bindings, which is dynamic scoping that
misbehaves only when a caller happens to pick one of the macro's own names.

The ECMAScript abstract operations — `ToPrimitive`, `ToNumber`, `ToPropertyKey`,
`LengthOfArrayLike`, `SameValueZero` — are written **in** JSL, not declared extern. That is where
most of the leverage is. `ToPrimitive` is about thirty lines of JSL and today exists nowhere; its
pieces are scattered ad hoc through `fng-number-value`, `fng-int-value` and `fng-string-coerce` in
the frontend, which is three partial coercion implementations that no test compares to each other.

### The expression core

| Form | Meaning |
|---|---|
| `(let [(x E) …] BODY…)` | sequential binding; a binding is an SSA value and emits no node of its own |
| `(loop [(x init [type]) …] BODY…)` | `OP-LOOP` plus one `OP-PHI` per binding; the optional type fixes its carried representation |
| `(recur v …)` | iterate: park the control and the next values on the back edge, and diverge |
| `(if C A B)` | `OP-IF`, two `OP-CPROJ` arms, `OP-REGION`, `OP-PHI` |
| `(%Prim a …)` | one primitive op, arity-checked |
| `(Name a …)` | a call to another JSL `builtin` |
| `(call fn a …)` | invoke a JavaScript function value, advance control, thread the heap, and box its result |
| `(call-with-receiver fn this a …)` | invoke ECMAScript [[Call]] with an explicit receiver, threading the same control and heap effects |
| `(call-dynamic-with-receiver fn this a …)` | invoke a callable obtained from the heap after narrowing it to the closed set of frontend-visible JavaScript functions |
| integer, float | `OP-CONST` at `t-int-con` / `t-flt-bits` |
| `"…"` | a string constant, interned through `jss-from-utf8!` |
| `true` `false` `undefined` `null` | `OP-CONST` at the matching lattice constant |
| symbol | a parameter or a `let` binding |

Every other head symbol is an error with a name. `class` remains declared unimplemented and refused
by `JSL-ERR-UNSUPPORTED`; there is no accepted-and-approximated path.

---

## The library on disk

`lib/index` lists the units in load order and `jsl-load-index!` reads them, then checks the whole
table once. Reading and checking are separate passes because a body may call a definition in any
file, so the table has to exist before a name is resolved.

**An explicit index rather than a directory scan.** A scan's order is the filesystem's, and load
order is observable: it fixes declaration indices, which are closed-world function indices, which
appear in every printed graph and every golden hash. A library that reordered itself when a file was
renamed would make a golden diff mean nothing. An index that names no unit is `JSL-ERR-EMPTY-INDEX`
rather than an empty library, because every assertion a suite makes over a loaded library is
vacuously true of one that loaded nothing.

**`String.prototype.indexOf` is complete.** All seven spec steps, with `RequireObjectCoercible` and
`ToIntegerOrInfinity` real rather than approximated, checked against Node over 26 cases covering
fractional positions, both infinities, NaN, `undefined`, `null`, booleans, numeric strings with and
without surrounding whitespace, exponent and hex forms, the empty string, a non-string search value,
and both nullish receivers. The `Infinity` rows are the ones that matter: `%ToInteger` is
ToIntegerOrInfinity and not `|0`, and `|0` answers 0 for both infinities, so
`"abc".indexOf("c", Infinity)` would find the `c` at index 2 instead of returning -1.

**The table's provenance is reproducible, and the table can fail.** `tools/jsl-gate.sh` makes three
claims over 250 cases: Node regenerates `tests/jsl-string-oracle.txt`; the JSL library run through
the evaluator reproduces the same file; and two independently injected defects — `|0` in place of
ToIntegerOrInfinity, and `floor(x + 0.5)` in place of `Math.round` — each **differ** from it. Two,
because one injected defect only proves the rows it touches. Node and JSL are each compared against one committed artefact rather than against each
other, so neither can drift into agreement with a stale copy of the other, and the case list is
transcribed independently in `tools/jsl-string-oracle.mjs` and `tools/jsl-string-oracle.coil` —
a shared generator would make the comparison self-consistent, which is the one thing an oracle must
not be.

The gate was falsified two ways before being trusted. Replacing `%ToInteger` with `%BitOr … 0`
aborts the evaluator (`Infinity` is not representable through ToInt32), and shifting the clamp's
lower bound from 0 to 1 — a defect that runs cleanly — produces a readable diff at the
`indexOf("", 0)` row.

**One documented deviation, in step 1.** RequireObjectCoercible must throw a **TypeError**. Error
classes do not exist yet — no error objects, no prototypes, no `instanceof` (roadmap R03) — so the
throw carries the message string and the class is wrong. The throw happens, on the right inputs,
with the right message; only the class is missing. That is recorded here and asserted by the suite,
rather than left as a silent approximation.

**The library, as it ships.** 88 declarations — 55 macros, 33 builtins — across `lib/abstract`,
`lib/math`, `lib/number`, `lib/array` and `lib/string`, all verified against Node by
`tools/jsl-gate.sh`:

| Area | Entries |
|---|---|
| Abstract ops | `Clamp` `ToBoolean` `ToInt32` `ToUint32` `ToLength` `SameValueZero` `IsNaNValue` `RelativeIndex` `RequireObjectCoercible` `NaN` `Infinity` `NegInfinity` |
| `Math` | `abs` `sign` `trunc` `floor` `ceil` `round` `max` `min` |
| `Number` | `isNaN` `isFinite` `isInteger` `isSafeInteger` |
| `Array.prototype` | `indexOf` `includes` `lastIndexOf` `at` `join` `push` `pop` `shift` `slice` |
| `String.prototype` | `indexOf` `lastIndexOf` `startsWith` `endsWith` `includes` `repeat` `padStart` `padEnd` `charAt` `charCodeAt` `at` `slice` `trim` `trimStart` `trimEnd` `replaceAll` |

Several of these need no primitive at all, which is the point of having a language rather than a
descriptor table. `ToBoolean` is `(%Not (%Not v))`, because `%Not` is JavaScript truthiness.
`ToInt32` is `(%BitOr v 0)`, because the bitwise operators already perform that conversion on their
operands. `NaN` is `(%Div 0 0)` and the infinities are `(%Div ±1 0)`, so JSL needs no non-finite
literal. And `Number.isNaN` is `(%Not (%Eq v v))` — exact, with no type test, because a value fails
to equal itself exactly when it is a NaN Number. Each is a `macro`, so each costs no call.

Two are worth reading for the trick they turn. `MathAbs` is
`(if (%Lt x 0) (%Sub 0 x) (%Add x 0))`, where the `+ 0` on the non-negative arm is what makes
`abs(-0)` answer `+0` under IEEE without a special case, leaving NaN and both infinities alone.
`MathRound` is deliberately **not** `floor(x + 0.5)`: at `0.49999999999999994` — the largest double
below a half — the sum rounds up to exactly 1.0 and the naive form answers 1 where the spec answers
0. That value is in the conformance table, and it is the row that makes the round falsification bite.

**What `loop` unlocked.** `StringRepeatCount`, `StringLastIndexOf` and `StringPadStart` are the
first units that iterate, and none was expressible before it. `StringLastIndexOf` is worth reading:
it walks *forward* keeping the last match, because the primitive is a forward `%StringIndexOf`, and
it carries a `from > len` guard without which an empty needle never terminates — `StringIndexOfFrom`
clamps its start, so past the end an empty needle matches at `len` for ever. That row is in the
conformance table precisely because the bug is invisible without it.

**What is still deliberately absent, and why.**

- **Negative zero.** `%Neg 0.0` yields `+0` in this runtime, so `-0` is not constructible and no
  claim about it is tested. The definitions are written to be correct if one ever arrives —
  `MathAbs`'s `+ 0`, `MathSign` returning `x` unchanged on the zero arm — but that is reasoning, not
  evidence, and it is recorded as such.
- **The Unicode whitespace set.** `StringTrim` removes the ASCII whitespace, NBSP and ZWNBSP. The
  rest of the Zs category needs a table this runtime does not have, so it is a named gap rather than
  a `<= 0x20` approximation that would trim the wrong things.
- **Callback receivers.** `(call fn args...)` now implements the callback array family and carries
  the caller's heap through `CallEnd`. The remaining ABI work is explicit `thisArg`: source
  functions currently omit the receiver slot when they do not reference `this`, so JSL cannot yet
  use one uniform receiver-bearing call for every target.
- **`Math.pow`, `sqrt` and the trigonometric functions** stay `jsbuiltin_desc.coil` descriptors:
  they are libc calls, not compositions of the primitives JSL has.

**A worked example of what inlining buys.** `Clamp` began as a `builtin`. That put an `OP-CALL` on
`StringIndexOfFrom`'s only path and forced `:transitioning true` onto it. Changing one word to
`macro` removed the call, and the annotation came off with it — and because the transition check
reads the lowered graph rather than the source, that is safe to rely on: had the inlining not
happened, the declaration would no longer lower.

---

## Iteration

A JSL loop is a **tail-recursive binding group**. The body is an expression: if it evaluates to
`(recur …)` the loop iterates with those values, and otherwise that value is the loop's value.

```clojure
(loop [(i 0) (acc 0)]
  (if (%Lt i n) (recur (%Add i 1) (%Add acc i)) acc))
```

The optional third binding item declares a representation when inference cannot recover it across
the back edge: `(loop [(cursor start int) (out "" str)] ...)`. This is the same job as a typed
Torque local. It is checked by the ordinary JSL type parser and attached to the Phi; an unknown
type or a fourth binding item is rejected instead of ignored.

That shape maps one-to-one onto the IR: one `OP-PHI` per binding, the initialiser on the entry edge
and the recur value on the back edge. So JSL needs **no assignment form and no mutable local** —
which matters, because a `let` binding is already an SSA value and an assignment form would have
introduced a second, contradictory notion of a name.

`recur` diverges exactly as `goto` does, so `(if c (recur …) v)` needs no special case: one arm
bails, the other carries the value, and the merge collapses to the surviving arm. Divergence also
propagates through operands, which is semantics rather than a safety net — a `recur` in non-tail
position transfers control, so the enclosing expression never happens.

Three things the implementation has to get right, each of which produced a real bug before it was:

- **Nothing under construction is peepholed.** A node whose back edge is still the `NO-NODE`
  placeholder is not structurally meaningful, but GVN cannot tell: two bindings starting from the
  same value are `Phi(loop, Const 0, NO-NODE)` twice over, identical, and the second is deduped into
  the first. Both bindings then name one phi and the failure surfaces several nodes away as
  `n-in: input index out of range`. The frontend's `fng-if-expression` builds every phi the same way
  for the same reason.
- **A `recur`'s control is recorded after its arguments are evaluated.** An argument may move
  control — a nested `loop`, a call, an `if` — so recording it on entry names the block the
  arguments started in, and the back edge then leaves a block that no longer runs.
- **Each loop carries its own base into the recur arrays.** `rvals` holds `nbind` entries per recur,
  so deriving a value offset from the control index silently reads a sibling loop's values the
  moment two loops disagree about their arity.

A loop nothing recurs to (`JSL-ERR-LOOP-NO-RECUR`) is a `let` written the long way and would leave
the back edge null; a loop everything recurs from (`JSL-ERR-LOOP-NO-EXIT`) cannot terminate and
leaves the enclosing body with no Return. Both are named at lowering rather than left to produce a
malformed graph.

Recursive generated builtins are also a specialization boundary. `JSON.stringify` keeps its
string-quoting loop inside a called `JsonStringifyPlainValue` builtin rather than expanding it at
the top-level call site: inlining a loop after the caller has established heap memory would create
a useless self-carried memory Phi. This mirrors Torque's split between macros for local graph
visibility and builtins for recursive or representation-stable calling shapes.

---

## The primitive layer

A primitive is spelled `%Name` and is exactly one IR op. The table lives in `jsl.coil` as
`jsp-name` / `jsp-op` / `jsp-arity`, in the same one-function-per-column shape as
`jsbuiltin_desc.coil`, so a primitive is added in one place and a missing column is a compile
error rather than a silent zero.

The layer is deliberately thin, and it is the whole porting surface:

- arithmetic and comparison — `%Add %Sub %Mul %Div %Mod %Neg %Not %Eq %Lt %Le`
- bitwise — `%BitAnd %BitOr %BitXor %Shl %Shr %Ushr %BitNot`
- strings — `%StringLen %StringEq %StringConcat %StringCharCode %StringIndexOf %StringCompare
  %StringFromCode %StringLower %StringUpper`
- conversions — `%ToString %ToInteger %ParseInt %IsNaN %NumberToString`
- heap — `%NewArray %ArrayLen %ArrayLoad %ArrayStore %ArrayResize %PropLoadNamed
  %PropStoreNamed`
- representation capabilities — `%Box %BoxArray %UnboxInt %UnboxFlt %UnboxBool %UnboxObj %UnboxString
  %IsArray %UnboxArray`
- control — `%Throw`

`%BoxArray` is the typed form of `%Box` for a raw array handle. It records the runtime Array tag
explicitly, so recursive calls and optimization do not have to reconstruct representation
provenance from an `ArrayMark` node that may no longer be adjacent to the boxing boundary.

`%ToInteger` is the one primitive so far added *for* JSL rather than inherited. It is
`OP-TOINTEGER`, and it is ToIntegerOrInfinity — the whole spec abstract operation as one op,
because splitting it would put ToNumber, the NaN-to-zero rule and the truncation in three places
that could disagree. Adding it cost arms in `node.coil`, `verify.coil`, `gtext.coil` and
`eval.coil`; it has **no** `backend_select.coil` arm yet, so a JSL builtin using it compiles under
the evaluator and fails native selection with `MSEL-UNSUPPORTED` rather than miscompiling. That is
the machine surface growing, which is the design's expectation, not the ECMAScript surface growing.

`%IsArray` and `%UnboxArray` deliberately form a pair. The former consumes a tagged JavaScript
value and proves the Array runtime tag; the latter consumes that proven tagged representation and
produces the raw managed pointer required by `%ArrayLen` and `%ArrayLoad`. Arrays and ordinary
objects intentionally share the `t-obj` lattice kind, so weakening `%UnboxObj` to accept both tags
would erase a representation check. This is the same boundary Torque expresses with a type guard
followed by a cast to `JSArray`: a semantic definition chooses the branch, while a small extern-like
capability performs the representation transition.

Memory, allocation, and JavaScript callback calls are now expressible and threaded by the lowerer.
Safepoints and write barriers remain backend-generated implementation details rather than library
semantics. An unimplemented `%Name` still becomes `JSL-ERR-UNKNOWN-PRIM`; it cannot be reached by
accident.

---

## What the checker refuses

[D11](DECISIONS.md#d11-a-tool-is-only-a-tool-if-it-can-fail) says a tool is only a tool if it can
fail, and `text.coil`'s rule applies verbatim: a reader that returns a plausible declaration on
malformed input turns a format bug into a miscompile hunt. So every refusal has a **name**, the
name is asserted by a test, and `jsl-err-name` renders it.

| Code | Refuses |
|---|---|
| `JSL-ERR-NOT-A-LIST` | a top-level form that is not a list |
| `JSL-ERR-UNKNOWN-FORM` | a top-level head that is not `builtin` |
| `JSL-ERR-UNSUPPORTED` | a form that is designed but not implemented, named in the message |
| `JSL-ERR-BAD-NAME` | a missing or non-symbol definition name |
| `JSL-ERR-DUP-NAME` | two definitions of one name |
| `JSL-ERR-BAD-KEY` | an unknown `:keyword`, or one with no value |
| `JSL-ERR-BAD-PARAMS` | `:params` that is not a **vector** of `(name type)` pairs |
| `JSL-ERR-BAD-TYPE` | an annotation `ty-try-parse` rejects |
| `JSL-ERR-BAD-BOOL` | a `:transitioning` / `:cold` value that is not `true` or `false` |
| `JSL-ERR-NO-BODY` | no body expression, or more than one |
| `JSL-ERR-UNBOUND` | a symbol that is not a parameter, a binding, or a literal |
| `JSL-ERR-UNKNOWN-PRIM` | a `%Name` with no entry in the primitive table |
| `JSL-ERR-UNKNOWN-CALL` | a call to a name that is not a declared `builtin` |
| `JSL-ERR-ARITY` | a primitive or call with the wrong operand count |
| `JSL-ERR-BAD-LET` | a `let` whose bindings are not `(name expr)` pairs |
| `JSL-ERR-BAD-IF` | an `if` without exactly three operands |
| `JSL-ERR-NO-SUCH-FILE` | an index entry, or an index, that will not open |
| `JSL-ERR-EMPTY-INDEX` | an index that named no unit at all |
| `JSL-ERR-MACRO-RECURSION` | a macro that expands into itself, directly or not |
| `JSL-ERR-BAD-LABELS` | `:labels` malformed, or declared on a `builtin` |
| `JSL-ERR-TOO-MANY-LABELS` | more labels than `JSL-MAX-LABELS` |
| `JSL-ERR-BAD-GOTO` | `goto` naming no label of the enclosing macro |
| `JSL-ERR-MISSING-OTHERWISE` | a labelled macro called with no `:otherwise` |
| `JSL-ERR-UNEXPECTED-OTHERWISE` | `:otherwise` on a callee that has no label |
| `JSL-ERR-PARSE` | `coil.reader` refused the bytes; its `Diag` message is kept as the error site |
| `JSL-ERR-UNDECLARED-TRANSITION` | a non-`transitioning` definition whose **lowered graph** contains a call or a safepoint |

The last row is the one that is worth more than the others, and it is the reason the check runs
after lowering rather than over the source. Torque's `transitioning` is an annotation discipline
that the Torque compiler enforces syntactically. Here it is checked against the graph that was
actually built, by walking the definition's reachable cone for `OP-CALL` and `OP-SAFEPOINT`. An
annotation cannot be wrong about what the lowering did, because the thing inspected is the lowering
output. That makes it strictly stronger than the version it is modelled on.

`jsl-check` reports the **first** failure with its code and the offending name, and `jsl-load!`
refuses to leave a half-built declaration in the table: a definition either enters the table
complete or does not enter it.

---

## The pipeline

```
lib/index  ->  lib/**/*.jsl
  -> src/jsl.coil          read (coil.reader) + check; every refusal has a name
  -> src/jsl_lower.coil    emit the ideal graph through node.coil's builders
  -> out/runtime.gtext     golden, diff-checked by tools/gate.sh          [PLANNED]
       |-> src/eval.coil       runs it; differential oracle against Node
       `-> src/backend_*.coil  compiles it, inlinable into user code
```

Lowering into a checked-in `gtext` rather than re-lowering per compile is
[D7](DECISIONS.md#d7-textual-ir-is-a-first-class-round-trippable-format) applied to the runtime: a
change in lowering then shows up as a reviewable **graph diff**, which is the form the gate already
runs on. That stage is planned, not built; today `jsl-lower!` builds the graph in memory and the
test suite runs it through `ev-run-nobind`.

Two things fall out of the declarations and should be taken when the corpus is large enough to make
them worth generating:

- **R00's support manifest generates itself.** The roadmap wants one machine-readable manifest
  distinguishing `supported` / `partial` / `unsupported`, generated rather than curated. The `.jsl`
  declarations *are* that manifest — name, `:transitioning`, `:ret`, and the spec link per entry.
- **Roadmap rule 5** asks that runtime operations sit behind typed descriptors declaring coercion,
  allocation, safepoints, exceptions and side effects. A JSL signature is that descriptor, and
  `jsbuiltin_desc.coil` is its seventeen-entry ancestor.

---

## The heap

`lib/array/` holds `indexOf`, `includes`, `lastIndexOf`, `at`, `join` (reads) and `ArrayPush1`,
`ArrayLength`, `ArrayPop`, `ArrayShift`, `ArraySlice`, `ArrayIota`, `ArrayRepeat`, `ArrayMapDouble`
(allocating and mutating). All are Node-verified: a probe definition builds the array with
`ArrayIota` and reads it back inside one function, so nothing crosses a call.

**Memory is implicit.** `%ArrayLen`, `%ArrayLoad`, `%ArrayStore` and `%NewArray` take the heap from
the lowering rather than from an operand, and a store's new memory becomes current automatically.
A definition reads like the spec rather than like memory SSA.

**Memory crosses calls as an implicit effect.** The source signature remains ordinary JavaScript
data, but a heap-using `builtin` has one additional trailing call operand. The callee views it as a
function-entry memory `OP-ARG`; after the call, the caller's current memory is a CallEnd-rooted
`OP-ARG`. This is deliberately structural—no typed `OP-PARM` is smuggled into a memory slot—and it
matches the verifier's existing rule that the final call argument may be a memory producer.

Memory use is inferred to a fixpoint through JSL calls, so a helper that calls a heap-using helper
inherits the effect even if it has no primitive heap operation itself. Macros still inline directly
against the caller's memory. Builtins now provide the code-sharing and recursion counterpart; this
is what permits a recursive parser or object walker to live in JSL without hiding managed-object
allocation inside a C runtime operation.

**`%ArrayResize` takes three operands, and the third is an ORDERING VALUE.** `pop` loads the last
element and then shortens the array. Nothing in the memory chain says a read precedes a later write
of the same memory, so the load floats past the write that destroys what it read and selection
refuses the block with `MSEL-MEMORY-ORDER`. `OP-ARRAYRESIZE`'s fifth input exists for exactly this;
JSL has to name it because JSL has no other way to say "after". It is the only primitive so far
whose signature carries a scheduling fact rather than data.

**Two spec branches became clamps, and both are smaller and more correct than the branch.**
`[].pop()` is `undefined` with the length left at 0, and the spec says so with a step-3 guard.
Clamping the index to `[0, len]` gets the same answer with no `If`: on an empty array the index is 0,
a load past the end already reads `undefined`, and resizing to 0 changes nothing. The guard version
was tried first and is a Phi over `Const undefined` and a boxed load — a shape the representation
seam does not carry, so `popped * 10 + values[0]` answered one low. `shift` uses the same clamp.

**Four bugs the heap work produced, each now pinned:**

- **Memory must be established before the body, not on first use.** A heap first touched inside a
  loop has no memory at the loop's entry, so no loop memory Phi is built — and every iteration then
  reads the entry heap instead of what the previous one wrote.
- **Heap reads must be anchored to the current control** (`n-array-length-at!`, not
  `n-array-length!`). A read with a null control anchor floats, ordered by its memory edge alone,
  which is right for a straight-line body and wrong the moment the memory is loop-carried:
  `(%ArrayLen a)` after a loop that never ran answered 1 instead of 0.
- **A value parked for `recur` must be pinned until the loop closes.** It lives in a Coil array, not
  a graph edge, so until `jl-loop-close!` wires it into a phi it has no user at all — and `jl-drop!`
  collects it as dead code, leaving the phi wired to a killed node.
- **A definition that touched the heap returns its final memory.** With nothing reading the last
  store, the kill cascade collects the entire chain and `g-verify` reports `VERR-LEAK`.
- **A loop publishes the memory on its exit edge.** The header memory Phi describes memory at the
  start of an iteration, not after the final body. Returning the header Phi discarded stores made
  by the last iteration; loop closing now records and publishes the exiting body's memory.

### Three backend defects the mutating entries exposed

None of these is a JSL bug, and all three were already in the tree: writing an array in a loop and
then reading its length back is a shape nothing had ever compiled.

- **A control-anchored heap operation was not held to its anchor.** `ms-gcm-place!` derives a block
  from value inputs, and a store's result vreg usually has no consumer — so `latest = earliest` and
  the store landed at its earliest block, which for a store reading a loop-header memory Phi is the
  LOOP HEADER. It then ran once per header visit rather than once per body visit, and
  `(%ArrayLen (ArrayIota 3))` answered **4** as machine code. Reads have the same problem in the
  other direction: `ArrayShift` loads element 0 and its only consumers are after the loop, so GCM
  sank the load past the moves and `shift` answered the SECOND element. `n-array-load-at!` and
  `n-array-store-at!` take a control input precisely to say where the operation belongs, and
  `ms-inst-anchor-block` now makes that a constraint in the placer and in its verifier alike.
- **The memory anti-dependency vector described a schedule that no longer existed.** It is built at
  the end of selection and its membership rule names block ids — which GCM then changes. A read GCM
  hoisted into a dominating block became required by the verifier and absent from the vector, and
  `ArrayShift` could not be compiled at all (`MSEL-MEMORY-ORDER`). It is rebuilt after placement.
  This is the same mistake, in the same shape, as the `schedule-order` refresh below.
- **The closed-world function index was the DECLARATION index.** A function index is a bit in
  `Val.fidxs`, a 64-bit set, and `be-call-return-kind-fuel` skips any function at 63 or above. Macros
  are 55 of the library's 88 declarations and have no `OP-FUN` at all, yet each consumed a bit.
  Adding five array entries pushed `StringIndexOfFrom` to index 66; its bit fell outside the mask, so
  the return kind of a call to it became unknown and boxing that result failed selection with
  `MSEL-UNSUPPORTED` — reported against **`String.prototype.indexOf`**, which uses none of the new
  definitions. `jsl-decl-fidx` counts only the builtins, which takes that declaration from 66 to 29.

A fourth defect found this way was recorded rather than papered over, and has since been fixed: a
single arithmetic expression of about twenty terms mixing boxed array elements with unboxed lengths
miscompiled, and the answer varied between runs of the same binary while every underlying runtime
call was correct. Nothing about arrays was involved — the query that decides whether a `+` is an
integer or a floating-point add carried eight units of fuel, so it answered "no" for any operand
chain longer than that and the two sides of one expression disagreed about where the value lived.
It, and the two further defects chasing it turned up, are in
[JOURNAL.md](JOURNAL.md#the-representation-seam-three-miscompiles-a-depth-bound-was-hiding).

---

## Specialisation: which pass actually does it

The decisive claim for a JIT-free compiler is that a fast path with a decidable guard becomes
straight-line code. It does. Given

```clojure
(macro Positive :params [(x dyn)] :labels [Bail]
  (if (%Lt x 0) (goto Bail) (%Mul x 10)))

(builtin fast :params [(y dyn)] :ret dyn
  (Positive 7 :otherwise (%Add y 999)))
```

`fast` compiles to `Return Const int=70`. No call, because a macro is inlined into its caller; no
branch, because the guard folded; and no `%Add`, because the whole bail-out path went with it.

**Which pass does it matters, so it is stated exactly.** The lowering does *not* skip the slow path
here. `%Lt 7 0` folds to `Const bool=0` at construction, but the `If` is still built, the `goto`
still fires, and the handler is still emitted — the graph straight after lowering contains the `If`,
both `CProj` arms, `Add y 999`, and a Region and Phi merging them. It is `iterate!`, the peephole
fixpoint, that collapses all of it. `jl-macro-finish`'s no-exits path is a real optimisation, but it
fires when a `goto` is unreachable in the *source*, not when it is merely decidable.

That is still the thesis rather than a weakening of it. V8 reaches this shape by speculating and
retaining deopt metadata to retreat with; under D1's closed world it falls out of ordinary constant
propagation, with no deoptimisation machinery anywhere. `tests/jsl-test.coil` pins both halves: the
folded case asserts zero `If`, `Add`, `Mul` and `Lt` nodes survive, and its falsification asserts
that the same macro with an opaque argument keeps all of them.

---

## What is deliberately not here

**`class` is refused, not approximated.** A JSL class needs to mint `shape-transition` chains. That
form remains designed but unbuilt, so it reports `JSL-ERR-UNSUPPORTED` by name. `loop` is built:
it lowers to `OP-LOOP`, value Phis, and an implicit memory Phi when its body touches the heap.

**Not everything belongs in JSL.** V8 keeps Date, JSON, the irregexp engine, `dtoa` and Intl in
C++ and does not pretend otherwise; the same holds here. Those arrive as declared foreign calls
with declared effects, inside the descriptor model rather than scattered through lowering. The
declaration form for them is not built.

**The primitive ops do not disappear.** `OP-STRINGINDEXOF` survives as `%StringIndexOf`, and it
should — a primitive is exactly what it ought to be. What dissolves is the *semantic wrapper*: the
coercion sequence that is currently duplicated across the frontend, the evaluator and instruction
selection. That is where the ten sites per builtin were, and that is what stops multiplying.

**A declared parameter type is a claim, not a fact.** Under
[D1](DECISIONS.md#d1-closed-world-verified-types-speculative-monomorphisation-with-generic-backups)
and [D8](DECISIONS.md#d8-a-rewrite-may-only-act-on-a-proven-type-and-proven-is-narrower-than-it-sounds)
an annotation is a contract to discharge, and `ANY` is the absence of information rather than a
claim. So JSL does **not** inject `:params` types onto `OP-PARM` nodes, because that would hand the
optimiser an unproven claim it is entitled to act on, which is precisely the failure D8 exists to
prevent. Parameter types are recorded on the declaration and compared against what closed-world
inference computes. The comparison is not built yet; until it is, the annotation is documentation
and the analysis is unaffected by it, which is the safe direction to be wrong in.

---

## Linking the library into compiled JavaScript

`jsl-call!` has always been able to call a lowered definition. What was missing was a caller: the
TypeScript frontend built its own IR nodes for every JavaScript builtin, so the library was verified
and unused. `String.prototype.indexOf` is the first operation the frontend actually emits through
JSL — `tests/native-conformance/string-index-of.ts` is compiled to machine code and its answers come
out of `lib/string/index-of.jsl`. Perturbing that `.jsl` file turns the conformance gate red, which
is how the claim is checked rather than asserted.

Two things make the seam work.

**Definitions are pulled, not lowered wholesale.** `jsl-require!` lowers one definition and its
transitive callees. Programs that call no builtin get exactly the graph they got before, which
matters because `tests/frontend-exact-graph-test.mjs` compares the frontend's `g-render` output byte
for byte against the JavaScript codegen.

**The seam is representation, and it is narrower than "everything is NaN-boxed."** A JSL `dyn`
parameter holds whatever representation the value already has: a string literal in a `.jsl` file
lowers to `n-string-const!`, a raw pointer, and `%StringIndexOf` reads it as one. So the frontend
passes its string straight through — boxing it would hand the library a tagged word where it expects
a pointer. `StringIndexOfFrom` takes `(s dyn) (needle dyn) (start int)` and returns `int`, which is
exactly what the IR node it replaces took and returned, so nothing at the boundary converts.

### The scheduling bug this exposed

Wiring the first call into the middle of an expression exposed a real backend defect, since fixed in
`src/backend_select.coil`.

A call is pinned to its control edge; its arguments are ordinary floating nodes. The within-block
list scheduler carries three edge kinds: real data edges, memory edges, and a third class that only
means "these two were in this order when we got here, keep them that way". That third class asks
`before`, which reads the current instruction order — the order the scheduler was invoked to fix.

A call at instruction 17 consumed a string built at instruction 37, so the effect rule added
17 -> 37 because 17 came first, while the data edges ran 37 -> 26 -> 23 -> 20 -> 17. Nothing could be
emitted. The block reported `MSCHED-CYCLE`, the repair path gave up, and the original order survived
to fail verification with `MSEL-DEPENDENCY`. Note the cycle is five instructions long: refusing to
contradict a *direct* data edge would not have been enough.

`ms-schedule-block!` now retries the block with the two call/effect clauses dropped. That is safe
because they are a backstop rather than the mechanism — genuine aliasing between a call and an
allocation is carried by the memory edges, which come from the node graph and never consult
`before`. Store/store order and the structural constraints are untouched in both passes.

The retry alone was not enough. `schedule-order` still described the pre-sort order, so verification
demanded the new schedule preserve exactly the relative order that had just been deliberately
changed. It is refreshed after the instruction list is rebuilt, which makes the order-preserving
edges describe the schedule that actually exists.

`tests/native-conformance/strings-and-conversion.ts` now calls `indexOf` mid-expression, which is
the shape that failed. Reverting the scheduler change turns that gate red.

### What the conversion costs, and the one thing that would make it free

`jsl-inline!` expands a definition's body into the caller's graph rather than calling it, which is
the split Torque draws between an inlined `macro` and a called `builtin` — with the difference that
the caller chooses, because the frontend is emitting the operation rather than invoking it. That was
not a preference: routing Math through `jsl-call!` cost 48.9ms -> 75.9ms on
`benchmarks/typescript-aot/math-loop.ts`, and inlining recovered it to 71.0ms.

The remaining gap is a guard that will not fold. `%FloorNum` lowers to the very `OP-JSBUILTIN` the
frontend used to emit by hand, so the library's `MathFloor` is that node plus `if (%IsInt v)`. For
the conversion to be free, the guard has to disappear on an argument whose kind the caller knows.

**Why it does not.** `box-compute` reports `dyn`, and it cannot do better. A type here is a KIND SET
with no representation bit, so `t-flt` means "a raw double in an FP register" — precisely the wrong
claim about a tagged word in a general-purpose one. `Box` therefore forgets, and `typetest-compute`,
which folds the moment its input is provably inside or outside the target, never receives anything
it can decide. The fact is one edge away, on what was boxed.

**Two ways to read it there, both of which failed, and they failed for the same reason.**

- In `compute`: cannot ask `n-ty-proven?` at all. It walks the input cone, the analysis is already
  walking one, and the shared mark and stack buffers make that reentrancy a named graph corruption.
  So a compute can only read a PROVISIONAL type.
- In `idealize`: `n-ty-proven?` is legal there, and a unit test in `tests/node-test.coil` confirmed
  the fold was correct in isolation — `flt` folds to false, `int` to true, `num` stays.

Both turned `tools/jsl-gate.sh` and `tools/jsl-native-gate.sh` red with `VERR-ARITY`, on definitions
that were fine before. The mechanism was never the problem: folding a `%IsInt` guard collapses an
arm of the enclosing `if` while `jl`'s diamond is still being built, and the half-built Region and
Phi are then left disagreeing. The prerequisite is in the LOWERING — `jl` has to tolerate a
condition that folds under it — and it is the next piece of work here.

**And it would not have helped `math-loop` anyway.** The fold fires only when the boxed value's
kind is decided. `i - 500` is `num`, which is `int|flt`: neither inside `int` nor disjoint from it,
so either answer would be a guess. `num` is what JavaScript arithmetic produces.

### What the conversion costs, resolved

Converting the string family initially cost a factor of 20 —
`benchmarks/typescript-aot/string-loop.ts` went 3.8ms to 79.4ms. Chasing it down took three separate
facts, and none of them was "the DSL is slow".

**1. `jsl-inline!` rather than `jsl-call!`.** A definition the frontend emits is expanded into the
caller's graph, not called. This is Torque's split between an inlined `macro` and a called `builtin`,
with the difference that the CALLER chooses. Worth 75.9ms -> 71.0ms on `math-loop`.

**2. Ranges decide comparisons.** `text.indexOf(needle)` lowers through `Clamp 0 0 (%StringLen s)`.
Its first test is two constants and always folded; its second, `len < 0`, did not, because a length
is a range rather than a constant and `cmp-compute` gave up on any non-constant operand. It now
decides `a < b` whenever `max(a) < min(b)` or `min(a) >= max(b)`, and `%StringLen` is typed
`int=[0..max]` because a length is never negative. Both are true independently of any benchmark.

**3. Analysis proves; something has to ACT on the proof.** `g-analyze!` only ever calls `n-compute`
— deliberately, since rewriting mid-fixpoint would act on provisional types. But nothing ran
afterwards, so a node the fixpoint had decided was a constant stayed a node. The clamp's result was
a `Phi : int=0` with a fully decided type, still pinned to its Region inside the loop, so the pure
loop-invariant `%StringIndexOf` consuming it could not be hoisted and re-scanned the haystack every
iteration. `g-fold-proven!` runs the peephole once the fixpoint has settled. It is D8-compliant by
construction rather than by promise: `n-peephole` already refuses to fold an unproven type, so the
same call before the fixpoint folds nothing.

The result is 4.1ms against a 3.8ms baseline, and the graph is back to the pre-conversion shape — 38
nodes and one `If`, down from 64 and five. Every pinned frontend fixture that moved got strictly
smaller (call 32 -> 31, control 37 -> 33, object 39 -> 38, full 87 -> 82); nothing grew.

**`math-loop` remains 1.45x, and that one is real.** `MathFloor` is `if (%IsInt v) v else
(%FloorNum v)`, where `%FloorNum` lowers to the same `OP-JSBUILTIN` the hand-written form emitted —
so the conversion is that node plus a guard, and the guard only disappears when the argument's kind
is decided. `i - 500` is `num`, which is `int|flt`: neither inside `int` nor disjoint from it, so
folding it either way would be a guess rather than a proof. Removing that cost means proving
integer-ness of JavaScript arithmetic, which is a real analysis and not a peephole.

A lowering-time fold in `jl-if` was tried and reverted. It broke
`a_decidable_guard_folds_to_straight_line_code`, and it was the wrong place regardless: nothing is
proven during construction, so it necessarily acts on provisional types.

---

## Reading order for the code

1. `src/jsl.coil` — the error codes first, then `jsp-*` (the primitive table), then `jsl-load!`
   (the reader) and `jsl-check` (the walk). The declaration table is a static singleton reached
   through `(jsl)`, the same shape as `(types)` and `(shapes)`.
2. `src/jsl_lower.coil` — `jl-expr` is the whole lowering; everything else is the binding
   environment and the post-lowering transition check.
3. `tests/jsl-test.coil` — the positive cases run their graphs through the evaluator and assert the
   value. The negative cases assert the **specific** code, because "it failed" is satisfied by a
   checker that always fails.
