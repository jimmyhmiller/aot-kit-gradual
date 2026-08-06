# Roadmap: run the complete V8 Benchmark Suite v7

This file is the authoritative roadmap. The Simple-backend and binary-trees roadmap is complete;
its implementation history remains in [JOURNAL.md](JOURNAL.md), and its gates remain permanent
regressions. This roadmap starts a new controller.

The research and corpus audit behind the scope and ordering are recorded in
[V8-BENCHMARK-RESEARCH.md](V8-BENCHMARK-RESEARCH.md). Detailed slice contracts are in
[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).

## Target

Compile and execute all eight programs in the **V8 Benchmark Suite version 7** through the native
Microsoft `typescript-go` parser, Coil-owned frontend, ideal IR, optimizer, arm64 backend, and
moving collector:

1. Richards
2. DeltaBlue
3. Crypto
4. RayTrace
5. EarleyBoyer
6. RegExp
7. Splay
8. NavierStokes

The suite is pinned from the official V8 repository at tag `7.4.77`, whose `benchmarks/` directory
identifies itself as version 7. We use the original JavaScript programs and harness semantics;
typed adapters may describe closed-world entry points, but may not rewrite the algorithms into an
easier language subset.

This deliberately does **not** mean every file under modern V8's `test/js-perf-test`, nor
Speedometer or JetStream. V8 now recommends Speedometer and JetStream for modern performance work
and describes its old suite as a classic peak-performance workload. The finite v7 corpus is the
right next compiler-coverage target; a later roadmap can graduate to modern suites.

## What the audit found

The completed compiler already has general CFG lowering, calls, frames, scheduling, allocation,
objects, exact stack maps, and moving GC. Binary-trees proves that substrate. The missing work is
mostly language/runtime coverage plus numeric backend coverage:

- the native parser bridge exists, but the old npm TypeScript normalizer still drives several
  product and benchmark tools;
- the frontend handles declarations, direct calls, constructors, structured `if`/`while`/`for`,
  object literals, and named fields, but not JavaScript's full benchmark surface;
- the ideal interpreter understands doubles, while native selection and the frontend are still
  centered on integer arithmetic;
- the corpus uses function expressions, receiver calls and `this`, prototype-style construction,
  arrays and indexed access, strings, Math intrinsics, modulo, bitwise operations, shifts,
  increment/decrement, short-circuit expressions, conditional expressions, `switch`, `do`,
  `break`, `continue`, `typeof`, `in`, `instanceof`, `delete`, exceptions, and regular expressions;
- EarleyBoyer is the broadest dynamic-language test (4,684 lines); RegExp contains 237 regular
  expression literals and must not be claimed complete through a stubbed matcher.

The order below follows capability dependencies, not benchmark source order.

## Non-negotiable rules

1. **Original workloads.** Preserve the pinned source and expected checks. A port may add types and
   a closed-world wrapper, but may not replace a data structure, builtin, regular expression, or
   algorithm with a precomputed answer or benchmark-specific native helper.
2. **One product frontend.** The native `typescript-go` AST path is authoritative. JavaScript
   TypeScript-API code may remain temporarily as an independent oracle, never as the compiler path.
3. **Capability failures are data.** Every corpus item is present from B00 and reports its first
   stable unsupported capability until it runs. Crashes and generic parse failures are not status.
4. **Semantics before speed.** Node/V8 is the observable oracle. Raw ideal, optimized ideal, normal
   native, register-pressure native, and GC-stress native must agree before timing is published.
5. **No benchmark dispatch.** Compiler and runtime code may not branch on suite, file, function, or
   benchmark names. Builtins are allowed only as general specified runtime operations.
6. **No GC exemptions.** Allocation-heavy programs run with exact layouts and stack maps under
   moving collection. A larger non-collecting heap is not completion evidence.
7. **No score laundering.** Report compilation separately from execution, retain raw samples, and
   publish every individual result and loss. The aggregate uses the suite's geometric-mean rules.
8. **Every milestone is falsified.** Reversing its behavior must turn its focused gate red for the
   expected reason before the milestone is completed.

## Milestones

Status values are `active`, `blocked`, `not started`, and `done`. The executable controller in
`workflow/state.json` is the status authority. `workflow.mjs complete` accepts only a clean worktree,
so each evidence record names a commit that already contains the green implementation.

| ID | Milestone | Status | Required predecessor | Exit gate |
|---|---|---|---|---|
| B00 | Pinned corpus, Node oracle, and capability inventory | done | completed roadmap | eight licensed, hashed sources pass Node checks and report stable first gaps |
| B01 | JavaScript-aware native parser ABI | done | B00 | `.js` mode and named AST roles/literals/operators cover the corpus |
| B02 | Canonical Coil-owned frontend path | done | B01 | product tools require `typescript-go`; npm parser is oracle-only |
| B03 | Native JavaScript tagged-value ABI | done | B02 | every value tag survives calls, spills, fields, and moving GC |
| B04 | JavaScript number semantics in ideal IR | done | B03 | IEEE-754/NaN/-0/mixed-number oracle matrix agrees |
| B05 | arm64 floating-point lowering | done | B04 | f64 ABI, Phis, allocation, spills, and comparisons agree natively |
| B06 | `ToInt32`, modulo, bitwise, and shifts | done | B04, B05 | Node edge-case matrix agrees for all 32-bit operators |
| B07 | Expression evaluation and assignment | done | B03, B04 | updates, compound lvalues, comma, ternary, and short-circuit order agree |
| B08 | Structured CFG and targeted exits | done | B07 | `do`, `switch`, fallthrough, `break`, and `continue` agree |
| B09 | Function expressions and lexical closures | done | B03 | captured/recursive closures and indirect closed-world calls survive GC |
| B10 | Receiver calls, `this`, and constructors | done | B09 | receiver ABI and JS constructor-return rules agree |
| B11 | Dynamic properties and prototype chains | done | B10 | lookup, shadowing, missing properties, transitions, and prototypes agree |
| B12 | Dense JavaScript arrays | done | B03, B11 | indexed storage, growth, holes, push/pop/slice, and exact GC scans agree |
| B13 | Strings and conversion | done | B03 | corpus string operations and conversions agree with Node |
| B14 | Core builtins and uncaught `throw` | done | B05, B12, B13 | Math/builtin descriptors agree and original failure checks compile honestly |
| B15 | Richards and DeltaBlue closure | active | B06–B14 as applicable | both original programs pass the full correctness matrix |
| B16 | NavierStokes closure | not started | B05–B07, B12, B14 | original numeric-array kernel passes every mode |
| B17 | RayTrace and Splay closure | not started | B05, B07–B08, B10–B14 | both original checks pass; Splay survives forced collection |
| B18 | Crypto closure | not started | B06–B14 | original RSA/big-integer round trip passes without host substitution |
| B19 | Dynamic operators and catchable exceptions | not started | B09, B11–B14 | `typeof`/`in`/`instanceof`/`delete` and exceptional CFG agree |
| B20 | EarleyBoyer closure | not started | B19, B21 when inventory requires | original 4,684-line program passes every mode |
| B21 | General RegExp runtime | not started | B13 | literals, captures, flags, `lastIndex`, exec/test/match/replace/split agree |
| B22 | RegExp benchmark closure | not started | B21 | all 237 literals execute and the original check passes |
| B23 | Whole-suite correctness and stress runner | not started | B15–B18, B20, B22 | all eight pass independently and together in every correctness mode |
| B24 | Reproducible aot-kit versus Node/V8 publication | not started | B23 | raw samples, medians, Node/aot-kit ratios, and aggregate publish reproducibly |

Critical path:

```text
B00 -> B01 -> B02 -> B03
B03 -> B04 -> B05 -> B06
B03 -> B07 -> B08
B03 -> B09 -> B10 -> B11 -> B12
B03 -> B13
B05 + B12 + B13 -> B14
shared capabilities -> B15/B16/B17/B18
B09 + B11 + B12 + B13 + B14 -> B19 -> B20
B13 -> B21 -> B22
B15 + B16 + B17 + B18 + B20 + B22 -> B23 -> B24
```

## Completion definition

The roadmap is complete only when one command builds the pinned suite, runs all eight benchmarks
through aot-kit, verifies each benchmark's original correctness checks against Node/V8, repeats the
defined optimization/seed/register-pressure/collector matrix, and produces a reproducible report
with per-benchmark and aggregate results. Parsing a file, lowering a reduced port, or running only
the ideal interpreter is intermediate evidence, not a completed benchmark.

## Next task

Implement B00 exactly as specified in [CURRENT-SLICE.md](CURRENT-SLICE.md): pin the upstream corpus,
record its license and content hashes, build the Node oracle, and generate a stable capability
inventory from the native parser path. Do not begin by implementing whichever unsupported syntax
happens to appear first.
