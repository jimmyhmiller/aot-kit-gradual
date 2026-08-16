# Handoff: move JavaScript semantics into the DSL

**THE TREE IS GREEN. 564 passed, 0 failed.** The arithmetic migration is landed: the five failures
the previous handoff recorded are fixed, and what fixed them is written down below because each was
a general lesson, not a local patch.

Read `docs/DSL-OWNERSHIP.md` for the measurement, the phases and the enforcement. This file is what
is in flight.

---

## The mandate, stated here so it is not a pointer

**Every JavaScript semantic moves into `lib/`. Not most of it, not the convenient parts — all of
it.** The frontend's job is to lower *syntax* into structure: control flow, scoping, memory and
alias plumbing, the call ABI, closure environments, shapes. The meaning of every operator, every
coercion and every builtin belongs to the DSL.

**The DSL's current expressiveness is never the limit.** If something cannot be written in `lib/`
today, the DSL is what is wrong and gets extended. A `%` primitive is the correct way for the DSL
to reach a runtime capability it cannot express — number formatting and a regexp engine are the two
still owed.

**The goal is not "the frontend delegates". It is that the frontend CANNOT hold a semantic.**
Phase 1 in `docs/DSL-OWNERSHIP.md` is deleting the six helpers that exist so it can
(`fng-bin`, `fng-number-value`, `fng-int-value`, `fng-to-number-operand`,
`fng-condition-expression`, `fng-equal-value`) and splitting `Op` so the arithmetic and comparison
variants are unnameable outside `jsl_lower` — a compile error rather than a lint. Phase 5 is
deleting the surface entirely, so a future change that wants a hand-written semantic has to add the
door back in a commit that says so.

**Do not accept a partial conversion as done.** Every time a remainder looked inherent it was not:
"the guards cannot fold" was a missing primitive, "the round trip is genuine work" was a missing
fold rule, "arithmetic is unaffordable" was both. When something looks like it must stay in the
compiler, the burden is to prove it is structure and not meaning.

---

## What is done and green

- **Phase 0 — a DSL call is free when the types are known.** `box-compute` carries the input's kind
  (widened over the numeric union — a soundness requirement, not an optimisation);
  `fng-analyze-fresh!` iterates analyse → fold → `iterate!` to a fixpoint; `jl-if` lowers the arm
  before collecting a proven predicate; JSL bindings are pinned for their scope.
- **The relational operators** are `IsLessThan`/`IsLessEqual` in `lib/`.
- **The bitwise operators** are the DSL's, which also wired `ToInt32`/`ToUint32`.
- **The arithmetic operators** are the DSL's: `JsAdd`, `JsSub`, `JsMul`, `JsDiv`, `JsMod` and
  `JsNegate` (unary `-` included — it was still a hand-written `Sub(0, ToNumber(x))` until the
  dead-definition ratchet flagged `JsNegate` as defined-but-uncalled). Two primitives were added to
  make this affordable, `%IsNumber` and `%UnboxNumber` — see the recorded reasons below.
- **The ownership ratchets are re-recorded**: `DSL-WIRED` includes the six arithmetic operations;
  the opcode budgets are `Add` 4, `Sub` 2, `Mul`/`Div`/`Mod` 1 each (the survivors are the
  relative-index clamp, the `++`/`--` raw fast path, and `fng-static-global-value`); the golden
  graph text for `return n + 1` is re-pinned with the six-node value path plus the memory
  scaffolding.

## What fixed the five failures, because each is a rule

**1. A representation boundary is decided from the DECLARED type, at the site that knows it —
never from the value's shape.** `main : number` returned a NaN-boxed word to a native caller
because the unboxing hack (`fng-return-representation`) tested for the folded shape `Box(Add)` at
build time, when the DSL's result is still an unfolded `Phi dyn` over the concat/numeric arms. The
shape it looked for does not exist until analysis folds the guards, so it matched nothing, ever.
The fix: `fng-expression-expected` now applies the `FNG-NUMBER` coercion (`fng-number-value`) to
EVERY expression kind, not just identifiers, and the shape hack is deleted. The coercion is built
eagerly and folds against the DSL's own boxing when analysis proves the types.

**2. A type proof is not a representation proof, in the folds as much as anywhere.**
The opcode fuzzer's `((If) (New))` counterexample: an if/else merges two boxed arms into
`Phi(Box, Box) : num`; an object field forwards it; `unbox-idealize` deleted `Unbox(Box(v))` on
the evidence that `v` proves `num` — and handed the tagged Phi to a raw `Add`, which consumed the
NaN-box bits. Three changes in node.coil:
- The verifier's representation classifier moved to **`n-rep-of` in node.coil** — one table, read
  by the verifier's REP pass and by the idealizations, so they can never disagree. One deliberate
  difference: a Phi with an ABSENT arm classifies UNKNOWN, because the idealizations run during
  construction where an open loop Phi's backedge is still unknown (this is what keeps the deferred
  `Box(Phi)` placeholders alive for `fng-distribute-deferred-phi-boxes!`).
- `unbox-idealize` vetoes both fold arms when the boxed value is certainly tagged.
- `box-idealize` peels `Box(x)` whenever `x` is certainly tagged: **boxing a tagged word is the
  identity**, and `Box(Box(x)) → Box(x)` was only the easiest case of that rule. The frontend
  boxes DSL operands blindly (`fng-arith2`), so tagged-without-being-a-Box values (a Phi of Box
  arms, a PropLoad) arrive under a second tag the backend would corrupt.

**3. The ratchet counter is textual.** `occurrences` counts `(Add)` anywhere in
`frontend_native_graph.coil`, comments included — a comment saying `Box(Add)` inflates the debt.
Word comments accordingly.

## The two primitives, and why they exist

**`%IsNumber`** (`JSP-ISNUMBER`, lowers to `TypeTest (t-num)`). A boxed operand must carry the kind
`int|flt` — a field declared `flt` holds an int-tagged 0 after `{a: 0}`, so the static type cannot
determine the runtime tag — and against that union `ty-isa num num` decides while `ty-isa num int`
does not. Selection emits two `MI-JSTEST`s and an OR; no new encoding.

**`%UnboxNumber`** (`JSP-UNBOXNUMBER`, a bare `Unbox (t-flt)`). `%UnboxFlt` lowers through
`jl-unbox`, which wraps its operand in a `Cast` the evaluator checks — an int-tagged number fails
`Cast flt` even though the unbox beneath converts correctly (`ev-unbox` turns RT-INT into RFlt;
aarch64 emits `sxt48`/`scvtf`).

## Traps that cost real time

- **A type is not a representation.** `ty-isa int flt` is false, and that says nothing about the
  machine. `n-rep-of` is now the one answer to representation questions; do not re-derive from the
  lattice.
- **`ty-isa ANY num` is true.** An unanalysed node reads as a machine number, so
  `fng-machine-number-value?` over-reports and cannot be used as "is this a primitive".
- **Build-time type tests do not fire.** `n-ty-proven?` is false for everything while the graph is
  being constructed. A coercion decided at build time keys on the DECLARED type (see rule 1) or on
  shape — and shapes that only exist post-fold do not count.
- **Do not put a fast path in the frontend.** Specialisation belongs in the DSL definition, which
  leads with the common case.

## Tools

- `coil build tools/js-repro.coil -o out/js-repro` then `out/js-repro FILE.js ARG [--dump] [--tag]`
  — node's answer beside ours in milliseconds, naming which of frontend/verifier/evaluator refused
  it and at which node.
- `tools/js-sweep.sh` — 29,068 cases, catalogued, crash-resumable. `docs/SWEEP-CATALOGUE.md`.
- `repros/*.js` all pass; `repros/open/*.js` all fail. Sweep with
  `for f in repros/*.js; do ./out/js-repro "$f" 10 >/dev/null || echo "FAIL $f"; done`.
  **`ns.js` needs the raised budget in `tools/js-repro.coil` and takes ~2 minutes.**
- The fuzz property: `coil test tests/js-source-prop.coil --cases N` (append `--seed S` to replay).

## Next, in order

Continue the plan in `docs/DSL-OWNERSHIP.md`, and finish it:

1. `Eq` (18 sites) → `IsStrictlyEqual`, `Not` → `ToBoolean`, and the four remaining owed abstract
   operations (`ToLength`, `SameValueZero`, `RelativeIndex`, `ToPropertyKey`). None need a new
   primitive — they are wiring. The two `(Add)` relative-index clamps in `fng-relative-index`
   territory are `RelativeIndex`'s to absorb.
2. `fng-static-global-value`, the build-time constant evaluator, is the one site with a real
   argument for staying: no `FngContext` and literals only. It is also demonstrably wrong today
   (`true + 1` there builds a raw `Add` on a boolean). Either thread a context to it or fix it —
   do not leave it as an unexamined exception.
3. The intrinsics currently REFUSED at the frontend rather than implemented: `Number.prototype.
   toFixed`, `String.prototype.replace`, `instanceof` against a global, object spread. Two need a
   new `%` primitive — correctly-rounded number formatting, and a regexp engine. Build them.
4. Then Phase 1 and Phase 5: delete the six helpers, split `Op`, and leave nowhere to put a
   hand-written semantic.
