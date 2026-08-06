# Current slice: B15 Richards and DeltaBlue closure

The evaluator execution-model refactor proposed in
[EVALUATOR-EXECUTION-MODEL.md](EVALUATOR-EXECUTION-MODEL.md) is the recommended prerequisite for
continuing the DeltaBlue ideal-oracle repair. B15 remains active throughout that work.

## Contract

The unchanged pinned Richards and DeltaBlue programs must compile through the canonical native
frontend and pass their original correctness checks in every required execution and stress mode.

## Deliverables

- [ ] Pin the original Richards and DeltaBlue checks and exact Node observables.
- [ ] Compile both complete programs without source substitution or benchmark-name dispatch.
- [ ] Reduce each remaining failure to a general capability witness before repairing it.
- [ ] Pass raw and optimized ideal execution for both programs.
- [ ] Pass native arm64 execution under normal and forced register pressure.
- [ ] Pass moving-GC stress and deterministic scheduling-seed matrices.
- [ ] Corrupt Richards queue/hold expectations and DeltaBlue projection expectations independently.
- [x] Add `tools/gates/B15.sh`; keep its contract latch red until all remaining evidence passes.

## Exit evidence

B15 closes when both unchanged benchmark programs pass their original checks against Node in raw
ideal, optimized ideal, native, pressure, GC-stress, and seed modes; each independent correctness
mutation turns the focused gate red; and the workflow controller passes.

## Stop conditions

Do not close B15 with rewritten benchmark logic, host execution hidden behind the native runner,
benchmark-name dispatch, disabled collection, relaxed original checks, fixture-only semantics, or
an unfalsified queue/hold or projection witness.
