import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("focused analysis uses retained run metadata instead of full-run constants", () => {
  const directory = mkdtempSync(join(tmpdir(), "aotk-analysis-test-"));
  const input = join(directory, "focused.jsonl");
  const output = join(directory, "report.json");
  writeFileSync(input, `${JSON.stringify({ path: "/x/test/a.js", variant: "default", status: "passed" })}\n`);
  writeFileSync(`${input}.summary.json`, `${JSON.stringify({ metadata: {
    expandedVariants: 1, executedVariants: 1, timingMs: { build: 2, execution: 3, total: 5 },
  } })}\n`);
  execFileSync(process.execPath, ["tools/analyze-test262-results.mjs", input, output], { stdio: "pipe" });
  const report = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(report.metadata.totalRecords, 1);
  assert.equal(report.metadata.executedVariants, 1);
  assert.deepEqual(report.metadata.runTimingMs, { build: 2, execution: 3, total: 5 });
});

test("analysis without a summary does not invent timing or variant totals", () => {
  const directory = mkdtempSync(join(tmpdir(), "aotk-analysis-test-"));
  const input = join(directory, "focused.jsonl");
  const output = join(directory, "report.json");
  writeFileSync(input, `${JSON.stringify({ path: "test/a.js", variant: "strict", status: "failed" })}\n`);
  execFileSync(process.execPath, ["tools/analyze-test262-results.mjs", input, output], { stdio: "pipe" });
  const metadata = JSON.parse(readFileSync(output, "utf8")).metadata;
  assert.equal("executedVariants" in metadata, false);
  assert.equal("runTimingMs" in metadata, false);
});
