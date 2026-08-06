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
  object: "9424fc8198d6306ee7b9d83e950e16c3b66250e7cbc368f8729dd06324c0cc45",
  full: "b05b04327ac86a90f420ff56cee05d6c4225994ae191476207669c3f038090d7",
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
