# V8 benchmark roadmap research

Research performed 2026-08-03 before replacing the completed roadmap.

## Scope decision

The phrase “V8 benchmarks” can refer to three different targets:

- the historical V8 Benchmark Suite v7: eight standalone pure-JavaScript programs;
- Octane 2: seventeen results, incorporating and expanding the old suite;
- modern V8 performance work: Speedometer, JetStream, and the large internal
  `test/js-perf-test` tree.

V8's current benchmark documentation recommends Speedometer and JetStream and identifies
`test/js-perf-test` as feature microbenchmarks. V8 retired Octane as a recommended proxy for real
web performance in 2017, while retaining classic suites as useful peak-performance investigations.
For this compiler, the finite original v7 suite is the achievable next coverage step after
binary-trees. The roadmap names it explicitly so “all” is testable.

Primary sources:

- <https://v8.dev/docs/benchmarks>
- <https://v8.dev/blog/retiring-octane>
- <https://chromium.googlesource.com/v8/v8/+/7.4.77/benchmarks/>
- <https://chromium.googlesource.com/v8/v8/+/7.4.77/benchmarks/revisions.html>

## Corpus audit

The official `benchmarks/` archive at V8 tag `7.4.77` (commit
`f96b55bd7c9c36e9ab5cbef08f094bf4c57f9707`) contains `base.js`, `run.js`, and these v7
programs. Counts below are lexical AST counts from TypeScript 5.9.3 parsing the unchanged JavaScript;
they guide planning but are not the V0 executable inventory.

| Program | Lines | Dominant pressure |
|---|---:|---|
| Richards | 540 | constructors, receiver calls, mutable objects, bitwise scheduler state |
| DeltaBlue | 881 | prototype inheritance, arrays, switch/do/ternary, receiver calls |
| Crypto | 1,699 | arrays, strings, 32-bit bitwise/shift arithmetic, many loops |
| RayTrace | 905 | doubles, Math, objects, prototype-style classes, conditional expressions |
| EarleyBoyer | 4,685 | closures, arrays, strings, exceptions, dynamic properties, RegExp |
| RegExp | 1,765 | 237 RegExp literals and String/RegExp operations |
| Splay | 395 | mutable trees, object literals, allocation and GC, arrays |
| NavierStokes | 388 | dense double arrays, indexed access, nested numeric loops |

Across the eight sources the audit found 2,150 `new` expressions, 794 indexed accesses, 274
function expressions, 191 `for` statements, 146 `while` statements, 92 conditional expressions,
62 `instanceof` operations, 53 `break` statements, 44 `typeof` expressions, 29 throws, 16 deletes,
13 switches, 5 try statements, 4 continues, and 2 do-loops. Counts are dominated by generated code
inside EarleyBoyer and RegExp, but each capability still needs general semantics.

## Repository audit

The current native frontend recognizes a narrow typed subset and enumerates only its supported
syntax kinds in `src/typescript_native.coil`. `src/frontend_native_graph.coil` currently lowers
integer-oriented arithmetic, comparisons, direct calls/new, object literals, named fields,
`if`/`while`/`for`, declarations, and returns. The ideal interpreter has an f64 value model, but the
machine backend has no corresponding complete native floating-point path. The npm TypeScript
normalizer remains in benchmark generation and exact-graph oracle tests even though the native Go
parser/Coil frontend exists.

The first roadmap draft grouped those facts into large V1–V5 epics. An independent decomposition
audit split them into B01–B14 because parser authority, tagged values, ideal number semantics,
native f64, 32-bit coercions, expression order, control exits, closures, receivers, prototypes,
arrays, strings, and builtins have distinct implementations and falsification gates. The audit also
caught two ordering defects: original Richards/Crypto/RayTrace/Splay checks use `throw`, and
RayTrace uses `typeof`. Those capabilities now precede the affected benchmark closure milestones.
