# V8 suite implementation plan

This is the executable breakdown of [ROADMAP.md](ROADMAP.md). Every milestone adds a focused gate,
a positive differential, a named negative/corruption case, a demonstrated falsification, and a
journal entry. Completion also requires the quick, full, and extended project gates.

When a full benchmark exposes a defect, first reduce it into a benchmark-independent regression,
fix the general capability, and only then admit the original benchmark to its permanent gate.

## B00 — pinned corpus, oracle, and inventory

- Implement: import/fetch the official V8 `7.4.77` (`f96b55bd...`) `base.js`, `run.js`, and eight
  programs; record licenses and SHA-256 hashes; add deterministic Node correctness and native-parser
  first-gap JSON; generate `docs/V8-BENCHMARK-GAP.md`.
- Files: `benchmarks/v8-v7/`, `tools/v8-fetch.mjs`, `tools/v8-node-oracle.mjs`, inventory tool/data.
- Verify/falsify: corrupt a byte, omit a license, skip a benchmark, and inject syntax failure;
  `tools/gates/B00.sh` must distinguish each. Unlocks reproducible inputs, not native execution.

## B01 — JavaScript-aware native parser ABI

- Implement: filename and `ScriptKindJS`; named AST roles; operator and literal APIs including
  strings and regex; stable kind names and bounded diagnostics.
- Files: `native/typescript-go-bridge/{main.go,aot_typescript.h}`, `src/typescript_native.coil`.
- Verify/falsify: representative roles across all eight sources; invalid handles/roles and TS-only
  syntax in JS mode; force TS mode or swap call roles. Gate: `tools/gates/B01.sh`.

## B02 — canonical Coil-owned frontend

- Implement: one product compilation command using the native bridge and Coil resolution/lowering;
  npm TypeScript remains only an independent oracle or is removed from production dependencies.
- Files: `src/frontend_native*.coil`, generation/benchmark tools, `package.json`.
- Verify/falsify: a throwing npm-parser stub leaves product gates green; breaking the native bridge
  turns them red; unsupported nodes retain code/kind/role/range. Gate: `tools/gates/B02.sh`.

## B03 — native JavaScript tagged-value ABI

- Implement: one documented representation for undefined, null, boolean, int fast path, double,
  string, object, array, function/closure, and future RegExp; define truthiness, equality, call ABI,
  GC classification, boxing, and unboxing.
- Files: `src/{ty,eval,node,backend,gc}.coil`, runtime header/source.
- Verify/falsify: every tag through Phi, call/return, spill, field, and moving GC; reserved NaN tags,
  malformed refs, wrong unbox; flip a tag predicate. Gate: `tools/gates/B03.sh`.

## B04 — JavaScript number semantics in ideal IR

- Implement: IEEE-754 constants/arithmetic/comparisons, promotion, NaN, infinities, negative zero,
  division, and numeric truthiness with sound folding.
- Files: `src/{node,ty,eval,verify}.coil`.
- Verify/falsify: Node matrix around zero signs, overflow, NaN, infinities, mixed numbers, and divide
  by zero; substitute integer division or fold `NaN === NaN`. Gate: `tools/gates/B04.sh`.

## B05 — arm64 floating-point lowering

- Implement: FP register class, constants, arithmetic, comparisons, conversions, ABI arguments and
  results, Phis, liveness, allocation, spills, and safepoint behavior.
- Files: `src/backend.coil`, backend selection/ABI/liveness/allocation tests and native harnesses.
- Verify/falsify: normal and forced-pressure native differential including FP live across calls and
  GC; disable an FP reload or unordered comparison rule. Gate: `tools/gates/B05.sh`.

## B06 — `ToInt32`, modulo, and bitwise operators

- Implement: `%`, `&`, `|`, `^`, `~`, `<<`, `>>`, `>>>`, compound forms, JS coercion, and masked
  shift counts in IR, evaluator, frontend, and backend.
- Verify/falsify: Node matrix for fractions, negatives, NaN/infinity, 2^31/2^32 boundaries, and
  out-of-range counts; remove masking or sign-extend `>>>`. Gate: `tools/gates/B06.sh`.
- Unlocks Richards scheduler and Crypto word arithmetic.

## B07 — expression evaluation and assignment

- Implement: prefix/postfix update, compound assignment, comma, ternary, `&&`/`||` value semantics,
  and a single-evaluation lvalue abstraction for locals, properties, and elements.
- Files: parser constants and `src/frontend_native_graph.coil`, with Region/Phi lowering.
- Verify/falsify: `a[i++] += f()`, short-circuit side effects, postfix old value, ternary objects;
  eagerly lower both arms or evaluate a receiver twice. Gate: `tools/gates/B07.sh`.

## B08 — structured CFG and targeted exits

- Implement: `do/while`, `switch` dispatch/fallthrough, labeled and unlabeled `break`/`continue`,
  target stacks, and correct value/memory merging.
- Verify/falsify: nested loop/switch/labels across seeds; illegal labels and dead Phi arms; redirect
  an inner exit to its outer target. Gate: `tools/gates/B08.sh`.

## B09 — function expressions and lexical closures

- Implement: anonymous/named expressions, capture analysis, mutable captured cells, recursive named
  expressions, closure layouts, target sets, and indirect closed-world calls.
- Files: native frontend, ideal call/closure nodes, evaluator/backend, GC/runtime.
- Verify/falsify: sibling/mutable/recursive closures across moving GC; wrong arity/tag/capture layout;
  capture a mutable local by value. Gate: `tools/gates/B09.sh`.

## B10 — receivers, `this`, and constructors

- Implement: receiver-aware method call with one receiver evaluation, explicit receiver ABI, `this`,
  allocation, initialization, and JS object-versus-primitive constructor return rules.
- Verify/falsify: detached calls, nested receiver expressions, constructor return variants, receiver
  across GC; omit receiver or evaluate it twice. Gate: `tools/gates/B10.sh`.

## B11 — dynamic properties and prototypes

- Implement: own named storage, shape transitions, dynamic load/store, prototype lookup, shadowing,
  missing-property undefined, constructor `.prototype`, prototype GC edges and barriers.
- Files: `src/shape.coil`, frontend/evaluator/backend, runtime object tables.
- Verify/falsify: lookup/shadow/transition/mutation/GC matrix, missing properties and cycles; restrict
  lookup to own properties or omit a barrier. Gate: `tools/gates/B11.sh`.

## B12 — dense JavaScript arrays

- Implement: literals, indexed loads/stores, tagged backing stores, length/capacity, growth, required
  holes, push/pop/slice, exact scanning, and barriers; non-index keys remain properties.
- Verify/falsify: mixed values, growth, holes, bounds, negative keys, and collect-every-allocation;
  disable growth or element scanning. Gate: `tools/gates/B12.sh`.

## B13 — strings and conversion

- Implement: immutable string representation and encoding; literals, equality, concatenation,
  length, charAt/charCodeAt, substring/substr/slice/split, String conversion, parseInt, and isNaN.
- Verify/falsify: empty/boundary/negative/omitted arguments, radix parsing, mixed concatenation and GC;
  make all `+` numeric or return zero for out-of-range charCodeAt. Gate: `tools/gates/B13.sh`.

## B14 — core builtins and uncaught `throw`

- Implement: descriptor table for corpus Math and global builtins with arity, coercion, result type,
  allocation/safepoint effects; an uncaught throw path that preserves original benchmark checks.
- Verify/falsify: exact B00 Math surface against Node, unknown builtin rejection, stable nonzero thrown
  diagnostic and rooted thrown object; perturb sqrt or swallow throw. Gate: `tools/gates/B14.sh`.

## B15 — Richards and DeltaBlue closure

- Implement: only documented harness adapters plus general fixes reduced from full-program failures.
- Evaluator prerequisite: when ideal execution exposes cross-call/cache ambiguity, implement the
  frame/arrival/heap redesign in
  [EVALUATOR-EXECUTION-MODEL.md](EVALUATOR-EXECUTION-MODEL.md) rather than adding benchmark-specific
  recovery behavior.
- Verify/falsify: original checks in raw ideal, optimized ideal, native, pressure, GC stress, and seed
  modes; corrupt queue/hold and projection expectations separately. Gate: `tools/gates/B15.sh`.
- Unlocks: Richards and DeltaBlue.

## B16 — NavierStokes closure

- Implement: minimize and repair remaining general dense-double-array failures.
- Verify/falsify: original density check in every correctness mode, including collection during
  backing-store growth; perturb the checksum. Gate: `tools/gates/B16.sh`. Unlocks NavierStokes.

## B17 — RayTrace and Splay closure

- Implement: corpus-needed `typeof` plus minimized general numeric/object/allocation fixes. Preserve
  RayTrace's standalone computational path and Splay's live tree.
- Verify/falsify: original pixel/tree checks, `typeof null === "object"`, moving-GC tree invariants;
  misclassify a tag or omit an edge from tracing. Gate: `tools/gates/B17.sh`.
- Unlocks: RayTrace and Splay.

## B18 — Crypto closure

- Implement: minimize remaining carry, word-arithmetic, string, and array failures; never substitute
  a host RSA/crypto implementation.
- Verify/falsify: original encryption/decryption round trip in every mode; adverse shift/carry values;
  alter one carry or unsigned-shift rule. Gate: `tools/gates/B18.sh`. Unlocks Crypto.

## B19 — dynamic operators and catchable exceptions

- Implement: remaining `typeof`, `in`, `instanceof`, `delete`, and explicit exceptional CFG for
  `try`/`catch`/required `finally` and cross-call throw. Include exception values in verification,
  motion, scheduling, liveness, allocation, frames, and stack maps.
- Verify/falsify: nested/rethrow/handler-allocation and collection-before-catch cases plus prototype
  operators; remove an exception liveness edge. Gate: `tools/gates/B19.sh`.

## B20 — EarleyBoyer closure

- Implement: reduce every remaining full-program failure into general frontend/runtime/compiler tests.
- Verify/falsify: original 4,684-line check across all modes; corrupt its expected result and each new
  reduced witness. Gate: `tools/gates/B20.sh`. Unlocks EarleyBoyer.

## B21 — general RegExp runtime

- Implement: a pinned/licensed general regex engine integration; literals/construction, captures,
  flags, `lastIndex`, exec/test and String match/replace/split, with declared allocation/GC effects.
- Verify/falsify: Node pattern matrix for captures, alternation, classes, anchors, quantifiers,
  escapes, global/case flags, replacements, and zero-length matches; ignore `g` or captures.
- Gate: `tools/gates/B21.sh`.

## B22 — RegExp benchmark closure

- Implement: minimize general failures until the original workload executes every one of its 237
  literal ranges; forbid pattern-specific lookup tables.
- Verify/falsify: full correctness matrix and literal-coverage record; remove one range and add an
  unseen-pattern differential. Gate: `tools/gates/B22.sh`. Unlocks RegExp.

## B23 — whole-suite correctness and stress runner

- Implement: one command running all eight independently and together in raw ideal, optimized ideal,
  native, pressure, collect-every-allocation, and seed modes; randomize combined-process order.
- Files: `tools/v8-suite.mjs`, native harness, structured result schema.
- Verify/falsify: original checks agree with Node in every mode; skipping a program/mode, silently
  downgrading stress, or leaking global state fails. Gate: `tools/gates/B23.sh` plus extended form.

## B24 — reproducible aot-kit versus Node/V8 publication

- Implement: correctness-qualified runner and report with source/compiler/environment hashes,
  hardware/OS, Node/V8 versions, flags, warmup policy, every raw sample, medians and dispersion,
  compile/link time, code size, allocation/GC metrics, per-program milliseconds and `Node/aot-kit`
  ratio, normalized geometric aggregate, and all failures/timeouts/losses.
- Files: `tools/v8-compare.mjs`, raw JSON, generated Markdown, verification schema.
- Verify/falsify: recompute solely from raw JSON; `--verify` is write-free and `--update` explicit;
  delete the slowest sample, reverse a ratio, or mismatch hashes and require failure.
- Gate: `tools/gates/B24.sh`. Completion means all eight benchmarks have run and the repository
  contains the reproducible comparison against Node/V8.
