import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

// The native frontend is the product frontend. Its graph intentionally differs from the legacy
// JavaScript normalizer now that functions have JavaScript object identity and real `prototype`
// properties. Pin native output here; frontend-exact-graph-test.mjs pins the independent legacy
// oracle on its own terms.
const expectedDigests = Object.freeze({
  basic: "7a8a3daf099c02d4559e4eca74fb255a20bb2e38eacc121b69d7841ad0912686",
  // Repinned when g-fold-proven! began running the peephole after analysis instead of leaving what
  // the fixpoint proved unused. EVERY fixture that moved got strictly SMALLER — call 32 -> 31,
  // control 37 -> 33, object 39 -> 38, full 87 -> 82 — as duplicate constants collapse into the
  // ones GVN can now see and commutative operands take their canonical order. `basic` and `bitwise`
  // are byte-identical. Nothing grew, which is the evidence this is the peephole doing its ordinary
  // job on more of the graph rather than a change in what the frontend builds.
  // Repinned when the dynamic-to-number seam became ToNumber instead of a bare Unbox. Two changes,
  // and the second is the one worth knowing about. `twice`'s `x * 2` reads a `number` PARAMETER,
  // which is a tagged word like every other Parm, so `Unbox flt <- Parm` is now
  // `Unbox flt <- ToNumber <- Parm`. That part is the point: an unbox asserts a tag and traps,
  // where JavaScript specifies a conversion.
  //
  // The second: `twice` GREW A MEMORY EDGE. It now takes `Arg mem` and returns memory alongside its
  // value, because `%ToNumber` lowers to a runtime helper and a string argument makes that a heap
  // operation. Any function doing arithmetic on a dynamic operand threads the heap from here on.
  // 30 nodes to 34.
  call: "9937978e6ea2752c2be29613cc69164124e3b1c8115631b2e1f2d5a119b8f8b3",
  control: "4d77f131d42c349fbffb154f65918d20a4a0fb002418426b8cdbc832f955260d",
  // Repinned for the same ToNumber seam as `call`, and this one is the minimal form of it: exactly
  // one node added — `Unbox flt <- Parm` becomes `Unbox flt <- ToNumber <- Parm` — and every later
  // index shifted by one. 37 nodes to 38, no memory edge gained, because `Box` already threaded the
  // heap through this fixture.
  object: "8c19cc1ebeb4e58a6919b68cfbda7cb5b34a97228740eef91bb77592b110e680",
  // Repinned twice. First for the ToNumber seam: two dynamic operands in this fixture, so exactly
  // two nodes added — 82 to 84 — plus the memory edges the functions containing them now thread,
  // the same consequence spelled out on `call`.
  //
  // Then once more for object-typed arguments, which is exactly one node: `Box` on the actual
  // before the `Call`, 84 to 85. A `Parm` is a tagged JavaScript value and a callee reading a field
  // off the declared shape unboxes it, so an object argument has to arrive tagged. It was arriving
  // as the raw allocation pointer and trapping.
  full: "5aa04bede276bcdf2e7767d42f06be4b93512171b374bc3e2be642735fee282d",
  bitwise: "189e78fe00839f184bb88f682c514f3a5d97b7972da062e8aa7262d3969e17a9",
});

export function assertNativeGraph(fixture, nativePath) {
  if (!nativePath) throw new Error(`missing native graph path for ${fixture}`);
  const expected = expectedDigests[fixture];
  if (!expected) throw new Error(`unknown native graph fixture: ${fixture}`);
  const native = fs.readFileSync(nativePath);
  const digest = crypto.createHash("sha256").update(native).digest("hex");
  assert.equal(digest, expected, `native Coil ${fixture} graph changed: ${digest}`);
  console.log(`canonical native ${fixture} graph ${digest}`);
}
