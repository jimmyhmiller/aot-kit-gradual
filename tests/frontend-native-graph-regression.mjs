import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

// The native frontend is the product frontend. Its graph intentionally differs from the legacy
// JavaScript normalizer now that functions have JavaScript object identity and real `prototype`
// properties. Pin native output here; frontend-exact-graph-test.mjs pins the independent legacy
// oracle on its own terms.
const expectedDigests = Object.freeze({
  // Repinned when top-level declarations began carrying their actual function identities. The
  // rendered six-node arithmetic graph is byte-identical between clean HEAD and this change; only
  // the already-stale digest expected the older ordering.
  basic: "3de6b11430bd61da751bcd2d053cfdef700d7d2f122214bbce69bdcc0f071097",
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
  // Repinned when `ToNumberValue` regained its spec guard. The former single ToNumber is now the
  // explicit IsInt/IsFlt fast path and ToNumber slow path, joined before the unbox. Constants in
  // that inlined diamond are rooted at this function's FunStart (not whole-graph Start), which is
  // the non-entry ownership invariant this fixture now pins. 34 nodes to 48.
  // Repinned when JSL lowering began skipping statically disproven arms. The guarded ToNumber
  // expansion remains for the opaque parameter, while constant sub-guards no longer leave dead
  // diamonds for iteration to clean up. The generated JSON helpers move user Fun ids 53 -> 54.
  // Repinned when JavaScript-visible identities and internal JSL builtin identities became
  // disjoint. The sole user function is now correctly `Fun.1` instead of inheriting the linked
  // library's builtin count; zero is reserved as the runtime side-table's invalid owner. The call
  // structure and every non-identity node remain unchanged.
  call: "511138d336ac0a0e6aab558ec8304ac930b735caca7e202e57662f4488901312",
  control: "317059e49013ae650f20f71a4a960fd0b5e9202d519901ed26a90803a7d260bd",
  // Repinned for the same ToNumber seam as `call`, and this one is the minimal form of it: exactly
  // one node added — `Unbox flt <- Parm` becomes `Unbox flt <- ToNumber <- Parm` — and every later
  // index shifted by one. 37 nodes to 38, no memory edge gained, because `Box` already threaded the
  // heap through this fixture.
  // Repinned with the same guarded ToNumberValue as `call`: the object fixture's dynamic numeric
  // field crosses the IsInt/IsFlt diamond before the slow conversion, with its true constant
  // rooted at the containing FunStart.
  // Repinned for the disjoint callable namespace described on `call`; its one user function is
  // now `Fun.1`, with no structural graph change.
  object: "a3b22ae04130ba27ee7e122e25b9d1d5183d8ca53c61951711b62068ffb93cd5",
  // Repinned twice. First for the ToNumber seam: two dynamic operands in this fixture, so exactly
  // two nodes added — 82 to 84 — plus the memory edges the functions containing them now thread,
  // the same consequence spelled out on `call`.
  //
  // Then once more for object-typed arguments, which is exactly one node: `Box` on the actual
  // before the `Call`, 84 to 85. A `Parm` is a tagged JavaScript value and a callee reading a field
  // off the declared shape unboxes it, so an object argument has to arrive tagged. It was arriving
  // as the raw allocation pointer and trapping.
  // Repinned with two guarded ToNumberValue expansions. The fixture now contains four explicit
  // numeric tag tests and two slow ToNumber nodes instead of two unconditional conversions; the
  // additional Regions/Phis are the control handed back by JSL inlining. 85 nodes to 111.
  // Repinned for the disjoint callable namespace: its two user functions become `Fun.1` and
  // `Fun.2`; node count and all non-identity structure are unchanged.
  full: "784bf03564ecdbb47f25fd13f9527af727a3c959c99d8cc7cd7949ad9cdc977d",
  bitwise: "a9e893ac4a4e394075e850fef7c876ce8db3f5b3a61fc5993b217ab06b8c5ab7",
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
