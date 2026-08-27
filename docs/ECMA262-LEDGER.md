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
(387 normative), with zero Ecmarkup warnings. All 2,655 normative work items remain explicitly
unclassified until the classification phase supplies reviewed ownership and evidence.

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
