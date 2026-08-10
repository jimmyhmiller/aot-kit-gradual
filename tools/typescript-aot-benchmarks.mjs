#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const allCases = [
  { name: "sum-loop", input: 20_000_000, repeats: 1, warmupInput: 100_000 },
  { name: "branch-loop", input: 20_000_000, repeats: 1, warmupInput: 100_000 },
  { name: "call-loop", input: 5_000_000, repeats: 1, warmupInput: 50_000 },
  { name: "bitwise-mix", input: 2_000_000, repeats: 1, warmupInput: 50_000 },
  { name: "floating-point", input: 20_000_000, repeats: 1, warmupInput: 100_000 },
  // Exercises the Math builtins that lib/math/rounding.jsl now computes, so a regression from
  // replacing an inline IR node with a call into the runtime library is visible rather than assumed.
  { name: "math-loop", input: 2_000_000, repeats: 1, warmupInput: 20_000 },
  // Exercises the string operations lib/string/ now computes, for the same reason.
  { name: "string-loop", input: 500_000, repeats: 1, warmupInput: 5_000 },
  { name: "closure-loop", input: 1, repeats: 200_000, warmupInput: 1, warmupRepeats: 1_000, optimize: false },
  { name: "object-literals", input: 1, repeats: 2_000, warmupInput: 1, warmupRepeats: 100 },
  { name: "dynamic-object-literals", input: 1, repeats: 2_000, warmupInput: 1, warmupRepeats: 100 },
  { name: "recursive-objects", input: 16, repeats: 1, warmupInput: 8 },
  { name: "array-callbacks", input: 1, repeats: 200, warmupInput: 1, warmupRepeats: 20 },
  { name: "json-roundtrip", input: 1, repeats: 50, warmupInput: 1, warmupRepeats: 5, optimize: false },
];
const requestedCases = process.argv.slice(2).map(arg => {
  if (!arg.startsWith("--case=")) throw new Error("usage: typescript-aot-benchmarks.mjs [--case=NAME ...]");
  return arg.slice("--case=".length);
});
const cases = requestedCases.length === 0
  ? allCases
  : allCases.filter(benchmark => requestedCases.includes(benchmark.name));
if (cases.length !== (requestedCases.length || allCases.length)) throw new Error("unknown or duplicate benchmark case");
const measuredSamples = Number(process.env.AOT_BENCHMARK_SAMPLES ?? 9);
if (!Number.isSafeInteger(measuredSamples) || measuredSamples < 1)
  throw new Error("AOT_BENCHMARK_SAMPLES must be a positive integer");
const nodeWarmupIterations = Number(process.env.AOT_NODE_WARMUP_ITERATIONS ?? 20);
if (!Number.isSafeInteger(nodeWarmupIterations) || nodeWarmupIterations < 0)
  throw new Error("AOT_NODE_WARMUP_ITERATIONS must be a non-negative integer");
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, encoding: "utf8", ...options });
const metric = (text, name) => {
  const match = text.match(new RegExp(`(?:^| )${name}=(-?[0-9]+)`));
  if (!match) throw new Error(`missing ${name}: ${text}`);
  return Number(match[1]);
};

const output = path.join(root, "out", "typescript-aot-benchmarks");
fs.mkdirSync(output, { recursive: true });
const report = [];
const nativeParserArchive = run("tools/build-typescript-go-bridge.sh", []).trim();

for (const benchmark of cases) {
  const sourcePath = path.join(root, "benchmarks", "typescript-aot", `${benchmark.name}.ts`);
  const coilPath = path.join(output, `${benchmark.name}.coil`);
  const emitterPath = path.join(output, `${benchmark.name}-emitter`);
  const objectPath = path.join(output, `${benchmark.name}.o`);
  const executablePath = path.join(output, benchmark.name);
  const compileStarted = process.hrtime.bigint();
  run(process.execPath, ["tools/generate-typescript-aot-benchmark.mjs", sourcePath, coilPath,
    "0", "10", benchmark.optimize === false ? "0" : "1"]);
  // Coil.toml [link] already force-loads the archive and names the frameworks, and the compiler
  // applies manifest link flags to every build. Passing them again loads the archive twice and the
  // link fails with ~73 duplicate symbols, each reported against itself.
  run("coil", ["build", coilPath, "-o", emitterPath]);
  fs.writeFileSync(objectPath, run(emitterPath,
    benchmark.scheduleSeed === undefined ? [] : [String(benchmark.scheduleSeed), "10"], { encoding: null }));
  const coilCompileNs = Number(process.hrtime.bigint() - compileStarted);
  run("xcrun", ["clang", "-O2", "-arch", "arm64", "-fno-omit-frame-pointer",
    "tools/typescript-aot-benchmark-harness.c", "tools/native-gc-runtime.c",
    "tools/native-gc-trampoline.S", objectPath, "-o", executablePath]);

  const source = fs.readFileSync(sourcePath, "utf8");
  const nodeCompileStarted = process.hrtime.bigint();
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  const nodeCompileNs = Number(process.hrtime.bigint() - nodeCompileStarted);
  const nodeRun = (input = benchmark.input, repeats = benchmark.repeats) => {
    const started = process.hrtime.bigint();
    let result = 0;
    // Vary the argument and retain every result so V8 cannot hoist an identical pure call or
    // discard all but the final iteration. This matches the native harness's observable checksum.
    for (let i = 0; i < repeats; ++i)
      result = (result ^ module.main(input + i)) | 0;
    return { result, runtimeNs: Number(process.hrtime.bigint() - started) };
  };
  const nativeRun = () => {
    const text = run(executablePath, [String(benchmark.input), String(benchmark.repeats)]);
    return { result: metric(text, "result"), runtimeNs: metric(text, "runtime_ns") };
  };

  // Give V8 enough in-process calls to tier up before any timed observation. Warmup uses the same
  // code paths with a smaller input so large measured kernels do not turn tiering into most of the
  // benchmark runtime. Native binaries are AOT and receive only untimed process-level shakeouts.
  for (let i = 0; i < nodeWarmupIterations; ++i)
    nodeRun(benchmark.warmupInput, benchmark.warmupRepeats ?? benchmark.repeats);
  for (let i = 0; i < 3; ++i) nativeRun();
  const samples = [];
  for (let i = 0; i < measuredSamples; ++i) {
    const native = nativeRun();
    const node = nodeRun();
    if (native.result !== node.result) throw new Error(`${benchmark.name}: Coil ${native.result} != Node ${node.result}`);
    samples.push({ coilRuntimeNs: native.runtimeNs, nodeRuntimeNs: node.runtimeNs });
  }
  const coilMedianNs = median(samples.map(sample => sample.coilRuntimeNs));
  const nodeMedianNs = median(samples.map(sample => sample.nodeRuntimeNs));
  report.push({ ...benchmark, nodeWarmupIterations, result: nativeRun().result, coilCompileNs, nodeCompileNs, coilMedianNs, nodeMedianNs,
    ratio: coilMedianNs / nodeMedianNs, samples });
  console.error(`${benchmark.name}: Coil ${(coilMedianNs / 1e6).toFixed(3)} ms, Node ${(nodeMedianNs / 1e6).toFixed(3)} ms`);
}

fs.writeFileSync(path.join(output, "results.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(), platform: `${os.platform()} ${os.arch()}`,
  node: process.version, nodeWarmupIterations, measuredSamples, benchmarks: report,
}, null, 2)}\n`);
console.log("\n| Benchmark | Coil median | Node median | Coil / Node |");
console.log("|---|---:|---:|---:|");
for (const row of report)
  console.log(`| ${row.name} | ${(row.coilMedianNs / 1e6).toFixed(3)} ms | ${(row.nodeMedianNs / 1e6).toFixed(3)} ms | ${row.ratio.toFixed(3)}× |`);
