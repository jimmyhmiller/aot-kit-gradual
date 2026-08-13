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

### 2. Proof that emitted machine code runs

The deleted native gates emitted a Mach-O object, linked it against a C harness with `clang`, ran
the binary, and checked the answer — `arm64 Mach-O linked and executed; kernel returned 84`. A
deftest runs in-process and cannot link.

A deftest **can** assert on the encoded bytes and on the evaluator's result, which covers "the
graph computes the right value" and "selection/allocation/encoding produced the expected
instructions." It does not cover "the CPU agrees."

`coil.os` exposes `fork`, `execvp`, `waitpid`, `pipe`, `dup2`, so a deftest could drive `clang`.
Note before trying: `coil test` already forks each test, and forking again inside a test child to
exec a toolchain is the multithreaded-fork pattern behind this project's signal-9 saga.

---

## Owed, by capability

Ordered by how much was lost. Each row names what the deleted gate proved and the shape of the
deftest that replaces it.

### Native execution — `native-gate.sh`, `native-object-gate.sh`, `native-gc-gate.sh`, `fp-native-gate.sh`, `jsl-native-gate.sh`

| Proved | Deftest owed |
|---|---|
| arm64 Mach-O links and executes; kernel returns 84 | Build the graph, run the backend, assert on `be-object-len` and the encoded instruction sequence. Execution is not recoverable in-process. |
| Six call layouts + external allocation relocation linked and executed | Per-layout deftest asserting the selected machine program and relocation entries. |
| Fast allocation, promotion, recursive raw/boxed roots, old-to-young barriers; OOM and omitted barriers trap | Per-scenario deftest over the GC graph; assert barrier nodes are present where required. The *trap* cases were the strongest part of this gate — they need explicit negative deftests. |
| FP semantics, constants, calls, Phis, safepoints, forced spills execute natively | Deftests at 8 and 1 registers asserting the allocated/encoded form; evaluator for values. |
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
