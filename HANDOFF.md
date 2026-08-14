# Handoff: testing

The gate is `coil test`. 538 tests, ~25s, project mode. Nothing else runs.

The previous handoff (the iteration-loop mission) is in git history before this commit. That mission
landed: the gate went 257s to 25s. This one is about what the tests actually prove.

---

## Start here: make the opcode set a type

92 opcodes are declared as bare integers in `src/node.coil`:

    (const OP-ADD i64 14)
    (const OP-MUL i64 15)
    ...
    (const OP-COUNT i64 90)     ; already wrong -- there are 92

They should be a `defsum`. This is first in the handoff because it is the structural fix for the
coverage problem described further down, not because it is tidy.

**Why it matters for testing.** `coil.prop` derives generators from types: `(derive Arbitrary Op)`
would generate all 92 opcodes. Today every property generator hand-picks about 15, which means a
person is choosing which parts of the compiler get exercised, and that person forgets. The coverage
ceiling measured this session traces directly to that.

**Why it matters beyond testing.** `match` over a sum is exhaustive. A missing case becomes a
compile error. The backend defect found and fixed this session (`be-select-program!` accepting a
float program, emitting `0xFFFFFFE0/E1/E2` as instructions, and passing every downstream check) was
*exactly* a missing case that reported success. Exhaustiveness would have made it unwritable.

**The objections I raised and then measured away:**

| worry | reality |
|---|---|
| a tagged union is wider than `i64` | **identical.** Measured: an all-nullary `defsum` is 8 bytes, same as `i64`. Only sums with payloads pay (that test sum was 16). |
| opcodes are used as array indices | **one site.** `gtext.coil:716` loops `0..OP-COUNT` searching by name. Everything else is `=` or `case`. |
| enormous churn | ordinary. 92 constants; `case` forms become `match`. |

Fix `OP-COUNT` first regardless — it says 90 against 92 constants, so anything iterating that range
silently skips two opcodes.

### Manual or lint+fix?

**Split it by whether the change needs a decision.**

*Mechanical, automate freely:* renaming the constants, rewriting `(= (n-op x) OP-ADD)` comparison
sites, the single `gtext` integer loop. A `coil lint --fix` rule or plain `sed` handles these, and
`coil test` is a sound gate for them.

*Semantic, do by hand:* every `case` over opcodes with a default arm. Exhaustiveness will reject
these, and **that rejection is the entire point.** Each one is a question only a person can answer:
is this default a genuine fallback, or a missing case that has been quietly succeeding?

**The trap to avoid:** an auto-fix that satisfies the compiler by inserting a catch-all arm produces
a green build that has learned nothing, and destroys the one benefit worth having. If you write a
lint rule, make it *report* incomplete dispatches, never repair them.

**`hivemind` fits the mechanical half well** — it is file-partitionable, the gate is the real test
suite, and a failed unit reverts. Point it at the comparison sites and the constant renames, keep
the `case`-to-`match` work in your own hands.

**Sequence that keeps the tree green:** fix `OP-COUNT`; add the `defsum` alongside the constants;
convert `n-op`'s return type and let the compiler list the sites; do the mechanical ones in bulk;
then work the exhaustiveness failures one at a time, treating each as a possible bug rather than a
compile error. Expect that pile to be large and to contain at least one real finding.

---

## What testing looks like now

Eight properties plus supporting tests, all in `tests/backend-parity-prop.coil` unless noted. Every
one was **falsified before being trusted** — broken deliberately, confirmed to fail, restored. Keep
that discipline; it caught three of my own mistakes this session.

| property | law |
|---|---|
| `native-agrees-with-interpreter-at-the-allocator-floor` | compiled code means the same at 8 registers and at the tightest count the allocator claims to solve |
| `loop-native-...` | same, for values live across a back edge |
| `float-native-...` | same, through the FP register bank |
| `call-native-...` | same, for values live across a call boundary |
| `optimization-preserves-meaning` | `iterate!` must not change what a program computes |
| `float-optimization-...` | same, where `x*0`, `x+0`, `x/x` are the tempting wrong rewrites |
| `heap-optimization-...` | same, over two objects of one shape — the case alias analysis can get wrong |
| `array-optimization-...` | same, over marked allocations and indexed storage |
| `every-shape-agrees-under-one-corpus` | all of the above behind ONE corpus, so the search can splice shapes together |
| `an_uncompilable_program_is_refused_by_name...` | what the backend cannot compile is refused by name and publishes nothing |
| `the_verifier_reaches_a_verdict...` | a malformed graph gets a verdict, not a crash, and a rejection names itself |
| `string_optimization_preserves_meaning` | concat/length folding preserves meaning |
| `node_agrees_with_the_compiler` (`js-source-prop.coil`) | **the only external oracle.** Same TypeScript to `node -e` and to us |
| `a_linked_object_agrees_...` (`linked-object-test.coil`) | a real Mach-O object, linked with clang and executed |
| `an_allocating_program_runs_under_the_collector` | allocation through the real GC |

`docs/DEFTESTS-OWED.md` is the ledger: what the deletion of the shell gates cost, what has been
recovered, and what is still owed. Read it before assuming green means what it used to.

---

## The coverage picture, and what would actually move it

27.3% of instrumented edges (3173 of 11618). It went 17.4% to 27.3% this session across four levers,
each smaller than the last: unified corpus (+815), Mach-O publication (+244), arrays (+99), shift
operators (+32).

**Do not chase this percentage directly.** Two measurements explain why:

- **The denominator grows with the numerator.** Pulling a subsystem into a property instruments it
  too. Mach-O added 244 covered and 656 total.
- **New program shapes mostly re-tread old paths.** Going from seven shapes to nine in the unified
  corpus added *nine edges*. Distinct properties are not distinct coverage.

**What would move it, in order:**

1. **The opcode sum type**, above. Generators stop being limited by what someone typed out.
2. **Real JavaScript through the real frontend.** `frontend_native_graph.coil` is 7,290 lines, the
   largest uncovered block. The lifter already exists (`js-source-prop.coil` emits TypeScript from
   the same description that drives the IR) and both paths agree. It is blocked on one thing: the
   property runner forks per case and the frontend reaches the TypeScript-Go bridge, whose Go
   runtime cannot survive a fork. Measured: 40 cases pass in 4.8s under `--no-fork`, watchdog at 60s
   with forking. If that loop moves to `posix_spawn` — the fix the *test* runner already took for
   the signal-9 problem — convert `frontend_translates_generated_javascript_faithfully` from a
   table-driven deftest back to a `defprop` and delete the caveat in `DEFTESTS-OWED.md`.
3. **More string operators.** Concat and length are two of twenty-odd. An attempt to add
   `STRINGUPPER`/`STRINGLOWER`/`STRINGSUBSTRING` crashed the property with an ambiguous LEAK
   naming nodes the string program does not contain — unresolved, worth a fresh look.
4. **Prototypes and closures.** Untouched subsystems. Expect ~400 edges each, on the strings
   precedent.

---

## Method notes

These are here because each cost real time, and all three have the same shape: **a green signal I
did not try to break.**

- **A generator arm that never fired.** The branch step was chosen from a byte's *high* bits while
  the `(slice u8)` generator produces printable ASCII, so the diamond code was dead through 31,000
  cases while coverage sat flat and looked like a ceiling. Every counterexample the property had
  ever printed was ASCII — the evidence was in plain sight. `every-generator-arm-fires` now asserts
  structurally that each arm produces the nodes it should.
- **A property that passed while testing nothing.** The call property searched for an allocator
  floor up to 8 registers; that shape needs 11, so the precondition never held and 200 of 200 cases
  were rejected. The runner reported it; watch for that warning.
- **A "solved" claim from one lucky run.** A linked allocating program printed the right answer once
  and I wrote it up. The same binary, re-run minutes later, exited 139. It was faulting on
  uninitialised state that happened once to be benign. **Re-run anything that manages its own
  memory before believing it.**

And the pattern worth carrying: every *capability* limit I claimed this session and then tested was
wrong — linked-object execution, driving clang from a deftest, GC allocation, rejection paths,
strings were all reachable. Every *arithmetic* limit held. Be suspicious of "can't", trust "the
numbers don't get there" only after measuring.
