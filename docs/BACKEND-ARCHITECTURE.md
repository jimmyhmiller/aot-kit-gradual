# Backend architecture

The backend has no umbrella module. Tools, tests, and external consumers import the phases they
actually use, so their dependencies remain visible. The implementation follows a one-way
dependency order:

```text
core → cfg → select → liveness → schedule → allocate → aarch64 → macho
```

Later modules may import any earlier layer directly because Coil does not place an imported
module's own dependencies or types into another module's scope. No layer may import to its right.
`tools/backend-module-gate.mjs` checks that rule, ensures the retired `src/backend.coil` facade is
not restored, and rejects in-repo umbrella imports.

| Module | Owns |
|---|---|
| `backend_core` | Machine opcodes and descriptors, shared records and tables, backend state, reset/error publication |
| `backend_cfg` | Machine CFG discovery, call-target reachability, RPO, dominators, loop depth, CFG verification |
| `backend_select` | Legacy and block selection, Phi copies, placement, selected-IR verification, representation classification, local legality scheduling |
| `backend_liveness` | CFG use/def solving, edge liveness, register classes, GC value kinds and safepoint roots |
| `backend_schedule` | Final scheduling orchestration and legacy live-interval construction |
| `backend_allocate` | Interference, register assignment, spilling, frame layout and ABI verification |
| `backend_aarch64` | AArch64 words, lowering to code bytes, fixups and checked code publication |
| `backend_macho` | Mach-O sections, symbols, relocations, stack maps, shape layouts and byte verification |

Two boundaries deserve explanation:

- Representation classification belongs to selection policy even though liveness consumes its
  result. Moving it into liveness creates a cycle because closed-world call-result selection also
  needs the same classification.
- The local legality scheduler remains with selected-machine-IR placement. Placement invokes it
  before the liveness pass exists; `backend_schedule` owns only the later orchestration that runs
  interval construction and liveness together.

TypeScript and JavaScript syntax, symbol resolution and ideal-graph construction stay in the
frontend modules. The backend is source-language independent except for explicit JavaScript value
ABI machine operations; new TypeScript surface support should normally stop at ideal IR rather
than adding syntax knowledge here.
