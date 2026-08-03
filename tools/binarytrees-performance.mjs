#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import ts from "typescript";
import { normalizeTypeScript } from "../src/frontend_ir.mjs";
import { generateCoilBuilder } from "../src/frontend_coil_codegen.mjs";

const root = path.resolve(import.meta.dirname, "..");
const jsonPath = path.join(root, "benchmarks/binarytrees-depth21.json");
const reportPath = path.join(root, "docs/BINARYTREES-PERFORMANCE.md");
const mode = process.argv[2];
const depth = 21;
const requiredSamples = 9;

function fail(message) {
  console.error(`binarytrees performance: ${message}`);
  process.exit(1);
}

function run(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: root, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${file} ${args.join(" ")} exited ${result.status}\n${result.stderr ?? ""}`);
  }
  return result;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function metrics(text) {
  return Object.fromEntries([...text.matchAll(/([a-z_]+)=([0-9]+)/g)].map(match => [match[1], Number(match[2])]));
}

function phaseMetrics(text) {
  const line = text.split("\n").find(value => value.startsWith("PHASE "));
  if (!line) throw new Error(`missing PHASE line: ${text}`);
  const raw = metrics(line);
  const scale = raw.numer / raw.denom;
  const result = {};
  for (const name of ["graph", "optimization", "selection", "gcm", "scheduling", "allocation", "encoding", "object"])
    result[name] = Math.round(raw[name] * scale);
  return { phases: result, codeSize: raw.code_size, objectSize: raw.object_size };
}

function frontendSample(source, filename) {
  let start = performance.now();
  ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const parse = performance.now() - start;
  start = performance.now();
  const program = normalizeTypeScript(source, filename);
  const normalized = performance.now() - start;
  start = performance.now();
  generateCoilBuilder(program, { moduleName: "profiletypescriptbinarytrees" });
  const graph = performance.now() - start;
  return {
    parse: Math.round(parse * 1e6),
    resolve: Math.round(Math.max(0, normalized - parse) * 1e6),
    graphConstruction: Math.round(graph * 1e6),
  };
}

function validate(data) {
  if (data.schemaVersion !== 1 || data.benchmark !== "binary-trees" || data.depth !== depth)
    fail("published JSON has the wrong schema, benchmark, or depth");
  if (data.protocol?.measuredSamples !== requiredSamples || data.samples?.length !== requiredSamples)
    fail(`published JSON must contain exactly ${requiredSamples} measured samples`);
  const phases = ["parse", "resolve", "graph-construction", "optimization", "selection", "gcm", "scheduling", "allocation", "encoding", "linking", "execution", "gc"];
  for (const phase of phases) if (!(phase in data.medians.phasesNs)) fail(`missing phase ${phase}`);
  for (const field of ["allocationThroughputBytesPerSecond", "collections", "copiedBytes", "promotedBytes", "peakLiveHeap", "codeSize", "nodeRatio"])
    if (!(field in data.medians)) fail(`missing median metric ${field}`);
  if (!Array.isArray(data.losses) || data.losses.length === 0) fail("losses must be explicitly disclosed");
  for (const sample of data.samples) {
    if (sample.depth !== depth || !sample.coil || !sample.node || !sample.frontend || !sample.backend)
      fail("raw sample is incomplete");
  }
  if (!fs.existsSync(reportPath)) fail("Markdown report is missing");
  const report = fs.readFileSync(reportPath, "utf8");
  for (const phrase of ["Raw samples", "Median", "Coil / Node", "Losses and limitations"])
    if (!report.includes(phrase)) fail(`Markdown report is missing ${phrase}`);
}

if (mode === "--verify") {
  if (!fs.existsSync(jsonPath)) fail("run --update to publish the benchmark evidence");
  validate(JSON.parse(fs.readFileSync(jsonPath, "utf8")));
  console.log(`verified ${path.relative(root, jsonPath)} and ${path.relative(root, reportPath)} without writing files`);
  process.exit(0);
}

if (mode !== "--update") fail("usage: tools/binarytrees-performance.mjs [--verify|--update]");

const output = path.join(root, "out/binarytrees-performance");
fs.mkdirSync(output, { recursive: true });
const sourcePath = path.join(root, "tests/typescript/binarytrees.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const coilPath = path.join(output, "profile-emitter.coil");
const emitterPath = path.join(output, "profile-emitter");
fs.copyFileSync(path.join(root, "tools/profile-binarytrees-phases.coil"), coilPath);
run("coil", ["build", coilPath, "-o", emitterPath]);

function compile(seed, ordinal) {
  const objectPath = path.join(output, `binarytrees-${ordinal}.o`);
  const executablePath = path.join(output, `binarytrees-${ordinal}`);
  const emitted = run(emitterPath, [String(seed), "10"], { encoding: null });
  fs.writeFileSync(objectPath, emitted.stdout);
  const backend = phaseMetrics(emitted.stderr.toString());
  const linkStarted = process.hrtime.bigint();
  run("xcrun", ["clang", "-arch", "arm64", "-O1", "-fno-omit-frame-pointer",
    "tools/binarytrees-harness.c", "tools/native-gc-runtime.c", "tools/native-gc-trampoline.S",
    objectPath, "-o", executablePath]);
  const linking = Number(process.hrtime.bigint() - linkStarted);
  return { executablePath, backend, linking };
}

// Warm both runtimes and all compilation paths without retaining their observations.
for (let warmup = 0; warmup < 2; ++warmup) {
  frontendSample(source, sourcePath);
  const built = compile(9000 + warmup, `warmup-${warmup}`);
  run(built.executablePath, ["10", "0", "0"]);
  run(process.execPath, ["tools/binarytrees-reference.mjs", "10", "--timed"]);
}

const samples = [];
for (let ordinal = 0; ordinal < requiredSamples; ++ordinal) {
  const frontend = frontendSample(source, sourcePath);
  const built = compile(9100 + ordinal, ordinal);
  const coilRun = run(built.executablePath, [String(depth), "0", "0"]);
  const coil = metrics(coilRun.stdout);
  const nodeRun = run(process.execPath, ["tools/binarytrees-reference.mjs", String(depth), "--timed"]);
  const node = metrics(nodeRun.stderr);
  samples.push({
    ordinal: ordinal + 1, depth, seed: 9100 + ordinal,
    frontend,
    backend: { ...built.backend.phases, linking: built.linking, codeSize: built.backend.codeSize, objectSize: built.backend.objectSize },
    coil,
    node,
  });
  console.error(`sample ${ordinal + 1}/${requiredSamples}: Coil ${(coil.runtime_ns / 1e9).toFixed(3)}s, Node ${(node.runtime_ns / 1e9).toFixed(3)}s`);
}

const med = key => median(samples.map(sample => key(sample)));
const phasesNs = {
  parse: med(s => s.frontend.parse),
  resolve: med(s => s.frontend.resolve),
  "graph-construction": med(s => s.backend.graph),
  optimization: med(s => s.backend.optimization), selection: med(s => s.backend.selection),
  gcm: med(s => s.backend.gcm), scheduling: med(s => s.backend.scheduling),
  allocation: med(s => s.backend.allocation), encoding: med(s => s.backend.encoding + s.backend.object),
  linking: med(s => s.backend.linking), execution: med(s => s.coil.runtime_ns), gc: med(s => s.coil.gc_ns),
};
const coilRuntime = phasesNs.execution;
const nodeRuntime = med(s => s.node.runtime_ns);
const data = {
  schemaVersion: 1, benchmark: "binary-trees", depth,
  generatedAt: new Date().toISOString(),
  environment: {
    commit: run("git", ["rev-parse", "HEAD"]).stdout.trim(),
    dirty: run("git", ["status", "--porcelain"]).stdout.trim().length > 0,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model ?? "unknown", node: process.version,
    typescript: ts.version,
    coil: (() => {
      const help = spawnSync("coil", ["--help"], { cwd: root, encoding: "utf8" });
      return (help.stdout || help.stderr).split("\n").find(Boolean)?.trim() || "coil (version unavailable)";
    })(),
  },
  protocol: { warmupSamples: 2, measuredSamples: requiredSamples, depth, registers: 10, gcHeapBytes: 268435456, order: "Coil then Node per sample" },
  medians: {
    phasesNs,
    nodeRuntimeNs: nodeRuntime,
    nodeRatio: coilRuntime / nodeRuntime,
    allocationThroughputBytesPerSecond: med(s => s.coil.bytes / (s.coil.runtime_ns / 1e9)),
    allocations: med(s => s.coil.allocations), collections: med(s => s.coil.collections),
    copiedBytes: med(s => s.coil.copied), promotedBytes: med(s => s.coil.promoted),
    peakLiveHeap: med(s => s.coil.peak), codeSize: med(s => s.backend.codeSize),
    objectSize: med(s => s.backend.objectSize),
  },
  losses: [
    "This is one Apple Silicon machine and is not a cross-machine performance claim.",
    "Frontend resolve time is normalized-frontend time minus an independently measured TypeScript parse; timer noise can clamp it to zero.",
    "Frontend Coil-source generation and hand-built Coil graph construction are timed separately; process startup is excluded.",
    "Depth-21 execution measures the hand-built Coil kernel proven by X2. TypeScript parsing, resolution, and source generation are reported separately; X5 independently proves the generated TypeScript-native kernel at depth 21.",
    "Coil and Node execute the same observables and allocation workload, but use different object layouts and garbage collectors.",
    "Samples run sequentially rather than under an isolated or frequency-pinned laboratory environment."
  ],
  samples,
};

const ms = ns => (ns / 1e6).toFixed(3);
const rows = samples.map(s => `| ${s.ordinal} | ${(s.coil.runtime_ns / 1e9).toFixed(3)} | ${(s.node.runtime_ns / 1e9).toFixed(3)} | ${(s.coil.runtime_ns / s.node.runtime_ns).toFixed(3)} | ${s.coil.collections} | ${s.coil.copied} | ${s.coil.promoted} |`).join("\n");
const phaseRows = Object.entries(phasesNs).map(([name, value]) => `| ${name} | ${ms(value)} |`).join("\n");
const report = `# Binary-trees depth-21 performance\n\nThis report is generated by \`node tools/binarytrees-performance.mjs --update\`. Correctness and report verification use \`tools/binarytrees-performance-gate.sh --verify\`, which does not publish or modify tracked files.\n\n## Median results\n\n- Coil execution: ${(coilRuntime / 1e9).toFixed(3)} s\n- Node execution: ${(nodeRuntime / 1e9).toFixed(3)} s\n- Coil / Node ratio: ${(coilRuntime / nodeRuntime).toFixed(3)} (lower is faster)\n- Allocation throughput: ${(data.medians.allocationThroughputBytesPerSecond / 1e9).toFixed(3)} GB/s\n- Collections: ${data.medians.collections}; copied: ${data.medians.copiedBytes} bytes; promoted: ${data.medians.promotedBytes} bytes\n- Peak live heap: ${data.medians.peakLiveHeap} bytes; code size: ${data.medians.codeSize} bytes\n\n| Phase | Median ms |\n|---|---:|\n${phaseRows}\n\n## Raw samples\n\n| Sample | Coil s | Node s | Coil / Node | Collections | Copied bytes | Promoted bytes |\n|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n\nThe complete raw observations, environment, protocol, and per-phase nanoseconds are in [\`benchmarks/binarytrees-depth21.json\`](../benchmarks/binarytrees-depth21.json).\n\n## Losses and limitations\n\n${data.losses.map(loss => `- ${loss}`).join("\n")}\n`;

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
for (const [target, contents] of [[jsonPath, `${JSON.stringify(data, null, 2)}\n`], [reportPath, report]]) {
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, contents);
  fs.renameSync(temporary, target);
}
validate(data);
console.log(`published ${requiredSamples} depth-${depth} samples`);
