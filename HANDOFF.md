# Handoff: move JavaScript semantics into the DSL

## CATCHABLE EXCEPTIONS CROSS NATIVE FRAMES (2026-08-22, latest)

Catch-only `try` statements now lower to explicit exceptional graph edges on Linux x86-64. A
boxed pending exception lives in the runtime and is relocated as a GC root; generated calls query
that state before consuming their result, exceptional-only returns no longer contaminate the
callee's ordinary return ABI, and catch entry atomically takes and clears the value. Source throws,
nested catch/rethrow, a `%Throw` originating in a JSL definition, and a callback throw crossing a
JSL array operation all agree with Node through the native ELF harness. The same runtime-call
dependency convention is encoded on AArch64 so this work does not knowingly regress the existing
backend.

JavaScript meaning remains in `lib/**/*.jsl`: source `throw` invokes `ThrowValue`, and transitive
throwability is derived as a fixed point over the JSL call graph. The frontend owns only syntax,
scope, state snapshots and exceptional control transport. The DSL ownership gate still reports an
empty list of frontend-open-coded JavaScript operations.

This is a substantial Test262 foundation, not complete exception conformance. `finally` is still
refused because it requires completion records for return/throw/break/continue. The runner still
skips `assert.throws`; built-in Error constructor identities/prototypes are not implemented, so
enabling it now would either create honest failures or require weakening its constructor check.
A 40-file exploratory catch sample produced 5 native passes, 16 honest failures and 32 refusals;
the failures/refusals expose unrelated Annex B binding semantics, empty statements, `eval`,
`for-in`, and built-in Error names rather than platform or exception-transport failures.

Verification on Linux x86-64 with the freshly built Coil main compiler:

* `COIL_META_CACHE=0 coil test tests/native-execution-test.coil` — **32 passed, 0 failed**, including
  five exception transport witnesses.
* `COIL_META_CACHE=0 coil test tests/jsl-test.coil` — **38 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil` — **4 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**: the same
  seven named frontend refusals and 26-vs-25 semantic disagreement, with no infrastructure failure.
* `COIL_META_CACHE=0 coil test` — **433 passed, 0 failed**. The first run correctly caught the
  changed derived witness count; `docs/WHAT-WORKS.md` was regenerated before this green rerun.

## STRING SEARCH POSITIONS LIVE IN THE DSL (2026-08-21, latest)

`String.prototype.indexOf`, `includes`, `startsWith`, `endsWith`, and `lastIndexOf` now pass boxed
optional positions into `lib/string/*.jsl`. The DSL owns ToIntegerOrInfinity, clamping, negative and
infinite positions, the `endsWith` undefined-to-length default, and `lastIndexOf`'s distinct
NaN-to-+Infinity rule. `lastIndexOf`'s forward scan stops at the converted position, including for
an empty needle. The frontend now accepts the real optional arities, but only reports absence and
boxes representation; it does not interpret the values.

Complete reruns of all five upstream Test262 method directories produced **88 passed, 40 failed,
80 refused, and 43 skipped**, versus 48 passed, 34 failed, 126 refused, and 43 skipped before this
change. Forty refusals became native passes. Six refusals became honest failures: four
object-valued `lastIndexOf` positions expose the existing missing ToPrimitive/`valueOf` support,
and the large multi-assertion `indexOf/position-tointeger.js` now reaches graph construction but
exhausts the compiler's bounded allocator instead of stopping at its former encoder refusal.

The merged full-corpus artifact at `.amp/in/artifacts/test262-current.jsonl` now contains **2,591
passed, 8,596 failed, 48,074 refused, and 23,017 skipped** across the same 82,278 unique records.
This is an honest incremental rerun: unsupported object coercion and compiler scaling were not
special-cased into passes.

Verification on Linux x86-64:

* Coil main `bbac459` produced byte-identical stage-2/stage-3 x64 compilers. `.agents/setup` could
  not install it because Coil's own upstream x64 behavioral gate currently reports 53 passed and
  three build failures (`closure-lib.coil`, `defclosure.coil`, and `sums-deep.coil`). This
  repository's suites were run with that freshly built stage-2 compiler; the upstream Coil gate
  failure is not hidden or attributed to this repository.
* Complete upstream String `indexOf`, `includes`, `startsWith`, `endsWith`, and `lastIndexOf`
  directories — **88 passed, 40 failed, 80 refused, 43 skipped**.
* `COIL_META_CACHE=0 coil test tests/jsl-test.coil --no-fork` — **38 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil --no-fork` — **4 passed, 0 failed**,
  with no frontend-owned JavaScript operation.
* `COIL_META_CACHE=0 coil test tests/native-differential-test.coil --no-fork` — **1 passed, 0
  failed**, including the new optional-position probes against Node.
* `COIL_META_CACHE=0 coil test` — **428 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**: the same
  seven named frontend refusals and 26-vs-25 semantic disagreement, with no infrastructure
  failures.

## ARRAY SEARCH `fromIndex` AND `substr` COUNT LIVE IN THE DSL (2026-08-21, latest)

`Array.prototype.indexOf`, `includes`, and `lastIndexOf` now pass the boxed `fromIndex` value into
`lib/array/read.jsl`, where ToIntegerOrInfinity, negative-relative indexing, infinities, bounds,
empty-array coercion ordering, string value comparison, and SameValueZero are implemented. An
explicit `undefined` remains distinguishable from an omitted `lastIndexOf` argument. The frontend
only reports argument presence and builds the graph; it does not decide JavaScript meaning.

`String.prototype.substr` likewise passes its boxed count to `lib/string/substring.jsl`. Omitted
and explicitly `undefined` counts return the remainder, while other values use the existing DSL
conversion and clamp operations. The remaining surrogate-pair cases need proper UTF-16 code-unit
string representation and were not approximated in the frontend.

Complete upstream reruns of the three affected array-search directories plus the `substr`
directory improved the full-corpus baseline from 2,475 to **2,551 passed**. The merged incremental
artifact is `.amp/in/artifacts/test262-current.jsonl`, with **2,551 passed, 8,590 failed, 48,120
refused, and 23,017 skipped** across the same 82,278 unique path/variant records. This includes 72
array-search failures and four refusals becoming passes. Four formerly passing object-valued
`fromIndex` cases now fail honestly because evaluating the argument exposes the existing missing
ToPrimitive/`valueOf` support; their old passes resulted from ignoring `fromIndex` entirely.

Verification on Linux x86-64:

* Focused upstream empty-array coercion-ordering and `substr(..., undefined)` cases — **8 passed**.
* Complete affected array-search directories — **190 passed, 516 failed, 94 refused, 28 skipped**.
* Complete upstream `substr` directory — **10 passed, 2 failed, 8 refused, 5 skipped**; both
  failures are the known UTF-16 surrogate-pair boundary.
* `COIL_META_CACHE=0 coil test tests/jsl-test.coil --no-fork` — **38 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil --no-fork` — **4 passed, 0 failed**,
  with no frontend-owned JavaScript operation.
* `COIL_META_CACHE=0 coil test tests/native-differential-test.coil --no-fork` — **1 passed, 0
  failed**.
* `COIL_META_CACHE=0 coil test` — **428 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**: the same
  seven named frontend refusals and 26-vs-25 semantic disagreement, with no infrastructure
  failures.

## COMPLETE TEST262 CORPUS NOW HAS AN HONEST NATIVE BASELINE (2026-08-21, latest)

The runner can now attempt every actual test file in an upstream Test262 checkout with bounded
parallel native compilation, incremental JSONL results, and resume. It excludes `_FIXTURE.js`
module support files (which are inputs to tests, not tests themselves), accepts CR/CRLF metadata,
uses PID-specific object/executable paths, caches immutable C bridge objects by tracked-source
freshness, and cleans up after crashes and timeouts. On Linux each worker has a 30-second timeout
and a 2048 MiB address-space limit, so malformed generated programs are recorded instead of
exhausting the machine. None of these outcomes is turned into a pass.

The complete attempt used Test262 revision `3655e7464de3d52643ecddd4b5f9f4f3e7f62398` and selected
53,578 tests. Default/strict expansion plus one policy record for unsupported protocol tests
produced 82,278 unique results:

* **2,475 passed** through frontend, Machine IR, native x86-64 encoding, ELF linking, runtime, and
  execution.
* **8,656 failed**, led by 6,164 `jsl argument 0 is NO-NODE` graph corruptions, 1,724 runtime
  failures, 492 compiler `SIGSEGV`s, 104 declaration-initializer graph corruptions, 79 compiler
  `SIGABRT`s, and 65 timeouts.
* **48,130 refused** rather than approximated. The largest indexed reasons are frontend codes 1001
  (23,354) and 1003 (20,462), followed by unsupported bridge kinds and 1,615 pipeline refusals.
* **23,017 skipped** for explicit unimplemented Test262 protocol: 11,876 catchable-exception
  assertions, 5,523 async tests, 4,453 negative parse tests, 843 modules, 290 `$262` host-object
  tests, and 32 negative runtime tests.

The durable evidence is `.amp/in/artifacts/test262-full.jsonl` with aggregate totals in
`.amp/in/artifacts/test262-full.jsonl.summary.json`. All 82,278 `(path, variant)` keys are unique;
there are no fixture-file or metadata-parser failures. `docs/TEST262.md` documents range,
parallelism, timeout, memory-limit, result, and resume options. This is a full-corpus **attempt and
baseline**, not a conformance claim: exact top-level Script semantics, modules, async completion,
negative phases, fresh realms, `$262`, and catchable exceptions remain real implementation work.

No JavaScript operation was added to the runner, native harness, or frontend. These changes are
process isolation, object preparation, metadata, and reporting only; `lib/**/*.jsl` remains the
sole owner of JavaScript semantics.

Final Linux x86-64 verification:

* `npm run test262 -- --jobs 4 --test262 /tmp/test262 tests/test262/cases` from an empty native C
  object cache — **8 passed, 0 failed, 0 refused, 0 skipped**, with no leaked per-process files.
* The full incremental command — expected nonzero because unsupported and broken tests are not
  hidden — **2,475 passed, 8,656 failed, 48,130 refused, 23,017 skipped**.
* `COIL_META_CACHE=0 coil test tests/test262-harness-test.coil --no-fork` — **5 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil --no-fork` — **4 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test` — **428 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**: seven
  listed frontend refusals and the listed 26-vs-25 disagreement, with no platform, encoding,
  linking, or runtime infrastructure failure.

## ACTUAL TEST262 FILES RUN THROUGH THE NATIVE RUNNER (2026-08-21, latest)

The prior section's single Test262-shaped fixture was not an answer to “can this run Test262
tests?” A real command now reads upstream YAML frontmatter, expands requested includes, selects
default/strict variants, assembles the native entry, and reports PASS/FAIL/REFUSED/SKIP:

```
npm run test262 -- --test262 /path/to/test262 TEST_OR_DIRECTORY...
```

Four byte-for-byte upstream files from Test262 revision
`3655e7464de3d52643ecddd4b5f9f4f3e7f62398` are pinned under `tests/test262/cases/`: division,
modulus, and multiplication line-terminator tests plus the compare-array harness include test. Each
passes in both default and strict mode, so the focused command performs eight actual Test262
executions through native frontend, Machine IR,
x86-64 encoding, ELF publication/linking, runtime, and GC trampoline. The Coil gate independently
runs all four source files against Node.

The runner does not turn missing support into green. A frontend refusal makes the command fail;
module/async/negative variants are visibly skipped; a runtime throw/crash fails. It prints the
current function-body entry limitation before every run because exact top-level Script semantics
are not implemented yet. `docs/TEST262.md` records that boundary and the exact source provenance.
Try/catch now has a stable bridge kind and is rejected during indexing instead of aborting in graph
construction.

No JavaScript semantics were added to runner/frontend code. Metadata, include expansion, variant
selection, and process status are harness policy. Arithmetic and assertion value operations still
reach `lib/**/*.jsl`; the four DSL ownership invariants remain green and the exact open-coded
semantic debt remains empty.

Focused verification on Linux x86-64:

* `npm run test262 -- --test262 /tmp/test262 tests/test262/cases` — **8 passed, 0 failed, 0
  refused, 0 skipped**.
* `COIL_META_CACHE=0 coil test tests/test262-harness-test.coil --no-fork` — **5 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/dsl-ownership-test.coil --no-fork` — **4 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test tests/frontend-native-graph-test.coil --no-fork` — **4 passed, 0
  failed**.
* `COIL_META_CACHE=0 coil test` — **428 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**, with the
  same seven named frontend refusals and one 26-vs-25 semantic disagreement; no harness, platform,
  encoding, linking, or runtime infrastructure failure.

## TEST262 CORE HARNESS REACHES NATIVE X86-64 EXECUTION (2026-08-21, latest)

The first Test262 runner slice now assembles the exact upstream `sta.js`, a deliberately bounded
`assert.js`, and a fixture into the repository's `main(n)` entry ABI, then sends that source through
the real frontend, x86-64 encoder, ELF linker, GC trampoline, and process execution. The assertion
slice runs ordinary `assert`, exact SameValue behavior (including NaN and signed zero),
`assert.sameValue`, `assert.notSameValue`, global `compareArray`, and `assert.compareArray`.
Vendored harness files retain their Ecma copyright notices and the Test262 BSD license.

This exposed a real frontend collision: `object.name()` was rejected whenever an unrelated
top-level function declaration was also named `name`. Test262 defines both global `compareArray`
and `assert.compareArray`. Receiver validation no longer guesses a target from that spelling; the
graph builder continues to resolve indexed methods and otherwise performs the JavaScript property
load and dynamic call.

This is an honest synchronous-script foundation, not a claim that arbitrary Test262 tests run yet.
Frontmatter policy, requested includes, strict/module variants, negative parse/runtime phases,
async completion, fresh realms, and `$262` remain runner work. The upstream `assert.js` also uses
`try`/`catch` for diagnostic formatting and `assert.throws`; the bridge can identify TryStatement,
but the native frontend and runtime do not yet implement catchable exception transport. The local
assertion subset therefore omits `assert.throws` rather than reporting false conformance.

Verification on Linux x86-64:

* `COIL_META_CACHE=0 coil test tests/test262-harness-test.coil --no-fork` — **1 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test` — **423 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**, with the
  same seven listed frontend refusals and one 26-vs-25 semantic disagreement; no infrastructure
  failures.

## LINUX X86-64 RUNS THE COMPLETE NATIVE JAVASCRIPT HARNESS (2026-08-21, latest)

Linux x86-64 now owns a complete host-native path from the target-neutral Machine IR through
`src/backend_x64.coil`, ELF64 `ET_REL` publication in `src/backend_elf.coil`, the SysV runtime/GC
entry trampoline, native linking, and execution. It uses neither QEMU nor cross-AArch64 artifacts.
The earlier “first arithmetic slice” note below is retained as history and is superseded by this
section.

The x64 encoder now covers the machine operations exercised by the full JavaScript native harness:
integer and floating arithmetic/comparisons/conversions, NaN-box tests and box/unbox, loads/stores,
branches and edge copies, SysV frames/spills/callee saves, direct and polymorphic calls, runtime
string/array/property calls, and allocation. Direct calls are resolved in raw executable bytes and
also carry ELF RELA relocations. Runtime calls are undefined ELF symbols; polymorphic dispatch calls
are internal fixups and receive no external relocation. Unsupported instructions fail atomically
with an exact op/node/owner/instruction/location diagnostic.

Two ABI boundaries found by actual execution are worth preserving. Internal generated-code calls
have independent eight-GPR/eight-FPR argument lanes plus compact stack overflow, while C runtime
calls use SysV registers and preserve allocator-visible XMM callee colors. After `push rbp`, the
first incoming stack argument is at `frame + 16`, not the AArch64-derived `frame + 8`; the wrong
offset read the return address as JSON.stringify's ninth argument. Focused raw-byte tests now select
host-native bytes and portable mmap flags, while structural AArch64 encoder tests remain AArch64.

Verification on Linux x86-64:

* `COIL_META_CACHE=0 coil test tests/native-execution-test.coil` — **27 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test` — **422 passed, 0 failed**.
* `COIL_META_CACHE=0 coil test --suite frontier` — intentionally **0 passed, 8 failed**. Seven are
  the listed frontend refusals and `shortest-round-trip-digits.js` is the listed 26-vs-25 semantic
  disagreement; there are no xcrun, Mach-O, ELF, encoding, linking, runtime, or platform failures.

## LINUX X86-64 NOW HAS AN ELF64 RELOCATABLE-OBJECT PUBLISHER (2026-08-21, latest)

`src/backend_elf.coil` publishes the existing x86-64 Machine IR code as ELF64 `ET_REL`: `.text`,
local function and global `kernel`/`aot_text_start` symbols, `R_X86_64_PC32` RELA call fixups, the
unchanged `aot_stackmap` and `aot_layout` payloads, and a non-executable-stack note. It deliberately
reuses `backend_macho`'s metadata producers and pre-publication model verifier, so Linux does not
fork the GC/runtime contract. `native/gc/runtime.c` now selects ELF section-start symbols off Apple.

## LINUX NOW EXECUTES ITS FIRST REAL X86-64 JAVASCRIPT ARTIFACT (2026-08-21, latest)

The Linux path is native x86-64, with no QEMU and no cross-architecture execution. The new
`src/backend_x64.coil` maps the allocator's first integer colors onto the SysV AMD64 argument and
caller-saved registers and encodes moves, 64-bit immediates, add/subtract/multiply/negate, and
return. Unsupported machine operations fail with `BER-ENCODING`; they are not silently omitted.
`tests/frontend-native-graph-test.coil` now compiles
`function main(n) { return n * 3 + 7; }`, maps the emitted x86-64 bytes executable, calls them in
process with the host C ABI, and observes 22 for 5 and 4 for -1. The same test retains the existing
AArch64 encoder on non-x86-64 hosts. The focused suite is 3/3 green on this Linux orb.

This is the first host-native encoder slice, not yet the full Test262 harness. The linked harness
still needs the remaining machine operations, SysV spill/callee-save/call lowering, an ELF64
relocatable-object writer, and an x86-64 GC entry/stack-map contract. Those are the next platform
milestones; claiming the Mach-O/AArch64 harness works on Linux before they exist would be false.

## FRESH AMP ORBS INSTALL THE COMPLETE TOOLCHAIN (2026-08-21, latest)

`.agents/setup` now installs the Debian prerequisites, Go 1.25.14, the current Coil `main`
compiler and standard library, npm dependencies, and the pinned `typescript-go` C archive. The
Coil install is accepted only after its upstream no-LLVM bootstrap reaches a byte-identical
stage-2/stage-3 fixpoint and passes the x64 behavioral gate. A commit marker skips that
three-stage bootstrap on a warm snapshot while still fetching `main`; the measured cold setup was
5m12s and the second run was 2.73s. `.agents/resume` performs only the fast tool availability check
and completed in under 0.01s. A clean non-interactive login shell resolved `coil` and `go` from
`~/.local/bin` and Node from the orb toolchain.

The TypeScript-Go bridge now force-links portably from its ordinary static archive. Apple embeds
its framework linker options in the archive member that needs them; Linux receives no Darwin
flags. `native/platform_compat.c` supplies the non-Apple instruction-cache symbol and host mmap
flags. This removes the old pre-test Linux linker boundary; product execution now reaches the
host-native backend boundary described above.

## SIX MORE DEFECTS, A HARNESS THAT STOPPED CALLING A SEGFAULT "0", AND A FRONTIER THAT RUNS (2026-08-19, latest)

`coil test` is **417 passing, 0 failing**. Each fix falsifies on its own; each is pinned by a case
in `tests/native-execution-test.coil`, which is now 27 deftests. **The frontier list this session
opened is empty again**: both items on it were fixed, and (6) turned out not to be about callbacks
or nesting at all. The frontier that REMAINS is eight genuinely failing tests -- see (7).

### 0. A CRASHED PROGRAM WAS REPORTED AS THE ANSWER 0, and it hid the two worst bugs below

`nh-shell-integer` read the child's first output line with `fgets` and handed it to `atoll`. A
segfaulting program prints nothing, `atoll("")` is 0 -- so every probe whose expected answer
happened to be 0 PASSED on a program that never ran, and every other probe reported `ours=0`, which
reads as a wrong computation and sends the search after the arithmetic. `pclose` returns the wait
status and the driver returns 0 on every path it completes; anything else is now refused by name.
**Both remaining bugs on the old frontier list turned out to be crashes, not wrong answers.**

### 1. A loop whose body always returns did not compile

`while (i < 2) { return x; }` fails `g-verify` with `VERR-IN-PROGRESS`, and so do the `for`,
`do`/`while` and `for ... of` forms. `fng-loop` writes the Loop's back edge from the control the
body fell out with, and a body that never falls out left `NO-NODE` there -- which is exactly what
`n-in-progress?` tests. The back edge is not MISSING, it is UNREACHABLE, and the graph has a node
that says so: `XCtrl`. `loop-compute` reads slot 1 alone, so the loop stays as reachable as its
entry, and the carried phis meet a proven-dead path.

### 2. Dropping a region path skipped a phi, leaving a 3-input Phi on a 2-input Region

Fixing (1) made a loop back edge PROVABLY dead for the first time, which reached
`region-remove-path!` -- and it walked the region's out list once, forward, while `n-del-use!` is a
SWAP remove. Dropping a loop's back-edge arm routinely vacates an entry: a memory phi's back edge
is a store chain whose own memory input is that phi, so releasing the arm kills the chain, the
chain releases the phi, and the phi releases the region. The last entry lands in the vacated slot
and a single forward pass never looks at it again. It surfaced as `phi-compute` reading the region
past its end -- "n-in: input index out of range" -- from `for (let i = 0; i < 2; i++) { return x; }`.
Both that scan and `region-reduce-phis!` now restart after every removal.

### 3. A closure that captures the ENTRY function's parameter dereferenced the raw argument

`fng-compile-function!` materializes a heap CELL for every parameter a nested closure captures --
behind `(if top-level 0 ...)`, and the entry function is compiled top-level. Its parameters stayed
bare `Arg` nodes, `fng-closure-expression` stored the RAW ARGUMENT into an environment slot typed
as a cell pointer, and the callee read that slot with a `Cast` plus a `Load`.
`function main(n) { let f = () => n; return f() | 0; }` dereferenced the integer 5. **SIGSEGV**, and
before fix (0) it was reported as the answer 0.

### 4. A callback could not see -- or be seen by -- the caller's cells and closure environments

`jl-mem` is the JavaScript PROPERTY heap, the one state a `.jsl` definition can name, and it was
the only memory edge a callback `Call` carried. A callback runs USER code, which reaches a captured
variable's CELL and a closure ENVIRONMENT's fields, each on its own alias. Nothing tied those to
the call, so the caller's stores into them had no consumer and were deleted as dead. One hole, two
ends:

```js
let b = 2; [3, 4].map(v => (v + b) | 0)          // the env slot was never written; the callee
                                                  // dereferenced it -- SIGSEGV
let acc = 0; [3, 4].forEach(v => { acc += v; })  // the cell store died the same way, and the read
                                                  // after the loop saw the initial value
```

`jsl-decl-calls-back?` (new, `src/jsl.coil`) is a fixpoint over the call graph in the shape of
`jsl-decl-uses-memory?`; `fng-callback-outer-memory` builds the merge; `jl-call-mem` names it on the
`Call`. Three things had to be exactly right, and each was found by a program that stopped
compiling:

- **The property heap is EXCLUDED from the outer merge.** `jl-call-mem` merges it with the
  definition's own `jl-mem`, so including it twice puts two states on ONE alias inside one
  `MemMerge`. That is ambiguous by construction -- `fng-alias-leaf` takes whichever it finds first
  -- and selection refused `[1, 2, 3].flatMap(x => x)` on the result array's `ArrayMark`.
- **It is merged AT THE CALL, not at the `fng-jsl-call` seam.** Merging it into the memory handed
  IN is tidier and makes it the entry arm of the definition's loop memory phi; `ArrayFilter`'s
  resize-before-and-after-the-loop shape then fails placement, and
  `[1, 2, 3, 4].filter(v => v > lo)` -- which compiles and answers correctly -- stopped compiling.
- **On the way back the property heap is the exception in the OTHER direction.** It is taken from
  the body, because `ArrayMap` builds its result array through that chain; re-anchoring it too left
  those stores with no consumer and deleted every element the map had written. Every OTHER alias
  re-anchors at the CallEnd, exactly as an ordinary JavaScript call does.

### 5. A memory state belongs to ONE function, and the block query is not what says so

`ms-node-block` answers "this owner's entry block" for any node with NO control input, and a memory
node usually has none -- slot 0 of `Store`/`Load`/`MemMerge` is a control anchor that is null in
practice. That is a sensible PLACEMENT default and a useless OWNERSHIP test, and
`ms-preselect-function!`'s dynamic-effect sweep was using it as one: it walks EVERY node in the
graph, so a store belonging to `main` answered "entry block of owner 1" and a JSL builtin adopted
it. Selecting it there walked into a memory `Phi` on one of `main`'s loops, which
`ms-preallocate-phis!` marks seen for `main` and not for that owner, and the whole program was
refused with `MSEL-UNSUPPORTED`.

`forEach` and `flatMap` in ONE function was the witness, and only once (4) existed to reach that
phi. `ms-memory-chain-owner` (new) asks the chain instead: a `Phi`'s region, an `Arg`'s anchor and
any pinned effect's control all map to a block, and a block names its function. Nothing else moved
-- a chain that names no function still falls back to the block query, exactly as before.

### 6. `xs: number[]` was not an array, and the bridge had no kind for it

The TypeScript bridge maps `ast.Kind*` to its own numbers and simply had **no case for
`KindArrayType`**, so an array TYPE annotation arrived as kind 0 and `fng-type-tag` answered
`FNG-DYNAMIC`. Everything that decides "is this an array" asks `fng-infer`, which asks that -- so
`xs.push(9)` on an array-typed PARAMETER was not an array method at all. It took the generic path,
loaded `push` out of the runtime property table, found nothing, and dispatched `undefined`: `brk`
on the callee tag test. Every method, and a function declared to RETURN `number[]` the same way.

**This is what "a callback created inside a non-top-level function traps in dispatch" actually
was.** A callback is only ever written on a method, and the array in `main` is usually a literal,
so the frontier entry named the two things that happened to be true of the repro. `xs.push(9)` with
no callback and no nesting fails identically. `fng-number-array-symbol?` has been reading the type
node's TEXT for a trailing `"[]"` since before this kind existed; that is what it was working
around.

Two places had to name `FNG-ARRAY` where they had been reading `FNG-DYNAMIC` by accident: an
array-typed FIELD must keep a tagged slot (a raw one holds a pointer the GC scan skips), and an
array ARGUMENT must still be boxed (a `Parm` is a tagged JavaScript value). The Go bridge is
rebuilt with `tools/build-typescript-go-bridge.sh`.

### 7. And the practice that let two fixed bugs stay filed as open

`repros/open/` is a directory of known bugs, one hand-written `.js` file each, and **nothing ran
it**: `tools/js-repro` was deleted with the interpreter and the paragraphs stayed. By the time
anyone looked, two of the four were fixed and still filed, one of them by a change made hours
earlier in this same session.

**The bugs are real failing tests now.** `tests/frontier/open-bugs-frontier.coil` has one deftest
per open bug, each asserting the CORRECT answer, so all eight are RED:

```
coil test --suite frontier        # 0 passed; 8 failed, and that is the honest number
```

The first draft of this was an expected-failure suite -- assert each bug is still BROKEN, keep the
gate green. That is the standard pattern and it is wrong here for one specific reason: fixing a bug
would turn a GREEN thing RED, and the remedy would be to go edit a test. That teaches "red means go
edit the bug list". These go the other way: fix the bug, the test goes green, and it stays as the
regression test it already was. Nothing is promoted and nothing is deleted.

It is `default = false` in `Coil.toml`, because a permanently red `coil test` stops answering the
question the everyday gate exists for -- did MY change break something. **That is the only reason,
and it is the one thing about this design that could let the frontier drift out of sight, so
`AGENTS.md` makes running it a standing order and the gate prints the count on every run:**

```
=== THE FRONTIER: 8 OPEN BUGS ===
  coil test --suite frontier   -- eight failing tests, and they are the work queue.
```

What watches the corpus on every gate is `tests/native-frontier-test.coil`, which is green and does
two things:

- derives each bug's status through the real pipeline and compares `docs/NATIVE-FRONTIER.md` byte
  for byte, so a bug that is fixed, that regresses, or that merely changes HOW it is broken turns
  the gate red with a diff naming the file;
- refuses to pass if `repros/open/` and the failing suite disagree in either direction -- a bug
  with no test, or a test whose repro was deleted. All four behaviours are falsified by hand.

Making the corpus runnable at all needed two changes. `nh-shell-integer` split into a fatal form
and a reporting one (`nh-status`), because the execution suite wants to die on a crash and this one
wants to record it. And `for (const k in o)` and `for await` got real bridge codes: they returned
kind 0 -- the bridge's "no code for this", shared with every syntax it has not been taught -- whose
frontend catch-all is an `abort`, and an abort cannot be observed without forking, which deadlocks
on the live Go runtime (`tests/native-capability-test.coil` records that attempt). With real codes
they refuse at indexing, recoverably, and the diagnostic names the construct.

### The shape all six had in common

Five of the six are one side of a boundary disagreeing with the other while each side is
internally consistent -- verifier versus builder, selection versus scheduling, caller versus
callee, one owner's blocks versus another's, the bridge's kind table versus the frontend's type
tags. The sixth, (0), is the reason the others took as long as they did: a measurement that reports
a crash as a number makes every one of those look like arithmetic.

## THE EVALUATOR IS DELETED, AND WITH IT EVERY JAVASCRIPT-SEMANTICS GATE

2026-08-18, owner's decision, executed in full: `src/eval.coil` (4,373 lines), `src/jsarray.coil`,
`src/jsobject.coil`, `src/js_probes.coil`, the evaluator's half of `src/jsstring.coil` (493 -> 170
lines, now only the compiler's string-CONSTANT table), `tools/js-repro`, `tools/js-sweep`, and
every test that ran a program through the interpreter. **8,700 lines.**

The argument, which is correct: this is an ahead-of-time compiler, the interpreter shipped
nothing, no `src/` module ever imported it, and it was one of the two hand-written copies of every
primitive that `docs/DEMOLITION.md` exists to delete. Removing it halves that duplication in one
move — every primitive now has exactly ONE implementation, the C case in `native/gc/runtime.c`,
with `lib/` owning everything composed above it.

**WHAT THIS COSTS, STATED PLAINLY SO NOBODY DISCOVERS IT BY SHIPPING A BUG.** `coil test` is 568
-> **390 passing, 0 failing**, and what was lost is the entire ability to check that a JavaScript
program computes the right answer:

- the differential against node (`js-source-prop`, 23 tests) — gone
- the fuzz property that generated programs and compared them with node — gone
- the 48-repro sweep (`tools/js-repro`) — gone
- the DSL's own execution tests (`jsl-test` kept 38 of 67; the 29 that RAN a definition are gone)
- memory-SSA semantics (`mem-test` kept 6 of 30), the b06-b14 ideal suites, `jsstring-test`

What survives is real but narrow: the compiler's structure (types, verifier, graph text round-trip,
selection, scheduling, register allocation) and roughly 70 assertions that execute machine code
for arithmetic, control flow, calls and object memory. **A green tree no longer means the compiler
is correct.** It means it is internally consistent.

## THE GATE IS BACK, AND IT RUNS MACHINE CODE (2026-08-19)

`tests/native-execution-test.coil` — eleven tests now. It takes TypeScript source, runs it through the
frontend and the whole backend, writes a Mach-O object, links it with `xcrun clang` against
`native/gc/runtime.c` and `trampoline.S`, executes the binary, and compares its answer with node's
for the same source text. **It is the only test in this repo that runs the artifact we ship.**

It needed no new machinery. The three legs already existed and had never been joined:
`frontend-native-graph-test`'s `fe-native-new`/`frontend-native-build!`, `linked-object-test`'s
`fopen` + `popen` + clang, and a `popen` of `node -e`. The Phase A sketch in an earlier version of
this file (mmap the code and hand-patch `BL` relocations through thunks) was unnecessary — the
system linker resolves them.

**Falsified before trusted**: change `(%Lt u 65)` to `(%Lt u 66)` in `lib/string/case.jsl` and
`string_case_is_a_dsl_loop_and_it_runs_on_the_cpu` fails while the arithmetic case still passes.

Strike 1 is now verified end to end: `"AbZ@[a".toLowerCase()` has no implementation in the compiler
and none in C, so the answer can only come from `lib/string/case.jsl` over the two atoms. The
emitted object's only undefined symbol is `_aot_js_string`.

## `for ... of` LOWERS, AND FOUR COMPILER DEFECTS FELL OUT OF MAKING IT RUN (2026-08-19)

`coil test` is **414 passing, 0 failing**. The feature is four small pieces; the four bugs are the
session, and **not one of them needs `for ... of` to reproduce.** Each was found by compiling a
program, running it, and comparing with node.

### The feature

ECMAScript's own desugaring, not an index loop written in the frontend:

    GetIterator(xs)                 once, before the Loop
    ArrayIteratorNext(it)           at the loop header
    IteratorComplete(result)        the If -- so the BODY is the FALSE arm, the mirror of every
                                    other loop here
    IteratorValue(result)           bound to the loop variable inside the body arm

All four are in `lib/array/iterator.jsl`, over the `ArrayValues`/`ArrayIteratorNext` that
`xs.values()` already used. **The iterator is why this needs no synthetic counter**: a loop-carried
value in this builder is a phi over a SYMBOL, `fng-assigned!` derives the carried set from the
source, and there is no symbol for a counter the source never wrote. The iterator keeps its index in
an internal slot, so the state crosses the back edge through the memory phis `fng-loop` already
builds for every loop. `fng-loop` gained two parameters rather than a 140-line copy.

The bridge maps `KindForOfStatement` to kind 250 (250 was the one number free between `TSK-FOR` and
`TSK-LABELED`) and answers kind 0 -- "no code for this", which the frontend refuses by name -- for
`for await`, whose protocol is a different lowering. `fe-for-of-binding-valid?` refuses an
assignment target and a destructuring pattern for the same reason: both would otherwise reach the
graph builder as a declaration list it would read the wrong child of. `fe-resolve-node!` gained a
case so the ITERABLE resolves in the enclosing scope and the binding is popped at the loop's end;
the default child walk did neither.

`GetIterator` throws a TypeError for a non-array, because there are no Symbols here and so no
@@iterator to look up. It THROWS rather than iterating zero times: `for (const c of "abc")` is a
real program this cannot run yet, and an empty body would look like a correct answer.

### The four defects

1. **A dynamic key read is a JavaScript value** (`be-js-dynamic-boundary?`). It kept a second,
   shorter list of "which ops produce a tagged word" beside `n-rep-of`, and `PropLoadKey` was in one
   and not the other. So an `If` on `o[k]` tested the RAW word, and a tagged `false` is a non-zero
   bit pattern: `o[k] ? 100 : 200` answered 100 while `String(o[k])` printed "false" and `o.a` was
   right. The predicate asks `n-rep-of` first now; the hand-written list survives only for the ops
   it leaves UNKNOWN, whose representation is not structural (a `Call`, an open `Phi`).
2. **An operation that ends the process may not be hoisted** (`ms-anchored-memory-op?`). `JsThrow`
   lowers to a runtime call that never returns, and its only consumer is the Phi joining its arm
   with the other one -- so nothing kept it inside its guard and `ms-gcm-place!` moved it to the
   shallowest block between its inputs and that Phi. A `for ... of` inside another loop therefore
   aborted with "uncaught JavaScript throw" before the first iteration. **The version whose outer
   loop ran ZERO times aborted too**, and that is what said the throw was unguarded rather than
   mis-answered; the disassembly then showed the call in the entry block's straight line with the
   `cbz` that should have skipped it two thousand instructions later, reading the already-thrown
   result out of its stack slot.
3. **One backward pass is not a fixpoint** (`ms-gcm-place!`). Placement walks instructions last to
   first, so a value's uses are normally settled before the value -- but the deferred phi boxes
   `fng-distribute-deferred-phi-boxes!` creates are NEW instructions consumed by OLD ones, so a use
   sits at a lower index and moves after the def has already read its block. `ms-gcm-placement-valid?`
   recomputes the latest use and refused with MSEL-PLACEMENT: latest 6 at placement, 4 at
   verification. It repeats until nothing moves, bounded at 8 rounds.
4. **An allocation and a field store must not erase the runtime property heap** (`fng-object`,
   `fng-lvalue-write`). Both rebuilt the memory merge from the declared FIELD aliases alone, so the
   dynamic aliases fell out of it -- and `fng-current-memory` answers a missing alias by
   MANUFACTURING A FRESH `Arg`, which starts that alias's store chain over from nothing. An array
   literal therefore kept only its LAST element store whenever an element expression touched another
   alias. **This is the one to remember**: `let xs = [{v: 1}, {v: 2}]` had a hole at index 0 and
   nothing anywhere said so, and `[(o.v = 1, 5), (o.v = 2, 6)]` is the same bug with no objects in
   the array at all. `fng-lvalue-write` now calls `fng-preserve-active-memory`, which is the third
   place that merge was written by hand and the only one that was right.

Also pinned, and also not for-of: `Load` for a static shape slot is anchored to its control now
(`n-load-at!`). Unanchored, GCM hoisted `o.v` out of the loop while the `Unbox` producing its
pointer stayed inside -- a dependency `ms-gcm-place!` refuses.

Six new cases in `tests/native-execution-test.coil` (22 there now), and **all four fixes falsify
independently** -- each was reverted with the others in place and exactly the expected pins failed:

| revert | fails |
|---|---|
| `JsThrow` out of `ms-anchored-memory-op?` | `for_of_inside_another_loop`, `for_of_break_and_continue` |
| `be-js-dynamic-boundary?` back to the op list alone | six, including `a_dynamic_key_read_is_a_javascript_value` |
| the dynamic-alias loop in `fng-object` | `an_element_expression_that_writes_memory_keeps_the_array` |
| the GCM round bound from 8 to 1 | `for_of_break_and_continue` |

The two that need no `for ... of` are pinned in their own non-for-of shapes, so deleting for-of
would not take them with it.

## SEVEN MORE FIXES, ALL FOUND BY RUNNING PROGRAMS (2026-08-19, later still)

`coil test` is **407 passing, 0 failing**. `docs/NATIVE-DIFFERENTIAL.md` is **49 of 53 agreeing with
node**, up from 45. Every fix below was found by compiling a program, running it, and comparing --
not one of them by reading code.

### The theme, again, in a new direction

Last session's was "a type is not a representation". This session's is its converse: **a type that is
NARROWER must not lose a capability the wider one had.** Four of the seven are that sentence.

1. **An array returned from a function was not an array** (`be-array-value?`). A `Call` has lattice
   type `dyn` and the `Cast` the frontend puts on its result carries the declared `obj`, so
   `(x) => [x, x]` handed back a value every runtime tag test called an ordinary object:
   `r instanceof Array` false, `String(r)` "[object Object]". It now follows the bounded call graph
   the way `be-function-return-kind-fuel` does. **It had been blocking a correct definition**:
   `Array.prototype.flatMap` is FlattenIntoArray with depth 1 -- spread a mapped element that is an
   array, append one that is not -- and written that way it asks `%IsArray` about the callback's
   result, so it could not be written at all while the answer was wrong. The definition it replaced
   unboxed every mapped value as an object and read its length, which is right for `x => [x, x]` and
   produces the EMPTY array for `x => x`.
2. **A declared `:ret` is a representation contract** (`jl-builtin-call`), the other half of the
   parameter rule that landed earlier. A `Call` computes `dyn` whatever its callee returns, so a
   `lib/` definition declared `:ret int` -- a RAW machine integer -- read as tagged everywhere
   downstream, and two consumers disagreed about one word:
   `"abcdef".lastIndexOf("c")` returned 2 correctly and `lastIndexOf("c") | 0` answered 0.
3. **A value spanning representation classes is not a raw scalar** (`ml-kind-for-type`). It asked
   about `VK-OBJ` alone, so `num|str` -- what `x + 1` on an `any` parameter produces -- was a raw
   SCALAR. The function then had no single return tag and **`String(f(1))` failed selection
   outright**. `undefined|number`, which is every `at` and `codePointAt`, was classified the same
   wrong way.
4. **A string-position argument is ToString of what was passed** (`fng-string-argument`). The
   expression went through untouched, so `"abcdef".localeCompare(1)` handed a raw machine integer to
   `%StringCompare` and `[1,2,3].join(1)` used one as a separator.
5. **A conditional expression must box its arms.** `n > 0 ? "yes" : 5` merged a raw string pointer
   with a raw integer into one Phi. `String(v)` gave the runtime's tag dispatch an untagged `5` and
   printed "2.4703282292062327e-323" -- the double whose bit pattern is 5, twenty-three characters
   where node prints one. `??` boxed its arms already; the ternary did not.
6. **`s[i]` on a string is not an array load.** It took the ordinary element path, so `GetElement`
   ran `%ArrayLoad` over a string pointer and EVERY index answered `undefined`. Three things had to
   change together and each was wrong alone: `StringElement` in `lib/` (which is neither `charAt`
   -- empty string out of range -- nor `at` -- negative indices count from the end); the verifier,
   which accepted only an object, function or undefined RECEIVER and so refused
   `s[i].charCodeAt(0)` outright while the same call on a `dyn` receiver had always been fine; and
   `fng-infer`, which called `s[i]` dynamic, so the method dispatched generically and answered 0.
7. **A method callee is a property read like any other** (`fng-call`). It went straight to
   `GetNamedProperty` -- the runtime property table -- while an object LITERAL stores its properties
   into static shape slots, so the load never saw the store. It now uses `fng-field-load-value`, the
   same function an ordinary `o.get` read uses, which picks the slot when the field is statically
   known and the table when it is not. **This did not fix the program it was found by**; see below.

Each is pinned in `tests/native-execution-test.coil`, which is 15 tests now, and every pin carries
BOTH shapes where two shapes fail in opposite directions -- `flatMap(x => x)` beside
`flatMap(x => [x, x])`, `lastIndexOf("c")` beside `lastIndexOf("c") | 0`. One of a pair passing
proves nothing about the other; that is how the `flatMap` definition got written wrong twice.

### FIXED, AND IT WAS THE BIGGEST: A FUNCTION FROM THE HEAP CAN BE CALLED

Every object method in the language used to return nothing. **Two independent bugs, and the first
hid the second completely.** The disassembly is what found both; no amount of reading the selector
would have, because the selector was marking these calls polymorphic correctly and the ENCODER
disagreed with it.

**ONE — a sign-bit collision in the call encoding.** A polymorphic call is encoded in `MInst.imm` as
the COMPLEMENT of its target set, and `be-poly-call?` recovers which kind of call it is from the
SIGN: negative is a dispatch, non-negative names an owner to call directly. That is injective for
every 63-bit set and it collides for exactly one input. An unconstrained `fun` type carries `fidxs`
of -1, its complement is 0, and 0 is "direct call to owner 0" -- which is always the entry function.
A callable loaded from the heap has precisely that type, because closed-world inference does not
follow a function through a store. So every such call compiled to `bl _kernel` and branched into
`main`. `be-call-target-summary` maps the unconstrained set to 0, "no summary, dispatch over every
function" -- a value the dispatcher already understood -- and emission and `ms-call-target-valid?`
now read it from one function so they cannot drift.

**TWO — a generic call's ABI is all tagged.** With the dispatch reaching the right function,
arguments arrived as 0. The callee is unknown and every JavaScript function's parameters are `dyn`,
but the unknown-callee path passed the raw expression: `o.add(4)` emitted `mov x2, #4`, and the
callee tag-tested x2, found no tag, and answered nothing. **The receiver survived**, because it is
boxed on its own path -- which is exactly why `this.v` worked while `k` did not, and why fixing only
the dispatch looked like most of a fix.

Pinned as `a_function_from_the_heap_can_be_called_on_the_cpu`: thirteen shapes including `this`,
arguments alongside `this`, two-argument methods, two methods on one object, a callback stored into
a dynamic property, a method returning an object, a nested `o.inner.get()`, and an array of
functions called in a loop. Both fixes falsify independently.

A third, smaller one landed with them: **a method callee is a property read like any other**. It
went straight to `GetNamedProperty` -- the runtime property table -- while an object LITERAL stores
into static shape slots, so the load never saw the store. It now uses `fng-field-load-value`, the
same function an ordinary `o.get` read uses.

### The shape of what these three had in common

Every one was a place where two sides of a boundary disagreed about a representation, and BOTH sides
were individually self-consistent: selector versus encoder, caller versus callee ABI, store path
versus load path. None of them is findable by reading one side. That is the argument for the
execution suite over the structural one, and it is why the remaining sections of this file describe
witnesses rather than theories.

### PREVIOUSLY OPEN, NOW FIXED -- kept for the narrowing method

The narrowing that got there, recorded because the method transfers:

```js
function main(n: number): number { let o = {get: () => 7}; return (n + o.get()) | 0; }
function main(n: number): number { let o = {v: 3, get: function() { return this.v; }};
  return (n + o.get()) | 0; }
function main(n: number): number { let a: any[] = [function() { return 42; }];
  return (n + a[0]()) | 0; }
```

All three answered 0. What narrowing established, before the disassembly settled it:

- **The stored value is correctly tagged.** `typeof o.f` is "function" and `typeof a[0]` is
  "function". So the `Box`, the `Store` and the load are all fine.
- **Direct calls work.** `let f = function() { return 7; }; f()` is right, and so is passing a
  function as an ARGUMENT and calling the parameter -- both resolve to a target and never dispatch.
- **It is the POLYMORPHIC dispatch path** (`be-poly-call-*` in `backend_aarch64.coil`). A receiver
  call is `CALL-ABI-DYNAMIC-RECEIVER`, which is polymorphic unconditionally, and `a[0]()` has no
  static target either.
- **The call HAPPENS.** No target match would `brk` -- the dispatcher emits `cbnz x13, +2; brk` --
  and the program does not trap. So a target was selected and called, and the RESULT is wrong:
  `String(r)` of the returned value is the EMPTY string, not "42" and not "0". That points at the
  return-tag fixup after the `blr` (`be-poly-return-code` and the `csel` chain that ORs the tag
  back on), not at the dispatch itself.

Nothing in either derived report exercises this, because both sweep METHODS on built-in receivers.
The last bullet was WRONG, and instructively so: "the call happens, so it is the return-tag fixup"
assumed the `bl` it saw was the dispatch. It was not a dispatch at all -- it was a direct branch to
`main`, and there was no `blr` anywhere in the function. Four correct deductions and one wrong
inference from an absence; the disassembly cost less than the reasoning did.

### The frontier that is refused rather than wrong

**THIS LIST IS NOW EIGHT FAILING TESTS.** `coil test --suite frontier` runs one per bug, each
asserting the answer node gives, all red. `docs/NATIVE-FRONTIER.md` is the derived status table and
`repros/open/` is the corpus both are built from. Two entries had already been FIXED and were still
filed as open when this was written -- a `forEach` callback mutating an enclosing local, repaired
hours earlier the same day, and `String(1e21)`'s exponential switch. Both are pinned in
`tests/native-execution-test.coil` now.

What remains open, as of the last regeneration -- but read the report, not this paragraph:

- `for (const k in o)` and `for await`, both refused by name at indexing. They used to abort on
  "bridge kind 0", the bridge's code for every syntax it has not been taught; giving each a real
  code is what made the refusal recoverable and therefore testable.
- `for (x of xs)` writing an existing binding, and `for (const [a, b] of xs)`.
- **Shorthand methods** (`{ get() { ... } }`) are refused during indexing.
- **A closure capturing a loop variable** does not compile.
- **Rest parameters** are refused rather than bound to nothing.
- **`String(1/3)`** is 19 characters against node's 18 -- the shortest-round-trip digit generator
  the `%.17g` path is not. `String(1e21)` was the other half of that repro and now agrees.

### What the derived report still records as disagreeing

`sort(x => x)` is a probe artifact and may never be fixable: the comparator is inconsistent, so
node's resulting order is unspecified. `sort((a, b) => a - b)`, `sort((a, b) => b - a)` and `sort()`
all agree with node and are pinned. `keys`/`values`/`entries` return iterators, which stringify as
"[object Array Iterator]"; there is no iterator object here to give that name.

## LOOPS COMPILE, AND EVERY METHOD IS NOW RUN AGAINST NODE (2026-08-19, later)

`coil test` is **403 passing, 0 failing**. Three things landed, in this order, and the third is only
possible because of the first two.

### 1. `String(anArray)` -- the last 11 cells, and the report is 216/216

`String([1, 2, 3])` is `"1,2,3"` through `Array.prototype.toString`, and nothing implemented it: the
runtime's ToString is a tag dispatch that answers `"[object Object]"` for every tagged object, which
is right for an object and unfixable inside the primitive for an array, because the array case reads
the ELEMENTS. So `ToStringValue` in `lib/abstract/coercions.jsl` asks `%IsArray` and hands that case
to `ArrayToStringValue`.

Four compiler changes were needed to make that definition compile at all, and each is a rule:

- **`%IsArray` folds in ONE direction** (`arraytest-compute`). A value whose kinds exclude `VK-OBJ`
  cannot be an array, so the test is a constant `false` -- which is what makes the array dispatch
  free at the overwhelming majority of `ToStringValue`'s call sites. The other direction is NOT
  available: the lattice has no bit separating an array from a plain object, so "is an array" stays
  a structural question.
- **`ToString` of a RAW OBJECT POINTER** (`backend_select`). An object arrives as a bare pointer and
  the runtime dispatches on a tag, so it is tagged at the selection site with the same tag
  `be-js-tag-for-value` derives for a `Box`. **`-1` is the failure sentinel and a tag is not a small
  number** -- `JSV-ARRAY` is a negative 64-bit pattern, so `(< tag 0)` rejects every object tag there
  is. That mistake cost an hour, twice.
- **A function nothing calls is not part of this program** (`g-kill-uncalled-functions!`, new).
  `mu-build-program!` builds EVERY live `Fun` -- deliberately, because a callable whose identity
  escapes as a value has no direct call edge -- so an uncalled function was selected, scheduled,
  allocated and EMITTED. It became reachable the day a `lib/` macro first named a `builtin`:
  `ToStringValue` is inlined into `JsAdd`, so `n + 1` pulled the join builtin's `Fun` into its graph,
  the `ArrayTest` folded to false, the `Call` died with the arm, and the FUNCTION remained. The pass
  keeps whatever is reachable from `Start`/`Stop` -- which is the right question, because a function
  stored in a field or merged in a `Phi` is reachable through that value -- and unpins the `Parm`s
  before killing, since a `Parm` is pinned for life by `jl-bind!`.
- **Recursion in `lib/` is a `builtin`, never a macro.** `ArrayToStringValue` reaches itself:
  `String([1, [2, 3]])` is `"1,2,3"`, because converting an element that is an array joins it again.
  A macro cannot -- `jsl-check-macro-cycles` refuses it by name -- and a builtin is a call, which
  terminates. It carries a **cycle stack**, pushed and popped, so `let a = [1]; a.push(a);
  String(a)` is `","` as node says rather than an infinite recursion, and `String([b, b])` for one
  array `b` is still `"1,1"` -- an append-only visited list gets the second case wrong.

`docs/NATIVE-CAPABILITY.md` is now **216 of 216 cells compiling, 0 selection failures, 0 verifier
rejections.**

### 2. NOT ONE JAVASCRIPT LOOP COMPILED, and nothing in the repo said so

`for`, `while`, `do`, nested, empty -- every one failed selection with `BER-UNSUPPORTED-OPCODE op
Phi`. It was invisible because every probe in the derived report is straight-line and every
execution case was written by hand. **Two computes disagreeing about what ANY means:**

- **`n-ty-settled?` conflated "at a fixpoint AT ANY" with "not analysed yet".** A value inside a
  proven-dead region computes ANY for ever -- no path reaches it, so it has no value -- so every
  input cone containing one was "unsettled", so `n-in-proven-xctrl?` never proved anything, so the
  dead region was never dropped, and the live `Phi` merging it kept an ANY arm selection has no rule
  for. Loops are where that shape occurs, because a loop's guards are unknown while its back edge is
  unbuilt. Two flags separate the states: `analysed` (has `g-analyze!` finished) and `provingctrl`
  (this is a CONTROL question, not a value one). **Both are needed** -- relaxing it for value folding
  too let a loop's carried phi be replaced by its entry constant, and `a[i]` became `a[0]`.
- **`CallEnd` answered ANY for `~ctrl`** (`ty-high?` where `ty-unanalysed?` was meant). On the
  control axis "unanalysed" and "proven unreachable" are both high and are not the same claim.

**One thing was tried and REVERTED, and the property test is why.** Asking `if-compute`'s control
before its predicate looks obviously right and is not monotone: control falling from a dead type to
`bot` makes the answer RISE from `[~ctrl ~ctrl]` to ANY. `if_compute_is_monotone_in_both_slots`
printed the exact witness pair. The two fixes above make loops compile without it.

### 3. A loop counter used as an INDEX was silently wrong

Compiling was only half of it. A loop's carried phi has ONE arm while the body is lowered, so every
"is this tagged?" test answered from half a phi, and three separate decisions got it wrong:

- `i++` wrote a raw DOUBLE back into a phi whose entry arm was a raw INT (`fng-machine-number-value?`
  said "raw" from the entry `0`). One phi, two register classes. Every integer consumer read the
  double's bit pattern, **whose low 32 bits are zero for any small integer**, so `a[i]` and
  `s.charCodeAt(i)` indexed 0 on EVERY iteration: `[4,5,6]` summed to 12 and `"abcdef"` hashed to
  six copies of `"a"`.
- `i = i + 1` produced a TAGGED phi, and the `int`-parameter seam skipped the coercion for the same
  reason. `a[i]` at least failed `g-verify` ("ArrayLoad slot 3 is tagged, needs raw-num");
  `s.charCodeAt(i)` compiled and read the NaN box as an index.
- The `int`-parameter coercion itself produced a raw FLOAT for a parameter declared `int`.
  `fng-to-number-operand` answers a double, and both are "raw-num" to the verifier.

Fixed with one structural predicate, `fng-open-loop-phi?` -- a phi on a `Loop` whose slot 2 is still
`NO-NODE` is conservatively "not a machine number" and "may be tagged" -- plus `BitOr(x, 0)` at the
`int` seam. Where the counter really is an integer the guards fold and the loop is the same two
instructions. **The `(BitOr)` debt went 2 -> 3 and is recorded**; it is representation rather than
meaning, and it is counted anyway because a debt that can be argued away silently was never watched.

### The harness, and what it now covers

`tests/native_harness.coil` (new) holds the three legs, and both suites use it. Two costs made the
old copy unaffordable at scale and are gone:

- **It recompiled `native/gc/runtime.c` per program.** 0.25s each against 0.05s to link an object
  already compiled. The runtime, the trampoline and the driver are built once.
- **It spawned a node per program.** `native/js-oracle/oracle.c` -- written for the deleted fuzzer,
  never called since, 0.076ms per case against 63ms of process startup -- is the oracle now.
- **macOS charges ~0.69s to assess the FIRST execution of each freshly linked binary** and 3ms
  thereafter. Measured. `nh-link!` and `nh-exec!` are separate so a suite can link one binary and
  run it many times, which is what makes the sweep below affordable at all.

**`tests/native-differential-test.coil` (new) runs every method the frontend dispatches against
node.** Same derived list as the capability report, same read-the-compiler technique; each method is
tried at the arity the frontend states and the first argument list that BOTH compiles and runs under
node is the one recorded. The probe **hashes `String(r)` character by character** -- a length is
blind to what these definitions decide, and a length-only test stayed green when `join`'s separator
was changed from `","` to `";"`. Eight probes per program, one binary per chunk: 45s for one
54-probe function against 19s spread over seven, because the analyse/fold fixpoint is superlinear.

`docs/NATIVE-DIFFERENTIAL.md` is checked in and compared byte for byte, exactly like the capability
report. **45 of 53 methods agree with node; 8 do not**, and that is the honest number:

| call | what happens |
|---|---|
| `"abcdef".lastIndexOf(1)` | answers 0 where node says -1 -- a `builtin` with a loop, `:ret int`, read as the wrong machine word |
| `"abcdef".localeCompare(1)` | 0 where node says 1, same shape |
| `[1,2,3].join(1)` | a non-string separator is not coerced |
| `[1,2,3].flatMap(x => x)` | see below |
| `[1,2,3].sort(x => x)` | an inconsistent comparator; node's order is unspecified, so this row may never be fixable |
| `[1,2,3].keys/values/entries` | iterators stringify as `[object Array Iterator]`; we have no iterator object |

**AN ARRAY RETURNED FROM A FUNCTION IS NOT ARRAY-TAGGED, and it is the root of two of those.**
`be-function-return-tag` derives the tag from the return value's TYPE, and an array and a plain
object are ONE type. Witness, three lines, all disagreeing with node:

```js
function main(n: number): number { let f = (x: any) => [x, x]; let r: any = f(1);
  return (n + (r instanceof Array ? 100 : 200)) | 0; }   // ours 200, node 100
function main(n: number): number { let f = (x: any) => [x, x]; let r: any = f(1);
  return (n + String(r).length) | 0; }                    // "[object Object]"
function main(n: number): number { let v = [1,2]; let r: any = v.map(x => [x, x]);
  return (n + String(r).length) | 0; }
```

`be-js-tag-for-value` is the structural answer and swapping it in gets the tag right -- and then
`instanceof Array` is STILL false, so the tag is not the only place the decision is made. That is
where the next session starts. `ArrayFlatMap`'s one-line correct body is written out in a comment
above the definition, blocked on exactly this: it makes `flatMap(x => x)` right and
`flatMap(x => [x, x])` wrong, and trading a common case for a rare one is not a fix.

### What the sweep cannot see

The differential probes ONE call per method with a generic argument. It says nothing about a second
argument, an empty receiver, a negative index, or any two methods composed. It is a floor that did
not exist this morning, not a conformance suite.

## FOUR COMPILER FIXES, AND 113 -> 205 OF 216 CELLS (2026-08-19)

Every one was found by reading `docs/NATIVE-CAPABILITY.md`, reproduced as a single program, and
checked by running the compiled binary against node. **Verifier rejections are now 0.**

1. **`ToString` decided on TYPE where it had to decide on REPRESENTATION** (`backend_select.coil`).
   Its `cond` asked the type which machine word a value was, so `num` -- strictly more information
   than `dyn` -- fell to the unsupported arm, and narrowing a type LOST a capability. Worse, a
   tagged value with a narrow type walked into the wrong arm: a NaN out of `charCodeAt` is typed
   float-only and IS tagged, so it reached `FROM-DOUBLE-BITS`, which read the NaN box as an IEEE
   double and printed nineteen characters where node prints "NaN". Representation is the first
   question now, and `n-rep-of` answers it.
2. **A value spanning representation classes must already be tagged** (`be-kinds-must-be-tagged?`).
   There are three raw forms -- number, string pointer, object pointer -- and `undefined`/`null`/
   `true` have none, so a kind set touching two classes can only be a tagged word and boxing it
   again is the identity. **The first version of this rule was unsound**: it said the tag-only
   class ALONE was enough, which made `Box(Const undefined)` a no-op, and `String(v.at(99))`
   printed one character instead of "undefined". It compiled, it ran, and it was wrong by 8 --
   `tests/native-execution-test.coil` is what said so, within a minute. Strictly more than one
   class is the rule.
3. **A `Box` is not foldable to a `Const`** (`node.coil`). `Box(Const undefined)` has a constant
   type -- there is only one undefined -- so `g-fold-proven!` replaced it with the constant and
   deleted the tagging it existed to perform. A `Phi` merging it with a boxed string then held a
   raw immediate on one arm and a tagged word on the other, and nothing objected because both arms
   were individually well typed. DSL-OWNERSHIP records the same trap for `box-compute`'s TYPE; this
   is the transformation half of it. **Vetoing the fold un-hid two further bugs that the fold had
   been accidentally papering over** -- which is the argument for the veto, not against it.
4. **A declared parameter type is a representation contract** (`fng-jsl-call`). `(start int)` means
   a raw machine integer, and call sites passed whatever the expression produced -- for
   `"abcdef".slice(-2)` a BOXED -2, because unary minus reaches the DSL and comes back tagged. The
   graph failed `g-verify` with "Add slot 1 is tagged, needs raw-num". Coercion now happens once at
   the single DSL call seam, driven by the callee's declared parameter types, instead of being
   repeated per method and forgotten for the next definition.

And two beyond the compiler:

- **`StringCharCodeAt` called an in-bounds-only atom out of bounds** (`lib/string/char.jsl`). Its
  comment claimed `%StringCharCode` answers NaN itself. It does -- by returning a TAGGED NaN where
  the in-range case returns a raw code unit. One primitive, two machine representations, chosen at
  run time; nothing downstream can be right about both. Guarded in the DSL, where the bounds belong.
- **A dead loop is not dead code until something says so** (`g-sweep-unreachable!`). `n-kill!`
  refuses a node that still has users and every node in a Phi cycle has one, so a `lib/` definition
  whose result goes unread stayed live, reachable from no root, and `v-pass-leaks` refused the
  graph -- `"abcdef".toLowerCase()` compared only against `undefined` did not compile. The sweep
  breaks the cycles, then kills them, and REFUSES TO RUN if anything unreachable has an effect. It
  runs at the end of the build: inside the analyse/fold fixpoint the function's own memory `Arg`s
  are not wired to the `Return` yet and every one of them looks unreachable.

**What is left is 11 cells with one cause**: `String(anArray)` -- every array method that answers an
array, plus `split`. JavaScript says `String([1,2,3])` is `"1,2,3"` via `Array.prototype.toString`,
and nothing implements that conversion. It is a missing feature rather than a defect, and it wants
`ArrayJoin` reached from `ToStringValue` in `lib/` rather than a special case in the frontend.

### And what does not compile is now DERIVED, not listed

`tests/native-capability-test.coil` reads the method names out of `frontend_native_graph.coil`'s
own dispatch tables -- the same read-the-compiler technique `dsl-ownership-test` uses to count
opcodes -- compiles a program for each under four usage shapes, and writes
**`docs/NATIVE-CAPABILITY.md`**: 216 cells, checked in, compared on every run. Add a method to the
frontend and a row appears with no edit.

Today: **113 cells compile, 94 die in instruction selection, 9 in the verifier.**

Three drafts of that file were wrong before it was right, and the wrongness is the lesson:

1. Consuming every result with `r === undefined` reported `toLowerCase` broken while the execution
   suite was compiling and running it. Comparing a STRING against undefined is what did not compile.
2. Consuming every result with `String(r).length` reported all 54 methods fine, while a realistic
   `substring` program does not compile at all.
3. **"Compiles" is a property of a PROGRAM, not of a method.** Hence four columns, and rows that
   disagree across them: `substring` compiles converted and fails in arithmetic; `charCodeAt` is
   the other way round. A column that fails everywhere is about the column -- `then indexed` mostly
   measures whether you can index the receiver at all.

`docs/STATUS.md` remains true and useless on this question: it says `push`, `map` and `reduce` are
done, meaning a definition exists in `lib/` and the frontend calls it. The derived report is what
says whether the backend can compile the result.

**Do not add a fork to that file.** The obvious design runs each probe in a forked child so an
`abort` becomes a row rather than taking the suite down, the way `gtext-test` observes `g-parse`'s
abort. It was built, it worked several times, and then it HUNG -- the frontend is the typescript-go
bridge and forking a live Go runtime deadlocks. A hang has no diagnostic at all. What replaces it:
the probe derives each string method's ARITY from the same table and only makes calls the frontend
accepts, and never passes an empty argument list to an array method (`v.map()` aborts on a callback
that is not there).

## The dead-code sweep that followed (2026-08-19)

With the interpreter gone, a great deal of the repo was reachable from nothing. All of it was
deleted, with `coil check` as the verifier and the suite green after each step:

- **`workflow/`** — 34 tracked JSON milestone contracts for the B00-B15 shell-gate regime that was
  deleted on 2026-08-13. Pure archaeology.
- **`tests/js-source-prop.coil` and `src/js_templates.coil`** — the JS fuzz property's generator and
  its 90-odd node-verified program templates. The property itself died with the interpreter, so
  these described a fuzzer that no longer existed. Its one surviving test (the rest-parameter
  refusal, which needs no oracle) moved into `tests/frontend-native-graph-test.coil`. **When the
  fuzz property is rebuilt on the native harness, recover `js_templates.coil` from git — it is
  400 lines of templates each verified against node.**
- **35 orphaned `n-*!` node builders**, `%UnboxBool` and `%PropDeleteNamed` (JSP 47 and 62, now in
  `jsp-retired?`), and **69 functions across 16 `src/` modules whose names appeared nowhere
  outside their own definitions** — 694 lines. Two of those were capability rather than plumbing
  and are worth knowing about: **`g-inline-small!` (the small-function inliner) and
  `n-specialize-fun!`/`spec-*` (the call specializer) were called by nothing.** They were reachable
  only from tests that ran the interpreter, so the product never invoked either. They are in git if
  a future optimizer wants them; nothing was optimizing anything with them in the tree.
- **10 `lib/` definitions with no caller** — ArrayIota, ArrayMapDouble, ArrayRepeat, BoxedInf,
  BoxedNegInf, FltCeilFrom, FltFloorFrom, FltTrunc, NegInfinity, NewObject. `ToBoolean` stays: it
  is the DSL half of checklist F2 (`Boolean(x)`).

**And the sweep found a real bug in the ratchet.** `dsl-ownership-test`'s `lib-files` list held 31
paths for 34 `.jsl` files, so every call made from `lib/math/platform.jsl`, `lib/math/rounding.jsl`
and `lib/object/enumeration.jsl` was invisible to the no-dead-definition check. Their callees looked
dead and had been parked on the orphan allowlist — `ObjectCoercible`, `FltAbs`, `IntAbs`, `IntSign`,
`FltSign`, `BoxedNaN` were never dead at all. **The allowlist was absorbing a detector bug.** The
list is complete now and the allowlist is down to two entries.

Totals for the day: **15,202 deletions across 101 files.** `coil test` 390 passed, 0 failed.

Strikes 0 and 1 landed earlier the same day and are still correct as source changes: the string
atoms exist and `lib/string/case.jsl` is a DSL loop over them, with the ops and both hand-written
copies gone. Their evaluator halves were deleted hours later along with everything else, so the
`ev-string-atom`/`ev-cached-value-op?` machinery described further down this file no longer
exists — the graph property it exposed (an allocation must be control-pinned) is recorded in
DEMOLITION Part 5 and still holds.

---

## The mandate, stated here so it is not a pointer

**Every JavaScript semantic moves into `lib/`.** The frontend lowers *syntax* into structure:
control flow, scoping, memory and alias plumbing, the call ABI, closures, shapes,
REPRESENTATION. The meaning of every operator, coercion and builtin belongs to the DSL, reached
through `fng-jsl-call*`. **The DSL's expressiveness is never the limit** — a `%` primitive is the
correct way to reach a runtime capability it cannot spell (`%ToFixed` was added this way; a
regexp engine is the one still owed). **Do not accept a partial conversion as done**, and **no
fast path in the frontend** — the specialisation lives in the definition and folds when types
prove.

## Current state of the debt (all ratcheted in tests/dsl-ownership-test.coil)

| opcode | count | what it is |
|---|---|---|
| `Eq` | 1 | dynamic-callee identity compare — tag bits ARE function identity here |
| `Lt` `Le` | 0 | — |
| `Add` `Sub` `Mul` `Div` `Mod` `Minus` `Not` `BitAnd` `BitXor` `BitNot` `Shl` `Shr` `UShr` | 1 each | `fng-static-global-value`, the literal-only constant evaluator (numeric operands enforced) |
| `BitOr` | 2 | the above plus `fng-int-value`'s index coercion |

`DSL-OWED` is empty. Of Phase 1's six helpers: `fng-equal-value` and `fng-bin` are DELETED,
`fng-condition-expression` is renamed `fng-condition-representation` (`If` owns truthiness
end-to-end; the helper only boxes a raw string pointer). Three remain — `fng-number-value`,
`fng-int-value`, `fng-to-number-operand` — reachable only from the declared-type boundary
(`fng-expression-expected`), array index/length positions, and parameter defaults.

## What landed this session, most recent first

- **DEMOLITION S0 — the string atoms.** `StringAlloc`/`StringSetUnit` (OPTAG 91/92, JSP 94/95,
  `%StringNew`/`%StringSetUnit`, JSSOP 0/1 which the C already had). The evaluator's string heap
  grew a `filled` counter and refuses BOTH an out-of-order write and a read of a partial string,
  because the native runtime already refused both and a silent divergence there would only show
  up in the product. Two traps, both now in DEMOLITION Part 5: an allocation or mutation must be
  CONTROL-PINNED (`(jl-ctrl)` in `jl-prim`) *and* on the evaluator's per-control cache chain
  (`ev-cached-value-op?`), because the evaluator recomputes a floating value node at every demand
  — op-class 2 is necessary and not sufficient; and `ev-effect-op?` is the WRONG list to join,
  since it means "publishes a memory state" and an atom answering a string fails that with
  `EV-MEM`.
- **DEMOLITION S1 — case.** `lib/string/case.jsl` is a loop over the atoms; ops `StringLower`/
  `StringUpper`, `ev-string-case`, `jss-ascii-case!`, JSSOP 21/22 and the C case are all gone
  (runtime.c 2,274 → 2,261). The file's old comment claimed case mapping was an irreducible
  Unicode table — it was an ASCII shift open-coded twice, and the comment now says so. Retiring
  an op leaves a hole in a DENSE SCANNED id space: `op-tag-retired?` and `jsp-retired?` declare
  it, or `gparse-op`/`jsp-find` walk into a number with no row.
- **The syntax migration's one casualty**: the Aug 17 commit stripped the leading spaces inside a
  multi-line string literal in `tests/js-source-prop.coil`, so the lifted-JS pin no longer matched
  the emitter. Restored. The rest of that commit's reindentation was code, not string content.

### Before the demolition, the operator migration

- **`++`/`--`** are `ToNumberValue` then `JsAdd`/`JsSub` (spec: ToNumeric then a NUMERIC add,
  never concat; postfix returns the COERCED old value). The write-back representation stays the
  frontend's, decided structurally with `fng-machine-number-value?`.
- **Object spread** — each `...a` is one `ObjectAssignSource` step (the definition Object.assign
  repeats). Two supporting rules: a program containing spread disables static object layouts
  (enumeration reads the runtime property table; shape slots are invisible to it), and a
  certainly-SHAPE-ROOT object never takes `fng-unique-field-index`'s static-shape name-guess.
- **`instanceof Object` / `instanceof Array`** — name-dispatch (only when the name has no user
  binding) to `InstanceOfObjectValue`/`InstanceOfArrayValue` in lib/abstract/property.jsl.
- **`Number.prototype.toFixed`** — the owed number-formatting primitive, built: `%ToFixed`
  computes round(x·10^f) EXACTLY on the double's binary decomposition, ties away from zero
  (printf rounds ties to even and cannot express the spec). Mirrored in `ev-to-fixed`
  (eval.coil) and `aot_js_to_fixed_format` (native/gc/runtime.c). ≥1e21 delegates to ToString
  and inherits repros/open/large-double-tostring-not-exponential.js.
- **`String.prototype.replace`** (string pattern, first occurrence) — `StringReplaceFirst`.
- **Equality, whole**: `===`/`!==`/`==`/`!=`/`!` and `switch` matching are
  `StrictEqual`/`StrictNotEqual`/`LooseEqual`/`LooseNotEqual`/`LogicalNot`. Deleted
  `fng-equal-value`, `fng-loose-equal`, `fng-nullish-equal` and the number/number and
  string/string fast paths. `StringEquals` is interior to the DSL now.
- **Conditions hold no semantics** — `If` owns truthiness (evaluator `rt-truthy?`; selection
  dispatches tagged→VALUE-TRUTHY, float→MI-FTRUTH, int→zero test). String conditions box.
- **`fng-static-global-value` is numbers-only** — its qualifier refuses `true + 1` etc., which
  fall to the ordinary top-level path where the DSL owns the coercions.
- Earlier in the session: the arithmetic migration landed green (declared-type coercion at
  `fng-expression-expected`, `n-rep-of` as the one representation classifier shared by verifier
  and idealize, `Box(tagged)` peels as identity, `Unbox` folds vetoed for certainly-tagged).

## The compiler was updated mid-session, and the fallout is instructive

The coil binary (and its stdlib) changed at 21:28 on 2026-08-16. Four things broke, none of them
new code:

1. **Reader**: `\xNN` escapes now need `\xNN;`; `SexpKind` gained `KView` (jl-float-bits match).
2. **`fng-coerce-to-alias` keyed on a momentary `n-ty` read** whose value depended on peephole
   visit order; the order changed and `o.x = acc` after `acc += 1` stored a tagged word raw.
   Fixed structurally with the boxed walk. **Build-time decisions key on SHAPE, never on a
   mid-construction type read** — this trap has now bitten twice.
3. **The stdlib hashmap masks buckets with `hash & (cap-1)`** and `hash-step`'s FNV multiply
   leaves low bits structured: ty-intern went quadratic and ns.js ran 90+ CPU-minutes.
   `ty-hash-finalize` (splitmix64 finalizer) now ends every repo-owned KeyOps hash
   (ty, gvn, ev-array-slot). ns.js: 1:38, correct. Any new custom hash must end in it.
4. **Two fields sharing one alias** left a duplicate entry in control snapshots' active lists;
   divergent states under one alias appeared once processing order changed
   (repros/shared-field-alias-snapshot-duplicate.js). `fng-control-aliases!` dedupes.

## Traps that cost real time (cumulative)

- **A type is not a representation.** `n-rep-of` (node.coil) is the one answer; the verifier and
  the idealizations read the same table. A Phi with an absent arm is UNKNOWN by design.
- **Build-time type reads are momentary state.** Key on shape/structure: the boxed walk,
  `fng-machine-number-value?`, `fng-shape-root-object?`.
- **An `If`'s control operand is read before an argument-position JSL call runs** — the call
  inlines guard diamonds that ADVANCE control. Lower the call first, then build the If
  (both switch lowerings record this).
- **The ratchet counter is textual** — a comment saying `(Add)` counts.
- **Piping `coil test` output masks its exit status** — check before committing.

## Tools

`tools/` is `dot-dump.coil` (renders the corpus as Graphviz) and `build-typescript-go-bridge.sh`.
`js-repro` and `js-sweep` were evaluator drivers and are gone. **There is no tool that compiles a
`.ts` to an object file** — the only place a program becomes machine code today is inside a
deftest. Phase A's first step gives that back.

## Next, in order

0. **`for...of`**, above: the pieces exist (`ArrayValues`, `ArrayIteratorNext`, and loops compile)
   and the bridge rebuild is 2.5 seconds, verified. It is refused by name rather than wrong, which
   makes it the largest REMAINING gap now that heap callables work.
2. **DEMOLITION strike 2** — `StringFromCodeUnit`, `StringConcat`, `StringEq` as DSL loops over
   the atoms, then delete the three ops and both copies of each. `%StringConcat` has 52 uses in
   `lib/` and `%StringEq` 6, all of which stay as calls to the new `builtin`s. This is the first
   strike where `ns.js` (2:07 today, gate budget ~2 minutes) may go over: raise the budget in the
   protocol deliberately rather than treating it as a hang. Then S3–S8 in order.
3. **Phase 1 residue**: convert the three remaining coercion helpers' sites to unconditional
   DSL calls (`ToNumberValue`/`ToInt32`) and let folding remove them — the mandate's own
   prescription — then delete the helpers. Then **split `Op`** so arithmetic/comparison/bitwise
   variants are unnameable outside `jsl_lower` (big mechanical refactor across node/eval/verify/
   backend/gtext/templates; the exhaustive-match compiler drives it; consider hivemind with the
   test suite as gate).
4. **The regexp engine** — the last owed `%` primitive family (String.replace/match/split with
   RegExp patterns). `Boolean(x)` to give `ToBoolean` its caller.
5. **Open repros**: closure-capturing-a-loop-variable, rest-parameters,
   undefined-for-these-values, large-double-tostring-not-exponential (wants the real
   shortest-round-trip digit generator; the native side prints %.17g noise today).
6. The stdlib's own `bytewise-hash` likely shares the low-bits weakness — that fix belongs in
   the compiler repo.
