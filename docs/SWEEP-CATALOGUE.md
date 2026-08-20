> **HISTORICAL, 2026-08-18.** The tools and gates this file describes were deleted with the
> evaluator. Kept for the findings themselves, which Phase A's harness should re-cover.

# The opcode sweep: what is broken, all of it at once

`docs/FUZZ-FINDINGS.md` is the ledger of defects that have been *diagnosed*. This is the ledger of
defects that have been *found*. The two are different jobs and they wanted different tools.

## Why a sweep and not a property

`tests/js-source-prop.coil` shrinks. It finds one counterexample, minimises it, reports it, and
stops — which is the right shape for "is this law true" and the wrong shape for "what is broken".
Two consequences, and both of them shaped this repository:

- **The first failure hides every other one.** A run that finds `rest-param` never gets to
  `instanceof`.
- **A body the frontend cannot lower poisons the search.** With eight steps drawn from a large
  template set, one bad template appears in a large fraction of all generated cases, the shrinker
  converges on it, and the property reports the same known failure for ever. The entire template
  discipline in `docs/FUZZ-FINDINGS.md` — pre-validate every body, bend it around open defects,
  write down that you bent it — exists to work around exactly this.

`tools/js-sweep.coil` inverts it. It enumerates a fixed matrix, prints one line per case, and never
minimises or stops. A body that fails is a *finding* rather than a poison, and a body that fails in
a hundred combinations is one catalogue entry with a count of a hundred. So the probes in
`src/js_probes.coil` are **deliberately unvalidated** — a probe that already works teaches nothing.

The one contract a probe still owes is composition: read the integer accumulator, write it, touch
nothing else. That is what makes any sequence of any probes a valid program, so the sweep needs no
rejection filter and a failing pair is genuinely about the pair.

## What it costs

169 probes, each alone at three constants, then every ordered pair: **29,068 cases in ~12 minutes**,
of which most is restarting after the 2,682 cases that abort the process.

That number is only possible because of `native/js-oracle/oracle.c`. The property reached node
through `popen`, forking and execing a fresh node per case — 63 ms of process startup against a
measured 49.5 ms/case for the whole property, so essentially *all* of the fuzzer's cost was
spawning node and none of it was the compiler under test. One persistent node over a pipe costs
0.076 ms/case, about 650×. A sweep of this size was not affordable before it and is routine after.

It uses `posix_spawn` rather than `fork`, and that is not a style choice: the process also links the
TypeScript-Go bridge, and a Go runtime does not survive `fork` in a multithreaded process.

## Reading the statuses

| status | meaning | a finding? |
|---|---|---|
| `OK` | node and we agree | no |
| `DIFF` | both produced a number and they differ | **yes, the worst kind** |
| `VERIFY` | the graph we built is malformed | yes |
| `EVAL` | the evaluator stopped | yes |
| `CRASH` | the compiler died without naming a cause | yes |
| `INDEX` | the frontend refused the source, naming the construct | usually not |
| `REFUSED` | the frontend refused a syntax kind, naming it | no |
| `TIMEOUT` | no result within the batch timeout | yes |

`REFUSED` and `CRASH` were one status until this run separated them, and they are opposite
outcomes: the first is the design working, the second is a defect. The distinction comes from the
first stderr line after the case announcement, because an abort cannot be caught from inside the
process — which is also why the sweeper announces each case *before* running it, so the shell
driver can recover which case died and restart after it.

## Results

| status | first run | now |
|---|---|---|
| `OK` | 18,094 | **18,630** |
| `INDEX` (refused, named) | 5,508 | 5,814 |
| `REFUSED` (syntax, named) | 2,385 | 3,796 |
| `EVAL` | 1,332 | 828 |
| `VERIFY` (malformed graph) | 860 | **0** |
| `DIFF` (wrong answer) | 592 | **0** |
| `CRASH` | 297 | **0** |

**No case in 29,068 now produces a wrong answer, a malformed graph, or an unnamed crash.** What
remains is `EVAL` — programs the evaluator stops on — and the two refusal columns, which grew
because constructs that used to be dropped silently are now declined by name. A larger `REFUSED`
count against a smaller `DIFF` count is the trade this project wants: the compiler saying what it
cannot do, instead of answering wrongly.

Regenerate with `tools/js-sweep.sh`; the machine-readable form is `out/sweep/catalogue.md`.

36 of 169 probes failed alone on the first run. Because each also fails in most of its ~169
pairings, the case counts are far larger than the number of findings — which is why the catalogue
splits "fails alone" from "only the pair fails".

### Wrong answers — no crash, no complaint, a well-formed graph

The worst class, because nothing signals it.

| what | repro |
|---|---|
| ~~a rest parameter always has length 0~~ — now refused by name | `repros/open/rest-parameters-are-unimplemented.js` |
| ~~`acc == String(acc)` is false; JavaScript says true~~ — **fixed** | `repros/loose-equality-number-to-string.js` |

### The compiler dies

| what | repro |
|---|---|
| ~~`instanceof` hands the JSL layer a NO-NODE argument~~ — **refused by name** | `repros/open/instanceof-against-a-global.js` |
| ~~`Array.prototype.unshift` never terminates~~ — **fixed** | `repros/array-unshift-does-not-terminate.js` |

### The graph is malformed

| what | repro |
|---|---|
| ~~a method on a primitive receiver~~ — **refused by name** | `repros/open/method-call-on-primitive-receiver.js` |
| a closure capturing a `let` loop variable | `repros/open/closure-capturing-a-loop-variable.js` — **open** |

### The evaluator stops

| what | repro |
|---|---|
| ~~object spread narrows without proof~~ — **refused by name** | `repros/open/object-spread-is-unimplemented.js` |
| unary `+` **fixed**; `forEach` folds into the closure item; `JSON.stringify` **open** | `repros/unary-plus-does-not-coerce.js`, `repros/open/undefined-for-these-values.js` |

### Composition only — both halves clean, the pair is not

These are the ones worth reading first. Nothing is wrong with either construct, so what failed is
what the compiler carried across the join, and every finding in `docs/FUZZ-FINDINGS.md` so far has
been of this kind.

| what | repro |
|---|---|
| ~~an object literal, then a write through a nested object~~ — **fixed** | `repros/nested-object-write-after-an-object-literal.js` |
| ~~`Math.trunc`, then `++`/`--`~~ — **fixed** | `repros/truncate-then-increment-stays-tagged.js` |
| ~~`Math.trunc`, then `if (true)`~~ — **fixed** | `repros/truncate-then-live-branch.js` |

**Three of those sit behind a builtin call.** Together with the already-fixed
`repros/dead-branch-after-builtin.js`, that is four distinct symptoms downstream of `Math.*`, and
they look more like one root cause — a builtin's result reaching the next block in the wrong
representation — than like four defects.

## Unsupported, and the diagnostic problem underneath

Most of the 5,508 `INDEX` cases are the compiler correctly declining something it does not
implement: `Math.imul`, `Math.clz32`, `Math.hypot`, regular expressions, `Map`, `Set`, `Symbol`,
`Date`, `Boolean`. Those are gaps, not defects.

**But the diagnostic misattributes several of them.** A `class` declaration, an object getter, an
object setter, a shorthand method, and array and object destructuring are all reported as
`unbound-name` — pointing at `C0`, `g`, `get2`, `x0` — rather than as unsupported syntax. The name
is unbound *because* the construct that would have bound it was not handled, so the report names
the symptom and not the cause. Anyone chasing "unbound name `g`" is looking for a typo.

That the sweep can say this at all is new. Before this run every one of those 5,508 cases came back
as the bare word `INDEX`: the frontend records a `status`, an `error-code` and the offending AST
node, and nothing read them. `fe-error-text`, `fe-code-name` and `fe-status-name` in
`src/frontend_native.coil` are what turned "the source did not index" into
``unsupported/unknown-builtin at `Math.clz32(acc)` ``.

The genuinely refused syntax — `try`/`catch`/`finally`, `for...of`, `for...in`, array spread,
`x as T` — is reported correctly by name and is not a finding.

## Where these fixes belong

Ten defects were fixed and **two** landed in `lib/`, the DSL that is supposed to own JavaScript
semantics. `docs/DSL-OWNERSHIP.md` has the measurement and the gate that now guards it: 214 DSL
definitions, 21 of them called from nowhere, and seven ECMAScript abstract operations the frontend
open-codes instead of calling. Read it before fixing anything here — the first question about a
defect in this catalogue is which side of that line it belongs on, and the answer has usually been
"the DSL" more often than the code suggests.

## Work order

Ordered by what a fix buys, not by how the sweep grouped them. Tick as they land; a finished item
moves its repro from `repros/open/` to `repros/`, gains a deftest in `tests/js-source-prop.coil`,
and gets its diagnosis written into `docs/FUZZ-FINDINGS.md`.

| # | item | why here | state |
|---|---|---|---|
| 1 | `rest-param` reports length 0 | silent wrong answer — nothing signals it | **wrongness fixed**; refused by name, feature still unimplemented |
| 2 | `loose-eq` number/string | silent wrong answer | **done** — `LooseEqual` in the JSL library |
| 3 | `instanceof` NO-NODE | the only genuine crash in 29,068 cases | **done** — refused by name; the global is still unimplemented |
| 4 | the `Math.*` cluster | 2 open repros + 1 already fixed; probably one root cause | **done** — one cause, as suspected |
| 5 | `tofixed` / `str-replace` | same violation at the same node — likely one fix, two probes | **done** — one fix; both methods still unimplemented |
| 6 | `arr-unshift` non-termination | a hang is worse than a refusal | **done** |
| 7 | `closure-in-loop` | per-iteration capture, a real language feature | **open** — localised, see below |
| 8 | `obj-spread` unproven Cast | `Object.assign` spelling already works, so the shape logic exists | **done** — refused by name; spread still unimplemented |
| 9 | the "undefined for these values" trio | one status, three probably-unrelated causes — split first | **split**: unary `+` **done**; `forEach` folds into #7; `JSON.stringify` **open** |
| 10 | nested object after an object literal | composition, alias-state family | **done** |
| 11 | the 10 misattributed `unbound-name` refusals | cheapest item here; today the compiler misdirects | **open** — needs a refusal in the INDEX pass, before name resolution runs |
| 12 | missing builtins (`Math.imul`/`clz32`/`hypot`, `Map`, `Set`, `Symbol`, `Boolean`, `Date`) | feature work, not defects | todo |

## What is still open, and what is known about it

### A captured cell written inside a loop or a capturing callback (#7, and #9's `forEach`)

`repros/open/closure-capturing-a-loop-variable.js`

    evaluator stopped: a memory edge does not describe the alias class being touched

Localised by contrast, which is most of the work already done:

| shape | verdict |
|---|---|
| object field mutated in a loop, read after | **works** |
| captured cell mutated straight-line, read through a closure | **works** |
| captured cell mutated in a BRANCH, read through a closure | **works** |
| captured cell mutated in a LOOP | **fails** |
| the same, with a call BEFORE the loop | **works** |
| `forEach` with a non-capturing callback | **works** |
| `forEach` with a capturing callback | **fails** |
| `for (let i…)` closing over `i` | wrong value — needs per-iteration bindings, a real feature gap |

Two facts point at the fix. First, the failing graph is **structurally identical** to the working
object-field one — same `New`, `Store`, `Loop`, `Phi`, `Load`, same aliases — so the frontend is
emitting the right shape and the evaluator is not walking it. Second, inserting a call before the
loop makes it work, and a call resets the frontend's memory anchor (`memory := NO-NODE` after a
`CallEnd`), which forces every alias to be re-derived from control. The loop also builds only ONE
memory phi where the closure's environment object has aliases of its own.

The `for (let i…)` case is separate and is a genuine feature gap: JavaScript creates a fresh
binding per iteration and this compiler allocates one cell outside the loop.

### `JSON.stringify` (#9)

Fails even for `JSON.stringify(5)`, so it is not about the object being serialised.

### The misattributed `unbound-name` refusals (#11)

`class`, getters, setters, shorthand methods and destructuring are all reported as `unbound-name`
pointing at the name the missing construct would have bound. The fix belongs in the INDEX pass: it
must refuse the declaration form by name before name resolution runs and reports the symptom. The
graph-building dispatch already does this for statements and expressions; indexing does not.

## Working on these

Every entry above has a runnable repro:

    coil build tools/js-repro.coil -o out/js-repro
    out/js-repro repros/open/rest-parameters-report-length-zero.js 7

`repros/` and `repros/open/` mean different things and the split is load-bearing:

- **`repros/` all pass.** Each is a defect that was diagnosed and fixed, kept so the next
  regression is one command away. `for f in repros/*.js; do ./out/js-repro "$f" 10 || echo "FAIL $f"; done`
  reporting nothing is the regression suite.
- **`repros/open/` all fail.** Each is a defect that has been found and not yet diagnosed. When one
  is fixed it moves to `repros/`, gets a deftest in `tests/js-source-prop.coil`, and its probe is
  worth promoting into `src/js_templates.coil` so the property explores it too.
