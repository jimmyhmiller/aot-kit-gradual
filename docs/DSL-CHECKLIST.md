# The DSL conversion checklist

**DONE means every box below is checked.** Each item is binary and carries its own verification.
When an item's status is guarded by a test, the test is named; when it is guarded only by this
file, the item says so. Do not check a box without running its verification.

Legend: `[x]` done and guarded · `[ ]` open · **DECIDE** = an architectural choice the owner
makes once, recorded here, after which the item becomes checkable.

---

## A. Operator and builtin semantics reach the DSL

All guarded by `tests/dsl-ownership-test.coil` (wired list + opcode budgets) and the fuzz
property against node.

- [x] A1. `+ - * / %`, unary `-` → `JsAdd/JsSub/JsMul/JsDiv/JsMod/JsNegate`
- [x] A2. `< <= > >=` → `IsLessThan/IsLessEqual`
- [x] A3. `=== !== == !=`, `switch` matching → `StrictEqual/StrictNotEqual/LooseEqual/LooseNotEqual`
- [x] A4. `& | ^ ~ << >> >>>` → `Bitwise*/Shift*` (wiring `ToInt32/ToUint32`)
- [x] A5. `!` → `LogicalNot`; conditions carry no semantics (`If` owns truthiness)
- [x] A6. `++ --` → `ToNumberValue` + `JsAdd/JsSub`, representation-only write-back
- [x] A7. `typeof`, `void`, `in`, `??`, delete → DSL definitions
- [x] A8. `instanceof` (user constructors, `Object`, `Array`) → `OrdinaryHasInstance` /
      `InstanceOf*Value`
- [x] A9. Object spread → `ObjectAssignSource` per element
- [x] A10. `String.prototype.replace` (string pattern) → `StringReplaceFirst`
- [x] A11. `Number.prototype.toFixed` → `NumberToFixed` over `%ToFixed` (exact, ties away
      from zero, both runtimes)
- [x] A12. The seven abstract operations live with no frontend duplicate (`DSL-OWED` is empty)

## B. Raw semantic opcodes constructed in the frontend (the debt table)

Guarded by `the_frontend_builds_structure_not_meaning` (textual count per opcode).
Done when the budget table is all zeros except any op B3 permanently blesses.

- [ ] B1. `fng-static-global-value` builds global initializers through the DSL (or is deleted in
      favour of lowering globals with a real `FngContext`). Kills 14 of the 16 remaining raw
      constructions (`Add Sub Mul Div Mod Minus Not BitNot BitAnd BitOr BitXor Shl Shr UShr`,
      one each). **Done when:** the budget for every one of those ops is 0.
- [ ] B2. `fng-int-value`'s trailing `(BitOr … 0)` dies with item C-block below.
      **Done when:** `BitOr` budget is 0 (after B1) — currently 2.
- [ ] B3. **DECIDE** the function-identity `Eq` (dynamic-callee dispatch compares a loaded value
      against a `Fun` constant by tag bits). Either bless it permanently as structure — move it
      to a named allowance in the ratchet with this rationale — or route dispatch through a DSL
      definition. **Done when:** the `Eq` budget is 0, or the ratchet carries a named
      `identity-compare` allowance and this box records which.

## C. Coercion-DECISION helpers (`fng-number-value`, `fng-int-value`, `fng-to-number-operand`)

The coercions they emit are already the DSL's; what is outside the DSL is the *decision* of when
to emit them (`fng-needs-to-number?`, the machine-number proofs, the direct-call exemptions).
The conversion at each site: call the DSL unconditionally, let folding remove the provable
guards, re-record any golden graphs, gate with `--cases 600` fuzz.

- [ ] C1. Declared-`number` boundary in `fng-expression-expected` calls `ToNumberValue`
      unconditionally.
- [ ] C2. Element-access keys (`a[i]` read: `GetElement` key; write: the ELEMENT lvalue key)
      call `ToInt32`/the DSL index coercion unconditionally.
- [ ] C3. `a.length = n` (`ResizeArray`'s length argument) same.
- [ ] C4. Number-typed parameter defaults (`fng-default-parameter!`) same.
- [ ] C5. Delete `fng-number-value`, `fng-int-value`, `fng-to-number-operand`,
      `fng-needs-to-number?`, and the exemption machinery that exists only for them.
      **Done when:** `grep -c 'fng-number-value\|fng-int-value\|fng-to-number-operand' src/frontend_native_graph.coil` is 0.

## D. Semantic facts embedded as frontend dispatch data (nothing ratchets these today)

- [ ] D1. Default arguments passed from the frontend move into the DSL definitions (each
      definition takes the spec default when the argument is absent, via an `IsUndefined` arm or
      an explicit `undefined` argument): `toString` radix 10, `toFixed` digits 0,
      `padStart/padEnd` `" "`, `join` `","`, `replace/replaceAll/normalize/localeCompare`
      defaults. **Done when:** `fng-string-argument`'s default parameter is gone and the
      frontend passes only what the source wrote.
- [ ] D2. **DECIDE** the result-type tables in `fng-infer` (which builtin returns
      string/number/array — used for method dispatch and representation). Either bless as
      dispatch structure (recorded here) or derive them from the DSL declarations' `:ret` so
      there is one source. **Done when:** decision recorded, and if derive: `fng-infer` reads
      `jsl-decl` metadata.
- [ ] D3. **DECIDE** `fng-numeric-literal`'s int-vs-float representation choice (safe-integer
      round-trip test). It is representation, but the bounds are spec facts. Bless or move.
- [ ] D4. The layout-safety list (`Object`/`JSON`/`String`/spread disable static shapes) gains a
      guard: a test that enumerating a STATIC object is either impossible (list is right) or
      correct (enumeration learned shapes — see E6). **Done when:** such a test exists and
      passes.

## E. The primitive layer: one meaning per primitive, not two hand-written copies

Today every `%` primitive is implemented twice: `eval.coil` (the oracle, ~163 `ev-*` functions)
and `native/gc/runtime.c` + `js-value.h` (~2,300 lines C).

- [x] E0. **DECIDED (owner, 2026-08-16): push the primitive line down.** Fat primitives become
      DSL definitions over a small atom set; BOTH hand-written copies are deleted in the same
      commit; what remains duplicated is only the atom interpreter + atom selection, plus the
      GC as permanent native substrate. Breakage and lost functionality are acceptable in
      exchange for deleted lines. **The execution plan, written for a less capable model to run
      step-by-step, is `docs/DEMOLITION.md`** — the items below map onto its strikes.
- [ ] E1. (DEMOLITION S9) Value ops pushed down: truthiness, strict-equal, ToNumber table, ToInteger,
      ToFixed (`AOT_JS_VALUE_*` ops 26–32; eval twins `rt-truthy?`, `aot_js_strict_equal`'s
      twin, `ev-to-number-value`, `ev-to-integer`, `ev-to-fixed`).
- [ ] E2. (DEMOLITION S0–S5, S8) String ops pushed down (`AOT_JS_STRING_*` 0–25, 30–31: new/set-unit/length/equal/
      concat/char-code/substring/substr/slice/char-at/from-int/from-bool/from-null/
      from-undefined/parse-int/is-nan/split/is-nan-value/from-code-unit/from-int-radix/
      from-double-bits/lower/upper/index-of/compare/from-value/parse-float/normalize; eval
      twins in `jsstring.coil` + `ev-string-*`).
      *Progress:* S0 exposed the two ATOMS (`%StringNew`/`%StringSetUnit`, ops 0/1 — these two
      stay; they are what everything else is written over). S1 deleted `lower`/`upper` (21/22)
      and both hand-written copies: `lib/string/case.jsl` is the only ASCII case shift left.
- [ ] E3. (DEMOLITION S6–S7) Number→string formatting CONFORMANT and single-sourced in the DSL: shortest-round-trip
      ToString (today `%.17g` noise natively, no exponential form in eval —
      repros/open/large-double-tostring-not-exponential.js). **Done when:** that repro moves
      out of open/ and `String(0.1)`/`String(1e21)`/`String(123456789012345680000)` match node.
- [ ] E4. (DEMOLITION S9+) Array ops pushed down (`aot_js_array` dispatcher; eval twins in `jsarray.coil` /
      `ev-array-*`).
- [ ] E5. (DEMOLITION S9+) Property/prototype ops pushed down (`aot_js_property`; eval twins in
      `jsobject.coil`: own-key order, prototype chains, delete, freeze).
- [ ] E6. Enumeration sees every object: either static shapes are enumerable (own-key
      count/at/load know shape slots in BOTH runtimes) or the layout-safety list (D4) is proven
      complete. **Done when:** `Object.keys` on a statically-shaped literal is correct without
      the program-wide demotion, or D4's test blesses the demotion.
- [x] E7. **DECIDED with E0**: allocation, GC, safepoints, trampoline are permanent native
      substrate — machine plumbing, not JS semantics. Never on the demolition list.
- [x] E8. **DECIDED with E0**: libm calls (sin/cos/pow/…) ARE atoms; they stay primitive.
      (Was: Math builtins (`AOT_JS_BUILTIN_*` 0–16: abs/floor/ceil/round/exp/log/sin/cos/tan/
      asin/acos/atan/sqrt/pow/max/min/random) — same treatment as E1.

## F. Missing features (absent, not misplaced)

- [ ] F1. Regexp engine — the last owed `%` primitive family; unblocks
      `String.prototype.replace/match/split` with RegExp patterns.
- [ ] F2. `Boolean(x)` — gives `ToBoolean` its caller; removes the last orphan-allowlist
      exception that exists for a missing feature.
- [ ] F3. Rest parameters (`...xs`) — currently refused by name.
- [ ] F4. `Function` as an indexed global (unblocks `instanceof Function`).
- [ ] F5. `$`-substitution (GetSubstitution) in `replace`/`replaceAll` — currently documented
      as literal-insertion.
- [ ] F6. ToPrimitive protocol — objects in `==`/`+` currently compare/concat by identity
      fallback; documented in `LooseEqual`.
- [ ] F7. repros/open/closure-capturing-a-loop-variable.js runs correctly.
- [ ] F8. repros/open/undefined-for-these-values.js runs correctly.
- [ ] F9. Object rest in destructuring / array spread in literals (array spread is refused
      today; object spread landed).

## G. Enforcement: the frontend CANNOT hold a semantic

- [ ] G1. Split `Op`: arithmetic/comparison/bitwise variants unnameable outside `jsl_lower` —
      `(Add)` in the frontend is a COMPILE error. (Big mechanical refactor across
      node/eval/verify/backend/gtext/templates; exhaustive matches drive it; hivemind with the
      full test suite as gate is the suggested vehicle.)
- [ ] G2. Phase 5: with B and C done, delete whatever helper surface remains so a future
      hand-written semantic requires adding a door back in a commit that says so.
- [ ] G3. Layer-D guard: the dispatch-data facts (D1–D4) are covered by tests or derived from
      the DSL, so they cannot drift silently.
- [ ] G4. The primitive layer (E) has a conformance harness: one table of cases runs against
      the evaluator, the native runtime, and node, so the two implementations cannot disagree
      silently. (The fuzz property covers composite programs; this is the per-primitive
      version.)

---

Ledger: 15 done, 24 open (2 remaining DECIDE items: B3, D2/D3). Execution manual: docs/DEMOLITION.md.
When a box is checked, name the commit that did it next to the box.
