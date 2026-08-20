> **HISTORICAL, 2026-08-18.** The tools and gates this file describes were deleted with the
> evaluator. Kept for the findings themselves, which Phase A's harness should re-cover.

# What the JavaScript source fuzzer has found

`tests/js-source-prop.coil` generates `Op` values, lifts them to TypeScript, and runs the same text
through node and through the frontend+evaluator. This file is the ledger of what that has turned
up. Every entry has a runnable repro in `repros/`; a fixed entry keeps its repro so the next
regression is one command away.

**The oracle is the EVALUATOR, not the backend.** `eval-via-source-text` builds the graph and runs
`ev-run-nobind` on it. So a disagreement localises to "the frontend and the evaluator, together,
disagree with node" — it does not by itself say which of the two is wrong, and for at least one
entry below the backend is the more likely to be right.

---

## Fixed

### Object construction kept a stale alias state for a shared field

Two structural declarations sharing a field alias put both the old alias state and the new object's
store into one `MemMerge`, and the later load selected the stale one. Fixed in `fng-object`
(`src/frontend_native_graph.coil`) by not preserving an older state when the new object's shape
supplies that alias. Pinned by `object_literal_replaces_shared_field_alias_state`.

### Unsupported syntax was silent, wrong, or a segfault

`native/typescript-go-bridge/main.go` maps every syntax kind it does not enumerate to **0**, and
nothing rejected kind 0. Three different symptoms, one cause:

| construct | before | now |
|---|---|---|
| `x as number` | **segfault** — the expression dispatch returned `NO-NODE` and the caller used it as a node id | reported |
| `[...a, 3]` | **wrong answer, no diagnostic** — length 2 where node says 3 | reported |
| `for (const v of xs)` | graph built with control stuck at the Start node | reported, and since 2026-08-19 **lowered** -- see HANDOFF |

Fixed by making both dispatch fallthroughs loud (`fng-unsupported-syntax!`), and by splitting the
array-literal element skip: an **elision** is kind 0 with an empty extent and is still skipped, so
`[1, , 3]` keeps its hole, while any other kind 0 has real source text and is reported.

The array-literal skip at the old `frontend_native_graph.coil:4361` was an uncommented
`(!= (ts-kind ast element) 0)`. It is worth noting how that reads: nothing at the site said it was
there for holes, so it silently covered spread too.

---

### A loop phi never reached its type fixpoint

`repros/loop-carried-int32-local.js`

    verify: 1 violation(s), first VERR-STALE-TYPE at n11
    n11: stored=int=[-2147483648..2147483647] computed=int

The stored type was **narrower** than the recomputed one, which is the miscompile direction: an
optimisation trusting an int32 range on a value the analysis says is any int is unsound.

`phi-compute`'s Loop arm widens with `ty-widen-from`, whose fuel is a counter carried **inside the
phi's own current type** — that counter is what makes the widening terminate. So the node's type is
an input to its own computation, while `g-analyze!` re-queued a changed node's **outs** only. A loop
phi therefore advanced its widening by exactly one step per visit and was then never looked at
again, and the pass returned with `n-compute` still disagreeing with `n-ty`.

Running `g-analyze!` twice by hand converged, which is what named it. Fixed by re-queueing the node
itself as well; that terminates for the same reason the widening does, since `TY-WIDEN-MAX` bounds
how many times a phi can change its own type.

**One line, three symptoms.** These all shared the cause and all pass now:

- a loop-carried local updated through `| 0` (`z += d` passed, `z = (z + d) | 0` did not)
- reading an array element inside a loop
- reading a field of an object allocated inside the loop

### A collapsing loop left its phis on the wrong region

`g-fold-proven!` peepholed every live node once in index order, which is a fixpoint of "what was
foldable when this index came up" — a function of the traversal order, not of the program. A
peephole at index j could collapse a region a phi at index i < j was attached to, and that phi was
never revisited. `iterate!` states this exact hazard in its own comment; the fold pass did not
follow it. Now it sweeps until a pass changes nothing.

Separately, `region-idealize` collapses a two-input Loop whose back edge died by returning its
entry control, and its comment says the attached phis then "reduce to their initial value" — but
nothing made them. `n-subsume!` only retargets each phi's input 0, and `phi-idealize` rescues just
the case where the replacement is not a merge. With an `if` before the loop the replacement *was* a
merge, so the phi kept two inputs on a three-input Region. Now `region-reduce-phis!` reduces them
explicitly.

Symptoms, both from a loop whose trip count the analysis could prove:

- a zero-trip `while` after a call — `VERR-PHI-REGION`, a one-armed phi on a `CallEnd`
- a one-trip `do`/`while` after an `if` — `VERR-PHI-ARITY`, a two-input phi on a three-input Region

### A `do`/`while` was a stale copy of `fng-loop`

`repros/do-while-after-object.js`, `repros/do-while-drops-dynamic-memory.js`

Five divergences, all from the same cause: `fng-do-loop` is a copy of `fng-loop` that did not
receive its fixes. Three were found by putting an object literal in front of a `do`/`while`:

1. **`index` was not reset** before building the carried-symbol phis, so it still held the length
   of the active-memory list. With any allocation before the loop the carried phis were never
   created and the reconcile pass indexed an empty list: `n-in: input index out of range`, or a
   segfault once the object was wide. This is why plain `while` and `for` were fine.
2. **Memory phis carried a `(t-undef)` content type**, which `fng-loop`'s comment at the matching
   site describes as telling inference the loop-carried memory holds undefined, letting the fold
   pass replace every load through it with a constant.
3. **A self-referential memory phi was not subsumed** when the body never touched that alias.

The remaining two came from the audit this file had already recommended — reading `fng-do-loop`
against `fng-loop` line by line — and that was the right call: a diff of the two functions named
both in one pass, after a session of trying to reach them from counterexamples.

`fng-loop` builds its memory phis over the **control alias list**: declared fields converted to
aliases, plus every dynamic alias, plus the runtime property heap force-included, plus the
captured-cell alias. `fng-do-loop` called `fng-active-memory!` and stopped, and that publishes
**declared fields only**. So a `do`/`while` whose body touched anything else had no phi for it,
the header read pre-loop memory on every iteration, and the second iteration could not see what
the first wrote:

| body | node | ours |
|---|---|---|
| `do { a[d] = (a[0] + d + 1) \| 0; d++; } while (d < 4)` | 23 | 20 |
| `do { acc = (acc + bump()) \| 0; d++; } while (d < 3)` (`bump` mutates a captured cell) | 19 | 14 |

**Both produce a well-formed graph.** `g-verify` has nothing to object to, so unlike the three
crashes above these were invisible to everything except an oracle — which is why they outlived
them. Each is correct written as `while`, and that is what localised it to the do-while lowering
rather than to loops or to memory in general.

The generator now emits all three loop spellings from its default family; it previously emitted
`for` only, so `do`/`while` was never generated at all.

### An abrupt loop exit before an allocation left a dead phi input

`repros/loop-exit-then-allocation.js`

    verify: 1 violation(s), first VERR-DEAD-INPUT at n38
    n38 is a Phi, inputs: [0]=n35 [1]=n34 [2]=n8(DEAD)

A jump records the memory for each alias **by node id**, in `jump-values`. A loop whose body never
touches an alias hands that alias's memory phi back as its own back edge, and `fng-loop` collapses
such a self-referential phi into its entry value — but a `break` inside the body had already
captured the phi. `jump-values` is a frontend table rather than a def-use edge, so `n-subsume!`
does not retarget it, and the exit merge wired the dead node straight into a phi.

`fng-retarget-jumps!` is the fix, and it scans the **whole** log rather than the target's own
slice: a `break` or `continue` aimed at an outer loop is captured while the inner loop's phis are
current and merged long after the inner loop has collapsed them, which is the labelled-jump case.

The `break` alone never showed it — it needed an allocation afterwards, which is what carries the
merged memory to a consumer the verifier walks. The generator now emits labelled `break` and
`continue` out of a nest.

### A field copied straight into another field stayed boxed

`repros/field-copy-stays-boxed.js`

    REP n19:Store slot 3 <- n12:Box is tagged, needs raw-num

`o.q = o.p` failed while `o.q = (o.p + 0) | 0` passed, because the arithmetic forced the unbox.
`p` is initialised from a variable and carries a boxed `dyn`; `q` is initialised from a literal and
its slot is raw. The read forwards through the store that wrote `p`, so the copy handed the raw
slot `p`'s boxed word with nothing in between.

**The representation of a field was decided twice.** The verifier classified by `ty-kinds`, making
every integer, float and boolean field raw; the frontend asked `(= (shape-alias-ty alias) (t-flt))`,
an exact type-id match that a field typed `int`, `bool` or any numeric union missed. Neither side
could detect the disagreement alone — each was internally consistent, the frontend emitting what it
believed and the verifier rejecting what it believed. `shape-alias-rep` in `src/shape.coil` is now
the single rule both read, and `fng-coerce-to-alias` applies it to every write through a declared
field.

The nested form was the same defect one slot over. `o.inner.x = ...` reads `o.inner` from a tagged
field, so the object operand was a boxed word under a `Cast` — and a `Cast` relabels the type
without changing the representation (`Cast is tagged, needs raw-ptr`). `fng-object-pointer` now
unboxes before the cast, for the read as well as the write. The read had looked correct only
because `v-rep-slot-required` pins the Store's pointer slot and not the Load's.

---

### A dead branch after a builtin call aborted the compiler

`repros/dead-branch-after-builtin.js`

    graph corruption: n-in: input index out of range
      phi-idealize -> n-peephole -> fng-analyze-fresh!

`Math.trunc` lowers through a ToNumber diamond, so the dead branch contains a Region with a Phi on
it. `region-idealize` drops proven-dead paths one at a time, and **each removal takes the matching
arm off every attached Phi with it** — so taking a two-input Region down to one leaves its phis
holding nothing but their control, and the next visit turns the Region into XCtrl and retargets
those phis onto it. What survives is a one-input Phi on XCtrl: unreachable, never analysed (still
typed ANY), and rejected by the Phi arity rule, which is right to reject it.

Fixed by collapsing the Region one step earlier, while each phi still has exactly one value to
reduce to. That value is the one on the dead path, which is sound precisely because nothing on this
control can execute.

**Separately, `phi-idealize` aborted instead of reporting.** Its first rule is "a phi that is not
on a merge is simply its one value", and it read input 1 to get that value without checking the phi
has one. A phi with fewer than two inputs now idealizes to nothing. The Region fix is the repair —
with it nothing produces a short phi here at all — but the guard stays, because reading an input
without checking it exists is a defect in `phi-idealize` whoever else stops supplying the shape,
and a malformed graph is meant to get a verdict rather than kill the process.

Not about division and not about `Math.trunc`: any builtin does it, with or without an `else`. The
dead branch alone is fine, `acc / 2` without the builtin is fine, an undecidable condition is fine,
and `while (false)` is fine — which is what localised it.

### `==` was `===` with boxing, so `7 == "7"` was false

`repros/loose-equality-number-to-string.js`

    node=9 ours=8

Loose equality between a number and its own string form was false, in both operand orders, and
`!=` was wrong with it. A well-formed graph, no diagnostic, and an answer off by exactly the
difference between the two arms.

`fng-equal-value` is **strict** equality's lowering, and `switch` shares it because `switch` matches
with `===`. `==` was routed through it too. That lowering unboxes a tagged operand as a float on
the evidence that the *other* side is numeric — which is no evidence about the tagged one at all —
so a string's tagged word was read as a double and equalled nothing.

`fng-loose-equal` now keeps one fast path, both operands **provably** raw machine numbers, and
sends everything else to a new `LooseEqual` in `lib/abstract/conversions.jsl`, which follows the
spec's steps for primitives: Booleans convert to Numbers first, a Number beside a String compares
against `ToNumber` of the String. Objects beside primitives still compare by identity, because
`ToPrimitive` is a `valueOf`/`toString` protocol this compiler has no closed-world story for; that
is unchanged and now written down.

**The first attempt did not move the repro**, and the reason is worth keeping: it used "is either
side tagged?" as the fast-path test, and a string is not `dyn`-typed either, so `acc == String(acc)`
still took the raw compare. The proof has to be that both sides *are* numbers, not that neither
looks dynamic.

Found by `tools/js-sweep.sh`, which the fuzzer could not have found: no template emitted `==`
between a number and a string.

### A rest parameter was bound to nothing instead of refused

`repros/open/rest-parameters-are-unimplemented.js`

    node=10 ours=0

Nothing implements `...xs`, and nothing noticed. It was indexed as an ordinary parameter named
`xs`, the call site passed it nothing, and every read came back undefined — so `xs.length` was
`undefined`, `undefined | 0` is 0, and `(...xs) => xs.length` returned zero for every call.

`fe-rest-parameter?` refuses it by name at the indexing step, detected from the parameter's own
source text: the bridge maps every syntax it does not enumerate to kind 0, so a `DotDotDotToken` is
not reliably distinguishable from anything else it has not been taught.

**This fixes the wrongness, not the feature.** Rest parameters remain unimplemented — materialising
an array from the extra arguments at a fixed-arity call site is feature work. The repro stays in
`repros/open/` because it still does not run.

### A parameter live across a self-recursive call came back unbound

`repros/parm-live-across-recursive-call.js`

    evaluator: a Call did not match a closed-world function definition at n5

n5 is the `Parm`, not a `Call`. `ev-call` saves the caller's parameter bindings before binding the
callee's and restores them afterwards. The save pushed an entry **only for slots that have a `Parm`
node**; the restore indexed `oldh`/`oldv` **by parameter slot**. The frontend's calling convention
leaves the leading env and receiver slots empty, so the two were always out of step — the restore
read past the end of a one-element list and the parameter came back unbound.

Only self-recursion could show it. A call to a different function restores that function's
parameters and never touches the caller's own, and a parameter not live across the call is never
read afterwards — which is why tail position, a non-recursive call with a live parameter, and
`return (1 + g(x - 1)) | 0` all passed, and why the entry sat here suspected of being an evaluator
limit rather than a defect.

**`tests/eval-test.coil` covering this for hand-built fib IR and passing was the misleading
evidence**, and it was misleading for a reason worth keeping: a hand-built graph has no empty ABI
slots, so the fixture could not reach the case. A test that passes because its input cannot express
the bug looks exactly like a test that passes because the code is right.

`fib(12)` through the frontend now agrees with node, as does a two-parameter recursion with both
parameters live across the call.

---

### Eight more, from the probe sweep

`docs/SWEEP-CATALOGUE.md` has the full account; these are the diagnoses, shortest form. Every one
is pinned by a deftest in `tests/js-source-prop.coil` and has a repro in `repros/`.

| defect | cause |
|---|---|
| `7 == "7"` was false | `==` used **strict** equality's lowering, which unboxes a tagged operand as a float on the evidence that the *other* side is numeric |
| a rest parameter had length 0 | `...xs` was indexed as an ordinary parameter and never bound; `undefined \| 0` is 0 |
| `instanceof Object` corrupted the graph | no user constructor resolves and `Object` has no value node, so NO-NODE reached the JSL layer |
| `Math.trunc(x)` then `i++`, and then `if (true)` | every `Math.*` returns a **tagged** `ToNumber` while inference calls it a number; consumers decided from the static type |
| `(x).toFixed()`, `'s'.replace()` | a primitive in the receiver slot, which takes an object, a function or undefined |
| `unshift` never terminated | its write-back loop stored past the end and **grew the array its own bound was read from** |
| a shared field name asserted the wrong shape | `fng-unique-field-index` returns the first owner of any same-named field at a matching offset — sound for the alias, a lie as a `Cast`/`Unbox` target |
| unary `+` was a no-op | `+x` is ToNumber; and `fng-needs-to-number?` asks "is it `dyn`", which a string is not |

**Four of the eight are the same mistake**: deciding a *representation* question from a *declared
type*. `fng-loose-equal`, `fng-update-local`, `fng-merge-snapshots!` and unary `+` all asked what
the source said instead of what the value is. The type lattice makes this easy to get wrong in both
directions — `ANY isa num` is true, so an unanalysed node reads as a machine number, and a string is
not `dyn`, so an is-it-tagged test waves it through. When the question is "what is in this machine
word", the answer has to come from the graph.

## The sweep found more than this file has diagnosed

`docs/SWEEP-CATALOGUE.md` is the other half. This file is the ledger of defects that have been
*diagnosed*; that one is the ledger of defects that have been *found*, and it is much longer.

The difference is the tool. A `defprop` shrinks — the first failure hides every other one, and a
template the frontend cannot lower converges the search onto a defect already known, which is why
every entry above needed its template pre-validated and sometimes bent around an open bug.
`tools/js-sweep.coil` enumerates instead: 169 probes alone and in every ordered pair, 29,068 cases,
nothing minimised and nothing stopped. Its probes are deliberately unvalidated, because a probe that
already works teaches nothing.

Findings with a repro and no diagnosis live in `repros/open/`. Everything in `repros/` passes;
everything in `repros/open/` does not, and moves across when it is fixed.

## Open

### A single-path region keeps its phi, and an Unbox outlives the type it was built for

`repros/single-path-region-keeps-its-phi.js`

    REP n81:Unbox slot 1 <- n63:Phi is raw-num, needs tagged

The mirror of the dead-branch entry above — there the taken arm died, here the untaken one does —
and the fix for that one does not touch it:

    n62: Region : ctrl <- _ n52        one live path
    n63: Phi : int     <- n62 n58      still attached to it
    n81: Unbox : flt   <- _ n63        unboxing a value that is already raw

`region-idealize` reduces a two-input Region to its single path only when the Region carries no
Phi, so a one-path Region that does carry one survives as a merge that merges one thing. The phi
then narrows to `int` as analysis proves the single arm, while the `| 0` lowering that consumed it
was built when it was `dyn` and still has its Unbox.

Which of the two is wrong is the open question, and they are different repairs: either
`region-has-phi?` is guarding too much and the phi should reduce with the region exactly as the
Loop arm already does, or the frontend is emitting a representation conversion against a type that
had not settled and the fix belongs with `fng-coerce-to-alias`.

**The fuzzer cannot reach this today** — no template emits a constant-true condition; `XCtrl`'s
emits `if (false)`, which is the fixed case. It was found by hand while minimising that one, so an
`if (true)` template is what would keep it honest, after the fix.

Everything else above is fixed, pinned by a deftest in `tests/js-source-prop.coil`, and has a repro
in `repros/` that fails without its fix — each was reverted and re-run to confirm that.

---

## Reading the coverage number

`coil fuzz tests/js-source-prop.coil` reports edges as a fraction of **every edge in the test
binary**, and that binary links the whole compiler — backend, register allocator, Mach-O writer,
GC, JSL lowering, the verifier. `opcode_generated_javascript_agrees_with_node` builds a graph and
interprets it. It cannot reach the backend half at all, so a large part of the denominator is
unreachable by construction and no set of TypeScript templates will move it.

Measured at `-n 200 --cases 50`, before and after adding `js-emit-structural!`:

| | edges | corpus |
|---|---|---|
| before | 5164 / 14347 | 49 |
| after | ~5330 / 14721 | 57 |
| after, at `-n 400` | 5543 / 14538 | 89 |

Run-to-run variation is real — the search is seeded — so treat these as a band rather than a
reading. The denominator moves a little too, since it counts edges in whatever the binary currently
contains.

The corpus — distinct behaviours the guided search kept — is the number that actually moved, and it
is the better signal of generator reach. Note also that the handoff's 28.8% baseline does not
reproduce: 36.0% was already the figure before any template was added.

A 60% target against this denominator would need a property that drives the backend too, or a
denominator scoped to the modules under test. Chasing it with more frontend templates will not
get there.

## Why templates are pre-validated

Generated blocks compose: each reads and writes the integer accumulator, so any sequence of any
blocks is a valid program and no rejection filter is needed. The cost is that a block the frontend
cannot lower does not produce a clean finding — with eight steps drawn from ninety-two variants it
poisons about 8% of all cases, the shrinker converges on it, and the property reports that one
known failure for ever instead of exploring.

So every body in `js-emit-structural!` was run against node before it was added. Two of them were
once weakened to route around open defects — the field-copy template carried arithmetic that forced
an unbox the copy itself should have done, and there was no abrupt loop exit anywhere. Both defects
are fixed above and both templates are now the shape that found them, which is the point of writing
the weakening down rather than just doing it: a template bent around a bug has to be straightened
again when the bug goes, and nothing but a comment remembers to.

That is the discipline: the generator explores the language that works, what does not work is a
repro plus a line in this file rather than a permanently red gate, and the line comes out when the
defect does.

## Running one repro

`tools/js-repro.coil` builds to a binary that takes a `.js` file and an argument and prints node's
answer beside ours:

    coil build tools/js-repro.coil -o out/js-repro
    out/js-repro repros/field-copy-stays-boxed.js 10
    node=20 ours=20 arg=10  repros/field-copy-stays-boxed.js

It exits non-zero on a disagreement, so it also works as the gate in a shell loop over `repros/`.
It runs the frontend, then the verifier, then the evaluator, in that order, and prints which of the
three rejected the program along with the graph — so a failure names its stage instead of only
reporting that something went wrong.

**The reason it exists is the build/run split.** `coil test tests/js-source-prop.coil` is 26
seconds and almost all of that is compiling the compiler, which a repro session then pays again for
every file and every argument. This binary pays it once (6 seconds) and each trial after that costs
milliseconds. Four of the five defects fixed above were narrowed by running twenty or thirty
variants of a shape in a single pass, which is not a thing anyone does at 26 seconds a try.

It also sweeps the directory, which turns `repros/` into a regression suite rather than an archive:

    for f in repros/*.js; do ./out/js-repro "$f" 10 >/dev/null || echo "FAIL $f"; done

All 37 pass. Two things had to be right before that was true, and both were the tool being wrong
rather than the compiler:

- **It writes the case to a file instead of interpolating it into `node -e '...'`.** The property
  can single-quote its source because that source is generated and has no quote in it; a repro is
  hand-written, and an apostrophe in a comment -- "the alias's declared content" -- closed the
  quoting and produced a shell syntax error that reads exactly like a compiler failure.
- **An integral result may arrive as a float.** A JavaScript number is a double, so
  `return readX(p) * 4` on a field holding `2.5` is `RT-FLT` holding exactly 10 while node prints
  `10`. Demanding `RT-INT` reported a correct program as broken, which is the one thing a
  differential tool must not do.
