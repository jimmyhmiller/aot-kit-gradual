import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

// The native frontend is the product frontend. Its graph intentionally differs from the legacy
// JavaScript normalizer now that functions have JavaScript object identity and real `prototype`
// properties. Pin native output here; frontend-exact-graph-test.mjs pins the independent legacy
// oracle on its own terms.
const expectedDigests = Object.freeze({
  basic: "7a8a3daf099c02d4559e4eca74fb255a20bb2e38eacc121b69d7841ad0912686",
  call: "752cf2c895d2d0167739a75608a90822f33509d4a73027e097da08a3a5b79778",
  control: "38f2a6309bbedede76dab9ba443dee14b3ecb4cbaf01d9e11f243d514ea4f7fa",
  object: "cc0a96420e342bae2936f68f4e7aca290fb326716b2d45ca42402d2e5b31c59b",
  full: "eb7674f74487b76907d2add8b6d23acab3b4d1d13d738d87e7114dc844bea27a",
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
