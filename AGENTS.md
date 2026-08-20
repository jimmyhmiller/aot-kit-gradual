# Standing orders

## Run both suites. Every time.

```
coil test                      # the gate. MUST be green. Anything red here is a regression.
coil test --suite frontier     # the open bugs. RED, and that is the point.
```

**Run the frontier suite at the start of a session and again before you hand off.** It is
`default = false` in `Coil.toml` so a permanently red `coil test` cannot destroy the gate's
meaning — the gate answers "did MY change break something", and it can only answer that if green
means green. That is the only reason it is opt-in, and it is the one thing about this design that
could let the frontier drift out of sight. Hence this file, and hence the banner the gate prints:

```
=== THE FRONTIER: 8 OPEN BUGS ===
```

## The frontier IS the work queue

Its failures are not noise to route around. Each one is a bug this compiler has, written as a test
that asserts the answer node gives, so it is red today and goes green the day it is fixed. **When
there is no other assignment, take one.** Read `docs/NATIVE-FRONTIER.md` for the status table, and
the repro file itself for the diagnosis — each carries node's answer for `main(7)`.

- **Fixing one is zero test edits.** The test goes green and simply stays, as the regression test
  it already was. Regenerate `docs/NATIVE-FRONTIER.md` (the gate will tell you and leave the fresh
  copy in `/tmp/aotk-frontier.md`) and delete the repro only once the case is pinned in
  `tests/native-execution-test.coil`.
- **Adding one is two edits:** a `repros/open/*.js` file, and a `deftest` in
  `tests/frontier/open-bugs-frontier.coil`. The gate refuses to pass if those disagree in either
  direction — a bug with no test, or a test whose repro was deleted.
- **Never turn a frontier test green any other way.** Not by weakening the assertion, not by
  deleting the repro, not by narrowing the program until it passes. The suite is red on purpose;
  the honest number is the whole value.

### Why it is shaped this way

`repros/open/` used to be four hand-written bug files with a paragraph each, and nothing ran them:
the tool that did was deleted with the interpreter and the paragraphs stayed. Two of the four were
FIXED and still filed as open — one of them by a change made hours earlier the same day. A bug
record nothing executes is worse than no record, because it reads as current.

The first replacement asserted each bug was still BROKEN, which kept the gate green and was wrong
for a specific reason: fixing a bug would turn a GREEN thing RED, and the remedy would be to go
edit a test. That teaches "red means go edit the bug list". These go the other way.

## `lib/` owns JavaScript semantics. The compiler owns structure.

`lib/**/*.jsl` is the DSL, and it is the ONE implementation of every JavaScript operation. The
frontend lowers syntax into calls on it (`fng-jsl-call*`) and must never open-code an operation the
DSL defines or could define. If a fix is tempting to write in `src/frontend_native_graph.coil`, ask
first whether the meaning belongs in `lib/` — it almost always does, and the frontend's job is only
to build the graph that reaches it.

`tests/dsl-ownership-test.coil` enforces this with four invariants, including an EXACT list of the
operations the frontend still open-codes. That list is currently empty. It may shrink. It is not
allowed to grow by accident.

## Everything else

`HANDOFF.md` is the running narrative: what landed, what it cost, and the witness for each claim.
Read its top section first — it is most-recent-first — and add to it rather than replacing it.
