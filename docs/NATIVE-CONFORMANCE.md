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
- the currently selected `Math` builtins and numeric coercions.

`tools/native-source-conformance.sh --extended` audits those sources across construction/schedule
seeds, register pressure, and moving-GC stress. It is intentionally not part of the green extended
gate yet: the number/bitwise witness currently diverges from Node under a nonzero schedule seed.
The manifest is
`tests/native-conformance/manifest.json`; feature labels make omissions reviewable rather than
leaving coverage implicit in source text.

## Known product-path gaps

The manifest also retains source cases marked `status: "gap"`. Run one directly with
`--case=NAME`, or run `--audit` to stop at the first gap. These are not counted as verified native
support:

- closures and named recursion currently emit an object but crash in native execution;
- receiver calls and constructors currently fail the existing B10 source witness;
- the combined dynamic-property/prototype witness traps in native execution;
- the string/conversion composition reaches a graph-verifier failure;
- the structural object/union call witness reaches a liveness failure;
- the integrated heap program emits but crashes natively.

Phase-local ideal/backend tests for these mechanisms remain valuable, but they are not a substitute
for product-path source conformance. A gap moves into the verified set only after it agrees with
Node in normal mode; extended-mode agreement is the remaining release qualification for the whole
verified set.

## Native benchmarks

`node tools/typescript-aot-benchmarks.mjs` compiles each benchmark through the same product emitter,
checks its result against Node before accepting samples, and records all nine native and Node timing
samples plus native/Node compilation time in `out/typescript-aot-benchmarks/results.json`.
`tools/benchmark-gate.sh` validates that report. Timing never proceeds past a correctness mismatch.

The current correctness-qualified workloads cover an integer loop, branch-heavy control, a
straight-line bitwise kernel, and a floating-point kernel. Runtime subsystems listed as conformance
gaps are intentionally not represented as performance claims yet.
