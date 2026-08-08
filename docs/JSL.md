# JSL: the JavaScript library language

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
| `(loop [(x init) …] BODY…)` | `OP-LOOP` plus one `OP-PHI` per binding |
| `(recur v …)` | iterate: park the control and the next values on the back edge, and diverge |
| `(if C A B)` | `OP-IF`, two `OP-CPROJ` arms, `OP-REGION`, `OP-PHI` |
| `(%Prim a …)` | one primitive op, arity-checked |
| `(Name a …)` | a call to another JSL `builtin` |
| integer, float | `OP-CONST` at `t-int-con` / `t-flt-bits` |
| `"…"` | a string constant, interned through `jss-from-utf8!` |
| `true` `false` `undefined` `null` | `OP-CONST` at the matching lattice constant |
| symbol | a parameter or a `let` binding |

Every other head symbol is an error with a name. `loop` and `class` are **declared unimplemented and
refused by `JSL-ERR-UNSUPPORTED`**, which reports the offending form. They are not accepted-and-approximated, and there is no path by which a `.jsl` file
using one of them produces a graph.

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

**The library, as it ships.** 42 declarations — 13 macros, 29 builtins — across `lib/abstract`,
`lib/math`, `lib/number` and `lib/string`, all verified against Node by `tools/jsl-gate.sh`:

| Area | Entries |
|---|---|
| Abstract ops | `Clamp` `ToBoolean` `ToInt32` `ToUint32` `ToLength` `SameValueZero` `IsNaNValue` `RelativeIndex` `RequireObjectCoercible` `NaN` `Infinity` `NegInfinity` |
| `Math` | `abs` `sign` `trunc` `floor` `ceil` `round` `max` `min` |
| `Number` | `isNaN` `isFinite` `isInteger` `isSafeInteger` |
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
- **Anything needing a call into JavaScript.** `Array.prototype.map` with a real callback, `split`,
  and `replace` with a function all need `%Call`. `ArrayMapDouble` is `map` with the mapping fixed to
  a macro: it shows the shape — allocate, loop, read the source, write the result — that a real `map`
  will have once a function can be a value.
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
- control — `%Throw`

`%ToInteger` is the one primitive so far added *for* JSL rather than inherited. It is
`OP-TOINTEGER`, and it is ToIntegerOrInfinity — the whole spec abstract operation as one op,
because splitting it would put ToNumber, the NaN-to-zero rule and the truncation in three places
that could disagree. Adding it cost arms in `node.coil`, `verify.coil`, `gtext.coil` and
`eval.coil`; it has **no** `backend_select.coil` arm yet, so a JSL builtin using it compiles under
the evaluator and fails native selection with `MSEL-UNSUPPORTED` rather than miscompiling. That is
the machine surface growing, which is the design's expectation, not the ECMAScript surface growing.

Memory, allocation, calls into JavaScript, and the safepoint and barrier primitives are the next
tranche. They are not in the table yet, and `jsp-find` returns `JSP-NONE` for them, which the
checker turns into `JSL-ERR-UNKNOWN-PRIM` naming the primitive. An unimplemented primitive cannot
be reached by accident.

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

`lib/array/` holds `indexOf`, `includes`, `lastIndexOf`, `at`, `join` (reads) and `ArrayIota`,
`ArrayRepeat`, `ArrayMapDouble` (allocating). All are Node-verified: a probe definition builds the
array with `ArrayIota` and reads it back inside one function, so nothing crosses a call.

**Memory is implicit.** `%ArrayLen`, `%ArrayLoad`, `%ArrayStore` and `%NewArray` take the heap from
the lowering rather than from an operand, and a store's new memory becomes current automatically.
A definition reads like the spec rather than like memory SSA.

**Memory cannot cross a call, so the heap may only be read through an object the enclosing function
created.** `v-mem-producer?` decides what may occupy a memory slot **structurally** — "this pass runs
before types are evidence" — and `OP-PARM` is not on its list, so memory cannot be a parameter
however it is typed. Passing it as a call argument was tried: the verifier accepts it at the call
(`v-need-call-args` permits a memory producer last) and then rejects it at the callee. Each function
therefore synthesises its own entry heap, an opaque "some heap" that its own allocations layer onto
correctly — which is why a builtin may read back its own writes.

Reading through an array that arrived as a **parameter** is what is unsound, and the failure survives
review: `ArrayIndexOfFrom` written as a `builtin` answered `-1` for an element the caller had just
stored, verified clean, and ran to completion. `jsl-check-heap-shape` computes, to a fixpoint through
calls, which parameters reach a heap operand, and refuses any `builtin` that has one
(`JSL-ERR-HEAP-IN-BUILTIN`). A `macro` may, because it is inlined into its caller's graph. The
analysis follows a parameter used directly, passed to a call, or rebound by a `let`; one laundered
through a call that *returns* it is not followed, which is why this is documented rather than
presented as a proof.

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

**`loop` and `class` are refused, not approximated.** A JSL `loop` needs a `OP-LOOP` with loop Phis
and a closed back edge, and `class` needs to mint `shape-transition` chains. Both are designed above
and neither is built, so both report `JSL-ERR-UNSUPPORTED` naming the form. There is no path by
which a `.jsl` file using one produces a graph.

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

## Reading order for the code

1. `src/jsl.coil` — the error codes first, then `jsp-*` (the primitive table), then `jsl-load!`
   (the reader) and `jsl-check` (the walk). The declaration table is a static singleton reached
   through `(jsl)`, the same shape as `(types)` and `(shapes)`.
2. `src/jsl_lower.coil` — `jl-expr` is the whole lowering; everything else is the binding
   environment and the post-lowering transition check.
3. `tests/jsl-test.coil` — the positive cases run their graphs through the evaluator and assert the
   value. The negative cases assert the **specific** code, because "it failed" is satisfied by a
   checker that always fails.
