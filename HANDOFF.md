# Handoff: finish the correctness-hardening phases

Last updated: 2026-08-12. Written for someone picking this up cold. The full session log with
every diagnosis is in `HANDOFF-ARCHIVE.md`; this document is the working plan.

## Mission

Make every non-RegExp V8 v7 benchmark (Richards, DeltaBlue, Crypto, RayTrace, EarleyBoyer,
Splay, NavierStokes) compile and run correctly through the Coil AOT JavaScript pipeline, then
compare against warmed Node. "Correct" means the benchmark's own checks pass — compiling
without crashing does not count. Correctness beats performance: perf regressions are acceptable,
silent wrong answers never are (per the project owner). A stub must throw a hard error, never
return a plausible value.

## Current state (all claims verified 2026-08-12, tree at `git log --oneline -1`)

| Thing | State |
|---|---|
| Gate (`bash tools/gate.sh`) | GREEN — 548 tests |
| Conformance (75 programs, TS mode) | GREEN |
| Richards, DeltaBlue | run and pass natively (~31x / ~62x slower than warmed Node) |
| object-parameters in untyped-JS mode | exact (1507052134) — was silently wrong for weeks |
| NavierStokes | runs end to end; `addPoints` fires; density values still wrong. Root cause FOUND and reproduced (see Phase 1b below) — fixing Phase 1b is expected to fix it |
| Splay / Crypto / RayTrace / EarleyBoyer | frontend rejections, untouched this session (see "After the phases") |
| Evaluator (`ev-run`) | runs whole closure-heavy dynamic JS programs; agrees with Node on every repro in `repros/` |

## The one rule: how to iterate

**`node tools/js-native-run.mjs FILE.js --debug --eval`** is the loop. ~2 seconds per iteration
after the first build. It compiles FILE.js through a cached resident emitter, links, runs, and
prints a three-way verdict:

- `MATCH (native=X eval=X node=X)` — done.
- `MISMATCH ... frontend: the evaluator already disagrees with Node` — the GRAPH is wrong; debug
  the frontend (`src/frontend_native*.coil`) or the evaluator itself.
- `MISMATCH ... backend: the evaluator agrees with Node but native does not` — the graph is
  right; debug select/schedule/allocate/emit (`src/backend_*.coil`).

Flags and tools:

- `--debug`: separately cached `-O0` emitter — compiler-source changes rebuild in tens of
  seconds instead of minutes. Use it for everything except final perf checks.
- `--ts-native`: hand a `.ts` file to the native TS parser instead of transpiling.
- `--keep`: keeps `program.o` in the temp dir for `objdump -d`.
- `AOT_DUMP_GRAPH=1 .coil/build/js-resident/emitter-O0 FILE.js 0 10 js eval` dumps the graph.
- schedule-seed `-999` (2nd argv) dumps shapes, graph, `mu-dump`, and `ms-dump-verbose`
  (per-instruction vregs — readable against a disassembly).
- `AOT_EV_DEBUG=1` (eval mode) prints every load/store/propload/propstore/arrayload/arraystore
  and each call's resolved target, with values.
- Debugging technique that found every bug this week: write the smallest .js repro, run the
  three-way, bisect by dropping statements. All current repros live in `repros/` — each one
  earns its place by having caught a real bug. Keep them passing.

Validation before EVERY commit (no exceptions; commit directly to main — the gate is the safety
mechanism): `bash tools/gate.sh` green, plus
`node tools/debug-benchmark.mjs richards --stage native` and `... deltablue --stage native` PASS.

## The phases (task list #15–#19)

Work them roughly in order; each is independently committable and must land gate-green.

### Phase 1b — single representation authority (task #15) — DO THIS FIRST

**This is the NavierStokes fix.** The live defect: `repros/proj2.js` (2×2 grid extract of
NavierStokes' `project()`) — native computes -288, Node/evaluator -260, in 2-second iterations.
Mechanism, fully diagnosed: in `set_bnd`, `x[i] = -x[i + rowSize]` computes its index with
INCONSISTENT int-vs-fp representation decisions. Selection decides "is this value in a GPR or an
FPR" by re-running a reachability walk (`be-node-fp-value?` in `src/backend_select.coil`) at
each consumer, and two consumers can disagree — the walk's own doc comment admits this class.
The miscompiled index reads out of bounds → `undefined` → NaN → zeros. It is shape-dependent
(adding any statement to the loop body makes it correct — see the sentinel experiment in
HANDOFF-ARCHIVE.md) and deterministic across seeds/register counts, so it is NOT the allocator.

The fix that was always the plan: ONE authority for a node's machine representation, computed
once (a table filled during/after selection, or a single memoized classifier), consulted by
every consumer — `ms-select-numeric-binary!`, `be-js-tag-for-value` (its numeric-join arm
`(if (be-node-fp-value? node) 0 JSV-INTEGER)` is the same hazard), `ms-fp-input!`,
`ms-select-int32-binary!`, and the return/box paths. Acceptance: `repros/proj2.js`,
`repros/proj.js`, then `repros/ns-small.js` (expect 68) and `repros/ns.js` (expect 26)
three-way MATCH, gate green, richards+deltablue PASS.

Also in Phase 1's remaining scope:
- Unconditional receiver representation: receivers are TAGGED everywhere; delete the raw-from-
  static-sites carve-outs (`fng-user-call` env/receiver paths, `CALL-ABI-*` handling).
- `fng-env-shape-of` should type by-value capture slots as cells.
- Extend the representation verifier (`src/verify.coil`, `v-rep-slot-required`) to Parm/Call
  edges, and split `REP-RAW-NUM` into RAW-INT vs RAW-FLT — the current lattice cannot see
  int-bits-in-float-slot bugs (it missed one; archive has the case).
- The verifier is already HARD (`VERR-REPRESENTATION`) for JS-frontend graphs, gated by
  `g-rep-strict?` (set in `frontend-native-build-mode!`, cleared by `graph-reset!`). Raw Coil
  test graphs and JSL legitimately violate the JS conventions — keep them advisory.

### Phase 2 — kill exact-seed-type tests in lowering (task #16)

Seed types lag graph construction: `(= (n-ty x) (t-dyn))` during lowering is a bug pattern —
a fresh Load reads as unanalysed, an open Phi as bottom. Several were already replaced with
structural checks (`fng-tagged-dynamic-value?`, `fng-machine-number-value?`,
`fng-needs-to-number?` — read these first, they are the idiom). Audit the remaining ones:
`grep -n '(= (n-ty' src/frontend_native_graph.coil` and judge each against the archive's
"seed-type disease" examples. Each conversion should come with a repro or a conformance case.

### Phase 3 — soundness backstops for closed-world assumptions (task #17)

The theme of half this week's bugs: an analysis assumes it saw every callee/caller/assignment,
and a dynamic pattern escapes it. Backstops needed:
- Dispatch fast path: `be-poly-call-targets` currently returns 0 (universal dispatch, always
  sound, ~2.5x slower on call-heavy code). Restore the summary as a FAST PATH that falls
  through to the universal chain — never a correctness gate.
- `fe-scope-inside?` violations and emit-time unit-membership should be hard errors.
- Grep for the pattern behind the `fng-local-function-target` bug (fixed: a local initialized
  with a function expression was pinned as a call target even when a closure reassigns it —
  `repros/pf2.js`). Other resolvers (`fng-static-method`, `fng-unique-prototype-method`,
  `fng-unique-field-index`) make cousin assumptions; `fng-unique-field-index` is KNOWN unsound
  when dynamic objects carry the same property name (archive: "globally-compatible" section).

### Phase 4 — composition fuzzer (task #18, differential half DONE)

The three-way differential exists and works. What's missing is the fuzzer, and this week proved
why it matters: EVERY bug was a composition of individually-passing patterns (all the
`repros/*.js` pattern probes pass alone; their compositions failed). Build a small JS program
generator that composes exactly the primitives in this pipeline's vocabulary — untyped object
literals, closures capturing mutably, script globals, dynamic callbacks, float-indexed arrays,
compound assignments with `++` in index expressions, accumulator loops — and runs the three-way
on each generated program. Minimize failures automatically (drop statements while the verdict
persists). Wire a small corpus of survivors into the gate.

### Phase 5 — loud-failure sweep (task #19)

`grep -n 'return AOT_JS_UNDEFINED' tools/native-gc-runtime.c` — ~36 sites. Classify each:
legitimate JS semantics (property miss) vs error swallowing. Every swallowing site gets a
`fprintf(stderr, ...)` + `__builtin_trap()` or a documented justification. The uiCallback bug
cost days because the wrong callee ran silently; loud failures cost minutes.

## After the phases: the remaining benchmarks

- **Splay**: `FE-CODE-UNBOUND-NAME` on `SplayTree.Node` (namespaced constructors); after that,
  `X.Y.prototype.method =` publications are not indexed as prototype methods (`MSEL-CALL`).
- **Crypto**: sloppy-mode implicit globals (`setupEngine = function...` without `var`) need
  resolver support; also a bare `alert` shim like DeltaBlue's adapter.
- **RayTrace**: `arguments` / `Function.prototype.apply`.
- **EarleyBoyer**: octal escapes in string literals.
- Benchmarks are adapted by stripping the `BenchmarkSuite` registration and appending a `main()`
  (see `repros/ns.js` for the NavierStokes adaptation; `tools/b15-adapt.mjs` does
  richards/deltablue). Node is the oracle: validate every adaptation under Node first.

## Landmines — attempted and REVERTED, do not redo blindly

- **fng-type-tag TSK-OBJECT-LITERAL arm**: crashes fe indexing (segfault in al-get). Reverted
  twice. Unnecessary anyway — `fe-type-index-for-decl-node`'s structural fallback covers it.
- **Routing fng-equal-value's numeric-peer branch through the guarded ToNumber**: regresses
  DeltaBlue selection (Fun-as-value MSEL failure) and turned out NOT to be the NavierStokes
  blocker (the runtime flt-unbox converts int-tagged words fine — `repros/geq.js` proves it).
- **Deduping the frontend's whole-memory entry Args (fng entry-arg cache)**: broke loop-phi
  subsume machinery, changed program results. The evaluator tolerates duplicate entry-Arg alias
  claims instead (`ev-memmerge`).
- **A single top-level `for (x=0; x<16; x+=2) checksum=(checksum+f(x))|0` loop** fails
  VERR-STALE-TYPE (frontend type-fixpoint bug, unfixed) — nest it in a dummy outer loop as the
  conformance corpus does. Worth fixing eventually; tiny repro is trivial to recreate.

## Architecture cheat sheet (things you need on day one)

- Closure ABI: parm 0 = hidden env (tagged), parm 1 = receiver, declared params from parm 2.
  Call inputs `[ctrl, callee, env, receiver, args..., mem]`. A materialized closure's VALUE is
  its env object pointer under the function tag; env field 0 = `__closure_target` (runtime
  fidx = FeFunction.id + 1).
- NaN-box tags (<<48): 0x7ff9 undefined, 0x7ffa null, 0x7ffc int, 0x7ffd object,
  0xfff9 function, 0xfff8 array. Floats are raw IEEE bits.
- Script globals are properties on an INTEGER owner key (`fng-script-owner-id`) in the runtime
  property side table — natively just a key, in the evaluator a shadow object
  (`ev-int-owner-object!`).
- `Fun` node inputs: input 0 = FunStart, inputs 1+ = its Returns. Nested function bodies lower
  AFTER the enclosing body that references them — call-site analyses cannot inspect an unbuilt
  callee (nins < 2).
- The evaluator (`src/eval.coil`) is the semantic oracle for graphs. Its per-node result caches
  are invalidated per control arrival (`ev-enter-ctrl!` — runs for every block kind, including
  Region/Loop/CallEnd); if a node kind caches, it must be on the per-control effect chain
  (the PropLoadKey bug).
- `coil check` for typechecking (~30 s), `coil test tests/FILE.coil` for one suite. Read
  `~/.claude/skills/coil-language/reference.md` before writing non-trivial Coil.

## Where the numbers stand (perf, after correctness)

Richards 74ms vs Node 2.4ms, DeltaBlue 126ms vs 2.0ms. Two known recoverable chunks: universal
dispatch (Phase 3 fast path) and the ToNumber guards on hot paths. Small-benchmark suite ranges
from 0.37x (sum-loop, faster than Node) to ~60x (json-roundtrip). Do not gate on benchmarks.
