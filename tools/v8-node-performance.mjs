#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "benchmarks/v8-v7/manifest.json"), "utf8"));
const warmupCalls = Number(process.env.AOT_NODE_WARMUP_CALLS ?? 1_000);
const measuredSamples = Number(process.env.AOT_BENCHMARK_SAMPLES ?? 9);
const iterationsPerSample = Number(process.env.AOT_V8_ITERATIONS_PER_SAMPLE ?? 10);
if (!Number.isSafeInteger(warmupCalls) || warmupCalls < 1_000) throw new Error("AOT_NODE_WARMUP_CALLS must be at least 1000");
if (!Number.isSafeInteger(measuredSamples) || measuredSamples < 1) throw new Error("AOT_BENCHMARK_SAMPLES must be positive");
if (!Number.isSafeInteger(iterationsPerSample) || iterationsPerSample < 1) throw new Error("AOT_V8_ITERATIONS_PER_SAMPLE must be positive");
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const corpus = path.join(root, "benchmarks/v8-v7");
const results = [];

for (const entry of manifest.benchmarks) {
  const context = vm.createContext({ console, alert(message) { throw new Error(String(message)); } });
  vm.runInContext(fs.readFileSync(path.join(corpus, "base.js"), "utf8"), context, { filename: "base.js" });
  vm.runInContext(fs.readFileSync(path.join(corpus, entry.file), "utf8"), context, { filename: entry.file });
  const suites = vm.runInContext("BenchmarkSuite.suites", context);
  if (suites.length !== 1) throw new Error(`${entry.name}: expected one suite, found ${suites.length}`);
  const suite = suites[0];
  const cases = [];
  for (const benchmark of suite.benchmarks) {
    benchmark.Setup();
    for (let iteration = 0; iteration < warmupCalls; ++iteration) benchmark.run();
    const samples = [];
    for (let sample = 0; sample < measuredSamples; ++sample) {
      const before = process.hrtime.bigint();
      for (let iteration = 0; iteration < iterationsPerSample; ++iteration) benchmark.run();
      samples.push(Number(process.hrtime.bigint() - before) / iterationsPerSample);
    }
    benchmark.TearDown();
    cases.push({ name: benchmark.name, medianNs: median(samples), samplesNs: samples });
  }
  const medianNs = cases.reduce((total, item) => total + item.medianNs, 0);
  results.push({ benchmark: entry.name, medianNs, cases });
  console.error(`${entry.name}: ${(medianNs / 1e6).toFixed(3)} ms`);
}

const report = { node: process.version, warmupCalls, measuredSamples, iterationsPerSample, results };
fs.mkdirSync(path.join(root, "out/v8-performance"), { recursive: true });
fs.writeFileSync(path.join(root, "out/v8-performance/node.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log("| Benchmark | Node median |");
console.log("|---|---:|");
for (const result of results) console.log(`| ${result.benchmark} | ${(result.medianNs / 1e6).toFixed(3)} ms |`);
