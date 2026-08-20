> **HISTORICAL, 2026-08-18.** The tools and gates this file describes were deleted with the
> evaluator. Kept for the findings themselves, which Phase A's harness should re-cover.

# Native source conformance

`tools/native-source-conformance.sh` is the product-path correctness gate. Each case is an ordinary
TypeScript source file. The gate executes its exported `main` with Node, compiles the same file
through the native TypeScript bridge and backend, links the resulting arm64 object, executes it,
and requires the integer observable to match Node exactly.

The normal gate covers the currently verified end-to-end surface:

- integer and floating-point arithmetic, comparisons, JavaScript number edge cases, bitwise and
  compound operations;
- updates, short-circuit values, comma and ternary expressions, structured loops, switches,
  labels, breaks, and continues;
- dense arrays including holes, indexed and non-index properties, growth, push, pop, and slice;
- closures, mutable captures, named recursion, direct calls, receiver calls, constructors, and
  constructor object-return semantics;
- typed and dynamic objects, structural values, nullable unions, prototype lookup and shadowing;
- strings, conversion, parsing, the currently selected `Math` builtins, and numeric coercions;
- a combined allocation-heavy program spanning recursive trees, closures, arrays, strings, loops,
  calls, and moving-GC relocation.

`tools/native-source-conformance.sh --extended` repeats those sources across construction/schedule
seeds, register pressure, and moving-GC stress and is part of the extended gate. The manifest is
`tests/native-conformance/manifest.json`; feature labels make omissions reviewable rather than
leaving coverage implicit in source text.

The manifest contains no expected product-path gaps. `--audit` remains available as a guard against
future quarantined cases: any case marked `status: "gap"` is excluded from the ordinary support
claim until it agrees with Node in normal and extended modes.

## Native benchmarks

`node tools/typescript-aot-benchmarks.mjs` compiles each benchmark through the same product emitter,
checks its result against Node before accepting samples, and records all nine native and Node timing
samples plus native/Node compilation time in `out/typescript-aot-benchmarks/results.json`.
`tools/benchmark-gate.sh` validates that report. Timing never proceeds past a correctness mismatch.

The correctness-qualified workloads cover integer, branch, call, bitwise, floating-point, Math,
and string kernels plus closures, shape-backed and dynamic object literals with property mutation, recursive object trees,
DSL array callbacks, and a JSON parse/mutate/stringify roundtrip. Node runs twenty untimed in-process
warmup batches over the same code paths before the nine measured samples; native compilation and
linking finish before timing and the AOT binary needs no tiering warmup. Benchmarks are performance
witnesses, while the source-conformance matrix remains the exhaustive semantic oracle for supported
features.
