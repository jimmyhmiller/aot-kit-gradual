# THE MISSION: MAKE THE ITERATION LOOP FAST

That is the whole mission. Not correctness. Not benchmarks. Not features. The ONLY goal is
shrinking the time between "I changed something" and "I know what happened." A multi-minute
wait is a bug; fix the wait, don't endure it.

(The old correctness-hardening handoff and its archive are deleted on purpose — they are in
git history before commit 2f716ab if ever needed. NavierStokes is DONE: `repros/ns.js`
three-way MATCHES at 26, gate green, all repros pass. Do not reopen that work now.)

## Why the loop is slow (measured 2026-08-12, one real debugging session)

1. **Every compiler-source edit costs a multi-minute emitter rebuild.** The resident emitter
   cache invalidates on any `src/*.coil` change, and even the `--debug` -O0 self-build takes
   minutes. One session made ~8 edits ≈ 30+ minutes of pure waiting. Adding a single debug
   print to the compiler costs a full rebuild.
2. **The -O0 emitter runs slow.** Small repros are the advertised ~2s, but a 400-line file
   (ns.js) took 1–7 minutes PER CHECK. There is no tier for "compiler is stable, input is big."
3. **The gate is minutes, and runs get wasted.** Two of six gate runs were thrown away: one
   raced a concurrent edit, one hit the conformance runner's error-masking bug (see item 2
   below — it hid a real failure behind an ENOTEMPTY crash).
4. **Bisection runs one variant at a time.** ~50 independent shrink-variant runs executed
   sequentially when they could run 8-wide.

## The plan, in order

1. **Measure first: phase timings in `tools/js-native-run.mjs`.** Print compile / native-run /
   node / eval milliseconds on every run. Everything else gets judged by these numbers.
2. **Fix the error masking in `tools/native-source-conformance.mjs`.** When a case fails, the
   `finally` block's `rmSync` races the still-running workers, throws ENOTEMPTY, and REPLACES
   the real assertion error. Stop remaining workers on first failure; never let cleanup clobber
   the failure being reported.
3. **`tools/sweep.mjs`: parallel batch runner with a verdict cache.** Run many .js files
   concurrently through the three-way, cache verdicts keyed on (emitter hash, file hash) so
   unchanged repros are free, and cache the Node-oracle result per file hash. This is also the
   bisection harness (run all variants at once) and, later, the fuzzer harness.
4. **Third emitter tier.** After an -O0 rebuild, kick off an optimized emitter build in the
   background; `js-native-run` uses the fastest emitter that is current. Big-file checks drop
   from minutes to seconds whenever the compiler is stable.
5. **The floor: incremental self-build.** The multi-minute minimum per compiler edit is Coil
   recompiling the whole compiler. Investigate module-level build caching in `coil build`.
   Scope unknown — measure before committing to it.

## Jimmy is landing compiler performance improvements — TEST THEM

Jimmy has his own performance improvements to the Coil compiler coming. When they land:

- Rebuild the resident emitters and re-measure the loop with the phase timings from step 1.
- **Compile with -O3** for the run-speed measurements.
- **If anything is still slow after his changes, TELL HIM — with the numbers.** Do not endure
  it, do not silently work around it.

## Ground rules that still apply

- `bash tools/gate.sh` green before every commit; commit directly to main.
- Repros in `repros/` stay passing (`node tools/js-native-run.mjs FILE --debug --eval`).
- The deliverables above are tooling; don't change compiler semantics while building them.
