# Simple Performance Parity

## 2026-08-23 parity achieved

The last material divergence was duplicate dominator traversal in late GCM. AOT Kit validated
`earliest` dominance with `mu-dominates?`, then immediately repeated the same idom walk to choose
the lowest-loop-depth placement. Simple validates and chooses in one walk. AOT Kit now does too.

| measurement | AOT Kit | Simple chapter 23 |
| --- | ---: | ---: |
| native witness graph/machine nodes | 120,293 | 32,378 |
| selection+GCM median | 200.735 ms | 67.228 ms |
| AOT Kit normalized to 32,378 nodes | 54.030 ms | 67.228 ms |
| normalized AOT Kit advantage | 19.6% | baseline |

The AOT Kit median is from six unprofiled measurements across three alternating two-variant witness
runs. The fixed random 1,000-file sample preserved its exact outcome mix and reduced aggregate
selection CPU from 4,571.424 ms to 3,360.055 ms (26.5%).

Validation: bounded gate 46/46, backend motion 10/10, backend selection 16/16, and frontier 0/11 as
intended. The exhaustive suite now compiles and runs after two stale test-integration repairs; it
finishes 399/448, with 49 broad native failures that are explicitly not claimed as green.

Selection profiling is explicitly enabled with `tools/run-test262.mjs --profile`; normal runs do
not execute selection trace formatting or clock reads. The profiling flag is forwarded through
both one-shot native processes and persistent native workers.

## 2026-08-23 node-dense selection memo follow-up

- Replaced three eager `functions * nodes` selection maps with node-indexed values and owner tags.
- Replaced per-memory-chain `ArrayList` allocation/free with a reentrant MachineUnit stack.
- Replaced per-owner whole-edge scans with source-block successor adjacency walks.
- Kept the bounded gate green at 46/46 and preserved the fixed sample's exact outcome mix.

The latest large witness measures 278.807--282.101 ms total selection. The strict path consists of
40.122 ms emission, 230.909 ms GCM, and 0.881 ms final anti-dependency publication. Normalized to
Simple's 32,378 nodes, combined selection is approximately 75.1 ms against Simple's 67.228 ms;
GCM remains at parity and emission remains the open gap.

The fixed 1,000-file sample's aggregate selection CPU moved from 4,571.424 ms before these memo and
worklist changes to 3,552.976 ms in the latest run. Because 16 workers make individual monotonic
phase totals sensitive to scheduling contention, use the single-worker witness for cross-system
phase comparisons and the sample only as an end-to-end throughput guard.

## 2026-08-23 selection/GCM result

The backend now follows Simple chapter 23's scheduling invariants: maintained def/use adjacency,
one early-placement computation, use-ready late placement, adjacency-driven memory
anti-dependencies, and one final block-order materialization. The former repeated early refresh,
unconditional late fixed point, Cartesian alias scan, double packing, and pre-GCM anti-dependency
publication have been removed.

| implementation | graph/machine nodes | selection rewrite | GCM | combined |
| --- | ---: | ---: | ---: | ---: |
| Simple chapter 23 | 32,378 | 5.965 ms | 61.263 ms | 67.228 ms |
| AOT Kit default | 120,293 | 43.778 ms | 229.125 ms | 283.441 ms |
| AOT Kit strict | 120,293 | 39.982 ms | 225.387 ms | 273.292 ms |
| AOT Kit strict, normalized to 32,378 nodes | 32,378 | 10.761 ms | 60.660 ms | 73.556 ms |

GCM is at throughput parity. The remaining 10--14% combined gap is in AOT Kit's richer
rewrite/emission path. The next targets are the separate terminator pass and repeated setup work in
preselection; verification and memory anti-dependency construction are no longer material costs in
production Test262 runs.

Fixed random sample (`seed=2621000`, 1,000 files, 1,557 executable variants, 16 workers,
`--batch-size 8`): 10.327 seconds wall and 4,571.424 ms aggregate selection CPU. Selection comprised
1,676.376 ms machine construction, 1,830.652 ms emission, 881.332 ms GCM, and 22.691 ms final
anti-dependencies.

## Goal

Make AOT Kit's AArch64 encoding and object-publication pipeline as fast as the
SeaOfNodes Simple chapter 23 backend on comparable generated programs.

Simple is the architectural and performance baseline. Differences in source language, runtime,
and object format are not excuses for avoidable backend overhead. A fixed-width AArch64 encoder
should be at least as straightforward as Simple's multi-target encoder.

## Measured baseline

Measurements were taken on the same Apple Silicon host using a nanosecond wrapper around Simple's
`CodeGen.encode()` after register allocation.

| Simple program | Encoded bytes | ARM encoding |
| --- | ---: | ---: |
| `sieve.smp` | 356 | 0.12-0.15 ms |
| `brain_fuck.smp` | 1,224 | 0.27-0.35 ms |
| `large.smp` | 61,212 | 2.7-4.6 ms |

AOT Kit's reproducible random 1,000-file Test262 sample produced 464 encodable variants:

| AOT Kit statistic | AArch64 encoding |
| --- | ---: |
| median | 31.7 ms |
| mean | 111.8 ms |
| p90 | 124.4 ms |
| p99 | 1,558.8 ms |
| maximum | 9,077.9 ms |
| aggregate | 51.9 s |

The worst normalized case encoded 6,533 reported machine instructions in 9.08 seconds. This is not
normal byte-emission cost. Native sampling placed almost all sampled work in
`backend_aarch64.be-encode!`, with a large secondary concentration in the repeatedly called
`backend_core.machine-unit` global-state accessor.

## What Simple does

Simple gives every backend phase a direct `CodeGen` reference. By encoding time, scheduling and
allocation are complete and their answers are authoritative.

1. `Encoding.reg(Node)` directly asks the allocator for the node's live range and final register.
2. Encoding walks laid-out blocks and their scheduled machine operations linearly.
3. `_opStart[nodeId]` and `_opLen[nodeId]` are written while bytes are emitted.
4. Internal, external, and constant relocations are appended when the relevant operation emits.
5. Local relocation patching iterates only the recorded relocation collection.
6. ELF publication consumes encoded bytes, dense offsets, function boundaries, and relocations.
7. Publication does not rediscover allocation, ownership, instruction positions, or relocations.

Simple's encoder includes block layout, instruction emission, branch compaction, and local patching.
Its result is therefore not fast because it measures only a trivial subset of encoding.

## What AOT Kit is doing wrong

AOT Kit has historically treated the machine program as a globally queryable database. Backend
helpers repeatedly enter `machine-unit`, and later phases recover facts by traversing structures
that earlier phases already knew. Dense allocation and block-offset tables removed the worst
whole-program scans, but did not establish a strict producer/consumer boundary.

The remaining symptoms are architectural:

- `be-encode!` repeatedly enters a global accessor instead of carrying an explicit context.
- The global `MachineUnit` aggregate is 4,384 bytes and its generated accessor is called in hot
  loops. Sampling shows that even its initialized path is paid often enough to be material.
- Encoding combines layout, sizing, metadata discovery, emission, patching, and verification under
  one timing bucket.
- Relocation and publication metadata can still be reconstructed after byte emission.
- Performance varies wildly for programs with similar machine-instruction counts, proving there is
  path-dependent repeated work rather than a simple linear byte-writing constant.

## Required invariants

The work is complete only when all of these are true:

- Every hot backend phase receives an explicit machine-unit or phase-context pointer.
- No encoding inner loop calls the global `machine-unit` accessor.
- Allocation results are dense arrays indexed by virtual register.
- Instruction start, length, owner, function, and block data are recorded once.
- Branch and external relocations are recorded during emission.
- Patching iterates relocation collections, never all instructions.
- Mach-O publication consumes recorded facts and does not query allocation or scan instructions.
- Encoding has exclusive timings for layout, sizing, emission, patching, and verification.
- Publication has exclusive timings for metadata, symbols, relocations, and serialization.
- Scaling is linear in emitted instructions/bytes, including adversarial large programs.

## Acceptance criteria

Parity is measured on comparable generated-code sizes, not source-file counts.

- Small ordinary programs: median AArch64 encoding below 1 ms.
- Approximately 1 KB generated code: encoding at or below 1 ms.
- Approximately 60 KB generated code: encoding in single-digit milliseconds.
- No Test262 encoding outlier above 100 ms without a documented proportional code-size reason.
- A log-log fit of encoding time versus machine instructions remains approximately linear.
- Mach-O publication is linear and small relative to encoding.
- The bounded gate remains green.
- The frontier retains the honest set of open failures.

## Work queue

- [ ] Add exclusive internal timing and operation counters to encoding and publication.
- [ ] Establish code-byte and instruction-count matched AOT Kit witnesses for the three Simple sizes.
- [ ] Pass one explicit context through `be-encode!` and its hot helpers.
- [ ] Remove `machine-unit` calls from encoding inner loops.
- [ ] Make sizing/layout write all dense instruction and block offsets exactly once.
- [ ] Make emission append internal and external relocation records directly.
- [ ] Patch branches and calls by iterating recorded relocations only.
- [ ] Make Mach-O consume function ranges, stack maps, symbols, and relocations without rediscovery.
- [ ] Remove legacy scan fallbacks from production paths after all producers publish dense data.
- [ ] Add scaling benchmarks and a bounded performance regression gate.
- [ ] Rerun the reproducible random 1,000-file sample and compare distributions.
- [ ] Run `coil test` and `coil test --suite frontier` before every handoff.
- [ ] Record each landed step and its measured effect in `HANDOFF.md`.

## Reproduction artifacts

- Simple checkout: `/tmp/seaofnodes-simple-20260823`
- Simple benchmark driver: `/tmp/SimpleEncodeBench.java`
- Random sample seed: `2621000`
- Random file list: `/tmp/aotk-random-1000-files.txt`
- Structured AOT Kit results: `/tmp/aotk-random-1000-results.jsonl`
- Native encoder sample: `/tmp/aotk-hot-encoder.sample`
