# Handoff: move JavaScript semantics into the DSL

**THE TREE IS GREEN. 566 passed, 0 failed.** The operator migration is essentially COMPLETE:
every JavaScript operator the frontend lowers — arithmetic, comparison, equality, bitwise,
logical not, `++`/`--`, `instanceof`, spread — reaches its meaning through `lib/`. `DSL-OWED` is
EMPTY. What remains is Phase 1/5 enforcement residue and two feature gaps, listed at the end.

Read `docs/DSL-OWNERSHIP.md` for the phases and the enforcement. **`docs/DSL-CHECKLIST.md` is
the definition of done** — every remaining item as a checkable box with its own verification;
update it as boxes close. This file is what is in flight.

---

## The mandate, stated here so it is not a pointer

**Every JavaScript semantic moves into `lib/`.** The frontend lowers *syntax* into structure:
control flow, scoping, memory and alias plumbing, the call ABI, closures, shapes,
REPRESENTATION. The meaning of every operator, coercion and builtin belongs to the DSL, reached
through `fng-jsl-call*`. **The DSL's expressiveness is never the limit** — a `%` primitive is the
correct way to reach a runtime capability it cannot spell (`%ToFixed` was added this way; a
regexp engine is the one still owed). **Do not accept a partial conversion as done**, and **no
fast path in the frontend** — the specialisation lives in the definition and folds when types
prove.

## Current state of the debt (all ratcheted in tests/dsl-ownership-test.coil)

| opcode | count | what it is |
|---|---|---|
| `Eq` | 1 | dynamic-callee identity compare — tag bits ARE function identity here |
| `Lt` `Le` | 0 | — |
| `Add` `Sub` `Mul` `Div` `Mod` `Minus` `Not` `BitAnd` `BitXor` `BitNot` `Shl` `Shr` `UShr` | 1 each | `fng-static-global-value`, the literal-only constant evaluator (numeric operands enforced) |
| `BitOr` | 2 | the above plus `fng-int-value`'s index coercion |

`DSL-OWED` is empty. Of Phase 1's six helpers: `fng-equal-value` and `fng-bin` are DELETED,
`fng-condition-expression` is renamed `fng-condition-representation` (`If` owns truthiness
end-to-end; the helper only boxes a raw string pointer). Three remain — `fng-number-value`,
`fng-int-value`, `fng-to-number-operand` — reachable only from the declared-type boundary
(`fng-expression-expected`), array index/length positions, and parameter defaults.

## What landed this session, most recent first

- **`++`/`--`** are `ToNumberValue` then `JsAdd`/`JsSub` (spec: ToNumeric then a NUMERIC add,
  never concat; postfix returns the COERCED old value). The write-back representation stays the
  frontend's, decided structurally with `fng-machine-number-value?`.
- **Object spread** — each `...a` is one `ObjectAssignSource` step (the definition Object.assign
  repeats). Two supporting rules: a program containing spread disables static object layouts
  (enumeration reads the runtime property table; shape slots are invisible to it), and a
  certainly-SHAPE-ROOT object never takes `fng-unique-field-index`'s static-shape name-guess.
- **`instanceof Object` / `instanceof Array`** — name-dispatch (only when the name has no user
  binding) to `InstanceOfObjectValue`/`InstanceOfArrayValue` in lib/abstract/property.jsl.
- **`Number.prototype.toFixed`** — the owed number-formatting primitive, built: `%ToFixed`
  computes round(x·10^f) EXACTLY on the double's binary decomposition, ties away from zero
  (printf rounds ties to even and cannot express the spec). Mirrored in `ev-to-fixed`
  (eval.coil) and `aot_js_to_fixed_format` (native/gc/runtime.c). ≥1e21 delegates to ToString
  and inherits repros/open/large-double-tostring-not-exponential.js.
- **`String.prototype.replace`** (string pattern, first occurrence) — `StringReplaceFirst`.
- **Equality, whole**: `===`/`!==`/`==`/`!=`/`!` and `switch` matching are
  `StrictEqual`/`StrictNotEqual`/`LooseEqual`/`LooseNotEqual`/`LogicalNot`. Deleted
  `fng-equal-value`, `fng-loose-equal`, `fng-nullish-equal` and the number/number and
  string/string fast paths. `StringEquals` is interior to the DSL now.
- **Conditions hold no semantics** — `If` owns truthiness (evaluator `rt-truthy?`; selection
  dispatches tagged→VALUE-TRUTHY, float→MI-FTRUTH, int→zero test). String conditions box.
- **`fng-static-global-value` is numbers-only** — its qualifier refuses `true + 1` etc., which
  fall to the ordinary top-level path where the DSL owns the coercions.
- Earlier in the session: the arithmetic migration landed green (declared-type coercion at
  `fng-expression-expected`, `n-rep-of` as the one representation classifier shared by verifier
  and idealize, `Box(tagged)` peels as identity, `Unbox` folds vetoed for certainly-tagged).

## The compiler was updated mid-session, and the fallout is instructive

The coil binary (and its stdlib) changed at 21:28 on 2026-08-16. Four things broke, none of them
new code:

1. **Reader**: `\xNN` escapes now need `\xNN;`; `SexpKind` gained `KView` (jl-float-bits match).
2. **`fng-coerce-to-alias` keyed on a momentary `n-ty` read** whose value depended on peephole
   visit order; the order changed and `o.x = acc` after `acc += 1` stored a tagged word raw.
   Fixed structurally with the boxed walk. **Build-time decisions key on SHAPE, never on a
   mid-construction type read** — this trap has now bitten twice.
3. **The stdlib hashmap masks buckets with `hash & (cap-1)`** and `hash-step`'s FNV multiply
   leaves low bits structured: ty-intern went quadratic and ns.js ran 90+ CPU-minutes.
   `ty-hash-finalize` (splitmix64 finalizer) now ends every repo-owned KeyOps hash
   (ty, gvn, ev-array-slot). ns.js: 1:38, correct. Any new custom hash must end in it.
4. **Two fields sharing one alias** left a duplicate entry in control snapshots' active lists;
   divergent states under one alias appeared once processing order changed
   (repros/shared-field-alias-snapshot-duplicate.js). `fng-control-aliases!` dedupes.

## Traps that cost real time (cumulative)

- **A type is not a representation.** `n-rep-of` (node.coil) is the one answer; the verifier and
  the idealizations read the same table. A Phi with an absent arm is UNKNOWN by design.
- **Build-time type reads are momentary state.** Key on shape/structure: the boxed walk,
  `fng-machine-number-value?`, `fng-shape-root-object?`.
- **An `If`'s control operand is read before an argument-position JSL call runs** — the call
  inlines guard diamonds that ADVANCE control. Lower the call first, then build the If
  (both switch lowerings record this).
- **The ratchet counter is textual** — a comment saying `(Add)` counts.
- **Piping `coil test` output masks its exit status** — check before committing.

## Tools

- `coil build tools/js-repro.coil -o out/js-repro`; `out/js-repro FILE.js ARG [--dump]` — node's
  answer beside ours in ms. Sweep: `for f in repros/*.js; do ./out/js-repro "$f" 10 >/dev/null
  || echo "FAIL $f"; done` (ns.js ~1:40 with the raised budget).
- Fuzz: `coil test tests/js-source-prop.coil --filter opcode_generated --cases 600`. The default
  gate runs fewer cases — run a big-case pass before declaring a frontend change safe.
- `sample <pid>` when anything is slow; ty-eq under hm-get means a hash went weak.

## Next, in order

1. **Phase 1 residue**: convert the three remaining coercion helpers' sites to unconditional
   DSL calls (`ToNumberValue`/`ToInt32`) and let folding remove them — the mandate's own
   prescription — then delete the helpers. Then **split `Op`** so arithmetic/comparison/bitwise
   variants are unnameable outside `jsl_lower` (big mechanical refactor across node/eval/verify/
   backend/gtext/templates; the exhaustive-match compiler drives it; consider hivemind with the
   test suite as gate).
2. **The regexp engine** — the last owed `%` primitive family (String.replace/match/split with
   RegExp patterns). `Boolean(x)` to give `ToBoolean` its caller.
3. **Open repros**: closure-capturing-a-loop-variable, rest-parameters,
   undefined-for-these-values, large-double-tostring-not-exponential (wants the real
   shortest-round-trip digit generator; the native side prints %.17g noise today).
4. The stdlib's own `bytewise-hash` likely shares the low-bits weakness — that fix belongs in
   the compiler repo.
