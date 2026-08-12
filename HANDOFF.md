# Handoff: V8 benchmark support, DSL coverage, and runtime performance

Last updated: 2026-08-12

## Goal

Make every non-RegExp benchmark in the current V8 v7 corpus compile and run correctly through the
AOT pipeline, then compare runtime performance with a properly warmed Node/V8 baseline.

The authoritative benchmark list is:

- Richards
- DeltaBlue
- Crypto
- RayTrace
- EarleyBoyer
- Splay
- NavierStokes

RegExp is intentionally excluded for now. “Supported” means the original benchmark executes its
own correctness checks successfully; merely parsing, emitting an object file, or avoiding a crash
does not count.

The broader project goal remains to express JavaScript semantics in the JSL DSL under `lib/`, with
the compiler/runtime providing mechanisms rather than benchmark-specific behavior.

## Current verified status

All five remaining benchmarks were probed end-to-end on 2026-08-11 with single-run adapted
sources (suite registration stripped, `main()` appended; all five adaptations validated under
Node first — NavierStokes was given a density-checksum `main` since upstream v7 has no self-check;
Node expects 2762). Every blocker below is reproduced and specific.

| Benchmark | Current status | Evidence / blocker |
|---|---|---|
| Richards | Runs and passes | `result=0 collections=0 moves=0`; ~29 ms/run steady state. |
| DeltaBlue | Runs and passes | `result=0 collections=0 moves=0`; ~65 ms/run steady state. |
| NavierStokes | Runs end to end; density stays zero because `addPoints` never fires — ONE equality lowering left | The whole pipeline works: both resets size arrays correctly (4356 then 16900), ~900k array ops execute, the checksum store/read round-trips through the script-global table. The density is zero because `prepareFrame`'s `framesTillAddingPoints == 0` never passes: the global's PropLoad is correctly classified dynamic and `fng-equal-value` takes the numeric-peer branch — `(fng-bin OP-EQ (n-unbox! left (t-flt)) right)` — a RAW float unbox of an INT-tagged word (0x7ffc<<48) compared against an int constant. That compare must go through the guarded ToNumber (IsInt/IsFlt diamond) like every other dyn numeric seam, or normalize both sides to one machine representation. ATTEMPTED AND REVERTED: wrapping the branch-570/572 operand as `(n-unbox! (fng-to-number-operand context left) (t-flt))` fails machine liveness with MLIVE-CLASS (a GPR/FPR register-class conflict, vreg 1925 in the scratch build) — plain mixed int/flt compares exist and work (lin_solve's `Le`), so the conflict is in how this particular ToNumber-diamond output threads into EQ; try lowering the compare through the JSL `Equals`/`StrictEquals` builtin instead, or convert the int peer to float with the proper ideal conversion op rather than adding an unbox. Mini-repro `fieldrepro.js` in the scratchpad now matches Node exactly (28) after the fng-int-value/fng-number-value CALL-exemption fixes — reuse its pipeline for iteration (`AOT_TRACE_ARR=1` traces all array/property ops via tools/native-gc-runtime.c). Expected checksum 2762. |
| Splay | Frontend rejects namespaced constructors | `FE-CODE-UNBOUND-NAME` on `Node` from the `SplayTree.Node` pattern. A minimal namespaced-constructor repro gets further — frontend passes, then `MSEL-CALL` because `X.Y.prototype.method =` publications are not indexed as prototype methods, so instance method calls have no targets. Both halves needed. |
| Crypto | Frontend rejects implicit globals | `FE-CODE-UNBOUND-NAME` on `setupEngine` (`setupEngine = function(...)` with no `var`), and `nValue`…`coeffValue` are likewise assigned-without-declaration; also uses bare `alert` (adapter shim needed, as DeltaBlue's). Needs sloppy-mode implicit-global creation in the resolver; unknown further blockers behind it (BigInteger is string/array heavy). |
| RayTrace | Needs `arguments` + `Function.prototype.apply` | Built entirely on the Prototype.js idiom `this.initialize.apply(this, arguments)` — every class instantiation forwards variadic arguments. Real feature work, not a resolver gap. |
| EarleyBoyer | TS parser rejects the source | 78 parse diagnostics, all `Octal escape sequences are not allowed` from the scheme2js character tables ("\\000" etc.). Adapter-rewritable to `\\xNN` losslessly; unknown depth behind it (4,684 lines of scheme2js output — exceptions, apply, string machinery). |

There is still no valid benchmark/Node comparison table. Do not report performance numbers for a
benchmark until its native result passes the benchmark's correctness checks and the perf debt
below is at least triaged.

## Three-way differential tooling (built 2026-08-11/12) — USE THIS FIRST

`node tools/js-native-run.mjs FILE.js [--debug] [--ts-native] [--eval] [--keep]` is now the
primary iteration loop (~2s with the cached -O0 emitter after `--debug`'s first build):

- `--eval` runs Node vs the IR EVALUATOR (ev-run on the frontend's graph) vs native, and blames a
  mismatch at the frontend (evaluator already disagrees with Node) or the backend (evaluator
  agrees, native does not). The evaluator understands the materialized-closure ABI (env object
  marked callable), function property shadow objects, and entry-Arg-rooted memory chains; its
  EV-MEM/EV-UNBOX/EV-CAST failures print the node, value, and requirement.
- Float results print numerically (native side decodes NaN-boxed float bits).
- `--keep` keeps program.o for objdump; `AOT_DUMP_GRAPH=1` dumps the graph from the resident
  emitter; schedule-seed -999 dumps mu/ms.

## OPEN: numeric-join boxing picks a WRONG STATIC TAG (the isolated backend bug, 2026-08-12)

Exact repro (scratchpad acc6.js / drop4.js; object-parameters JS-mode reduces to it): an untyped
accumulator `total = total + call() * k` over enough terms computes the right float in d-regs and
then boxes it with the INT tag. Disassembly (drop4): `fadd d0...; fmov x15, d0; ... movk x17,
#0x7ffc, lsl 48; orr x0, x0, x17` — 0x7ffc OR'd onto raw IEEE bits. ToInt32 of the resulting
word rounds the true total to a multiple of 256 (7052134 -> 7052288).

Root cause: `be-js-tag-for-value`'s numeric-join case answers `(if (be-node-fp-value? node) 0
JSV-INTEGER)` — a SECOND representation walk that can disagree with the walk selection used when
it chose FADD. The file's own comment admits the class ("the answer decides the representation,
so the two sides ... could disagree"). The representation authority must be single: either (a)
tag from the SELECTED register class of the operand vreg at JSBOX emission (FPR -> tag 0), or
(b) box `num`-typed values with a runtime integrality test (int -> 0x7ffc, else raw float bits),
which is the semantically faithful choice. Note `total < 1e18` comparisons on such dyn totals
also evaluate false natively (same family; OP-LT has no dyn boundary routing while OP-EQ does —
see ms select OP-EQ vs OP-LT).

Related fixed already (2026-08-12): kernel (owner 0) Return now always boxes to tagged x0 (the C
harness contract); fng-needs-to-number? is structural (fng-tagged-dynamic-value?), fixing Mul on
tagged field loads; fe-type-index-for-decl-node resolves structurally-deduped literals to their
declaration (object-parameters frontend defect — evaluator now matches Node at 1507052134).
A fng-type-tag TSK-OBJECT-LITERAL arm crashes fe indexing (segfault in al-get during index) —
reverted twice now; the structural decl fallback makes it unnecessary. Verifier note: the rep
lattice treats int-raw and float-raw both as RAW-NUM, so it cannot see this bug — splitting
RAW-NUM into RAW-INT/RAW-FLT would catch it at Store/operand edges.

## The systematic hardening plan (agreed 2026-08-11; work in phases, gate-green at every step)

A retrospective over the NavierStokes campaign found four systemic causes behind nearly every
bug: (1) value REPRESENTATION (tagged/raw/cell) is an unchecked convention on every edge;
(2) frontend lowering branches on seed types that inference has not computed
(`(= (n-ty x) (t-dyn))` — three separate bugs from this one idiom); (3) closed-world analyses
(captures, dispatch targets, unit reachability) have no soundness backstop, so wrong analysis =
runtime mystery; (4) silent failure modes cost ~10x what loud ones do. The phases:

- **Phase 0 — fast iteration (DONE).** `tools/js-native-run.mjs FILE.js` compiles a file
  natively, runs it AND Node, and prints MATCH/MISMATCH — ~0.6s per iteration after a one-time
  cached resident-emitter build (`generate-typescript-aot-benchmark.mjs --resident`; the
  emitter reads its source from argv instead of baking it in; staleness-stamped against
  src/lib). Runtime tracing stays behind `AOT_TRACE_ARR=1`. Debug builds: `coil build -O0` is
  ~6x faster when the emitter itself is under test.
- **Phase 1 — representation verifier.** New verify pass computing every value edge's
  representation STRUCTURALLY (Box→tagged, Proj/alloc→raw, Load→its alias's declared content,
  Call→boxed, Parm→ABI table) and checking each consumer's requirement; new
  `VERR-REPRESENTATION`. Write the call ABI as one table and make the receiver representation
  unconditional (tagged everywhere), deleting the structural carve-outs. Fix
  `fng-env-shape-of` typing by-value capture slots as cells.
- **Phase 2 — kill type-seed lies.** Audit the 7 remaining exact `(= (n-ty ...))` tests in
  frontend lowering; replace with structural predicates or explicit inference-ran gates; debug
  tripwire on reading seed types during lowering.
- **Phase 3 — soundness backstops.** Target-summary dispatch as a FAST PATH falling through to
  the universal chain (recovers the deliberate 2.5x dispatch regression soundly);
  `fe-scope-inside?` satisfiability as a hard frontend error; emit-time assert that every
  `__closure_target`/boxed-Fun fidx exists in the unit.
- **Phase 4 — differential testing.** Conformance mode running Node vs the ideal-graph
  evaluator (`ev-run`) vs native to localize silent wrongs; then a small generator over the
  axes that actually broke (nested closures x mutated captures x arrays x dispatch x numeric
  coercions). Every runtime bug becomes a conformance case (`nested-field-closures.ts` is the
  first, distilled from the NavierStokes campaign).
- **Phase 5 — loud failures.** Classify the ~36 `return AOT_JS_UNDEFINED` sites in
  tools/native-gc-runtime.c: spec-legitimate stays; internal-error-swallowing becomes
  trap-with-message.

## The DeltaBlue call-ABI problem and how it was actually solved

The previous handoff recommended threading one hidden script-environment parameter through every
user function and call. That design was NOT implemented, for a concrete reason discovered during
implementation: JSL's dynamic callback path (`%DynamicCallReceiver` in `jl-js-call-receiver-core`)
and the zero-capture callback fast path (`fng-callback-value`) would both need the environment
threaded through the JSL ABI as well, which is invasive and would have regressed the array-callback
pipelines. The architectural goal — one stable generic call descriptor independent of the target —
was reached instead with two frontend-local mechanisms:

1. **Script globals live in the runtime property side table.** Owner id is `main-id + 1`
   (`fng-script-owner-id`): main is never opened as a Fun, so that integer is provably unused by
   every JS and JSL callable, and the side table treats small-int owners as permanently live. A
   captured, non-static `FE-ROLE-GLOBAL` symbol reads via `OP-PROPLOAD` and writes via
   `OP-PROPSTORE` under interned name keys (`fng-script-global-load` / `fng-script-global-store!`,
   dispatched from `fng-symbol-node` / `fng-set-symbol!`). The GC already relocates side-table
   values, so no new root machinery was needed. Globals used only by the top level keep SSA;
   provably-constant globals keep `fng-initialize-static-globals!`.
2. **Globals and top-level function identities are no longer captures.** `fng-runtime-capture?`
   now excludes `FE-ROLE-GLOBAL` symbols and top-level function-declaration identities (their
   values are graph constants everywhere). Prototype methods therefore have zero capture
   parameters, and the generic `[receiver, args...]` descriptor lines up with every target. The
   `fe-copy-global-captures!` / `fe-propagate-call-captures!` passes still run — their records now
   serve only as analysis data (who references what, mutability for the static-global check).

`VERR-CALL-ARITY` on DeltaBlue is gone, and Richards’ ABI was re-verified after the change.

### Dispatch beyond the 63-bit target summary

DeltaBlue has 76 functions, so method-name target sets overflow the finite `i64` summary
(`fng-prototype-method-targets` returns 0 when any candidate’s runtime id is ≥ 63). Such calls now
go through a **graph-level identity-compare dispatch chain** (`fng-method-chain!`, candidates from
`fng-method-candidates!`): the loaded callee value is compared with `OP-EQ` against each
candidate's boxed Fun constant (tag bits make raw 64-bit equality exactly JavaScript function
identity for capture-free targets), each arm makes an exact receiver call with per-target argument
conversion/undefined-fill, arms merge through a region with per-alias memory phis and one boxed
value phi, and the fallthrough throws
`TypeError: dynamic method call matched no known function target` — loud, never a shifted register
file. The old `t-fun-set` path is untouched and still used whenever the summary fits, so Richards
compiles exactly as before.

JSL's own dynamic-callback target mask (`jl-frontend-function-targets`) still saturates at 63 —
programs with >62 functions that pass callbacks into JSL array builtins will mis-dispatch at
runtime (`brk`). None of Richards/DeltaBlue hits this; fix it before Crypto/EarleyBoyer if they
use array callbacks.

### Bugs fixed along the way (all latent, all exposed by DeltaBlue)

- **`fng-loop` anchored the loop-test `If` at the Loop node itself.** A condition that emits
  control (a ToNumber diamond, a short-circuit merge, an inlined JSL call, a dispatch chain) left
  two `If`s on one control node and broke CFG construction (`be-ctrl-succ` requires a unique
  control successor). The loop test now anchors at the control the condition left behind.
- **`ms-gcm-compute-earliest!` had no convergence break** and ran `be-inst-count + 1` full rounds,
  each with linear def scans — hours on DeltaBlue-sized programs. A round that changes nothing now
  ends the fixed point. `ms-owner-def-inst` is still a linear scan per query; if selection gets
  slow again, index vreg→def-inst.
- **Exact-`t-dyn` identity tests miss refined dyn types.** Two consumers bit:
  - The chain's value phi was consumed raw (an always-true loop bound) because
    `fng-needs-to-number?` tests `(= (n-ty v) (t-dyn))`. The chain now publishes its result with
    exact `(t-dyn)` (`n-set-ty!` after peephole; analysis recomputes later).
  - `fng-nullish-equal` compared a mixed-return callee's result against the raw null constant
    (which materializes as 0) while the backend had boxed every return of that callee
    (`Constraint.satisfy` returns both `null` and an object). When the compared value has no
    numeric kind, the raw branch now also tests the boxed null/undefined constants — exact, since
    a raw object pointer can never equal a tagged constant and a tagged object can never equal 0.
    Numeric kinds keep the raw-only compare so `0` never looks nullish.
- **Prototype materialization inside functions.** Lazily memoized per-function prototypes could be
  reused from a non-dominating branch arm (an `MSEL-DEPENDENCY` failure), and the first fix —
  materializing per `new` site — rebuilt whole method tables inside hot loops and drowned the side
  table (~200 s → property-cache collapse). Final design: the top level materializes and publishes
  each constructor's `.prototype` once (as before), and a function body **loads** it
  (`GetNamedProperty(Fun-const, "prototype")`) — dominance-safe anywhere, allocation-free, and one
  prototype identity program-wide. Nested (non-top-level) constructors keep per-site
  materialization.
- **`aot_js_property` operation 2 (SetPrototype) stored the prototype argument raw.** A tagged
  `.prototype` load stored tagged bits that the operation-0 walk (which compares raw owners) could
  never match, ending every method lookup at depth 1. The prototype value now canonicalizes
  exactly like the owner argument (managed/function tag → payload).

## FIXED: GC verification under stress

`deltablue 16777216 1` was dying with `native GC verification failed after collection 28`. Root
cause: `SetPrototype` (operation 2 in the property runtime) stored a tagged undefined/null
verbatim as the raw prototype pointer; heap verification then found a "pointer" outside both
spaces. Tagged non-pointer words now clear the prototype, every silent `verify_heap` failure
path prints a diagnostic, and the stress run completes with collections and passing
verification.

## Loop memory and nested-closure captures (NavierStokes fixes, all latent everywhere)

- **Every loop now carries memory phis** (`fng-loop`; `fng-do-loop` already did). Without them
  the exit arm's memory was the BODY's final store chain, which does not dominate the exit —
  the first post-loop merge with no intervening call handed the backend a memory Phi input from
  a non-dominating block. The phi set is the control alias list plus the runtime property heap
  (force-recorded — the body's first dynamic store may be the function's first) plus capture
  cells. A body that never touches an alias hands the phi ITSELF back as the backedge; such a
  phi is subsumed by its init or it leaks. Phi content types are the alias's declared type,
  exactly like `fng-memory` — a `(t-undef)` content let the fold pass prove loop-carried cell
  loads undefined (integrated-heap-program regression caught it).
- **Floating shaped stores place below their operands** (`ms-memory-block`): a Store's alias
  chain can root at function entry while the stored allocation is pinned deeper (every
  `x = new Array(n)` into a capture cell). Readers chained directly after such a store sink
  with it. Property-table ops are excluded — their values can cross a merge in a register from
  a sibling arm.
- **Transitive captures**: creating a nested closure copies the closure's captures to the
  creator (it must thread a grandparent's cell through its own environment before storing it
  into the child's), and CALLING a capture-bearing sibling records the callee's IDENTITY as a
  capture of the caller — the callee's value is the materialized closure in the parent-owned
  cell, and without the identity capture the call site fell back to the bare Fun and handed
  the callee a functionless environment.
- A pre-existing index-reuse bug in `fng-loop` (carried-phi allocation loop continued from the
  memory-phi loop's index) was latent while loops rarely had memory phis; it segfaulted the
  frontend the moment every loop carried them.
- **Captures are scope-checked**: a capture record is only RUNTIME-real when the capturing
  function is lexically nested inside the symbol's owner (`fe-scope-inside?`, enforced in
  `fng-runtime-capture?` and the copy passes). The closed-world analysis passes
  (`fe-copy-global-captures!` for method calls, plus the new transitive copies) spread capture
  records into TOP-LEVEL functions; treating those as runtime captures gave every top-level
  function a demanded environment no call site could supply (`new FluidField(null)` passed
  `Box(bare Fun)` as env and the prologue's env unbox trapped).
- **`new Array(n)` coerces its length**: `ResizeArray` declares `(length int)`; the raw
  expression was passed uncoerced, so an FP-computed size arrived as its IEEE bit pattern and
  resized to ~4.6e18 elements. `fng-int-value` now wraps the length.

## The uniform closure-call ABI (design A) — IMPLEMENTED, gate green

Every JavaScript callable now reserves **parameter 0 = hidden closure environment** (a tagged
value; capture-bearing functions unbox it to their env shape, capture-free functions leave it
dead) and **parameter 1 = receiver** (always reserved, dead when unused); declared parameters
start at parameter 2. Every call is built with `n-call-receiver!` — inputs
`[ctrl, callee, env, receiver, args..., mem]`. Aux `CALL-ABI-RECEIVER` is the exact form; aux
`CALL-ABI-DYNAMIC-RECEIVER` makes selection dispatch the runtime callee value by tag.

Key invariants, each of which was a bug when violated:

- **Env representation**: exact sites pass the BOXED closure (or undefined for capture-free
  targets); generic sites pass the callee value itself (a closure is its own environment). The
  env object's field 0 is `__closure_target` (runtime fidx = FeFunction.id + 1 at byte offset 8);
  capture cells follow; a lexical `this` is the last field, stored TAGGED.
- **Receiver representation**: `this` as the receiver Parm is RAW (exact sites pass shaped
  receivers unboxed). A LEXICAL `this` loaded from an env field is TAGGED and is unboxed at use
  (`fng-field-load-value` decides STRUCTURALLY — Parm vs env-load — because a fresh Load's value
  type is not computed until inference runs; comparing against interned `(t-dyn)` never matches).
- **Dynamic callee values must be tagged**: polymorphic dispatch tag-tests FUNCTION (payload =
  fidx) and OBJECT (payload → `ldr [ptr,#8]` = `__closure_target`), else `brk`. A syntactically
  direct Fun/Closure callee materializes UNTAGGED, so such calls stay EXACT even when name
  resolution fails (IIFEs, local closure values): raw callee for devirt/reachability, boxed
  closure as env, no DYNAMIC aux (`direct-value-callee` in `fng-user-call`).
- **No capture prepending under the receiver ABI**: select's legacy path prepended a Closure
  callee's capture inputs as argument registers; captures now travel in the env object, so
  `capturec` is forced 0 for `CALL-ABI-RECEIVER` calls.
- **JSL callbacks**: `jl-js-call` (the JSL `(call f ...)` form used by every `lib/array`
  callback) emits the receiver form with env = callee and receiver = boxed undefined; direct
  Fun/Closure callees stay exact, runtime values get the DYNAMIC aux. `inline-clone!`'s
  parm→input mapping `(+ 2 aux)` matches this layout exactly (it was silently wrong for the old
  shape — the array-from conformance failure).
- **Selection re-entrancy**: `OP-ARRAYMARK` claims its vreg (`ms-vset!`) BEFORE selecting the
  allocation input; selecting that input can walk a memory chain back to an ArrayStore whose
  array input is the mark itself, and the re-entry used to emit a second instruction for the
  same node.

Machine-unit reachability for dynamic sites: targets come from the callee's `t-fun-set` when the
summary fits, else the aarch64 dispatch falls back to an identity chain over ALL machine-unit
functions — which is why direct-value callees must stay exact (a function reachable only through
a boxed value would otherwise never be built). `mu-direct-callee` looks through `OP-CLOSURE`.

## Performance: current numbers and remaining debt

The 200-second DeltaBlue catastrophe is fixed. It was NOT the compiler: every side-table registry
(strings, objects, properties, arrays) sat behind a fixed 65536-slot cache that silently
saturated, after which each lookup fell back to a linear scan of the growing registry —
`js_string_lookup` alone was 56% of DeltaBlue's runtime, and repeated in-process runs (the perf
harness re-enters `kernel` per iteration) made every iteration slower than the last. All four are
now growing open-addressed identity indexes, rebuilt on GC compaction, cleared on reset; the
property-key content hash is memoized per string record.

Steady-state numbers on this machine (perf harness, 9 samples x 20 iterations; Node = 1,000
warmup calls then median of 9 samples x 10 iterations via `tools/v8-node-performance.mjs`):

| Benchmark | Native per run | Warmed Node | Ratio |
|---|---:|---:|---:|
| Richards | ~29 ms | 2.46 ms | ~12x |
| DeltaBlue | ~65 ms | 2.14 ms | ~30x |

Native "per run" includes whole-program re-entry (prototype publication and globals init), which
is the honest AOT analogue of one suite `run()`.

Remaining debt, in likely order of impact:

- Every field, method, and script-global access on prototype-based objects is a generic
  side-table property call (hash + probe + prototype-chain walk). Closing the 12–30x gap means
  shaped storage or inline caches for these, not more table tuning.
- Each `new` of a top-level constructor performs a `.prototype` property load plus a SetPrototype
  runtime call.
- Dispatch chains are linear compare ladders per call site.
- The chain emits per-alias memory phis per arm (`fng-active-memory!` = every declared field
  alias), which bloats graphs at polymorphic sites.
- String records are never pruned (the registry only grows), and per-iteration times still creep
  a few percent across a long in-process run — GC scans walk every live side record.

## Gate status

`tools/gate.sh --quick` is GREEN (548 tests). The three test files that failed to compile after
the jsvalue module split now import it; the `receivers-and-constructors` conformance SIGSEGV was
the receiver conversion boxing anything that COULD be a function (which is every dyn value),
shadowing the unbox arm for shaped callees — boxing now applies only to purely-function-typed
values. All 74 native conformance programs agree with Node.

## Callable/source identity work currently present

`FeFunction` still contains both `id` and `source-id`; with prioritization disabled they are
usually equal. The disabled `fe-prioritize-prototype-functions!` pass still exists and can be
removed. The identifier-expression fallback that prefers a function declaration over stored symbol
state also still exists; function-name reassignment semantics remain unimplemented (a reassignment
inside a function now degrades to function-local SSA — previously it was a differently-wrong shared
cell). Replace with a principled binding/callable distinction before claiming complete function
semantics.

## DSL status and hard-coded mechanisms

Unchanged from the previous handoff: property/element access mechanisms, function/closure
construction and call ABI, GC/allocation/write barriers, several Math builtins, and JSON remain
compiler/runtime mechanisms; the four DSL infrastructure gaps (`jsl-inline!` control flow in
non-entry functions, heap-writing merges leaving untyped memory Phis, construction-time folded
branches desynchronizing Regions/Phis, and a general JSL `%Call` capability) are still open and
still needed for moving callback array methods fully into the DSL.

## Benchmark and Node timing requirements

Unchanged: measure runtime only; ≥1,000 real warmup invocations for Node; validate outputs before
timing; one table with native time, warmed Node time, and native/Node ratio; distinguish warmup
invocations, timed invocations per sample, and sample count. Audit
`tools/v8-node-performance.mjs`, `tools/v8-performance-harness.c`,
`tools/typescript-aot-benchmarks.mjs`, `tools/generate-typescript-aot-benchmark.mjs` before
trusting results.

## Useful commands and artifacts

Debug pipeline for any benchmark source (the pattern used throughout):

```sh
node tools/generate-typescript-aot-benchmark.mjs SRC.js OUT.coil 0 10 1
coil build OUT.coil -o OUT-emitter          # ~2 min; embeds the JS source
./OUT-emitter 0 10 > OUT.o 2> emitter.err   # frontend + verify + select + emit
xcrun clang -O2 -arch arm64 -fno-omit-frame-pointer \
  tools/v8-native-harness.c tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  OUT.o -o OUT
./OUT                                        # expects: result=0 collections=... moves=...
```

Runtime debugging: compile the harness with `-DAOT_DEBUG_PROPERTY_LOOP` and/or `-DAOT_DEBUG_ARRAY`
(add `-I tools`) to trace property/array traffic; the first 512 events print with resolved name
text. The current DeltaBlue/Richards debug trees are
`.coil/debug/deltablue/declaration-precedence/` and `.coil/debug/richards/nullish-fix/`; both
harness `.coil` files carry extra failure diagnostics (block/ctrl-user dumps on selection
failures).

Gate:

```sh
./tools/gate.sh --quick
```

## Completion checklist

- [x] Richards passes correctness after the final ABI design.
- [x] DeltaBlue passes both benchmark correctness tests.
- [ ] Crypto passes.
- [ ] RayTrace passes.
- [ ] EarleyBoyer passes.
- [ ] Splay passes.
- [ ] NavierStokes passes.
- [x] RegExp is clearly labeled excluded rather than silently omitted.
- [x] The full relevant test gate is green (548 tests).
- [x] No benchmark-specific hard-coded result or semantic shortcut was introduced.
- [x] The DSL/compiler/runtime boundary is documented for every newly required primitive.
- [ ] Properly warmed Node comparisons in one complete table — Richards and DeltaBlue are
      measured (see the performance section); the other five await correctness first.
