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

### 1. An independent authority on what the answer *is*

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

### 2. Proof that a LINKED OBJECT runs

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
- **Straight-line only.** No branches, loops, calls or memory. *Owed:* generators for control flow
  and for the heap — the latter is where the deleted GC gates lived.
- The argument is reduced into ±2^40 to keep ADD/SUB exact.

### Measured: the generator saturates at 6.5% of the backend

With the fixed fuzzer (see below), 40,000 guided iterations ran 31,052 cases with no disagreement
between the interpreter and natively-executed code. Real assurance, but narrow — and the coverage
number says how narrow:

    corpus 12, 561 of 8650 edges, 64 comparison pairs

**That number is identical at `-n 10`, `-n 2000` and `-n 40000`, and identical again after deleting
the persisted corpus at `.coil/build/fuzz` and starting fresh.** Coverage saturates almost
immediately: straight-line ADD/SUB over one integer argument cannot reach the other 93.5% of the
backend, so more iterations buy nothing. **Broadening the generator is the only lever that matters
here** — control flow, memory, calls, and the remaining opcodes, in roughly that order.

Also measured: 22.9% of cases are discarded by `assume` (programs whose allocator floor exceeds
`WIDE-REGS`). That is the generator's balance between `MAX-OPS` and `WIDE-REGS`, not a fuzz problem,
and it is wasted work worth tuning.

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
