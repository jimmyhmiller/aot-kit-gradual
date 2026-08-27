# Independent Test262 compilation batches

## Objective

Recover whole-corpus compilation throughput without representing independent Test262 Scripts as
JavaScript functions, evaluating multiple tests in one Realm, or replacing the official harness.

## Required semantics

- Every selected test variant has a fresh Realm and global object.
- `assert.js`, `sta.js`, requested includes, and the test remain distinct Script records evaluated
  in metadata order.
- Directive prologues, top-level `this`, global declaration instantiation, lexical declarations,
  early errors, abrupt completion, and runtime-negative matching are unchanged by batch size.
- A timeout or native crash affects one test result and cannot suppress later batch members.
- Results retain one durable JSONL row per `(path, variant)`.

## Why a dispatcher over one combined AST is wrong

The current frontend indexes every SourceFile in one `NativeFrontend` symbol table and lowers every
Script record through one `g-start`. Appending alternative test Scripts and branching only during
graph construction is too late: duplicate lexical declarations, global function identities,
captures, strictness, and early errors have already interacted during indexing. Generated function
wrappers are also invalid because they replace Script semantics with function semantics.

## Compiler architecture

1. Introduce a compilation-batch owner containing one immutable parsed/indexed harness prefix and
   one independently parsed/indexed test unit per variant.
2. Give every test unit its own Script declaration environment and frontend symbol namespace.
   Harness declarations are imported through an explicit compiled-unit interface, not copied into
   the test namespace or resolved by source concatenation.
3. Compile harness function bodies and DSL callees once. Emit a per-test structural entry that
   performs fresh harness Script initialization, requested include initialization, and that test's
   Script evaluation against a new global object.
4. Publish all entries in one machine-code image with an entry table indexed by the native runner's
   integer argument. Shared text is immutable; heap/global state is created only after the child is
   forked.
5. Fork one child per selected entry. The child executes exactly one entry and returns the existing
   full-width diagnostic record through the result pipe.

## Implementation work queue

- [x] Separate Script semantics from sole-host-`Start` publication and prove one compiler-generated
  dispatcher calling an internal Script entry through graph verification and machine selection.
- [x] Give independently indexed source units an explicit base for disjoint graph-level callable
  identities without rebasing their local frontend resolution tables.
- [x] Add an append lifecycle for independently indexed `NativeFrontend` owners, with one final
  whole-image analysis pass and a compiler-owned integer dispatcher over internal Script entries.
- [x] Prove two independent frontend owners with disjoint callable identities survive graph
  verification and machine selection in one image without JavaScript wrappers.
- Split `fng-top-level-initialize!` into declaration/evaluation for a specified Script-unit range.
- Add backend exported-entry metadata rather than assuming only `mu-function-code-start(0)` is the
  host kernel.
- [x] Add a native persistent protocol request carrying a batch manifest, common harness records, and
  independent test records.
- [x] Group only variants with identical harness/include prefixes; strictness remains property of each
  final test Script.
- Add semantic witnesses for duplicate `let`, duplicate function names, top-level `this`, strict
  directives, abrupt completion, global persistence inside one test, isolation between tests,
  runtime negatives, crashes, and timeouts.
- [x] Compare every result in a deterministic official cohort against singleton compilation before
  enabling batching by default.

## Current performance blocker

The end-to-end manifest path exists but is deliberately opt-in (`--batch-size` defaults to 1).
The current deterministic 100-file/190-variant upstream cohort has zero singleton-versus-width-2
status changes: both report 42 pass, 129 fail, and 19 refuse. Width 2 nevertheless regresses
execution from 11,261 ms to 17,174 ms. Combined graphs increase analysis, selection, scheduling,
and allocation costs superlinearly, and failures after indexing can still force singleton fallback.

The next implementation must share immutable compiled harness/JSL machinery without making two
tests one graph-wide optimization problem. Each test must retain independent Script records,
frontend namespace, graph ownership, global initialization, and forked execution. Do not
concatenate source, wrap tests in functions, share one executed Realm, or classify failures away in
the runner.

## Current safe optimizations

Persistent compiler workers retain the checked DSL index. ARM64 execution forks after compilation
and runs encoded code in memory in a fresh child. Test262 publication emits only model-verified GC
metadata rather than serializing a complete Mach-O container. These reduce fixed overhead but do
not share frontend declarations or JavaScript-visible state.

## Measured boundary

An identical 100-file/200-variant compiled cohort on 2026-08-25 averaged 299.69 ms in
`frontend_graph`, of which 230.54 ms was analyze/fold/iterate. Selection averaged 15.82 ms,
allocation 10.63 ms, publication 2.84 ms, and isolated native execution 2.33 ms. Consequently, a
batch that only shares parsing, process startup, encoding, or publication cannot restore the old
throughput. The large gain requires sharing compiled and analyzed harness code across independent
entries while preserving a fresh Realm and global initialization for each child.

As a separate singleton improvement, natural-loop discovery now consumes CFG predecessor
adjacency rather than rescanning all edges for every visited block. The same cohort reduced that
phase from 18.66 ms to 0.394 ms per variant. This does not replace independent-entry batching.
