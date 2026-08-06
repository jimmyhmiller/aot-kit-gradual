#!/usr/bin/env node
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {compareTraces, formatComparison, readTrace} from "./compare-semantic-traces.mjs";

const root = path.resolve(import.meta.dirname, "..");
const known = new Set(["richards", "deltablue"]);
const args = process.argv.slice(2);
const benchmark = args.shift();
if (!known.has(benchmark)) usage();

let stage = "all";
let seed = 0;
let registers = 10;
let traceLimit = 4096;
let problemSize = null;
let nativeTimeout = 30000;
let deltaPhase = "both";
let skipDestroy = false;
let chainBuildOnly = false;
let runDirectory = null;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  const value = () => {
    if (index + 1 >= args.length) usage(`missing value after ${argument}`);
    index += 1;
    return args[index];
  };
  if (argument === "--stage") stage = value();
  else if (argument === "--seed") seed = integer(value(), "seed");
  else if (argument === "--registers") registers = integer(value(), "registers");
  else if (argument === "--trace-limit") traceLimit = integer(value(), "trace limit");
  else if (argument === "--size") problemSize = integer(value(), "problem size");
  else if (argument === "--native-timeout") nativeTimeout = integer(value(), "native timeout");
  else if (argument === "--phase") deltaPhase = value();
  else if (argument === "--skip-destroy") skipDestroy = true;
  else if (argument === "--chain-build-only") chainBuildOnly = true;
  else if (argument === "--run-dir") runDirectory = path.resolve(value());
  else usage(`unknown option: ${argument}`);
}
const stages = new Set(["node", "ideal-raw", "ideal-optimized", "ideal", "emitter", "native", "all"]);
if (!stages.has(stage)) usage(`unknown stage: ${stage}`);
if (registers < 1 || traceLimit < 0 || nativeTimeout < 1 || (problemSize !== null && problemSize < 0)) usage("registers and native timeout must be positive; trace limit and problem size must be non-negative");
if (!["both", "chain", "projection"].includes(deltaPhase)) usage("phase must be both, chain, or projection");

const stamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const directory = runDirectory ?? path.join(root, ".coil", "debug", benchmark, `${stamp}-${process.pid}`);
fs.mkdirSync(directory, {recursive: true});
const manifest = {benchmark, stage, seed, registers, traceLimit, problemSize, nativeTimeout, deltaPhase, skipDestroy, directory, startedAt: new Date().toISOString(), commands: []};
const adapted = path.join(directory, `${benchmark}.js`);
const archive = path.join(root, ".coil", "build", "native", "typescript-go-bridge", "libaot_typescript.a");
const linkFlags = ["--link-flag", `-Wl,-force_load,${archive}`, "--link-flag", "-framework", "--link-flag", "CoreFoundation", "--link-flag", "-framework", "--link-flag", "Security"];

function usage(message) {
  if (message) console.error(message);
  console.error("usage: debug-benchmark.mjs [richards|deltablue] [--stage node|ideal-raw|ideal-optimized|ideal|emitter|native|all] [--seed N] [--registers N] [--trace-limit N] [--size N] [--phase both|chain|projection] [--skip-destroy] [--native-timeout MS] [--run-dir DIR]");
  process.exit(2);
}
function integer(text, name) {
  const result = Number.parseInt(text, 10);
  if (!Number.isSafeInteger(result)) usage(`${name} must be an integer`);
  return result;
}
function quote(command) { return command.map(part => /[^A-Za-z0-9_./:=,+-]/.test(part) ? JSON.stringify(part) : part).join(" "); }
function record() { fs.writeFileSync(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`); }
function run(name, command, commandArgs, options = {}) {
  const rendered = quote([command, ...commandArgs]);
  console.error(`==> ${name}\n    ${rendered}`);
  const result = spawnSync(command, commandArgs, {
    cwd: root, env: {...process.env, ...options.env}, encoding: options.binary ? null : "utf8",
    maxBuffer: 64 * 1024 * 1024, timeout: options.timeout ?? 0,
  });
  const stdout = result.stdout ?? (options.binary ? Buffer.alloc(0) : "");
  const stderr = result.stderr ?? (options.binary ? Buffer.alloc(0) : "");
  if (options.stdoutFile) fs.writeFileSync(options.stdoutFile, stdout);
  else if (!options.binary && stdout) process.stdout.write(stdout);
  if (options.stderrFile) fs.writeFileSync(options.stderrFile, stderr);
  else if (!options.binary && stderr) process.stderr.write(stderr);
  const entry = {name, command: rendered, status: result.status, signal: result.signal, error: result.error?.message ?? null};
  manifest.commands.push(entry); record();
  if (result.error || result.signal || result.status !== 0) {
    console.error(`FAILED ${name}: ${result.signal ?? `exit ${result.status}`}`);
  }
  return {...result, ok: !result.error && !result.signal && result.status === 0};
}
function extractTrace(stderrFile, traceFile) {
  const lines = fs.readFileSync(stderrFile, "utf8").split(/\r?\n/);
  const trace = lines.filter(line => line.startsWith("AOT_TRACE ")).map(line => line.slice(10));
  fs.writeFileSync(traceFile, trace.length ? `${trace.join("\n")}\n` : "");
  fs.writeFileSync(stderrFile, `${lines.filter(line => !line.startsWith("AOT_TRACE ")).join("\n")}`);
  return trace.length;
}
function ensureBridge() {
  return run("build TypeScript bridge", path.join(root, "tools", "build-typescript-go-bridge.sh"), []).ok;
}
function adapt(nodeRun = false) {
  const output = nodeRun ? path.join(directory, `${benchmark}-node.js`) : adapted;
  const result = run(nodeRun ? "adapt Node oracle" : "adapt benchmark", "node",
    [path.join(root, "tools", "b15-adapt.mjs"), benchmark, path.join(root, "benchmarks", "v8-v7", `${benchmark}.js`)],
    {env: nodeRun ? {AOT_B15_NODE_RUN: "1"} : {}, stdoutFile: output});
  if (!result.ok) return null;
  if (problemSize !== null && benchmark === "deltablue") {
    const source = fs.readFileSync(output, "utf8");
    fs.writeFileSync(output, source.replace("chainTest(100);", `chainTest(${problemSize});`).replace("projectionTest(100);", `projectionTest(${problemSize});`));
  }
  if (benchmark === "deltablue" && deltaPhase !== "both") {
    const source = fs.readFileSync(output, "utf8");
    const omitted = deltaPhase === "chain" ? /\s*projectionTest\(\d+\);/ : /\s*chainTest\(\d+\);/;
    fs.writeFileSync(output, source.replace(omitted, ""));
  }
  if (benchmark === "deltablue" && skipDestroy) {
    const source = fs.readFileSync(output, "utf8");
    fs.writeFileSync(output, source.replaceAll("edit.destroyConstraint();", ""));
  }
  if (benchmark === "deltablue" && chainBuildOnly) {
    const source = fs.readFileSync(output, "utf8");
    fs.writeFileSync(output, source.replace("  new StayConstraint(last, Strength.STRONG_DEFAULT);", "  return;"));
  }
  if (benchmark === "deltablue") {
    const source = fs.readFileSync(output, "utf8");
    fs.writeFileSync(output, source
      .replace('alert("Cycle encountered");', 'alert("Cycle encountered mark=" + mark);')
      .replace('alert("Chain test failed.");', 'alert("Chain test failed i=" + i + " last=" + last.value);')
      .replace('alert("Projection 1 failed")', 'alert("Projection 1 failed dst=" + dst.value)')
      .replace('alert("Projection 2 failed")', 'alert("Projection 2 failed src=" + src.value)'));
  }
  return output;
}
function ideal(mode) {
  const coil = path.join(directory, `ideal-${mode}.coil`);
  const executable = path.join(directory, `ideal-${mode}`);
  if (!run(`generate ${mode} ideal runner`, "node", [path.join(root, "tools", "generate-b15-ideal-runner.mjs"), adapted, coil, mode, String(traceLimit)]).ok) return false;
  if (!run(`build ${mode} ideal runner`, "coil", ["build", coil, "-o", executable, ...linkFlags], {stderrFile: path.join(directory, `ideal-${mode}.build.stderr`)}).ok) return false;
  const stderrFile = path.join(directory, `ideal-${mode}.stderr`);
  const result = run(`execute ${mode} ideal`, executable, [], {stdoutFile: path.join(directory, `ideal-${mode}.stdout`), stderrFile});
  const count = extractTrace(stderrFile, path.join(directory, `trace-${mode}.jsonl`));
  console.error(`    wrote ${count} semantic events`);
  return result.ok;
}
function compareIdeal() {
  const rawFile = path.join(directory, "trace-raw.jsonl");
  const optimizedFile = path.join(directory, "trace-optimized.jsonl");
  if (!fs.existsSync(rawFile) || !fs.existsSync(optimizedFile)) return false;
  const raw = readTrace(rawFile), optimized = readTrace(optimizedFile);
  const result = compareTraces(raw, optimized);
  const report = formatComparison(result, raw, optimized);
  fs.writeFileSync(path.join(directory, "first-divergence.txt"), report);
  process.stdout.write(report);
  manifest.comparison = result.equal ? {equal: true, count: result.count} : {equal: false, index: result.index, reason: result.reason};
  record();
  return result.equal;
}
function emitObject() {
  const coil = path.join(directory, `${benchmark}-emitter.coil`);
  const executable = path.join(directory, `${benchmark}-emitter`);
  if (!run("generate native emitter", "node", [path.join(root, "tools", "generate-typescript-aot-benchmark.mjs"), adapted, coil, String(seed), String(registers)]).ok) return null;
  if (!run("build native emitter", "coil", ["build", coil, "-o", executable, ...linkFlags], {stderrFile: path.join(directory, "emitter.build.stderr")}).ok) return null;
  const object = path.join(directory, `${benchmark}-${seed}-${registers}.o`);
  const result = run("emit native object", executable, [String(seed), String(registers)], {binary: true, stdoutFile: object, stderrFile: path.join(directory, "emitter.stderr")});
  if (!result.ok && result.signal && process.platform === "darwin") {
    const backtraceFile = path.join(directory, "emitter.lldb.txt");
    run("capture emitter backtrace", "lldb", ["--batch", "-o", "run", "-k", "thread backtrace all", "--", executable, String(seed), String(registers)], {stdoutFile: backtraceFile, stderrFile: path.join(directory, "emitter.lldb.stderr"), timeout: 60000});
    const backtrace = fs.existsSync(backtraceFile) ? fs.readFileSync(backtraceFile, "utf8") : "";
    const firstFrame = backtrace.split(/\r?\n/).find(line => /frame #0:/.test(line));
    if (firstFrame) {
      manifest.crash = {signal: result.signal, firstFrame: firstFrame.trim(), backtrace: backtraceFile};
      console.error(`First crash frame: ${firstFrame.trim()}`);
      record();
    }
  }
  return result.ok ? object : null;
}
function native(object) {
  const binary = path.join(directory, `${benchmark}-${seed}-${registers}`);
  if (!run("link native benchmark", "xcrun", ["clang", "-arch", "arm64", "-O1", path.join(root, "tools", "native-gc-runtime.c"), path.join(root, "tools", "native-gc-trampoline.S"), path.join(root, "tools", "v8-native-harness.c"), object, "-o", binary], {stderrFile: path.join(directory, "native.link.stderr")}).ok) return false;
  return run("execute native benchmark", binary, [], {stdoutFile: path.join(directory, "native.stdout"), stderrFile: path.join(directory, "native.stderr"), timeout: nativeTimeout}).ok;
}

console.error(`Debug artifacts: ${directory}`);
record();
let ok = true;
if (!adapt(false)) ok = false;
if (ok && (stage === "node" || stage === "all")) {
  const nodeFile = adapt(true);
  ok = Boolean(nodeFile) && run("execute Node oracle", "node", [nodeFile], {stdoutFile: path.join(directory, "node.stdout"), stderrFile: path.join(directory, "node.stderr")}).ok;
}
if (ok && stage !== "node") ok = ensureBridge();
if (ok && stage === "ideal-raw") ok = ideal("raw");
if (ok && stage === "ideal-optimized") ok = ideal("optimized");
if (ok && (stage === "ideal" || stage === "all")) {
  const rawOK = ideal("raw");
  const optimizedOK = ideal("optimized");
  const tracesEqual = compareIdeal();
  ok = rawOK && optimizedOK && tracesEqual;
}
let object = null;
if (ok && (stage === "emitter" || stage === "native" || stage === "all")) {
  object = emitObject(); ok = Boolean(object);
}
if (ok && (stage === "native" || stage === "all")) ok = native(object);
manifest.finishedAt = new Date().toISOString(); manifest.ok = ok; record();
console.error(`${ok ? "PASS" : "FAIL"}: ${benchmark} ${stage}`);
console.error(`Artifacts: ${directory}`);
console.error(`Rerun: node tools/debug-benchmark.mjs ${benchmark} --stage ${stage} --seed ${seed} --registers ${registers} --trace-limit ${traceLimit}${problemSize === null ? "" : ` --size ${problemSize}`} --phase ${deltaPhase} --native-timeout ${nativeTimeout} --run-dir ${JSON.stringify(directory)}`);
process.exitCode = ok ? 0 : 1;
