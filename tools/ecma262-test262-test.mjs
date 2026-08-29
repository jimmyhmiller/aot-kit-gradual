import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidence, mappedPaths, validateOperationManifest, verifyEvidence, verifyPinnedCheckout } from "./ecma262-test262.mjs";

const manifest = paths => ({ schemaVersion: 2, operations: { A: {
  focusedNativeDifferential: "tests/spec-operations/a.js",
  test262: { paths, features: [], includes: [], rationale: "Direct public operation coverage." },
} } });

test("validates deterministic operation cohorts", () => {
  assert.equal(validateOperationManifest(manifest(["test/a.js"])).schemaVersion, 2);
  assert.throws(() => validateOperationManifest(manifest(["../outside.js"])), /invalid Test262 path/);
  assert.throws(() => validateOperationManifest({ schemaVersion: 2, operations: {
    A: { test262: { paths: [], rationale: "empty" } },
  } }), /at least one path/);
});

test("requires the exact pinned Test262 commit", () => {
  const run = (_command, _args, _options) => ({ status: 0, stdout: "abc\n" });
  assert.equal(verifyPinnedCheckout("checkout", "abc", run), "abc");
  assert.throws(() => verifyPinnedCheckout("checkout", "def", run), /expected pinned def/);
});

test("rejects a mapped path absent from the checkout", () => {
  assert.throws(() => mappedPaths("A", manifest(["test/absent.js"]), "/definitely/absent"),
    /does not exist at pinned revision/);
});

test("builds digest-bound evidence and rejects results outside the mapping", () => {
  const mapping = { paths: ["test/a"], features: [], includes: [] };
  const rows = [{ path: "/checkout/test/a/x.js", variant: "default", status: "passed" }];
  const evidence = buildEvidence("A", mapping, "abc", "results/a.jsonl", rows, Buffer.from("row\n"));
  assert.equal(evidence.expandedVariants, 1);
  assert.deepEqual(evidence.totals, { passed: 1, failed: 0, refused: 0, skipped: 0 });
  assert.match(evidence.resultsSha256, /^[0-9a-f]{64}$/);
  assert.equal(verifyEvidence("A", mapping, "abc", evidence, rows, Buffer.from("row\n")), evidence);
  assert.throws(() => verifyEvidence("A", mapping, "abc", { ...evidence, expandedVariants: 2 },
    rows, Buffer.from("row\n")), /stale or inconsistent/);
  assert.throws(() => buildEvidence("A", mapping, "abc", "results/a.jsonl",
    [{ path: "/checkout/test/b/x.js", variant: "default", status: "passed" }], Buffer.alloc(0)),
  /outside its mapped cohort/);
});
