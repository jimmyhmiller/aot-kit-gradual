# Deftests owed

The gate is now `coil test`. Nothing else.

On 2026-08-13 every shell gate, Node oracle, JavaScript frontend, emit driver, C harness and
golden table was deleted — 232 files, 13,538 lines — leaving 45 `.coil` suites and 550 tests. This
file is the record of what those files proved, so the coverage can be rebuilt as deftests instead
of quietly forgotten. **It is a debt, not an inventory of dead weight.**

Read the deleted files with `git show 'HEAD~1:<path>'`; the deletion commit names them all.

---

## What survives untouched

`coil test` — 45 suites, 550 tests. They depend only on `src/`, `lib/` and each other. No suite read
a golden table, invoked a tool, or shelled out, which is why the deletion could not break them.

## The two things a deftest structurally cannot do

Both were accepted deliberately. They are the actual cost of this change.

### 1. An independent authority on what the answer *is* — PARTLY RECOVERED

**`node_agrees_with_the_compiler` in `tests/js-source-prop.coil` restores this for arithmetic.** The
generated description is lifted twice -- to plain JavaScript for `node -e` via `popen`, and to IR
for us -- and the two answers must match. A disagreement is a disagreement with the language, not
with our other opinion of it. 200 generated cases against a real JavaScript engine, ~12s.

That covers `+` and `-` over one integer parameter and nothing else yet. Everything below still
stands for every other surface: String, Math, Number, Array, the int32 operators, and the whole B07
to B15 range.



19 Node/V8 oracle scripts produced 15 committed golden tables. `jsl-gate.sh` stated the design in
its own header:

> Node and JSL are compared against one committed artefact rather than against each other, so
> neither can drift into agreement with a stale copy of the other.

A deftest is written in the same language as the thing it tests. Any expectation it carries was
produced by the implementation under test. **Every claim of the form "agrees with JavaScript" is
now a claim of the form "matches what we recorded."** When a semantic changes, nothing external
objects; the value is simply repinned.

If a spec question ever becomes contentious, re-derive the answer from a real JavaScript engine by
hand and paste it in with a comment saying where it came from. That is the replacement, and it is
manual.

### 2. Proof that a LINKED OBJECT runs — RECOVERED

**`tests/linked-object-test.coil` does this.** A deftest CAN drive `clang`: the same `popen` the
node oracle uses writes the emitted object to disk, links it against a generated C harness, and
runs it. That covers what the mmap properties stop short of -- `be-macho-checked!`, the symbol
table, and the relocations resolving against a C caller at a real ABI boundary.

It is a deftest over six fixed programs rather than a property, because a link per case cannot
sustain 200 cases (a property attempt ran past ten minutes). Breadth at that layer belongs to the
mmap properties, which run thousands of cases against the same encoder.

ALLOCATING PROGRAMS RUN UNDER THE COLLECTOR -- `tests/linked-object-test.coil`.

The piece that made it work is **`be-use-runtime-allocation!`**, called after selection. Without it
the backend compiles an allocation to a pure inline bump against thread state nothing has
initialised: the object carries ZERO relocations, links cleanly, and segfaults. With it the object
calls `_aot_alloc_slow` twice and the collector is genuinely in the loop.

So a `_aot_alloc_slow` relocation is the cheap signal that a generated allocation is the real thing.
The deleted `native-gc-gate.sh` asserted exactly that before running anything, which is how this was
found; the test asserts it too.

Also required, and not guessable: the kernel is entered through `aot_gc_enter(fn)`, never called
directly, and `native-gc-trampoline.S` must be linked alongside the collector. There is no heap
argument -- there is an entry protocol.

`native/gc/` holds runtime.c, trampoline.S and js-value.h, restored from the deletion commit.

RETRACTED ON THE WAY HERE, kept because the correction is the useful part: an earlier version of
this entry claimed the same thing on the strength of ONE run that printed the right answer. It did
not reproduce -- the same binary re-run minutes later exited 139 -- because that build lacked
`be-use-runtime-allocation!` and was faulting on uninitialised thread state that happened once to
be benign. The current result was checked over three consecutive runs and two full suite runs
before being written down.

METHOD NOTE, the third time this session a single observation misled me: one green run of a program
that manages its own memory is not evidence. Re-run it.

(`git show c8b0a65^:tools/native-gc-runtime.c`, 2166 lines, plus `js-value.h`) COMPILES AND LINKS
against an emitted allocating object -- no undefined symbols, so the stackmap and layout sections
resolve. Running it exits 139 (SIGSEGV) even after `aot_gc_configure(1<<20, 0)`.

So the remaining gap is runtime INITIALISATION, not linking. `aot_gc_alloc` takes a `context`
argument and the collector keeps an `aot_gc_thread_state`; establishing what the emitted code
expects in those is the next step, and it is now a bounded question against a recovered 2166-line
file rather than an unknown. The deleted `tools/native-gc-harness.c` from the same commit is
probably the answer sitting in git.



Narrower than it first looks, and the correction matters.

**Executing emitted machine code is NOT lost.** `tests/backend-parity-test.coil`'s
`parity-native1` already does it inside an ordinary deftest: `mmap` a page, copy `be-code-byte`
output into it, `mprotect` it executable, `sys_icache_invalidate`, cast to a `fnptr` and call it.
The CPU really does run the emitted instructions. Anything covered by
select → schedule → colour → encode is recoverable as a deftest today, including register-pressure
matrices, and `defprop` is a better tool for it than the fixed matrices that were deleted.

What IS lost is everything downstream of `be-encode!`:

- **Mach-O emission** (`be-macho-checked!`) — container, symbol table, relocations. The mmap path
  executes raw code bytes and never builds an object file.
- **Linking** — `clang` resolving symbols against a C harness, the C ABI at a real call boundary,
  external allocation relocations.
- **`llvm-objdump` assertions** on the disassembled object.

So `arm64 Mach-O linked and executed; kernel returned 84` splits in two: "the instructions compute
84" is a deftest, "the object file links" is not.

`coil.os` exposes `fork`, `execvp`, `waitpid`, `pipe`, `dup2`, so a deftest could drive `clang` for
the remainder. Note before trying: `coil test` already forks each test, and forking again inside a
test child to exec a toolchain is the multithreaded-fork pattern behind this project's signal-9
saga.

---

## Owed, by capability

Ordered by how much was lost. Each row names what the deleted gate proved and the shape of the
deftest that replaces it.

### Native execution — `native-gate.sh`, `native-object-gate.sh`, `native-gc-gate.sh`, `fp-native-gate.sh`, `jsl-native-gate.sh`

| Proved | Deftest owed |
|---|---|
| arm64 Mach-O links and executes; kernel returns 84 | Split it: "the instructions compute 84" is a deftest that mmaps and calls them (see above). "The object links" is not recoverable in-process. |
| Six call layouts + external allocation relocation linked and executed | Per-layout deftest asserting the selected machine program and relocation entries. |
| Fast allocation, promotion, recursive raw/boxed roots, old-to-young barriers; OOM and omitted barriers trap | Per-scenario deftest over the GC graph; assert barrier nodes are present where required. The *trap* cases were the strongest part of this gate — they need explicit negative deftests. |
| FP semantics, constants, calls, Phis, safepoints, forced spills execute natively | A `defprop` in the shape of `backend-parity-prop.coil`, generating FP graphs. Note one register is infeasible for a generated tree — search for the allocator floor rather than pinning a count. |
| All 54 JSL builtins reach machine code; 180 results agree with Node | Deftest per builtin asserting it lowers and encodes. The 180 value comparisons become recorded expectations (see above). |

### Differential vs Node — 19 oracles, 15 golden tables

| Proved | Deftest owed |
|---|---|
| 322 JSL library cases agree with Node across String, Math, Number, Array | Deftests carrying the 322 values inline. **Recover the table from `git show HEAD~1:tests/jsl-string-oracle.txt` — do not regenerate it from JSL.** |
| int32 and number semantics agree with Node on exact IEEE bits | Same: recover the committed tables, assert against them. |
| B07–B15 evaluation-order / receiver / property / array / string / builtin matrices agree with Node | One deftest per matrix, values recovered from the deleted goldens. |

### Falsification discipline (Rule 9)

Every deleted gate injected the defect it claimed to detect and required detection: `shift-mask`,
`unsigned-shift`, `capture-by-value`, `duplicate-receiver`, `omitted-mutation`,
`omitted-generational-barrier`, `eager-branch`, `redirected-target`, `object-tag-predicate`,
`corrupt-FP-spill`, `cross-register-class`, and ~20 more.

**This is the cheapest thing to lose and the most expensive to notice.** A deftest asserting a
correct value proves nothing about whether it would have caught a wrong one.

*Owed:* every deftest that replaces a gate above needs a paired negative — either an injected
corruption (the backend still has `be-falsify-shift-mask!` and `be-falsify-unsigned-shift!`) or an
assertion that a deliberately wrong graph is rejected.

### Frontend differential — `src/frontend_ir.mjs`, `frontend_coil_codegen.mjs`, `ts_frontend.mjs`

944 lines of an independent JavaScript frontend, retained as an oracle for the native one. Its
graphs were pinned by sha256 in `frontend-native-graph-regression.mjs`.

*Owed:* graph-shape deftests. `tests/frontend-native-graph-test.coil` already does this for the
`basic` fixture — expected graph as **text**, not a digest. Seven fixtures remain: `call`,
`control`, `object`, `full`, `bitwise`, `b06`, `b08`. Recover each expectation with
`git show HEAD~1:tools/typescript-native-<name>-graph-smoke.coil` for the source string, then
regenerate and eyeball the graph before pinning it.

Note: `src/frontend_native_graph.coil:2` still says node creation order "intentionally mirrors
frontend_coil_codegen.mjs". That file is gone. The comment now refers to nothing — either drop the
constraint deliberately or record why the ordering matters on its own terms.

### Static and documentation checks

| Deleted | Proved | Deftest owed |
|---|---|---|
| `status.mjs --check` | `docs/STATUS.md` cannot claim a conversion that is not wired up — it re-derived recognised operations from the frontend's tables and verified each named definition exists in `lib/` and is referenced from `src/` | Deftest reading `lib/` via `jsl-read-file!` and asserting every claimed definition resolves. The Markdown half needs a parser; consider generating STATUS.md from a deftest instead of checking it. |
| `backend-module-gate.mjs` | Backend module import boundaries hold | Deftest parsing `src/*.coil` with the Coil reader and asserting the layering. Straightforward. |
| `workflow-gate.mjs` | `workflow/roadmap.json` + `state.json` are consistent | Deftest using `coil.json`. Straightforward. |

`docs/STATUS.md` went stale for months before that check existed. It is now unguarded again.

### Not tests, deleted anyway

- **Go/TypeScript bridge build** (`build-typescript-go-bridge.sh`) — a prerequisite build, not a
  check. `Coil.toml`'s `[link]` still force-loads
  `.coil/build/native/typescript-go-bridge/libaot_typescript.a`. **If that archive is absent,
  linking fails.** Rebuild it by hand, or restore the script.
- **Diagram pipeline** (`render-dot.sh`, `build-page.py`) — rendering, not correctness.
- **Benchmarks** (`benchmark-gate.sh`, binarytrees, V8 probes) — already opt-in; nothing gated on
  them.

---

## Suggested order

1. `backend-module-gate` and `workflow-gate` — mechanical, no judgement, restores two checks in an
   afternoon.
2. The seven frontend graph fixtures — pattern already proven.
3. JSL's 322 cases — recover the golden from git before touching anything.
4. Native encoding deftests, each with its falsification pair.
5. Decide, explicitly, whether execution coverage returns via a forking deftest or stays gone.

---

## Property tests (started 2026-08-13)

`tests/backend-parity-prop.coil` is the first. `Coil.toml` now discovers `-prop.coil` alongside
`-test.coil`, so `coil test` runs properties and examples together.

**The law:** a straight-line integer program means the same thing however many registers the
allocator was given. The interpreter says what it means; the CPU is asked twice — once at eight
registers, once at the *tightest count the allocator claims to have solved* — and all three agree.

Two things make this the right replacement for the deleted register-pressure matrices:

- **The floor is per-program, not a constant.** The deleted matrices coloured fixed programs at 8
  and at 1. One register is not even feasible for a generated tree (`be-color!` returns failure
  code 7; a binary op needs somewhere to put both operands), and a fixture's floor tells you
  nothing about another program's. `min-regs` searches for it per case, so every run exercises the
  allocator exactly at its limit.
- **The oracle is internal.** `eval.coil` and the AArch64 backend are two independent
  implementations in this repo, so this law survived the deletion of every Node oracle.

Falsified before being trusted: compiling the native side from a program with one constant changed
fails after 2 cases and shrinks to a 1-byte input.

### Known limits of this property

- **MUL is excluded, deliberately.** The graph's `int` is a JavaScript integer, so the evaluator
  promotes an overflowing product to a double exactly as specified, while the emitted AArch64 code
  wraps at 64 bits. Chained multiplication leaves the exact range in a few operations, so a naive
  MUL property spends its cases calling that difference a bug. *Owed:* a comparison that models the
  promotion, which then covers DIV/MOD traps too.
- **`classify` output does not surface.** The buckets are declared (straight-line / one branch /
  two or more) but neither `coil test` nor `--verbose` prints the distribution — only pass and
  reject counts. Evidence that an arm fires currently comes from the coverage delta, which is the
  weaker instrument. Worth asking upstream whether the distribution can be printed on success.
- **Calls need a bigger register budget than everything else.** The smallest count that colours the
  call shape is 11 -- a call pins argument and return registers by ABI on top of every caller value
  live across it -- so that property searches to 16 where the others search to 8. Searching to 8
  made its precondition unsatisfiable and the property vacuous; the runner caught it with
  "rejected 200 of 200 generated cases (100%). The precondition is too sparse", which is the guard
  `classify` would have given if its buckets printed.
- **Branches yes; memory no.** `emit-branch!` generates a diamond
  (`if (a < b) a+b else a-b`) merged by a Phi, which is what reaches the scheduler, the CFG and Phi
  handling; `build-loop-program!` covers the back edge (B08) and `build-call-program!` covers values
  live across a call boundary (B09/B10), and `build-heap-program!` covers aliasing between two
  objects of the same shape. *Owed:* the heap NATIVELY -- `build-heap-program!` compares the
  interpreter against the optimiser only, because memory arrives as an argument (`mk-mem-in`), so
  running an allocating program from a raw page means supplying a heap pointer in the right slot.
  Worth doing: the emitted code needs no runtime allocator (measured: zero external relocations),
  so the obstacle is the argument convention and nothing more. Also still owed: arrays, and the GC
  barriers the deleted native-gc gate covered.
- The argument is reduced into ±2^40 to keep ADD/SUB exact.

### Measured: coverage, and a generator arm that was dead for 31,000 cases

The first version of this property was straight-line ADD/SUB only. 40,000 guided iterations ran
31,052 cases with no disagreement, at `corpus 12, 561 of 8650 edges` — a number that did not move
between `-n 10`, `-n 2000` and `-n 40000`, nor after deleting the persisted corpus at
`.coil/build/fuzz`. That flatness was read here as "straight-line programs cannot reach more of the
backend." **Half right, and the wrong half was load-bearing.**

Adding a branch step changed nothing: `562 of 8655`. The branch arm was never executing. The step
was chosen from the byte's TOP two bits, and the `(slice u8)` generator produces printable bytes —
every counterexample this property ever reported was ASCII (`"a"`, `"Q"`). `b >= 192` never
happened, so the diamond code was dead while the coverage number sat still and looked like a
ceiling.

Keyed off the low bits instead:

    ADD/SUB only      corpus 12,  561 of  8650 edges,  23.5% rejected
    + branches        corpus 19,  739 of  8655 edges,  13.8% rejected
    + bitwise ops     corpus 20,  775 of  8659 edges,  12.5% rejected
    on the machine selector, after the legacy one was deleted:
    integer native    corpus 16, 1678 of 10602 edges
    loop native       corpus 24, 1886 of 10602 edges
    float native      corpus 18, 1678 of 10602 edges   (1258 before float diamonds)
    float optimizer   corpus 19,  641 of 10602 edges   ( 487 before float diamonds)
    integer optimizer corpus 35,  765 of 10602 edges
    call native       corpus  9, 1642 of 10721 edges
    rejection paths   corpus 10, 1263 of 11594 edges
    unified + rejection corpus 57, 3164 of 11594 edges
    heap optimizer    corpus 30,  830 of 10839 edges

60,000 guided iterations at the branch stage ran 52,842 cases with no disagreement.

**+32% edges and a third fewer discards.** The lesson worth keeping: a flat coverage number means
"nothing new is being reached", which is at least as likely to be a dead generator arm as a real
ceiling. Check that each arm fires before concluding anything about the code under test — and note
that a shrunk counterexample doubles as evidence about the input distribution.

Rejections are `assume` discarding programs whose allocator floor exceeds `WIDE-REGS`, not a fuzz
problem. Branch programs have different floors (a one-diamond program floors at 5 registers against
3 for its arithmetic equivalent), which is why widening the generator lowered the discard rate.

### `coil fuzz` (was broken here; fixed upstream)

`coil fuzz tests/backend-parity-prop.coil` fails in the instrumented build:

    clang: error: unknown argument: '--link-flag'
    clang: error: no such file or directory: 'CoreFoundation'

It passes this project's `[link] flags` from `Coil.toml` to clang as coil's own CLI spelling
(`--link-flag X`) rather than as clang arguments, and splits the `-framework CoreFoundation` pairs.
`coil build` and `coil test` handle the same manifest correctly, so this is a `coil fuzz` bug, not
a manifest problem.

**FIXED and installed 2026-08-13** (coil `565f416`). Root cause was `m-emit-link` in the compiler's
driver: it exists to build a `<self> build …` child command line, so it spells every manifest link
input as `--link-flag <tok>` — including `-framework` and its name as two separate pairs — and the
fuzz path was the one caller handing that to clang directly. The fix also repaired three further
fuzz-only divergences from `coil test`: `[cc]` sources were never compiled into the instrumented
build (this project has one, so the next failure would have been `Undefined symbols`),
`[metaprograms]` were not applied to `emit-ir` (fuzz silently tested a different program than
`coil test` does), and `m-prepare-native-deps` was skipped.

Verified on the installed `~/.cargo/bin/coil`: `coil fuzz tests/backend-parity-prop.coil -n 100`
gives corpus 12, 561 of 8650 edges, 233 cases passed. The 551-test gate is green on the same
toolchain, which matters here — this repo has twice had a compiler upgrade expose formerly-benign
UB of its own, so a new install is a reason to re-run the gate rather than assume it.

## The JavaScript source lifter (2026-08-13)

`tests/js-source-prop.coil`. One generated program description, two backends: `lift-js!` writes it
as TypeScript, `build-ir!` builds the same program straight as IR. Both walk the identical byte loop
and make identical decisions, so they are the same program by construction.

That is the architecture JavaScript fuzzers converged on (Fuzzilli's FuzzIL being the well-known
one): generate and mutate a linear description in which every step consumes values that provably
exist, and emit source only at the end. Mutating source text is close to useless -- almost nothing
survives the parser, and almost nothing that parses survives its first line.

**It gives the frontend an oracle with no external engine.** The graph the frontend produces from
the lifted source must compute what the directly-built graph computes; a disagreement is the
frontend mistranslating its input. That is the check lost when the JavaScript frontend was deleted,
recovered from inside. `src/frontend_native_graph.coil` is 7,290 lines -- the largest module in the
repo -- and one pinned six-line graph was the whole of its coverage before this.

Only `+` and `-` are generated. JavaScript's `&`, `|` and `^` are int32 operators (ToInt32 on both
operands, signed 32-bit result) and the IR's bitwise nodes are not, so generating them would report
the language's own semantics as a compiler bug. Covering them needs the lifter to model ToInt32.

### CONFIRMED: the frontend cannot run inside a forked property case

The differential is **table-driven**, not a `defprop`, and now for a measured reason rather than a
suspected one. Same property, same fresh property database, only the flag differing:

    COIL_PBT_DB=$(mktemp -d) coil test <file> --cases 40 --no-fork   ->  40 passed, 4.8s
    COIL_PBT_DB=$(mktemp -d) coil test <file> --cases 40             ->  watchdog at 60s, case 0

The native TypeScript frontend reaches the TypeScript-Go bridge, whose c-archive has already started
Go runtime threads. Running that in a forked child is the same trap as this project's signal-9 saga,
which was fixed in the coil test runner by spawning one process per test instead of forking. The
property runner still forks per generated case.

Two things had to be understood before that pair of runs meant anything, both from reading
`prop_runner.coil`:

- **`--no-fork` had exactly one gap, since fixed upstream.** It reaches the property runner
  (`prop_runner.coil`:942) and gated the generation loop; the reuse phase reached it through
  `fork-replay` before the flag was read, so a run that replayed a stored failure forked no matter
  what the flag said. The bisection and per-candidate forks look ungated but are unreachable under
  the flag by construction -- a crashing case takes the process with it rather than returning a
  signal from a child, so the `> 128` branch they sit behind never runs. (An earlier version of this
  note claimed four ungated sites. That was wrong and is corrected here.)
  Verified on this machine, `--no-fork` with a saved crashing input: the pre-fix stdlib prints
  "(replaying the saved counterexample)" and reports the crash, because a child died in the parent's
  place; the post-fix stdlib lets the abort take the process. A clean measurement of anything else
  still wants a property that PASSES.
- **The reuse phase runs first and is seed-independent by design** (replay a known failure in the
  first millisecond rather than after 200 fresh cases). Its store is `.coil/pbt/<property>/failing`,
  overridable with `--db` or `COIL_PBT_DB`. An earlier attempt to measure this was worthless because
  every run replayed a stored counterexample through `fork-replay` and never reached generation at
  all -- which also explains why passing a different `--seed` changed nothing.

So this property is one `--no-fork` away from working. It stays table-driven because the gate is a
bare `coil test`, and a `defprop` here would hang it. If the property runner ever spawns rather than
forks -- the same fix the test runner already took -- convert this back and delete this section.

Worth resolving -- a source-level property is the only thing that would exercise the frontend at
scale, and the lifter it needs already works.

## Coverage: measured ceiling, and why the native heap is blocked (2026-08-13)

Property coverage went 1888 -> 3080 of ~11.5k instrumented edges (17.4% -> 26.6%) across four
levers, each smaller than the last:

    unified corpus (6 shapes, one search)   1888 -> 2703   +815
    Mach-O publication                      2703 -> 2947   +244  (and +656 denominator)
    arrays folded into the shared corpus    2949 -> 3048    +99
    three shift operators                   3048 -> 3080    +32

**The operator set is saturated.** An added opcode is one more case in a selection switch whose
surrounding paths are already covered; +32 is what that looks like. Further operators are not a
coverage lever.

**The denominator moves with the numerator.** Pulling a subsystem into a property instruments it
too -- Mach-O added 244 covered and 656 total -- so a percentage-of-all-edges target gets harder
the more of the compiler a property honestly touches, and rewards narrow properties over broad
ones.

What the remaining ~73% consists of, and why none of it is more of the same:

- **Strings, prototypes, closures, JSL** -- whole op families, each needing its own generator.
- **The frontend**, 7,290 lines, the largest module: cannot run inside a forked property at all
  (the confirmed Go-runtime hang above). Structural, not a generator gap.
- **Verifier rejection paths, diagnostics, unsupported-opcode branches** -- reachable only by
  generating INVALID programs, which every property here is constructed never to do.

### BLOCKED: native execution of allocating programs

The largest single remaining lever, and it needs a decision rather than more effort. Memory arrives
as an argument, so an allocating program needs a heap in the right slot. Passing a freshly mmapped
region as either the first or the second argument SEGFAULTS, so allocation expects an initialised
structure -- a bump pointer and a limit, most likely -- and not a raw region.

RECOVERED AND ANSWERED. `git show c8b0a65^:tools/native-gc-runtime.c` is a semispace copying
collector, and the first thing it does is bind to the emitted object's SECTIONS:

    extern const uint8_t aot_stackmaps[] __asm("section$start$__DATA$__aot_stackmap");
    extern const uint8_t aot_layouts[]   __asm("section$start$__DATA$__aot_layout");
    extern const uint8_t aot_kernel[]    __asm("_kernel");

So allocating code cannot be executed from an mmapped page at all, whatever is passed as the heap.
The collector needs the stackmap and layout sections and the `_kernel` symbol, which exist only in
a LINKED Mach-O object. This is not an argument-convention problem and no amount of probing solves
it: it is the linked-object capability recorded as lost at the top of this file, met from the other
direction.

Two consequences worth stating plainly. Native heap and GC coverage requires a deftest that drives
`clang` -- which puts it behind the same fork-versus-Go-runtime question as everything else here.
And this corrects an earlier reading in this file: "zero external relocations" means allocation is
INLINED, not that it needs no runtime; the inlined sequence bump-allocates against state the
collector initialises through those sections.

Until that is reconstructed, the heap and array properties compare the interpreter against the
optimiser only, and every GC barrier the deleted native-gc gate covered stays uncovered.
