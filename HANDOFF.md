# Handoff: V8 benchmark support, DSL coverage, and runtime performance

Last updated: 2026-08-11

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
| NavierStokes | Closure-call ABI done; blocked on one backend scheduling bug | The uniform closure-call ABI (below) removed the former wall: runtime closure values now dispatch generically. The remaining blocker is `MSEL-DEPENDENCY` on an `ArrayMark` during machine verification: `ms-repair-late-memory-deps!` appears to bail (move budget) on a large block where GCM's provisional order puts array-op instructions before dependencies. Diagnosis state is in the scratch harness (`navier-stokes.coil` with fresh-verify snapshot prints); the emitted `select=1 node=<ArrayMark>` failure reproduces in ~3 min via that harness. |
| Splay | Frontend rejects namespaced constructors | `FE-CODE-UNBOUND-NAME` on `Node` from the `SplayTree.Node` pattern. A minimal namespaced-constructor repro gets further — frontend passes, then `MSEL-CALL` because `X.Y.prototype.method =` publications are not indexed as prototype methods, so instance method calls have no targets. Both halves needed. |
| Crypto | Frontend rejects implicit globals | `FE-CODE-UNBOUND-NAME` on `setupEngine` (`setupEngine = function(...)` with no `var`), and `nValue`…`coeffValue` are likewise assigned-without-declaration; also uses bare `alert` (adapter shim needed, as DeltaBlue's). Needs sloppy-mode implicit-global creation in the resolver; unknown further blockers behind it (BigInteger is string/array heavy). |
| RayTrace | Needs `arguments` + `Function.prototype.apply` | Built entirely on the Prototype.js idiom `this.initialize.apply(this, arguments)` — every class instantiation forwards variadic arguments. Real feature work, not a resolver gap. |
| EarleyBoyer | TS parser rejects the source | 78 parse diagnostics, all `Octal escape sequences are not allowed` from the scheme2js character tables ("\\000" etc.). Adapter-rewritable to `\\xNN` losslessly; unknown depth behind it (4,684 lines of scheme2js output — exceptions, apply, string machinery). |

There is still no valid benchmark/Node comparison table. Do not report performance numbers for a
benchmark until its native result passes the benchmark's correctness checks and the perf debt
below is at least triaged.

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

## Latent bug: GC verification fails under stress

`deltablue 16777216 1` (16 MB heap, stress mode) dies with
`native GC verification failed after collection 28` — reproduced identically on the committed
tree before any of this session's changes, so it is pre-existing. Normal runs do zero
collections and pass; a run that lands under enough memory pressure to collect can abort (one
such flake was observed). Worth a dedicated stress-mode debugging session before trusting long
heap-heavy runs.

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
