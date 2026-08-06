# Roadmap: a usable ahead-of-time JavaScript and TypeScript runtime

This is the only project roadmap. It replaces the V8-v7 benchmark campaign and its separate
implementation plan. The old milestone gates remain regression tests, but they no longer determine
the product direction.

## Product target

Build a runtime that can compile and run an ordinary multi-module TypeScript application, including
unmodified JavaScript dependencies, without a JIT. The first credible product is a command-line
application; the next is an HTTP service. Both must have correct ECMAScript behavior, useful host
APIs, source-mapped diagnostics, bounded memory use, and competitive warmed throughput.

The acceptance application must exercise ESM cycles and live bindings, exceptions, promises,
filesystem and network I/O, object and array mutation, closures, classes, JSON, and at least five
unmodified npm packages. Passing hand-written microbenchmarks alone is never product completion.

## Compatibility contract

- Target a pinned ECMAScript edition and a pinned TypeScript compiler version. Record both in a
  generated support manifest; do not use “JavaScript support” as an unbounded claim.
- Node is the observable oracle for supported ECMAScript and host behavior. Compare values, thrown
  error classes, messages where standardized, side-effect order, module order, and microtask order.
- TypeScript is checked and erased before JavaScript lowering. Types may justify optimizations only
  after proof; removing an annotation must not change runtime behavior.
- Unsupported syntax, semantics, modules, and host APIs fail before object publication with a stable
  diagnostic and source range. Silent approximation is a correctness bug.
- The runtime is allowed a documented Node-compatible subset. Every deviation must be explicit,
  tested, and present in the support manifest.

## Rules that keep the implementation clean

1. Implement language mechanisms, never application- or benchmark-name dispatch.
2. Reduce every full-application failure to the smallest independent conformance case before fixing
   it. Keep the reduction permanently.
3. Give each representation one owner and one verifier. Frontend, ideal IR, machine IR, runtime,
   module loader, and host layer must not repair each other's malformed state.
4. Keep semantics separate from optimization. Every program must work with optimization disabled;
   an optimization needs guards or proof and an equivalent generic path.
5. Centralize runtime operations behind typed descriptors that declare coercion, allocation,
   safepoints, exceptions, and side effects. Do not scatter special builtin rules through lowering.
6. Preserve exact GC metadata. No non-collecting application mode may be used as completion evidence.
7. Add observability with each subsystem: stable errors, source locations, traces, counters, and
   inspectable state are deliverables, not cleanup work.
8. Keep gates monotonic. A supported behavior never returns to “expected unsupported.”
9. Falsify every milestone gate by injecting or simulating the defect it claims to detect.
10. Do not mark a milestone complete with tracked changes, generated artifacts, skipped stress
    dimensions, or results that cannot be reproduced from one command.

## Standard evidence required for every milestone

Every milestone gets a focused `tools/gates/RNN.sh` and must satisfy all applicable rows below.

| Evidence | Required proof |
|---|---|
| Differential semantics | Node and native agree on result, exception, side effects, and ordering |
| Phase structure | Exact or normalized structural checks prove the intended mechanism exists |
| Negative behavior | Unsupported and corrupt inputs fail early with stable named diagnostics |
| Stress | Deterministic seed, register-pressure, and collect-every-allocation modes agree |
| Falsification | A deliberately broken invariant makes the focused gate fail for the expected reason |
| Application witness | A realistic multi-file program uses the capability without test-only adapters |
| Hygiene | Full gate is green, worktree is clean, outputs are reproducible, documentation matches code |

Coverage counts are floors, not targets. Each capability matrix records every syntax/operator/API
row, its positive cases, edge cases, error cases, and execution modes. A milestone cannot close if a
declared row has no test or if a test only checks the final integer while hiding evaluation order.

## Sequence and status

Only one milestone is active at a time. `workflow/state.json` is the machine-readable status
authority.

| ID | Milestone | Status | Exit condition |
|---|---|---|---|
| R00 | Baseline and compatibility ledger | active | exact current support is generated, tested, and reproducible |
| R01 | Complete core ECMAScript semantics | not started | supported synchronous JS behavior agrees comprehensively with Node |
| R02 | Dynamic object and call runtime | not started | generic properties/calls are correct and inline caches are verified |
| R03 | Exceptions and diagnostic stack model | not started | catch/finally and cross-frame unwinding produce source-mapped stacks |
| R04 | ESM, packages, and separate compilation | not started | a cyclic multi-package program builds incrementally and runs correctly |
| R05 | Promises, jobs, and event loop | not started | async ordering and rejection behavior agree with Node |
| R06 | Production garbage collector | not started | generational GC is precise, bounded, observable, and stress-clean |
| R07 | Standard library and CLI host | not started | real CLIs run with documented filesystem/process/buffer APIs |
| R08 | Networking and service host | not started | a real HTTP service passes correctness, load, shutdown, and leak gates |
| R09 | Ecosystem qualification and release | not started | unmodified packages and applications pass a published compatibility suite |

The dependency chain is deliberately linear. Work may be researched early, but implementation does
not jump ahead to host APIs while foundational language, exception, module, or scheduling semantics
remain provisional.

## R00 — baseline and compatibility ledger

### Build

- Pin the ECMAScript edition, TypeScript version, Node oracle version range, arm64 ABI, and supported
  operating-system target.
- Generate one machine-readable support manifest from tests. It must distinguish `supported`,
  `partial`, and `unsupported`, and link every supported row to a differential test.
- Inventory syntax, runtime semantics, builtins, module behavior, host APIs, diagnostics, GC modes,
  and tooling separately. Import the useful V8-v7 and native-conformance evidence without treating
  benchmark completion as the product goal.
- Establish application-shaped fixtures: a multi-file CLI, a package with an ESM cycle, and an
  allocation-heavy program. Initially they may report named gaps.

### Stay in scope

This milestone documents and mechanizes reality. It does not inflate support by adding shallow
features, change semantics merely to improve counts, or label phase-local tests as product support.

### Exit gate

- The manifest is deterministically regenerated and diff-checked.
- Removing a test, support row, fixture, or Node comparison fails the gate.
- Every existing supported feature runs raw ideal, optimized ideal, normal native, pressure native,
  and GC-stress native where applicable.
- Compiler/runtime crashes are zero; every known gap has a stable category and source range.
- `README.md`, conformance documentation, and the manifest make identical support claims.

## R01 — complete core ECMAScript semantics

### Build

- Finish lexical environments, declaration initialization, temporal dead zones, hoisting, `this`,
  `arguments`, rest/default/spread behavior, destructuring, classes, accessors, symbols, iterators,
  generators, coercions, equality, property-key conversion, and evaluation order.
- Complete strings, arrays, typed arrays, ArrayBuffer/DataView, Map, Set, Date, JSON, RegExp, and the
  required Math/Object/Reflect surfaces. Each builtin uses the central runtime descriptor model.
- Define one ECMAScript value representation and one conversion library. Frontend and optimizer
  must call those operations rather than duplicate coercion logic.
- Keep TypeScript transformations explicit: enums, parameter properties, namespaces, decorators,
  and JSX are either correctly lowered by a pinned transform or named unsupported.

### Clean implementation tests

- Table-driven differential tests cover boundary values, NaN and negative zero, holes, descriptors,
  prototype mutations, proxies if claimed, symbols, Unicode, regex state, iterator closing, and
  abrupt completion ordering.
- Metamorphic tests remove TypeScript annotations and compare behavior; optimization-off and
  optimization-on results match.
- Each builtin has descriptor validation plus fault injection for wrong coercion, missing safepoint,
  and incorrect exception behavior.
- At least one unmodified parser, serializer, template engine, and collection-heavy package runs.

### Exit gate

All rows claimed by the R00 core-language and builtin manifests are green against Node, and the
remaining unsupported rows are explicit. No application fixture fails on synchronous language
semantics.

## R02 — dynamic object and call runtime

### Build

- Implement hidden-class transitions, property descriptors, prototype-chain lookup, indexed
  elements, dictionary fallback, and correct invalidation after prototype or descriptor mutation.
- Implement generic call, method, constructor, bound-function, closure, accessor, and runtime-native
  call paths with one stable ABI and correct receiver/`new.target` behavior.
- Add monomorphic and polymorphic inline caches for loads, stores, and calls. Megamorphic sites must
  fall back to a correct generic operation. Cache state belongs to runtime metadata, not source-name
  special cases.
- Specify invalidation, concurrency assumptions, GC tracing, and serialization of all cache and
  shape metadata.

### Clean implementation tests

- Run identical programs with caches disabled, cold, monomorphic, polymorphic, megamorphic, and
  invalidated; observables must match.
- Structural tests inspect cache guards and fallback edges. Mutation tests remove a guard or
  invalidation and require a semantic failure.
- Property/call fuzzing varies shapes, prototypes, accessors, receivers, arities, and collection
  points against Node.
- Benchmark property and call throughput only after correctness; publish miss rates and fallback
  counts so a suspicious speedup cannot hide omitted work.

### Exit gate

The application fixtures use generic dynamic calls and properties without closed-world adapters,
survive prototype mutation and GC stress, and show no correctness dependence on cache state.

## R03 — exceptions and diagnostic stack model

### Build

- Add explicit exceptional control edges through ideal and machine IR, calls, runtime operations,
  landing pads, `try`/`catch`/`finally`, rethrow, and constructor/iterator cleanup.
- Root thrown values and all handler-live references precisely at every safepoint.
- Define Error subclasses, `cause`, stack capture, source-map lookup, and uncaught-exception output.
- Preserve original source ranges through transforms, inlining, specialization, and native emission.

### Clean implementation tests

- Differential traces cover nested handlers, return/throw through `finally`, exceptions during
  cleanup, cross-module and cross-native-frame throws, and collection immediately before catch.
- Corruption tests remove exceptional liveness, handler edges, or source mappings and require named
  verifier failures.
- Stack tests assert function, file, and line frames while allowing documented Node formatting
  differences. Release binaries retain enough metadata for actionable reports.

### Exit gate

All supported abrupt completions agree with Node; no fatal runtime path substitutes for a catchable
exception; application failures produce stable source-mapped stacks.

## R04 — ESM, packages, and separate compilation

### Build

- Implement ESM resolution, linking, instantiation, evaluation, live bindings, cycles, namespace
  objects, dynamic import, and top-level await policy. Define the supported `package.json` fields.
- Separate frontend artifacts, runtime ABI, module metadata, and final native linking. Artifacts are
  content-addressed and versioned so stale objects cannot link silently.
- Add incremental builds, dependency invalidation, deterministic output, and a documented interop
  boundary for CommonJS if supported.
- Keep module semantics in the loader/linker rather than flattening source files into one script.

### Clean implementation tests

- Compare evaluation/event traces for cycles, re-exports, ambiguous exports, failure caching,
  package conditions, symlinks, and dynamic imports against Node.
- Rebuild after changing public API, private implementation, compiler flags, and dependency
  metadata; assert exactly the correct artifacts invalidate.
- Build in different directory orders and absolute paths; normalized artifacts and behavior match.

### Exit gate

A multi-package TypeScript CLI with ESM cycles and at least five unmodified npm dependencies builds
incrementally, runs from a clean checkout, and reproduces byte-identical normalized artifacts.

## R05 — promises, jobs, and event loop

### Build

- Implement Promise resolution, thenable assimilation, async functions, `await`, async iteration,
  microtask queues, unhandled rejection policy, timers, and event-loop shutdown rules.
- Make async roots and suspended frames explicit GC objects with verified layouts and source stacks.
- Define deterministic test hooks for virtual time and queue inspection without changing production
  ordering semantics.

### Clean implementation tests

- Differential event logs cover nested promises, thenables, rejection propagation, `finally`, timer
  ordering, queue starvation boundaries, async generators, and process exit.
- Stress collection at every suspension/resumption point and inject failures in callbacks and host
  completions.
- Falsification swaps microtask/macrotask order, drops a rejection, or loses a suspended root and
  must fail a focused gate.

### Exit gate

Async application fixtures agree with Node on event order and error propagation across all stress
modes, with no leaked suspended frames after quiescence.

## R06 — production garbage collector

### Build

- Evolve the collector to generational operation with nursery allocation, promotion, remembered
  sets, write barriers, large-object handling, heap growth limits, and explicit OOM behavior.
- Preserve precise stack maps and layouts across calls, exceptions, async suspension, modules,
  inline caches, weak references, and finalization.
- Add heap statistics, pause/throughput counters, verification mode, poisoning, heap snapshots, and
  deterministic stress controls.

### Clean implementation tests

- Compare generational and full-collection modes on the same semantic corpus. Collect at every
  allocation and at every safepoint under restricted heaps.
- Barrier fault injection, stale-root poisoning, randomized heap relocation, weak/finalizer tests,
  and long-running leak slopes must catch missing edges.
- Benchmark allocation throughput, live-heap overhead, p50/p95/p99 pause, and peak RSS separately;
  never hide pauses inside aggregate throughput.

### Exit gate

All application fixtures run under a bounded heap for sustained periods, heap growth stabilizes,
stress verification is clean, and OOM produces the documented controlled failure.

## R07 — standard library and CLI host

### Build

- Provide documented `console`, process arguments/environment/exit/signals, filesystem, paths,
  URLs, buffers, encoding, streams, timers, and cryptographic primitives required by selected apps.
- Use capability-scoped host interfaces with explicit ownership, cancellation, errors, and GC
  lifetimes. Runtime semantics must not directly invoke scattered OS calls.
- Decide API compatibility operation by operation; generate the host support manifest from tests.

### Clean implementation tests

- Differential tests use temporary sandboxes for files, permissions, Unicode paths, partial I/O,
  stream backpressure, cancellation, signals, and resource cleanup.
- Leak tests count file descriptors, native allocations, handles, and heap roots before and after
  repeated application runs.
- Package tests run without patches or hidden Node subprocesses.

### Exit gate

At least three useful unmodified TypeScript CLIs install, compile, and pass their own test fixtures.
Failures have source-mapped stacks and leave no files, descriptors, or processes behind.

## R08 — networking and service host

### Build

- Add sockets, DNS, HTTP/1.1 client/server, streaming bodies, backpressure, cancellation, timeouts,
  graceful shutdown, and the minimum TLS surface required by the acceptance service.
- Integrate I/O completion with the R05 event loop through one ownership and wakeup model.
- Keep protocol parsing general and independently fuzzable; do not special-case the chosen service.

### Clean implementation tests

- Differential integration tests cover keep-alive, pipelining policy, malformed requests, aborted
  peers, slow readers/writers, timeout races, DNS/TLS failures, and shutdown with in-flight work.
- Protocol fuzzing and sanitizers run against parsers and native boundaries.
- Load tests publish throughput, latency percentiles, RSS, GC pauses, error rate, and open-handle
  counts at steady state. Node receives the same warmup, workload, and correctness checks.

### Exit gate

An unmodified framework-based TypeScript HTTP service passes functional and load tests, shuts down
cleanly, sustains a bounded heap, and has no known correctness divergence from its Node execution.

## R09 — ecosystem qualification and release

### Build

- Curate a versioned package/app corpus spanning parsing, validation, templating, data structures,
  CLI, and HTTP. Pin sources, licenses, hashes, install graphs, and expected behavior.
- Add a single build/run command, artifact cache, release packaging, compatibility report, upgrade
  notes, and stable runtime/compiler versioning policy.
- Provide CPU/heap profiles, optimization and fallback diagnostics, source maps, and a minimal
  debugger story sufficient to diagnose application failures.

### Clean implementation tests

- Run package-owned tests where practical plus black-box Node differentials. No source patches,
  precomputed answers, benchmark dispatch, hidden Node execution, or disabled GC are permitted.
- Reproduce release artifacts in a clean environment and verify signatures/hashes and ABI rejection
  of incompatible objects.
- Track correctness, startup, warmed throughput, latency, memory, and binary size independently.
  Regressions require explicit budgets and reviewed waivers; compiler time never substitutes for
  runtime evidence.

### Exit gate

The acceptance CLI and HTTP service, five or more unmodified dependencies each, and the compatibility
corpus pass from a clean release artifact. The published report states exactly what is supported,
what is not, performance versus warmed Node, memory behavior, and every known incompatibility.

## Immediate next work

Execute R00 only:

1. Define the support-manifest schema and generator.
2. Map every current native conformance case and builtin to a manifest row.
3. Add explicit missing-capability rows for exceptions, ESM, promises, host APIs, and GC production
   features.
4. Add the three named application-shaped gap fixtures.
5. Create `tools/gates/R00.sh` with deletion detection, deterministic regeneration, and claim/test
   cross-checks.

Do not begin R01 implementation until R00 makes the current boundary measurable and its gate has
been deliberately falsified.
