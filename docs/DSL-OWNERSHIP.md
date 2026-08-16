# The DSL is not the source of truth yet, and here is the measurement

`lib/` is a Torque-like DSL holding the ECMAScript abstract operations. The intent is that the
frontend lowers *syntax* and the DSL owns *semantics*. Nothing enforced that, and it has drifted.

## What was actually found

`ToInt32` is defined in `lib/abstract/conversions.jsl` as:

    (macro ToInt32 :params [(v dyn)] :ret int (%BitOr v 0))

and `frontend_native_graph.coil` writes, by hand, in several places:

    (fng-bin (BitOr) value (fng-const 0))

Two implementations of one operation. **Nothing calls the DSL one.** The same is true of
`ToBoolean` — `(%Not (%Not v))` in the DSL, open-coded as `fng-condition-expression` in the
frontend.

Counted across the whole library:

| | count |
|---|---|
| DSL definitions (`macro` / `builtin`) | 214 |
| reached from the frontend | 138 |
| reached only from other DSL definitions | 66 |
| **reached from nowhere at all** | **21** |

Seven ECMAScript abstract operations are defined in the DSL and never called by the frontend, which
open-codes each of them instead: `ToInt32`, `ToUint32`, `ToBoolean`, `ToLength`, `SameValueZero`,
`RelativeIndex`, `ToPropertyKey`.

## Why this keeps happening

The frontend already contains a hand-written version of nearly every operation, so reaching for it
is the path of least resistance and nothing objects. In one defect-fixing session, ten fixes landed
and **two** were in the DSL (`LooseEqual`, `ArrayUnshift1`); the rest went into the compiler,
including two — `String.prototype.replace` and `Number.prototype.toFixed` — that were *refused* at
the frontend when writing them in the DSL was the obvious move and `lib/string/replace-all.jsl`
already showed the pattern.

## What the DSL genuinely cannot express, and what that means

This distinction was asserted before it was checked, and checking changed it.

**It can express representation.** `%Box`, `%UnboxInt`, `%UnboxFlt`, `%UnboxObj`, `%IsInt`,
`%IsFlt`, `%IsString` are all available, and `NumEq` in `lib/abstract/repr.jsl` is exactly a
tag-dispatching comparison. "The DSL can't do representation" was wrong.

**It cannot express facts about the compiler's own graph** — has this node been analysed yet, is
this value already raw *in the IR*, which shape did `fng-unique-field-index` pick. Those are
optimizer state, not JavaScript semantics, and they legitimately live in the frontend.

**But that boundary is where the bugs were.** Four of the ten defects fixed in that session —
`fng-loose-equal`, `fng-update-local`, `fng-merge-snapshots!`, unary `+` — were the frontend
deciding a *semantic* question (does this need ToNumber?) from an *IR heuristic* (is this node
tagged? is it `dyn`?). The heuristic is a pre-specialisation of a DSL call the frontend chose not
to emit. Emitting the call unconditionally and letting the optimizer remove it when provably
unnecessary would delete the entire bug class.

`ToNumberValue`'s own comment records why the guard exists — "unguarded it cost `call-loop` 9.6ms
to 25.5ms" — so this is a known trade. It is worth restating that the project's standing direction
is that perf regressions are acceptable while the conversion to the DSL proceeds.

## The enforcement

`tests/dsl-ownership-test.coil` runs in the gate and holds three invariants. Each was falsified —
broken deliberately, confirmed to fail, restored.

1. **A wired operation stays wired.** `DSL-WIRED` lists operations the frontend delegates today. If
   a change replaces one with hand-written graph building, its call disappears and this fails,
   naming the operation.
2. **The open-coded operations are exactly the recorded debt.** `DSL-OWED` lists the seven above.
   The check is *exact*: wiring one up fails until it is moved to `DSL-WIRED`, so the debt cannot
   shrink without being seen to shrink, and a new open-coding has to be added deliberately.
3. **No DSL definition is dead.** A definition reached from neither the frontend nor another
   definition is the residue of reimplementing an operation elsewhere — the DSL copy stays, stops
   being called, and quietly stops being the source of truth. 21 are allowlisted with the reason;
   the list cannot grow silently.

What this does *not* catch: someone writing a brand-new semantic in the frontend that the DSL never
had. No automatic check can see an operation that was never written down. What it does catch is the
mechanism by which the DSL stopped being authoritative — definitions going quiet one at a time —
and it makes the debt a number that only moves on purpose.

## Phase 0 is done: a DSL call is now free when the types are known

`if (acc < 3)` lowered through the DSL's `IsLessThan` comes out as **one node**:

    n43: Lt : bool  <- _ n4 n5

No `Box`, no `Unbox`, no `TypeTest`, no guard. Before this it was a runtime call with tag tests
that never folded.

Four changes, in the order they were found — each one blocked by the one before it.

**1. A `Box` carries its input's kind.** `box-compute` returned `t-dyn` and threw the type away,
and `dyn` decides nothing: `ty-isa dyn int` is false, `join dyn int` is not high. So every DSL
guard on a boxed operand stayed unknown with a proven int one edge away. It now returns
`(t-kinds (ty-kinds t))` — the kind set, which is all a tag test needs.

*The kind set and not the type itself*: carrying the input type verbatim makes a `Box` of a
constant report a constant, and `g-fold-proven!` then replaces the Box with a `Const`, deleting the
boxing it existed to perform.

*And in `box-compute`, not in `typetest-compute`*: teaching the TypeTest to read THROUGH the Box
folds the same guards and breaks propagation. A compute may only depend on its immediate inputs'
types; a Box's type never changed, so when the boxed value's type fell the TypeTest was never
re-queued and `g-verify` reported `VERR-STALE-TYPE`. Both wrong versions were built and measured
before the right one.

**2. Analyse, fold, and then analyse what the fold left.** `fng-analyze-fresh!` ran `g-analyze!`
once and `g-fold-proven!` once. The fold *rewires* the graph — constants replace proven nodes,
dead branches collapse, phis on the affected regions reduce — and nothing re-queued any of it, so
the pass returned with types describing the graph as it was before the fold. It now iterates
analyse → fold → `iterate!` until the live count stops moving. `iterate!` is what actually
collapses the `If` once its predicate is a constant; folding without it leaves every guard proved
and none of them removed, which was most of the cost.

**3. `jl-if` killed a proven predicate before lowering the arm it feeds.** `n-kill!` cascades into
its inputs, so killing `(%IsInt a)` took `a` with it and the arm was then lowered against a corpse.
Dormant until guards started proving.

**4. JSL bindings are pinned for their scope.** A `let` value can lose every user it currently has
while its later uses have not been built yet — `(if (IsNumber a) … (NumLt a b))` is exactly that.
Having users is not evidence a value is still needed; being in scope is. The pin is released by
`jl-drop!`, and *not* by `jl-reset!`, which runs after `graph-reset!` where every id belongs to a
graph that no longer exists.

## The first migration

The four relational operators are the DSL's. `IsLessThan` and `IsLessEqual` in
`lib/abstract/conversions.jsl` are the whole meaning of `<`, `<=`, `>` and `>=`; the frontend
decides nothing about operands. `(Lt)` went 7 to 3, `(Le)` 4 to 0.

It fixed four wrong answers on contact — each an operand combination the four hand-written copies
did not picture:

| | node | before | after |
|---|---|---|---|
| `"5" < 6` | true | evaluator stops | true |
| `true < 2` | true | evaluator stops | true |
| `null < 1` | true | evaluator stops | true |
| `NaN <= 1` and `NaN > 1` | both false | — | both false |

`IsLessEqual` is its own definition rather than `not (IsLessThan b a)` because that identity is
false for NaN.

**No fast path in the frontend.** One was written — "both operands provably raw machine numbers,
compare directly" — and removed: it worked, and it was still the compiler holding an opinion about
what JavaScript comparison means. The specialisation lives in the definition, which leads with the
Number/Number case.

`repros/ns.js` finishes and answers correctly. It costs more evaluator steps than the hand-written
version did, because its comparisons are on genuinely dynamic array elements where no guard can
prove — that is the irreducible part, and it is a constant factor rather than a cliff.

## The second migration: the bitwise operators

`BitwiseAnd`, `BitwiseOr`, `BitwiseXor`, `BitwiseNot`, `ShiftLeft`, `ShiftRight` and
`ShiftRightUnsigned` are now the DSL's, and wiring them is what finally calls `ToInt32` and
`ToUint32` — two of the seven owed abstract operations, defined in `lib/` and called by nothing
because the frontend had its own copy at eleven separate sites.

`"5" | 0`, `true | 0`, `null | 0` and `"7" & 3` all stopped the evaluator before and are correct
now.

**The DSL's `ToInt32` was wrong**, which is why it had never been wired: it read `(%BitOr v 0)`,
on the assumption that the primitive coerces its operands. It reduces modulo 2^32 but *refuses* a
value that is not already a number, so the coercion was missing — the same defect as the four
hand-written relational operators, sitting in the DSL. It now goes through `ToNumberValue` and
unboxes, because `%BitOr` is an IR node whose operands must be raw.

Landing it needed one more core fix, and it is a good example of the class:

**`Box(Box(x))` is `Box(x)`.** Boxing is idempotent, and leaving the pair standing is not merely
wasteful: `unbox-idealize` peels exactly ONE layer, so `Unbox(Box(Box(x)))` folded to the *inner
Box* and handed a tagged word to something that asked for a raw one. `o.x | 0` produced
`BitOr slot 1 <- Box is tagged, needs raw-num`, because the field load had already forwarded to a
boxed value and the DSL call boxed it again on the way in. Dormant until `box-compute` started
carrying kinds, since before that nothing could satisfy `unbox-idealize`'s test at all.

Also fixed on the way: `unbox-idealize` now requires the *kinds* to match rather than merely
`ty-isa`, so `Unbox(Box(int), flt)` no longer folds to a raw int where a raw double was asked for.

### Debt after two migrations

| opcode | before | now | what is left |
|---|---|---|---|
| `Lt` | 7 | 3 | string-compare plumbing |
| `Le` | 4 | 0 | — |
| `BitOr` | 7 | 5 | `fng-nullish-equal`'s logical OR, `fng-int-value` for array indices |
| `BitAnd` `BitXor` `Shl` `Shr` `UShr` `BitNot` | 3 each | 1 each | the static-global constant evaluator |

The remaining per-operator entry is `fng-static-global-value`, which reduces global initialisers at
build time: it has no `FngContext` to make a library call with and can only ever see literals.

## How to get to zero hand-written semantics

The end state is not "the frontend delegates by convention". It is that **the frontend cannot
express a JavaScript semantic**, because the compiler refuses to build one there. Coil enforces
module boundaries at compile time — using a function from an unimported module is an error, not a
lint — so this is reachable structurally.

Five phases. The order is forced: each one is unaffordable or unsafe without the one before it.

### Phase 0 — Make a DSL call free when the types are known

**Nothing else can proceed until this lands.** Every abstract operation in `lib/` is a guard over
tag tests, and today those guards survive into the final graph: a `for (let i = 0; i < 3; i++)`
lowered through `IsLessThan` has 40 `Unbox`, 31 `If`, 21 `Lt` and 12 `TypeTest` nodes against one
compare for the hand-written version. Migrate the other sixty operator sites at that rate and the
compiler stops being usable.

The shape of the problem: the frontend boxes a raw value to hand it to the DSL, the DSL unboxes it,
and the `Box`/`Unbox` pair plus the tag tests do not collapse. `Box` types as `dyn`, and `dyn`
decides nothing — `ty-isa dyn int` is false, `join dyn int` is not high — so `typetest-compute`
answers "unknown" with a proven int one edge away.

Two candidate fixes, in increasing order of correctness:

- **Let `Box` carry its input kind** so the existing computes decide. Teaching `typetest-compute`
  to read through a `Box` was tried and broke eleven tests, so the type-level version needs the
  same care: a great deal of code expects a `Box` to be exactly `dyn`.
- **Type-propagating inlining.** When `jsl-inline!` inlines a macro, specialise the body against
  the caller's argument types so guards constant-fold at inline time. This is what Torque does and
  it is the version that makes every later phase free rather than merely cheap.

The gate for this phase is `repros/ns.js`: it must finish, through the DSL-owned relational
operators, inside the evaluator's budget.

### Phase 1 — Close the door

Delete the frontend's ability to write a semantic at all. Six functions exist *precisely* so that
it can, and they are the reason reaching for the frontend is the path of least resistance:

    fng-bin  fng-number-value  fng-int-value
    fng-to-number-operand  fng-condition-expression  fng-equal-value

`fng-bin` is the door: it takes an `Op` and builds a node. While it exists, "write the operator
here" is one line.

Making it structural needs the semantic opcodes to be **unnameable** in the frontend. `Op` is one
`defsum` in `node`, so its variants travel with the type and cannot be hidden individually. The
move is to split it: structural variants stay in `Op`, arithmetic/comparison/bitwise become a
second sum in a module that only `jsl_lower` imports. Then `(Add)` in the frontend is a compile
error, and `tests/dsl-ownership-test.coil`'s budget check becomes a belt to the compiler's braces
rather than the only guard.

### Phase 2 — The operators

Sixty direct constructions remain, and they are one abstract operation each:

| operation | sites | ECMAScript |
|---|---|---|
| `Eq` | 18 | `IsStrictlyEqual` (partly done — `LooseEqual` landed) |
| `BitOr` `BitAnd` `BitXor` `BitNot` `Shl` `Shr` `UShr` | 24 | `ToInt32` / `ToUint32` then the bit operation |
| `Add` `Sub` `Mul` `Div` `Mod` `Minus` | 21 | `ApplyStringOrNumericBinaryOperator` |
| `Not` | 1 | `ToBoolean` |
| `Lt` | 3 | string-compare plumbing, not operator meaning |

`Add` is the one to do carefully and probably first after the bitwise group: it is the only
operator whose result type depends on the operands (`"a" + 1` is a string), so it is where a
hand-written version is most likely to already be wrong.

### Phase 3 — The seven owed abstract operations

`ToInt32`, `ToUint32`, `ToBoolean`, `ToLength`, `SameValueZero`, `RelativeIndex`, `ToPropertyKey`.
Each already exists in `lib/` and is open-coded in the frontend. Most fall out of Phase 2 for free
— wiring the bitwise operators *is* wiring `ToInt32`.

### Phase 4 — The intrinsics currently refused

`Number.prototype.toFixed`, `String.prototype.replace`, `instanceof` against a global, object
spread. Each is refused at the frontend today and each is DSL-shaped; `lib/string/replace-all.jsl`
is the template for two of them. Two need a new `%` primitive — correctly-rounded number
formatting, and a regexp engine — and a primitive is the right way for the DSL to reach a runtime
capability it cannot express. That is a DSL *gap*, not a reason to write the semantics elsewhere.

### Phase 5 — Delete the surface

With Phases 1–4 done, the six helpers above have no callers. Deleting them is what makes the
property permanent: there is no longer anywhere to put a hand-written semantic, and a future change
that wants one has to add the door back, in a commit that says so.

## Definition of done, as numbers

These are all already measured by `tests/dsl-ownership-test.coil`, so progress is visible without
re-deriving anything:

| | today | done |
|---|---|---|
| semantic opcodes constructed in the frontend | 60 | **0** |
| abstract operations open-coded (`DSL-OWED`) | 7 | **0** |
| DSL definitions reached from nowhere | 21 | **0** |
| frontend semantic helpers | 6 | **0** |
| `repros/ns.js` through DSL operators | over budget | finishes |

## The work this implies

**Fold DSL guards against typed operands, first.** Until that lands, every operator moved into the
DSL makes the evaluator slower by roughly the size of its guard, and `ns.js` is the evidence. This
is the enabling change; everything below is cheap once it exists and expensive until then.

Wiring the seven owed operations is not cosmetic. Each one currently has two implementations that
can disagree, and this session found four defects that were exactly that kind of disagreement in a
different place. `ToInt32` and `ToBoolean` are the cheapest: both are one-line DSL definitions and
the frontend's open-coded forms are textually identical to them.
