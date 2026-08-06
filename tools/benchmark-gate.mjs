#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trackedSnapshot = () => {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root })
    .toString().split("\0").filter(Boolean);
  return Object.fromEntries(files.map(file => {
    const target = path.join(root, file);
    const value = fs.existsSync(target) ? crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex") : "<missing>";
    return [file, value];
  }));
};

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && (args.length === 0 || args[0] === "--update"), "usage: benchmark-gate.mjs [--update]");
const benchmarkArgs = ["tools/benchmark.mjs"];
if (args[0] === "--update") benchmarkArgs.push("--publish");
const trackedBefore = args[0] === "--update" ? null : trackedSnapshot();
execFileSync("node", benchmarkArgs, { cwd: root, stdio: "inherit" });
execFileSync("node", ["tools/typescript-aot-benchmarks.mjs"], { cwd: root, stdio: "inherit" });
if (trackedBefore) assert.deepEqual(trackedSnapshot(), trackedBefore,
  "verification-only benchmark changed tracked files; use --update to publish");

const report = JSON.parse(fs.readFileSync("out/benchmarks.json", "utf8"));
assert.equal(report.benchmarks.length, 3);
for (const benchmark of report.benchmarks) {
  assert.equal(benchmark.kit.length, 9);
  assert.equal(benchmark.v8.length, 9);
  assert.ok(benchmark.ratio > 0);
  assert.ok(Number.isFinite(benchmark.ratio));
}
assert.equal(report.profile.specialize, true);
assert.ok(report.profile.dominantHits * 100 >= report.profile.samples * 80);
assert.ok(report.profile.cloneCost <= 32);

const nativeReport = JSON.parse(fs.readFileSync("out/typescript-aot-benchmarks/results.json", "utf8"));
assert.equal(nativeReport.benchmarks.length, 4);
for (const benchmark of nativeReport.benchmarks) {
  assert.equal(benchmark.samples.length, nativeReport.measuredSamples);
  assert.ok(benchmark.samples.every(sample => sample.coilRuntimeNs > 0 && sample.nodeRuntimeNs > 0));
  assert.ok(benchmark.coilCompileNs > 0 && benchmark.nodeCompileNs > 0);
  assert.ok(Number.isFinite(benchmark.ratio) && benchmark.ratio > 0);
}

const markdown = fs.readFileSync("docs/BENCHMARKS.md", "utf8");
assert.match(markdown, /Raw samples/);
assert.match(markdown, /loss|win/);
console.log(args[0] === "--update"
  ? "benchmark report updated and verified"
  : "benchmark results verified without publishing tracked files");
