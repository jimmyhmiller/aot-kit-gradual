#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const corpus = process.env.AOT_V8_CORPUS ? path.resolve(process.env.AOT_V8_CORPUS) : path.join(root, "benchmarks/v8-v7");
const manifest = JSON.parse(fs.readFileSync(path.join(corpus, "manifest.json"), "utf8"));
const expected = ["Richards", "DeltaBlue", "Crypto", "RayTrace", "EarleyBoyer", "RegExp", "Splay", "NavierStokes"];
if (JSON.stringify(manifest.benchmarks.map(entry => entry.name)) !== JSON.stringify(expected)) throw new Error("oracle requires all eight canonical benchmarks in order");
const args = new Set(process.argv.slice(2));
const matrix = args.has("--extended") ? "extended" : "quick";
if ([...args].some(arg => !["--quick", "--extended"].includes(arg))) {
  throw new Error("usage: node tools/v8-node-oracle.mjs [--quick|--extended]");
}

function run(entry) {
  const events = [];
  const errors = [];
  const context = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(corpus, "base.js"), "utf8"), context, { filename: "base.js" });
  vm.runInContext(fs.readFileSync(path.join(corpus, entry.file), "utf8"), context, { filename: entry.file });
  if (matrix === "quick") {
    vm.runInContext(`
      BenchmarkSuite.prototype.RunSingleBenchmark = function(benchmark, data) {
        if (data == null) return { runs: 0, elapsed: 0 };
        benchmark.run();
        data.runs = 1;
        data.elapsed = 1;
        this.NotifyStep(new BenchmarkResult(benchmark, 1));
        return null;
      };
    `, context);
  }
  context.__runner = {
    NotifyStart(name) { events.push({ type: "suite-start", name }); },
    NotifyStep(name) { events.push({ type: "benchmark-pass", name }); },
    NotifyResult(name) { events.push({ type: "suite-pass", name }); },
    NotifyError(name, error) { errors.push({ suite: name, message: String(error?.stack ?? error) }); },
  };
  vm.runInContext("BenchmarkSuite.RunSuites(__runner)", context);
  const benchmarkPasses = events.filter(event => event.type === "benchmark-pass").map(event => event.name);
  const suitePass = events.some(event => event.type === "suite-pass" && event.name === entry.name);
  return {
    name: entry.name,
    file: entry.file,
    status: errors.length === 0 && suitePass ? "pass" : "fail",
    checks: benchmarkPasses,
    errors,
  };
}

const results = manifest.benchmarks.map(run);
const output = {
  schemaVersion: 1,
  oracle: "Node.js",
  node: process.version,
  v8: process.versions.v8,
  suiteVersion: manifest.version,
  upstreamCommit: manifest.upstream.commit,
  matrix,
  semantics: matrix === "quick" ? "one canonical workload per benchmark check" : "upstream canonical timing/repetition harness",
  results,
  status: results.every(result => result.status === "pass") ? "pass" : "fail",
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.status !== "pass") process.exitCode = 1;
