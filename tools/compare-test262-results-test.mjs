import assert from "node:assert/strict";
import test from "node:test";
import { canonicalTestPath, compareResults, indexResults } from "./compare-test262-results.mjs";

const row = (path, variant, status) => ({ path, variant, status });

test("canonical identity survives a different Test262 checkout root", () => {
  assert.equal(canonicalTestPath("/old/test/built-ins/Array/x.js"), "test/built-ins/Array/x.js");
  const report = compareResults(
    [row("/old/test/built-ins/Array/x.js", "strict", "failed")],
    [row("/new/test/built-ins/Array/x.js", "strict", "passed")],
  );
  assert.equal(report.sameCohort, true);
  assert.deepEqual(report.transitions, { "failed->passed": 1 });
  assert.equal(report.newlyPassing.length, 1);
});

test("reports exact pass regressions and cohort drift separately", () => {
  const report = compareResults(
    [row("test/a.js", "default", "passed"), row("test/b.js", "strict", "failed")],
    [row("test/a.js", "default", "refused"), row("test/c.js", "strict", "passed")],
  );
  assert.deepEqual(report.passToNonpass, [
    { path: "test/a.js", variant: "default", before: "passed", after: "refused" },
  ]);
  assert.equal(report.sameCohort, false);
  assert.equal(report.addedVariants[0].path, "test/c.js");
  assert.equal(report.removedVariants[0].path, "test/b.js");
});

test("rejects duplicate identities and unknown outcomes", () => {
  assert.throws(() => indexResults([
    row("test/a.js", "default", "passed"), row("test/a.js", "default", "failed"),
  ]), /duplicate expanded variant/);
  assert.throws(() => indexResults([row("test/a.js", "default", "maybe")]), /unknown status/);
});
