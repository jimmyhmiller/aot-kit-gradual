# Handoff: V8 benchmark support, DSL coverage, and runtime performance

Last updated: 2026-08-10

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
the compiler/runtime providing mechanisms rather than benchmark-specific behavior. If the DSL
cannot express a required operation, extend it using a Torque-like design: typed low-level
primitives, explicit control/effect flow, calls, allocation, and stable runtime ABIs. Do not add
benchmark-specific hard-coded answers.

## Current verified status

| Benchmark | Current status | Evidence / blocker |
|---|---|---|
| Richards | Runs and passes its benchmark check | Last verified output: `result=0 collections=0 moves=0`. Current diagnostic build takes roughly 80 seconds. Reverify after the callable-ID changes described below. |
| DeltaBlue | Parses and builds a graph; does not emit executable code | Fails graph verification with `VERR-CALL-ARITY`, currently around call node `n7094` depending on graph changes. The concrete target has hidden capture parameters that the generic call does not carry. |
| Crypto | Not yet probed end-to-end in the current worktree | Waiting on the shared call ABI fix. |
| RayTrace | Not yet probed end-to-end in the current worktree | Waiting on the shared call ABI fix. |
| EarleyBoyer | Not yet probed end-to-end in the current worktree | Earlier notes mention legacy parser diagnostics; must be reprobed from current state. |
| Splay | Not yet probed end-to-end in the current worktree | Waiting on the shared call ABI fix. |
| NavierStokes | Not yet probed end-to-end in the current worktree | Waiting on the shared call ABI fix. |

There is no valid full benchmark/Node comparison table yet. Do not report performance numbers for
a benchmark until its native result passes the benchmark's correctness checks.

## What was fixed during the benchmark work

### Richards

Richards originally failed in polymorphic/dynamic method handling. The following areas were fixed
or substantially advanced:

- Polymorphic method return values are normalized at indirect call boundaries.
- Loose equality now treats `null` and `undefined` as nullish based on the actual runtime
  representation rather than only the source declaration.
- Function/call target lookup was corrected in several paths.
- Dynamic and statically known object fields with globally incompatible layouts now consistently
  use the generic `PropertyKey` storage path.
- Receiver calls accept boxed function objects where JavaScript permits them.
- Missing JavaScript arguments are explicitly materialized as `undefined` for statically known
  callees.

Richards then completed with:

```text
result=0 collections=0 moves=0
```

Its current runtime is not acceptable as a final performance result. Generic property lookup is a
major contributor, and the build used extensive diagnostic paths.

### Object literals and array chains

Earlier work in this worktree improved object literal construction, dynamic property handling, and
array `map`/`filter`/`reduce` paths. The user’s performance target is:

- Every listed microbenchmark below 10x Node.
- Ideally the `map`/`filter`/`reduce` chain below 3x Node.

Those optimizations and their tests are part of the existing dirty worktree. They must be preserved
and revalidated after the benchmark ABI work.

## DeltaBlue: exact current failure

DeltaBlue heavily uses the old V8 benchmark inheritance idiom:

```js
UnaryConstraint.superConstructor.call(this, strength);
ScaleConstraint.superConstructor.prototype.addToGraph.call(this);
```

The frontend builds functions with hidden parameters in this order:

1. lexical/runtime captures,
2. receiver when present,
3. explicit JavaScript parameters.

Calls have corresponding captured and receiver-aware ABIs. This works when the frontend has an
exact target or a finite target set. It breaks for generic property calls whose concrete target is
only discovered by later property folding.

The failing graph has the shape:

```text
n7094: Call : dyn <- ... n148 ...
n148: Fun ...
```

`n148` has eight live `Parm` nodes while the call supplies only the receiver/ordinary arguments.
The extra parameters are global/cell captures. Verification correctly reports
`VERR-CALL-ARITY`—weakening the verifier would allow shifted or uninitialized registers and produce
incorrect execution.

### Root architectural issue

Script globals are currently propagated as variable-length lexical capture prefixes. Generic
JavaScript calls cannot know which prefix to construct. Function target summaries are finite
(63 usable identities in an `i64` bit set), while DeltaBlue has enough functions/methods to exceed
that width.

A temporary pass, `fe-prioritize-prototype-functions!`, attempted to renumber dynamically
published methods into the finite range. It caused semantic identity mismatches among:

- `FeFunction.id`,
- lexical declaration/symbol IDs,
- prototype parent/method tables,
- capture ownership,
- graph `OP-FUN` identities,
- function objects stored in properties.

The pass is currently disabled at the call site in `src/frontend_native.coil`. Exact callable IDs
remain stable; large target sets should use generic runtime dispatch rather than semantic
renumbering. The pass itself still exists and can be removed or redesigned later.

### Unsuccessful workaround that was removed

Padding every call to the maximum source parameter count with boxed `undefined` advanced some
verifier failures but was incorrect. It does not know the hidden capture count or placement, so it
can shift the receiver and explicit arguments into capture slots. That code was removed.

An exact-target omitted-argument fallback remains in `fng-user-call`; it recovers the frontend
function from `OP-FUN.aux - 1` and is valid for exact non-generic calls.

## Recommended next implementation

Implement a fixed script/global environment ABI.

The clean design is:

- Every user function that can access script globals receives one fixed hidden environment value.
- The environment contains shared cells for mutable globals and ordinary values/cells for immutable
  bindings as appropriate.
- Global reads and writes use that environment instead of adding a different capture parameter for
  each referenced global.
- True lexical captures from nested functions remain closure-specific.
- Generic calls can therefore use one stable descriptor regardless of the target.
- The call descriptor should eventually carry explicit argument count (`argc`), allowing callee
  prologues to materialize missing parameters as `undefined`, matching JavaScript without padding
  all call sites.

This resembles V8/Torque’s separation between a stable function context and ordinary JavaScript
arguments. It also scales beyond the finite target-summary width and is a prerequisite for robust
generic calls across the remaining benchmarks.

Likely implementation sequence:

1. Separate global captures from lexical captures in `FeCapture` queries. Helpers are concentrated
   around `fe-copy-global-captures!`, `fe-propagate-call-captures!`,
   `fng-runtime-capture?`, `fng-symbol-capture-count`, and `fng-capture-symbol`.
2. Allocate one script environment in the synthetic top-level/main graph.
3. Add a fixed environment slot to user function/call ABI construction.
4. Route `FE-ROLE-GLOBAL` storage through environment fields/cells.
5. Stop copying global symbols into per-target capture lists.
6. Keep local/nested lexical closure captures unchanged.
7. Make DeltaBlue emit, link, run, and pass `chainTest` plus `projectionTest`.
8. Re-run Richards immediately to catch ABI regressions.

Do not solve this by making every dynamic call carry the union of all global captures. That would
be correct only with a globally normalized ordering and would impose a large, growing call prefix;
the fixed environment is simpler and scales properly.

## Callable/source identity work currently present

`FeFunction` now contains both `id` and `source-id`. This was introduced while diagnosing callable
renumbering. Relevant changes include:

- `fng-function-source-index`.
- Function declaration publication through `source-id`.
- Direct call target selection using callable `id`.
- Capture ownership remapping code inside the now-disabled prioritization pass.

With prioritization disabled, `source-id` usually equals the original function ID. Audit this split
after DeltaBlue works; remove it if it no longer serves a real invariant, or populate it from the
exact declaration symbol rather than name heuristics.

There is also a temporary identifier-expression fallback that prefers a matching function
declaration over stored symbol state. This helps declaration resolution but may bypass mutable
reassignment semantics. It must be replaced with a principled binding/callable distinction before
claiming complete JavaScript function semantics.

## DSL status and hard-coded mechanisms

The intended boundary is:

- JavaScript algorithms and observable semantics belong in JSL definitions under `lib/`.
- Allocation, raw memory access, GC barriers, machine representation changes, indirect call
  mechanics, unwind support, and platform code generation are compiler/runtime primitives.
- Frontend syntax lowering may choose a DSL definition, but should not independently compute the
  JavaScript result.

Much array/string/conversion behavior is already expressed in JSL. Current unavoidable or
unfinished hard-coded areas include:

- Generic property/element access mechanisms and shape transitions.
- Function/closure construction and call ABI.
- GC/runtime allocation and write barriers.
- Several Math operations lowered to native/runtime builtins.
- JSON parsing/stringifying, which should ultimately be optimized native/JSL runtime code rather
  than a slow generic user-level implementation.
- Unsupported syntax/runtime families documented in `docs/STATUS.md`.

The previous version of this handoff described four important DSL infrastructure gaps that remain
relevant after benchmark correctness:

1. `jsl-inline!` control flow inside non-entry functions.
2. Heap-writing control-flow merges leaving untyped memory Phis.
3. Construction-time folded branches desynchronizing Regions and Phis.
4. A general JSL `%Call` capability for callback-taking definitions.

These are necessary for moving more semantics—especially callback array methods—fully into the
DSL. Do not lose them while fixing the runtime ABI.

## Benchmark and Node timing requirements

Once all runnable benchmarks pass correctness:

- Measure runtime only, not compile time.
- Node must receive real warmup. A minimum of 1,000 benchmark invocations is required before its
  measured samples; use more for very small workloads.
- AOT binaries do not require JIT warmup, but should still be sampled repeatedly and measured over
  enough work to escape timer noise.
- Validate outputs before timing.
- Report every benchmark in one table with native time, warmed Node time, and native/Node ratio.
- Do not call a small outer sample count “iterations”; distinguish warmup invocations, timed
  invocations per sample, and sample count.

Existing harness work includes:

- `tools/v8-node-performance.mjs`
- `tools/v8-performance-harness.c`
- modifications to `tools/typescript-aot-benchmarks.mjs`
- modifications to `tools/generate-typescript-aot-benchmark.mjs`

Audit these before trusting results. Confirm the Node path performs at least 1,000 actual benchmark
calls, not merely 20 outer timing rounds.

## Useful commands and artifacts

Current DeltaBlue diagnostic directory:

```text
.coil/debug/deltablue/declaration-precedence/
```

Rebuild and reproduce emission failure:

```sh
coil build .coil/debug/deltablue/declaration-precedence/deltablue.coil \
  -o .coil/debug/deltablue/declaration-precedence/deltablue-emitter

.coil/debug/deltablue/declaration-precedence/deltablue-emitter 0 10 \
  > .coil/debug/deltablue/declaration-precedence/deltablue.o \
  2> /tmp/deltablue-emitter.err

rg 'verify=|^n7094:|Parm .*<- n148$' /tmp/deltablue-emitter.err
```

The exact node numbers can move after any graph change. Use the `verify=<code> node=<id>` line as
the authority.

Richards’ last known-correct binary was:

```text
.coil/debug/richards/nullish-fix/richards
```

Run formatting/diff hygiene after edits:

```sh
git diff --check
git status --short
```

The full project gate was previously documented as:

```sh
./tools/gate.sh
```

Run focused tests while iterating, then the complete gate before declaring the benchmark work
finished.

## Worktree warning

The worktree is intentionally dirty and contains substantial changes from earlier DSL,
performance, runtime, backend, and benchmark work. Do not reset or discard unrelated changes.

At the time of this handoff, modified/untracked paths included:

```text
lib/array/build.jsl
src/backend_aarch64.coil
src/backend_macho.coil
src/backend_select.coil
src/frontend_native.coil
src/frontend_native_graph.coil
src/jsl_lower.coil
src/node.coil
src/shape.coil
src/verify.coil
tests/jsl-test.coil
tests/shape-test.coil
tools/b15-adapt.mjs
tools/generate-typescript-aot-benchmark.mjs
tools/native-gc-runtime.c
tools/typescript-aot-benchmarks.mjs
tools/v8-node-performance.mjs
tools/v8-performance-harness.c
```

Always inspect current diffs before modifying overlapping code.

## Completion checklist

Do not call this effort complete until all of the following are evidenced from the current
worktree:

- Richards passes correctness after the final ABI design.
- DeltaBlue passes both benchmark correctness tests.
- Crypto passes.
- RayTrace passes.
- EarleyBoyer passes.
- Splay passes.
- NavierStokes passes.
- RegExp is clearly labeled excluded rather than silently omitted.
- The full relevant test gate is green.
- No benchmark-specific hard-coded result or semantic shortcut was introduced.
- The DSL/compiler/runtime boundary is documented for every newly required primitive.
- Properly warmed Node comparisons are run and reported in one complete table.
