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
  call: "f46afc5885233e3c75f73f47749ce1db71baf193594276d48cd4c873c51c13de",
  control: "4d77f131d42c349fbffb154f65918d20a4a0fb002418426b8cdbc832f955260d",
  object: "625b7453c81af4af381888db86908c709bc485203898a2937e4d131bdecca0e9",
  full: "d3a11144bc8b06a62fb3804d456a0a0b27b1056d20657a2f1f74dc2485d6669a",
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
