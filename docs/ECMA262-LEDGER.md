# ECMA-262 ledger workflow

The raw ledger turns fixed upstream revisions into the work queue described by
`docs/ECMA262-JSL-COMPLETION-PLAN.md`. It is deliberately factual rather than optimistic: every
normative clause and grammar production starts as `unclassified`. Later classification artifacts
must account for those entries; the extractor never infers that matching names mean implemented
semantics.

## Revisions and artifacts

`spec/ecma262-sources.json` is the machine-readable source of truth. It pins full Git commits for
ECMA-262 and Test262, the ECMA-262 entry document, and the entry document's SHA-256 digest. The
digest protects against generating evidence from a modified checkout.

`spec/generated/ecma262-raw-ledger.json` is deterministic output from those pins. It records:

- every Ecmarkup clause, including normative status, clause type, algorithm kind, signatures,
  effects, built-in metadata, and exact source location;
- direct abstract-operation and clause dependencies found in cross-references;
- every named grammar production and every declaration location;
- explicit unclassified disposition and status fields;
- totals recomputed from the entries and all Ecmarkup diagnostics.

At the current pin the ledger contains 2,340 clauses (2,268 normative) and 404 named productions
(387 normative), with zero Ecmarkup warnings. The reviewed overlay now classifies all 2,655
normative work items; the raw ledger remains factual and unclassified so regeneration cannot
manufacture implementation claims.

## Fast feedback

Run this after changing the extractor, fixtures, pins, or generated ledger:

```sh
npm run spec:ledger:gate
```

It does not use the network, clone either upstream repository, compile the project, or run
Test262. The fixture suite exercises imports, abstract-operation dependencies, built-ins,
syntax-directed operations, normative and informative annexes, grammar, source locations, digest
rejection, and corruption rejection. The offline validator then checks the complete committed
ledger against the pins and verifies unique identities, locations, production references,
classification fields, and recomputed summary totals.

For one focused extractor iteration, run only:

```sh
npm run test:spec-ledger
```

This is the quickest proof that a newly represented spec construct is extracted correctly. Add a
minimal fixture containing that construct and assert its exact ledger entry. Do not wait for a full
ECMA-262 build or Test262 run to discover an extractor regression.

These checks complement rather than replace the repository's standing gates:

```sh
coil test
coil test --suite frontier
```

## Reproduction and pin updates

The first generation fetches the exact ECMA-262 commit into the ignored `.spec-cache/` directory:

```sh
npm run spec:ledger
```

Subsequent byte-for-byte reproduction is network-free while that checkout exists:

```sh
npm run spec:ledger:check
```

Updating upstream inputs is an explicit review event:

1. Choose full ECMA-262 and Test262 commit hashes and record their commit timestamps.
2. Update `spec/ecma262-sources.json`, including the SHA-256 of the new ECMA-262 entry document.
3. Run `npm run spec:ledger` and inspect both the pin diff and generated ledger diff.
4. Run `npm run spec:ledger:gate` and `npm run spec:ledger:check`.
5. Report added, removed, and identity-changed work items. Never hide upstream changes by editing
   generated output or retaining classifications against a different clause identity.

The ignored checkout is only an acquisition cache. It is not evidence and may be deleted safely;
the pins, generator, dependency lock, fixtures, and committed ledger are the reproducible evidence.

## Next classification boundary

The raw ledger does not yet claim JSL coverage. The next generated layer must join ledger identities
to reviewed JSL provenance, frontend structural handlers, runtime primitives, host hooks, or tested
unsupported boundaries. It must preserve the raw entries, reject duplicate canonical claims and
stale clause ids, and make the classified-versus-total count mechanically derivable. Name
similarity and spec-URL comments can propose matches, but only explicit reviewed metadata can turn
an item from `unclassified` into a coverage claim.

That boundary is now executable. `npm run spec:provenance` regenerates
`spec/generated/jsl-provenance.json`; `npm run spec:provenance:check` rejects drift. The report
separates checked claims from exact-name and preceding-spec-link candidates, including ambiguous
candidates that require manual resolution. At the initial witness it reports one checked complete
claim (`ToBoolean`), 68 unique candidates, four ambiguous candidates, and 295 declarations with no
automatic candidate. These figures measure review state, not semantic completion.

## Coverage overlay and operation workbench

`spec/ecma262-classifications.json` is the reviewed non-JSL classification overlay. Generated JSL
claims are joined automatically; duplicating one in the overlay is an error. Every manual entry
must name its owner, status, and evidence. Partial entries require a deviation, complete entries
forbid one, unsupported ownership requires unsupported status, and blocked entries require named
prerequisites.

`npm run spec:coverage` generates `spec/generated/ecma262-coverage.json`, and
`npm run spec:coverage:check` rejects drift. The report currently accounts for all 2,655 normative
items, emits 4,449 resolved abstract-operation dependency edges, computes public built-in closure
status, and ranks prerequisites by transitive dependent items and public algorithms unlocked. It
does not treat an absent classification as anything except `unclassified`.

For a single JSL declaration:

```sh
npm run spec:operation -- ToBoolean
```

## Exact Test262 transition evidence

Retained Test262 JSONL is compared by the expanded variant identity, not by aggregate totals:

```sh
npm run test262:compare -- results/before.jsonl results/after.jsonl
```

The identity is the canonical `test/...` path plus the runner's explicit variant (`default`,
`strict`, `module`, `policy`, or another emitted variant). Canonicalizing the path makes results
from different Test262 checkout roots comparable without collapsing distinct tests. Duplicate
identities and unknown statuses are errors.

The report separates shared transitions from added and removed variants. Its exit status is
nonzero if the cohorts differ or any shared variant moves from `passed` to `failed`, `refused`, or
`skipped`. This prevents an aggregate pass count from hiding a regression or a changed input set.
Run `npm run test:test262-compare` for the sub-second focused contract tests; it is also included in
`npm run spec:ledger:gate`.

### Mapped operation cohorts and retained evidence

`spec/ecma262-operations.json` maps an operation to deterministic `test/...` paths at the pinned
Test262 revision. Run one without invoking the whole corpus:

```sh
npm run spec:test262 -- ToBoolean --test262 .spec-cache/test262 --quick
```

The retained form writes exact variants and, when the mapping names an evidence sidecar, a
deterministic record containing the Test262 commit, mapping, JSONL SHA-256, status totals, and
variant count. `spec:coverage:check` reconstructs and verifies that record offline. A result outside
the mapped paths, an edited JSONL, stale totals, duplicate identity, or wrong commit fails the gate.

The first pinned `ToBoolean` evidence covers 38 logical-not variants: 30 pass and eight fail. Its
exact before/after comparison has no cohort drift and no pass regression. Two BigInt failures
directly establish that the operation is partial on the currently represented language surface;
four `eval` failures and two constructor-heavy failures expose separate prerequisites. Those tests
remain in the cohort so the evidence reports the whole direct surface.

## Reviewed classification families

`spec/ecma262-classifications.json` supports narrow reviewed rules over factual ledger fields. A
rule expands into individual coverage records; overlapping rules, overlap with explicit/JSL claims,
unknown inclusions/exclusions, empty matches, and invalid statuses all fail generation. Rules do
not infer completion.

Blocked rules reference `spec/ecma262-capabilities.json`. Every capability has a stable id, owner,
status, evidence, and description; unresolved prerequisite strings are rejected. Current reviewed
families classify all 2,655 normative items: 1,140 JSL, 626 frontend, 88 runtime, 21 host, and 780
composite. The generated candidate queue is empty. This is a zero-gap ownership milestone, not a
conformance claim: 2,536 items remain blocked, 11 are partial, and 108 are complete. Suggestions
remain non-claims whenever a future pin introduces a new gap.

This checks provenance and coverage manifests, lowers only that declaration and its transitive JSL
callees into a synthetic caller, verifies the graph, and runs the retained native-versus-Node
witness named in `spec/ecma262-operations.json`. `ToBoolean` is the complete pure-operation proof;
`SetProperty` is the partial heap-mutating proof with its missing spec boundary named explicitly.
The callback/abrupt `ArrayReduce` witness currently stops honestly at selection and is filed as
`reduce-callback-throw-invalid-phi-edge` in the executable frontier.
