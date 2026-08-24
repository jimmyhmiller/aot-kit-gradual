# Linear backend encoding and publication

## Problem

The AArch64 backend recovers facts already owned by earlier phases through whole-program
instruction scans. `be-reg-of`, `be-spill-of`, and `be-owner-of` scan every machine instruction
for each operand query. `be-label-off` does the same for each branch target and function boundary.
On the 31,847-instruction Test262 witness this made encoding take about 5.90 seconds and Mach-O
publication another 1.17 seconds.

## Reference design

SeaOfNodes Simple chapter 23 keeps these phase products directly:

- register allocation maps each node to an LRG and reads `LRG._reg` in constant expected time;
- encoding records `_opStart[nodeId]` and `_opLen[nodeId]` while emitting each instruction;
- local and external relocations retain their source instruction and target;
- object publication serializes the completed text and recorded relocation tables.

The relevant implementation is `codegen/RegAlloc.java`, `codegen/Encoding.java`, and
`codegen/ElfFile.java` in <https://github.com/SeaOfNodes/Simple/tree/main/chapter23>.

## AOT Kit design

Our IDs are dense, so arrays are stronger than a hash map:

1. Allocation publishes `vreg -> register`, `vreg -> spill`, and `vreg -> owner` in the existing
   `mra-*` arrays. Production encoding reads those arrays directly.
2. The sizing pass publishes `block-id -> byte offset` while assigning each instruction's `.first`.
3. The same pass computes function starts and ends in one walk over scheduled instructions.
4. Encoding records external and internal relocations when it emits their instruction.
5. Mach-O and in-memory publication serialize those relocation records and the already-built
   stack-map/layout arrays without reconstructing facts from Machine IR.

The required complexity is linear in the represented data:

```text
O(instructions + vregs + blocks + relocations + roots + shapes)
```

No production encoder or publisher lookup may scan all instructions to answer a per-operand,
per-label, per-relocation, or per-root query. Legacy hand-built encoder fixtures may use an explicit
fallback only when the dense allocation products do not exist.

## Delivery order

1. Dense allocation lookups.
2. Dense block offsets and linear function ranges.
3. Recorded relocations consumed by both object and memory publication.
4. Materialized stack maps/layouts with linear, independent byte verification.

Each step is benchmarked against the same 31,847-instruction witness and recorded in `HANDOFF.md`.

