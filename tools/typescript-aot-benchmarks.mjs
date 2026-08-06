#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cases = [
  { name: "sum-loop", input: 20_000_000, repeats: 1 },
  { name: "branch-loop", input: 20_000_000, repeats: 1 },
  { name: "bitwise-mix", input: 123456789, repeats: 20_000 },
  { name: "floating-point", input: 123456789, repeats: 20_000 },
];
const measuredSamples = 9;
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
  run("coil", ["build", coilPath, "-o", emitterPath,
    "--link-flag", `-Wl,-force_load,${nativeParserArchive}`,
    "--link-flag", "-framework", "--link-flag", "CoreFoundation",
    "--link-flag", "-framework", "--link-flag", "Security"]);
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
  const nodeRun = () => {
    const started = process.hrtime.bigint();
    let result;
    for (let i = 0; i < benchmark.repeats; ++i) result = module.main(benchmark.input);
    return { result, runtimeNs: Number(process.hrtime.bigint() - started) };
  };
  const nativeRun = () => {
    const text = run(executablePath, [String(benchmark.input), String(benchmark.repeats)]);
    return { result: metric(text, "result"), runtimeNs: metric(text, "runtime_ns") };
  };

  for (let i = 0; i < 3; ++i) { nativeRun(); nodeRun(); }
  const samples = [];
  for (let i = 0; i < measuredSamples; ++i) {
    const native = nativeRun();
    const node = nodeRun();
    if (native.result !== node.result) throw new Error(`${benchmark.name}: Coil ${native.result} != Node ${node.result}`);
    samples.push({ coilRuntimeNs: native.runtimeNs, nodeRuntimeNs: node.runtimeNs });
  }
  const coilMedianNs = median(samples.map(sample => sample.coilRuntimeNs));
  const nodeMedianNs = median(samples.map(sample => sample.nodeRuntimeNs));
  report.push({ ...benchmark, result: nativeRun().result, coilCompileNs, nodeCompileNs, coilMedianNs, nodeMedianNs,
    ratio: coilMedianNs / nodeMedianNs, samples });
  console.error(`${benchmark.name}: Coil ${(coilMedianNs / 1e6).toFixed(3)} ms, Node ${(nodeMedianNs / 1e6).toFixed(3)} ms`);
}

fs.writeFileSync(path.join(output, "results.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(), platform: `${os.platform()} ${os.arch()}`,
  node: process.version, measuredSamples, benchmarks: report,
}, null, 2)}\n`);
console.log("\n| Benchmark | Coil median | Node median | Coil / Node |");
console.log("|---|---:|---:|---:|");
for (const row of report)
  console.log(`| ${row.name} | ${(row.coilMedianNs / 1e6).toFixed(3)} ms | ${(row.nodeMedianNs / 1e6).toFixed(3)} ms | ${row.ratio.toFixed(3)}× |`);
