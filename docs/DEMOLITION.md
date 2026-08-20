# The demolition manual: one implementation of JavaScript, in the DSL

**THE EVALUATOR IS GONE (owner, 2026-08-18).** `src/eval.coil`, `src/jsarray.coil`,
`src/jsobject.coil`, the evaluator's string runtime, `tools/js-repro`, `tools/js-sweep` and every
test that ran a program through the interpreter were deleted in one commit — 8,700 lines. The
reasoning: an AOT compiler ships machine code, the interpreter shipped nothing, and it was one of
the two hand-written copies of every primitive that this manual exists to delete. Deleting it
halves the duplication in a single move and makes the remaining strikes smaller.

**READ THIS BEFORE YOU DELETE ANYTHING ELSE. THERE IS NO JAVASCRIPT-SEMANTICS GATE RIGHT NOW.**
`coil test` is 390 tests about the compiler's STRUCTURE — types, verifier, graph text, selection,
scheduling, register allocation — plus about 70 assertions that execute machine code for
arithmetic, control flow, calls and object memory. Nothing checks that a JavaScript program
computes the right answer. Green does not mean correct. Every gate that could answer that
question ran through the interpreter and went with it: the node differential, the fuzz property,
the 48-repro sweep.

**So the next work is not a strike. It is the native oracle** — see `## Phase A` below. Until it
lands, a strike can be written but cannot be verified, and landing one on a green tree is
landing it blind.

**THE DECISION (E0, owner 2026-08-16): push the primitive line down.** Every fat primitive — an
operation whose meaning is a loop over smaller operations — becomes a DSL definition in `lib/`,
and the hand-written copy in `native/gc/runtime.c` is DELETED IN THE SAME COMMIT. (This used to
say BOTH copies, eval.coil and runtime.c. There is only one now.) The owner has explicitly
accepted breakage and lost functionality in exchange for deleted lines. When an operation
resists, refuse it loudly (the rest-parameters pattern) rather than keeping a hand-written copy.

What survives permanently:
- **The atom set** — small ops the CPU/heap gives us. Each needs ONE implementation, the C case
  in `runtime.c`, and one instruction selection. There is no second copy to keep in sync any
  more; that is the whole benefit of deleting the interpreter.
- **The GC**: `native/gc/runtime.c`'s allocation/collection/safepoints and `trampoline.S` are
  machine plumbing, not JavaScript. Never delete them. The string-constant materializer's use of
  `JSSOP-NEW`/`JSSOP-SET-UNIT` in `ms-select-string-id!` also stays.
- **`src/jsstring.coil`, at 170 lines** — NOT a string runtime any more. It is the compiler's
  string-CONSTANT table: source text interns here and `ms-select-string-id!` reads the units back
  to materialize a constant into machine code. Do not grow it back.
- **`lib/` — the single implementation of everything else.**

Success is measured in deleted lines. `runtime.c` 2,261 is the number that matters now.
`repros/*.js` (49 files) and `tests/native-conformance/*.ts` are kept deliberately: they are the
input corpus Phase A's harness will run.

---

## Phase A — the native oracle: DONE (2026-08-19)

`tests/native-execution-test.coil` compiles TypeScript source to an object file, links it with
`xcrun clang` against `native/gc/runtime.c` and `trampoline.S`, runs the binary, and compares the
integer it prints with node's answer for the same source. **This is the only test in the repo that
runs the artifact this project ships.**

It needed no new machinery, and the earlier sketch in this file (mmap the code, hand-patch the `BL`
relocations through thunks) was the wrong shape — the real linker does that job. The three legs
already existed unassembled: `fe-native-new`/`frontend-native-build!` for source to graph,
`linked-object-test`'s `fopen`+`popen`+`clang` for graph to running binary, and a `popen` of
`node -e` for the other opinion.

Falsified before it was trusted: changing one comparison in `lib/string/case.jsl` (65 to 66) makes
`string_case_is_a_dsl_loop_and_it_runs_on_the_cpu` fail while the arithmetic case still passes.

What it proves that nothing else did: `"AbZ@[a".toLowerCase()` has no implementation in the
compiler and none in C — strike 1 deleted both — so the answer comes from `lib/string/case.jsl`
lowered through `jsl_lower`, selected to JSSOP 0 and 1, emitted as arm64, and resolved by the
linker against `_aot_js_string`. The emitted object's only undefined symbol IS `_aot_js_string`.

**The frontier it exposed is DERIVED, not listed.** `tests/native-capability-test.coil` reads the
method names out of the frontend's own dispatch tables, compiles each under four usage shapes, and
writes `docs/NATIVE-CAPABILITY.md` -- checked in, compared on every run, 216 cells.

**205 of 216 compile today, up from 113, and verifier rejections are 0.** Six fixes got there;
HANDOFF.md has each with its witness. The theme is one sentence: A TYPE IS NOT A REPRESENTATION,
and four separate places were deciding which machine word a value is by asking its type.

The 11 that remain are one missing feature: `String(anArray)`. JavaScript says `String([1,2,3])`
is `"1,2,3"` through `Array.prototype.toString`, and nothing implements that conversion --
`ArrayJoin` exists in `lib/` and wants reaching from `ToStringValue`, not a case in the frontend.

Read that report before scoping a strike.

---

## Part 1 — The op-registration drill (verified working; ToFixed was added this way)

To ADD an op named `X` with N operands, edit these sites IN THIS ORDER. After the defsum edit,
`coil check` lists every non-exhaustive match — let the compiler drive you to any site this list
misses. Anchor every insertion next to the `ToFixed` entry, which appears at each site.

**src/node.coil** (9 sites):
1. The `Op` defsum variant list: add `(X)` after `(ToFixed)`.
2. OPTAG constant: `(const OPTAG-X i64 <next>)` before `(const OPTAG-COUNT ...)`; bump COUNT.
   Next free is 91. OPTAGs are stable ids — never renumber existing ones.
3. `op-decode-tag`: `OPTAG-X (X)`.
4. `op-encode-tag`: `(X [] OPTAG-X)`.
5. `op-encode-payload`: `(X [] 0)`.
6. `op-value-name`: `(X [] "X")`.
7. `op-class`: `(X [] 98)` for a pure computed value (98 = VALUE|GVN|FOLDABLE), **`(X [] 2)`
   for an allocation or a mutation** (2 = VALUE only — an allocation is an identity, GVN would
   merge two distinct strings; a mutation must never be constant-folded).
8. The compute dispatch (the big match containing `(ToFixed [] (t-str))`): add `(X [] <type>)`.
9. The idealize dispatch (the match containing `(ToFixed [] NO-NODE)`): `(X [] NO-NODE)`.

**src/gtext.coil**: `op-payload-codec-kind` gains `(X [] AUXK-NONE)`.

**src/verify.coil** (2–3 sites):
- `v-check-arity`: `(X [] (v-need (= k <1+N>) VERR-ARITY n))` — slot 0 is the control anchor.
- `v-check-slots`: `(X [] (do (v-need-value n 1) ... (v-need-value n N) 0))`.
- `v-rep-slot-required` only if the op has a representation contract worth enforcing.

**src/jsl.coil** (4 tables): `(const JSP-X i64 <next>)` (next free is 94; bump JSP-COUNT),
name table `JSP-X "%X"`, op table `JSP-X (X)`, arity table `JSP-X N`. The generic lowering in
`jsl_lower.coil` handles arities 1–3 by building `n-new2/3/4`; nothing to edit there unless the
op needs special control/memory plumbing.

**src/backend_select.coil**: a selection arm. For string-family ops use the existing pattern:
`(ms-jsstring! owner bid node a b value JSSOP-X)` where `a`,`b` are selected vregs and `value`
is the third argument slot (use `(ms-immediate! owner bid 0)` for unused positions).

**src/backend_core.coil**: `(const JSSOP-X i64 <next>)` — next free is 33.

**native/gc/js-value.h + runtime.c**: enum entry + `operation ==` case. FOR THE TWO STRING ATOMS
THIS IS ALREADY DONE: `AOT_JS_STRING_NEW = 0` and `AOT_JS_STRING_SET_UNIT = 1` exist and work
(the constant materializer uses them). No C is needed for Strike 0.

## Part 2 — The op-DELETION drill (the point of everything)

To DELETE a fat op `X`, in one commit:
1. First make it unreachable: every `%X` in `lib/` is replaced by a DSL definition; verify with
   `grep -rn '%X' lib/` → empty, and `grep -n '"X"' src/frontend_native_graph.coil` → empty
   (frontend calls DSL definitions by name; those names stay — only `%`-primitive uses die).
2. Remove the defsum variant. Run `coil check`. Visit EVERY error it reports and delete the
   arm: the 9 node.coil tables, gtext, verify, eval dispatch, backend_select,
   `src/op_arbitrary.coil` (the fuzz generator), `src/js_templates.coil` (`js-op-family` and
   the emit arms — the TEMPLATE program can move to a surviving op's arm; do not lose the
   fuzz coverage of the JS feature, only the dead op).
3. Delete the now-orphaned implementations: the `n-x!` builder in node.coil, the `JSSOP-X`
   const, the runtime.c case and the js-value.h enum member (leave a `/* retired: X */` comment at the enum so the
   numbering history is readable; never reuse the number).
4. Update pins the compiler cannot see: `tests/jsl-test.coil` decl counts if lib
   definitions were added (`jsl-decl-count`, funs+macros totals, macro count),
   `tests/dsl-ownership-test.coil` lib-files list if a new .jsl file was created.
5. Gate (Part 4), then commit with the line-count delta in the message.

## Part 3 — The strikes, in order

### Strike 0 — expose the string atoms (registration only, no deletion)
Add ops `StringAlloc` (1 operand: raw int length → fresh string, all units zero, class **2**)
and `StringSetUnit` (3 operands: string, raw index, raw unit → returns the SAME string, class
**2**). JSP names `%StringNew` and `%StringSetUnit`. Selection: JSSOP 0 and 1 (already
implemented in C). Evaluator: add `jss-alloc! (len)` and `jss-store-unit! (string index unit)`
to `src/jsstring.coil` — mirror `jss-code-unit`'s record access for the write; `jss-alloc!`
appends `len` zero units to the heap and makes a record (see `jss-new-window!`). Ordering in
the DSL comes from DATA DEPENDENCE: always thread the string through the loop accumulator —
`(recur (%Add i 1) (%StringSetUnit out i u))` — never discard the result.
The existing read atom is `%StringCharCode` (in-bounds only — DSL callers guard); `%StringLen`
is the length atom.

### Strike 1 — case (proof of the pattern)
Rewrite `lib/string/case.jsl`:

    (builtin StringToLowerCase :params [(s dyn)] :ret dyn
      (let [(len (%StringLen s))]
        (loop [(i 0) (out (%StringNew len))]
          (if (%Le len i)
              out
              (let [(u (%StringCharCode s i))
                    (m (if (%Lt u 65) u (if (%Lt 90 u) u (%Add u 32))))]
                (recur (%Add i 1) (%StringSetUnit out i m)))))))

Upper is the mirror (97–122 → subtract 32). This matches today's ASCII-only semantics exactly.
DONE 2026-08-18. Ops `StringLower`/`StringUpper`, runtime `TO_LOWER_ASCII`/`TO_UPPER_ASCII`,
JSSOP 21/22, JSP 24/25 and `n-string-lower!`/`n-string-upper!` are gone. Pinned against node:
`"AbZ@[a".toLowerCase()` → `"abz@[a"`, upper mirror, plus a dynamic `String(acc)` receiver.

### Strike 2 — build/compare: `StringFromCodeUnit`, `StringConcat`, `StringEq`
Each is a loop over the atoms (concat: alloc len1+len2, two copy loops; eq: length check then
unit loop). NOTE `fng-jsl-call` sites in the frontend already call lib names
(`"StringConcat"`, `"StringEquals"`) — only the lib bodies and `%`-uses change. `%StringEq` is
also used inside lib (`StrictEqual` etc.) — replace those uses with the DSL definition (a
`builtin`, so it stays a call, not an inline blowup). Delete the three ops.

### Strike 3 — the substring family
`StringSubstring [mode]` is ONE op with modes (substring/slice/substr/charAt). Write one DSL
copy loop `SubstringUnits (s, from, to)` over the atoms; the four mode behaviors (clamping,
negative indices, charAt's 1-unit/empty result) already exist as spec logic — express them as
DSL wrappers (`Clamp`/`RelativeIndex` already exist in lib). Delete the op and eval's
`jss-window!`/`jss-substring!`/`jss-slice!`/`jss-substr!`/`jss-char-at!` family. This is the
single biggest eval deletion.

### Strike 4 — search/compare: `StringIndexOf`, `StringCompare`
Plain loops (`jss-match-at?` shows the algorithm; UTF-16 unit-wise lexicographic for compare).
Delete both ops. `StringIndexOfFrom` in lib currently wraps `%StringIndexOf` — it becomes the
real implementation.

### Strike 5 — `StringSplit`
A loop producing an array via the existing array ops (`%NewArray`/`%ArrayStore` — see
`ObjectKeys` in lib/object/enumeration.jsl for the shape). Delete the op and its eval/runtime
copies (the runtime case is large — big deletion).

### Strike 6 — `ParseInt`; `ToFixed` and `NumberToString(radix)` in the DSL
- `ParseInt`: char loop over units (sign, radix prefix, digit values). Delete the op.
- `ToFixed`: the exact bignum ALGORITHM is written in `aot_js_to_fixed_format` (runtime.c,
  commented; the evaluator's twin `ev-to-fixed` was deleted with the interpreter — recover it from
  git history if the commentary helps). Port it to the DSL: the 32-bit-half bignum is expressible with `%NewArray`/
  `%ArrayStore`/`%ArrayLoad` over an array of raw ints, or over a `%StringNew` unit buffer.
  Then delete BOTH copies and the `ToFixed` op — the poster child of this whole effort.
- `NumberToString` radix formatting: digit loop. Delete `FROM_INT_RADIX`.
- **`%ParseFloat` stays a primitive for now** (correctly-rounded decimal→double needs the
  bignum comparison technique; do it after S6 lands, same pattern as ToFixed, or leave with a
  written note). Do not silently approximate.

### Strike 7 — `ToString` of a double, conformant, once
Replace both nonconformant copies (`%.17g` in C, `{f}`-based in eval) with ONE DSL algorithm:
shortest-round-trip via the S6 bignum (generate digits at increasing precision; accept the
first digit string whose exact value re-rounds to the input double; then the spec's
fixed-vs-exponential formatting rules, sec-numeric-types-number-tostring). This closes
repros/open/large-double-tostring-not-exponential.js and checklist E3. Until S7 lands, keep the
current `%ToString` primitive — a wrong-but-present formatter beats none.

### Strike 8 — delete `normalize` and `localeCompare` outright
Owner-approved functionality loss: they drag Unicode tables (`native/unicode_runtime.c`).
Refuse both loudly at the frontend (the rest-parameters pattern: indexing error naming the
method). Delete `StringNormalize` op, both implementations, `unicode_runtime.c` if nothing else
uses it, JSSOP 31, the templates that emit them.

### Strike 9+ — beyond strings (sketch; scope each like the above before starting)
- `IsNaN`/`ToNumber`'s STRING-parsing arm → DSL over string atoms (the numeric table for
  non-strings is small and stays primitive).
- Enumeration (`OwnKeyCount/OwnKeyAt`) and the property table: needs property atoms — design
  them first (a doc note, then the drill). This unblocks checklist E6.
- Arrays: `jsarray.coil` is only 173 lines — low priority.
- Math builtins: `sin/cos/...` are libm — they ARE atoms; leave them.

## Part 4 — The gate protocol (run after every strike, no exceptions)

    coil check                                    # silent = clean
    coil test                                     # read the exit; do not pipe-mask it

`coil test` now includes `tests/native-execution-test.coil`, which is the only suite that runs
compiled code against node. **A strike is not done until its DSL definition has a case there.**
Add one in the same commit, and let node supply the expected value rather than computing it by
hand — a hand-computed expectation shipped wrong once already.

The repro sweep, the fuzz property and the `ns.js` budget are still gone; they ran through the
interpreter. Rebuilding the fuzz property on this harness is the next gate work after the `Box`
selection fix — `src/js_templates.coil` in git holds 400 lines of node-verified program templates
for it.

## Part 5 — Known traps (each of these cost real time; do not rediscover them)

- **Paren surgery**: the frontend's if-chains close with long paren runs. After any insertion,
  `coil check` immediately; if it reports `unclosed '('` the miscount is yours.
- **Exhaustive matches are the to-do list**: after a defsum change, loop `coil check` → fix →
  repeat until silent. Do not try to enumerate sites from memory.
- **The ratchets are textual**: `(Add)` in a COMMENT counts toward the opcode budget in
  tests/dsl-ownership-test.coil. Word comments accordingly.
- **Lib decl-count pins**: adding/removing lib definitions moves `jsl-decl-count` (three pins
  in tests/jsl-test.coil: total, funs+macros, macros).
- **Build-time decisions key on SHAPE, never on a mid-construction `n-ty` read** (bitten
  twice; see HANDOFF).
- **An If's control operand is read before an argument-position JSL call inlines its
  diamonds** — lower the call to a local first.
- **New custom hashes end in `ty-hash-finalize`** (the stdlib map masks with low bits).
- **`builtin` vs `macro`**: loops need `builtin` (a real called function; macros inline and
  cannot recur). String operations in this manual are all `builtin`s.
- **GVN and allocation**: any op that creates identity or mutates gets op-class 2, never 98.
- **Do not delete** `JSSOP-NEW`/`SET-UNIT` runtime cases, `ms-select-string-id!`, the GC, or
  the trampoline. `jss-from-utf8!`/`jss-utf8!` stay: the frontend interns source text with one
  and `jsl_lower` reads names back with the other.
- **AN ALLOCATION OR A MUTATION MUST BE CONTROL-PINNED, and op-class 2 is not enough.** Lower the
  primitive with `(jl-ctrl)` as slot 0 — see `jl-prim`'s string-atom arm. A floating allocation is
  free to be duplicated or sunk by anything that walks the graph. This was found the hard way when
  the interpreter, which was demand-driven, ran a floating `%StringSetUnit` twice and wrote the
  same unit twice; the interpreter is gone but the graph property it exposed is real, and the
  scheduler is the next thing that will exercise it.
- **A DELETED OP LEAVES A HOLE IN A DENSE, SCANNED ID SPACE.** `gparse-op` walks every OPTAG and
  `jsp-find` walks every JSP id, so a retired number must be declared — `op-tag-retired?`
  (node.coil) and `jsp-retired?` (jsl.coil) — or the parser aborts on its own table. Add the
  number to the list in the same commit that retires it.

## Part 6 — Progress ledger (update per strike, with commit hashes)

| strike | status | runtime.c | notes |
|---|---|---|---|
| baseline | — | 2274 | 2026-08-16. eval.coil was 4330 then; it is 0 now. |
| S0 atoms | **done** | 2274 | 2026-08-18. `StringAlloc`/`StringSetUnit`, OPTAGs 91/92, JSP 94/95. Registration adds; deletion starts at S1. The evaluator half of this strike was deleted the same day. |
| S1 case | **done** | 2261 | 2026-08-18. lib/string/case.jsl is a loop over the atoms; the ops, JSSOP 21/22 and the C case are gone. **Its native half has never executed — Phase A validates it.** |
| **Phase A** | **NEXT** | — | The native oracle. No strike below can be verified until it lands. |
| S2 build/compare | open | | |
| S3 substring | open | | |
| S4 search | open | | |
| S5 split | open | | |
| S6 parseint/tofixed/radix | open | | |
| S7 double ToString | open | | |
| S8 delete normalize | open | | |
