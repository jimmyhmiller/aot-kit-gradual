# THE MISSION: MAKE THE ITERATION LOOP FAST

That is the whole mission. Not correctness. Not benchmarks. Not features. The ONLY goal is
shrinking the time between "I changed something" and "I know what happened." A multi-minute
wait is a bug; fix the wait, don't endure it.

(The old correctness-hardening handoff and its archive are deleted on purpose — they are in
git history before commit 2f716ab if ever needed. NavierStokes is DONE: `repros/ns.js`
three-way MATCHES at 26, gate green, all repros pass. Do not reopen that work now.)

## State after Jimmy's compiler update (measured 2026-08-12)

Jimmy's new `coil` landed (installed 12:46, `~/Documents/Code/projects/coil` @ ~24a4f4c) and
it killed the old bottleneck outright:

- **Resident emitter self-build: -O0 3.1s, -O3 4.3s** (was multi-minute). A compiler-source
  edit now costs seconds. The whole "-O0 tier so rebuilds are bearable" motivation is gone;
  -O3 is cheap enough to be the only tier (`--debug` still works but buys nothing: the -O0
  emitter also RUNS ~1.6x slower on big inputs — 143.5s vs 91.7s emit on ns.js).
- `js-native-run.mjs` now prints `phase-ms: emit=… clang=… native=… eval=… node=… total=…`
  on every run (plan step 1, done), and the emitter cache stamp now hashes the `coil` binary
  itself — before that fix a compiler upgrade silently kept running stale emitters.
- Small-repro three-way loop: **~0.7s total**.
- Full gate under the new compiler: GREEN.

## Emitter performance: ~8x landed 2026-08-12 (91.7s → ~11.6s on ns.js, under load)

ns.js (396 lines, 8542 nodes) baseline was **emit=91.7s** — 97% of the check. Cost tracks
code SIZE, not run length. `sample`(1) works out of the box (full symbol names), and the
resident harness now prints per-pass wall times on stderr
(`phase-ms frontend/select/schedule/color/encode/macho`) — that breakdown, not the flat
profile, is what found the big one. Every change below verified BYTE-IDENTICAL objects on
all 30 repros + ns.js. Final ns.js breakdown (concurrent-load numbers):
frontend 0.75s, select 3.5s, schedule 2.5s, color 2.0s, encode 2.3s, macho 0.6s.

1. **Mach-O stackmaps were 33.5s of the 92** — invisible in flat profiles because the cost
   is `ml-live-before?` re-walking a block tail per (safepoint, vreg) query, and the layout,
   both stackmap sweeps, and the byte verifier each repeated the product. Now ONE backward
   liveness walk per block builds a root cache (`mobj-build-roots!`); everything reads it.
   33.5s → 0.6s.
2. **Liveness sets are bitsets now** (64 vregs/word; accessor API unchanged). The dataflow
   solver (`ml-solve!`) runs word-wise Gauss-Seidel — same per-round states, same round
   count. Schedule phase 5.3s → 2.5s.
3. Scheduler: the indegree pair pass records dependency EDGES; each emission decrements
   along the producer's edge list instead of re-asking `ms-schedule-dependency-kind` per
   consumer. `ms-inst-uses-vreg?` is a lean path (one be-inst, raw `mi-inputs` table,
   direct arg fields).
4. Allocator: `mra-build-interference!` / `mra-verify!` / the cross-call diagnostic walk
   each instruction's OPERANDS (`mra-collect-inst-uses!`) instead of asking every vreg;
   `ml-verify!` re-derives use/def with one operand pass per block. Color 4.9s → 2.0s.
5. `mi-desc` memoized into a table; `ml-kind-for-vreg` via a validated vreg→(node, owner)
   reverse map; `ms-gcm-latest-use-block` via per-vreg use lists.

What remains (the profile is now DIFFUSE — no quadratic left visible):

- **For Jimmy: the top of every phase's profile is non-inlined tiny calls** —
  `coil.core.Eq$i64$=`, `Ord$i64$*`, `Add$i64$+`, `al-get`, zero-arg accessors
  (`machine-unit`, `backend`, `node.graph`) are real out-of-line calls even at -O3.
  An inliner is the next big multiplier (est. 1.5-2x across the board).
- The scheduler's initial pair pass is still O(block²) for kinds 2/3 (memory order and the
  class-based effect rules); a counter-based rewrite could kill it but is subtle.
- select (3.5s) is the biggest remaining phase and is call-overhead-diffuse.

## Evaluator: ns.js eval went from non-terminating to ~4.5 min

`ev-array-element-index` scanned ONE global flat (object,index,value) list per array access
— NavierStokes grids made eval mode effectively hang (30+ CPU-min, killed). Now a
`(object<<32|index) -> slot` HashMap (`array-slot` in EvalState; slots are append-only so
mappings never go stale; indexes outside [0,2^32) keep the scan). ns.js eval: **190.6M
steps, result=26, MATCH, ~4.5 min under load**. Eval cost is now step-count-bound; if that
is still too slow, the next lever is per-step dispatch, not memory.

## Evaluator bug found & fixed 2026-08-12 (pre-existing, NOT compiler-related)

`--eval` failed on cinc/cadd/evo (EV-STUCK at a merge Phi): the top-level `ev-run-nobind`
interpreter loop called `ev-enter-ctrl!` unconditionally, so effects PINNED ON A REGION
(compound array assignment through a ToNumber diamond) executed before `ev-enter-merge!`
gave that region's Phis values. The `ev-call` loop already had the guard; the fix mirrors it
(src/eval.coil). The old-coil A/B settled the blame: an emitter built from 837bb8e with
YESTERDAY'S compiler fails identically, so this was a genuine latent source bug — the
"all repros pass --eval" claim was stale (the gate never ran the eval sweep; see plan).

## The new coil compiler STOPPED INLINING — root cause of the crash AND the call tax

The conformance segfault (zero-parameter mains: math-minmax and any tiny program) was NOT
bad codegen. Diagnosis, fully verified by old-vs-new binary diff:

- The old compiler (46ee64d) inlined every small monomorph: its binaries contain ZERO
  `al-get__*` / `Eq$i64$=` / `Ord$i64$*` / `Add$i64$+` symbols. The new compiler (12:58
  install, 24a4f4c-era; suspect commit "Preserve exports through compiler transforms")
  emits them all out-of-line — 36 such symbols in the same program.
- `frontend_native_graph.coil:7269` bound `first` with an UNCONDITIONAL
  `al-get [FeSymbol]` whose result is only used under a `(> parameter-count 0)` guard.
  Zero-parameter mains leave the symbol list empty -> al-get(empty, 0) -> null deref.
  The old compiler's inlining + dead-load elimination deleted the unguarded load, masking
  the bug for its whole life; the new compiler faithfully executes the eager call. FIXED
  in this repo (lookup moved inside the guard) — conformance is GREEN again with the new
  compiler.
- The same lost inlining is the emitter's remaining "diffuse" cost: every integer `=`,
  `<`, `+` and every tiny accessor is a real `bl` to a 2-3 instruction function
  (disassembly-verified). Restoring the inliner is Jimmy's fix and the next big
  multiplier on emit speed.

## Remaining plan, in order

1. **Fix the error masking in `tools/native-source-conformance.mjs`.** A failing case's
   `finally` `rmSync` races still-running workers, throws ENOTEMPTY, and REPLACES the real
   assertion error.
2. The gate does NOT run the repro `--eval` sweep — that is how the evaluator regression
   hid. Add a fast repro sweep to the gate (it is ~30s of parallel work now).
3. **`tools/sweep.mjs`: parallel batch runner with a verdict cache** keyed on
   (emitter hash, file hash); also the bisection/fuzzer harness.
4. More emitter speed if needed: counter-based scheduler pair pass, allocator verify passes
   (see profile notes above). Ask Jimmy about a coil inliner before micro-optimizing more.

## Ground rules that still apply

- `bash tools/gate.sh` green before every commit; commit directly to main.
- Repros in `repros/` stay passing (`node tools/js-native-run.mjs FILE --debug --eval`).
- Tell Jimmy, with numbers, anything that is still slow — do not endure it.
