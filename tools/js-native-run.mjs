#!/usr/bin/env node
// One-command native-vs-Node runner for a single JavaScript/TypeScript file.
//
//   node tools/js-native-run.mjs FILE.js [HEAP_BYTES]
//
// The expensive part of the old loop was that every source change rebuilt the whole compiler,
// because the generated harness bakes the source in as a string constant. This tool builds ONE
// resident emitter (generate-typescript-aot-benchmark.mjs --resident) that reads its source
// from argv at runtime, caches it under .coil/build/js-resident/, and rebuilds it only when the
// compiler sources change. After the first build, iterating on a source file costs seconds.
//
// The program must define `main()`; the native harness prints `result=<n>`; this tool runs the
// same file under Node and reports MATCH/MISMATCH. Integer-tagged native results (0x7ffc<<48)
// are decoded before comparison so a tagged return still compares by value.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { ensureResidentEmitter } from "./resident-emitter.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const flags = new Set(process.argv.slice(2).filter(argument => argument.startsWith("--")));
const args = process.argv.slice(2).filter(argument => !argument.startsWith("--"));
const keep = flags.has("--keep");
// --debug: use a separately cached -O0 emitter. The compiler self-build drops from minutes to
// tens of seconds, which is the whole loop when the change under test is in the COMPILER; the
// emitter runs slower, which costs nothing at conformance-program scale.
const debug = flags.has("--debug");
// --ts-native: hand the TypeScript file to the native TS parser instead of transpiling first.
// The two modes compile DIFFERENT programs (annotations drive shapes), and divergences between
// them are themselves bugs worth surfacing.
const tsNative = flags.has("--ts-native");
// --eval: also run the program through the IR evaluator (resident harness mode "eval") for a
// THREE-WAY verdict. Node is the semantic oracle; the evaluator executes the graph the frontend
// built; native executes what the backend emitted. eval wrong => frontend bug, eval right but
// native wrong => backend bug. Splits any mismatch in half before a single graph dump is read.
const runEval = flags.has("--eval");
const [inputArgument, heapText] = args;
if (!inputArgument) {
  console.error("usage: js-native-run.mjs FILE.js|FILE.ts [HEAP_BYTES] [--keep] [--debug] [--ts-native] [--eval]");
  process.exit(2);
}
const input = path.resolve(inputArgument);
const heapBytes = heapText ? Number.parseInt(heapText, 10) : 268435456;

const cacheDirectory = path.join(root, ".coil", "build", "js-resident");
fs.mkdirSync(cacheDirectory, { recursive: true });
const emitter = ensureResidentEmitter(root, { debug });

// TypeScript arrives as plain JavaScript at the emitter; transpile like the conformance runner.
let sourcePath = input;
if (input.endsWith(".ts") && !tsNative) {
  const ts = (await import("typescript")).default;
  const transpiled = ts.transpileModule(fs.readFileSync(input, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: input,
  }).outputText.replace(/^export /gm, "");
  sourcePath = path.join(cacheDirectory, `${path.basename(input, ".ts")}.js`);
  fs.writeFileSync(sourcePath, transpiled);
}

const work = keep
  ? fs.mkdtempSync(path.join(os.tmpdir(), "js-native-run-"))
  : fs.mkdtempSync(path.join(os.tmpdir(), "js-native-run-"));
const object = path.join(work, "program.o");
const binary = path.join(work, "program");

// Phase timings: every run prints where the milliseconds went, so slow loops get diagnosed
// from the numbers instead of vibes.
const phaseMs = {};
const timed = (name, fn) => {
  const start = performance.now();
  const value = fn();
  phaseMs[name] = Math.round(performance.now() - start);
  return value;
};

const kind = tsNative && input.endsWith(".ts") ? "ts" : "js";
const emitted = timed("emit", () => spawnSync(emitter, [sourcePath, "0", "10", kind],
                          { maxBuffer: 256 * 1024 * 1024 }));
if (emitted.status !== 0) {
  process.stderr.write(emitted.stderr ?? "");
  console.error(`emitter failed with status ${emitted.status}`);
  process.exit(1);
}
fs.writeFileSync(object, emitted.stdout);
timed("clang", () => execFileSync("xcrun", ["clang", "-arch", "arm64", "-O1",
  path.join(root, "tools", "native-gc-runtime.c"),
  path.join(root, "tools", "native-gc-trampoline.S"),
  path.join(root, "tools", "v8-native-harness.c"),
  object, "-o", binary], { stdio: "inherit" }));

const native = timed("native", () => spawnSync(binary, [String(heapBytes)], { encoding: "utf8" }));
process.stdout.write(native.stdout);
process.stderr.write(native.stderr);
const nativeMatch = /result=(-?\d+)/.exec(native.stdout);
let nativeValue = nativeMatch ? BigInt(nativeMatch[1]) : null;
// Decode an integer-tagged result (JSV-INTEGER = 0x7ffc << 48) to its payload. A word whose top
// sixteen bits are OUTSIDE the NaN-box tag range is a float stored as its raw IEEE bits; decode
// it numerically so `return 2.5 * 4` compares as 10 and not as 4621819117588971520.
const boxTags = new Set([0x7ff9n, 0x7ffan, 0x7ffbn, 0x7ffcn, 0x7ffdn, 0x7ffen, 0x7fffn,
                         0xfff8n, 0xfff9n, 0xfffan, 0xfffbn, 0xfffcn, 0xfffdn, 0xfffen, 0xffffn]);
let nativeFloat = null;
if (nativeValue !== null) {
  const bits = BigInt.asUintN(64, nativeValue);
  if ((bits >> 48n) === 0x7ffcn) {
    nativeValue = BigInt.asIntN(48, bits);
    console.log(`native result was integer-tagged; payload = ${nativeValue}`);
  } else if (!boxTags.has(bits >> 48n) && bits > 0xffffffffn) {
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, bits);
    nativeFloat = view.getFloat64(0);
    console.log(`native result was float bits; value = ${nativeFloat}`);
  }
}

let evalValue = null;
let evalStatus = null;
if (runEval) {
  const evaluated = timed("eval", () => spawnSync(emitter, [sourcePath, "0", "10", kind, "eval"],
                              { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }));
  const statusMatch = /evstatus=(-?\d+)/.exec(evaluated.stdout ?? "");
  const resultMatch = /result=(-?\d+)/.exec(evaluated.stdout ?? "");
  evalStatus = statusMatch ? Number(statusMatch[1]) : null;
  if (resultMatch) evalValue = BigInt(resultMatch[1]);
  if (evalValue !== null && (BigInt.asUintN(64, evalValue) >> 48n) === 0x7ffcn) {
    evalValue = BigInt.asIntN(48, BigInt.asUintN(64, evalValue));
  }
  if (evalStatus !== 0) {
    process.stderr.write(evaluated.stderr ?? "");
    console.log(`evaluator failed: evstatus=${evalStatus ?? "missing"} (exit ${evaluated.status})`);
    evalValue = null;
  } else {
    console.log(`eval result=${evalValue}`);
  }
}

let nodeValue = null;
try {
  let nodeSource = fs.readFileSync(sourcePath, "utf8");
  if (sourcePath.endsWith(".ts")) {
    const ts = (await import("typescript")).default;
    nodeSource = ts.transpileModule(nodeSource, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace(/^export /gm, "");
  }
  const script = `${nodeSource}\nconsole.log(String(main()));`;
  const nodeRun = timed("node", () => spawnSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" }));
  const lines = nodeRun.stdout.trim().split("\n");
  nodeValue = BigInt(lines[lines.length - 1]);
  console.log(`node result=${nodeValue}`);
} catch {
  console.log("node run failed or returned a non-integer; compare manually");
}

if (!keep) fs.rmSync(work, { recursive: true, force: true });
else console.log(`artifacts kept in ${work}`);

console.log(`phase-ms: ${Object.entries(phaseMs).map(([name, ms]) => `${name}=${ms}`).join(" ")}` +
            ` total=${Object.values(phaseMs).reduce((sum, ms) => sum + ms, 0)}`);

if (native.status !== 0) {
  console.log(`VERDICT: native exited ${native.status} (signal ${native.signal ?? "none"})`);
  process.exit(1);
}
if (nativeFloat !== null && nodeValue !== null && Number.isFinite(nativeFloat) &&
    nativeFloat === Number(nodeValue)) {
  nativeValue = nodeValue;
}
if (runEval && nativeValue !== null && nodeValue !== null) {
  const parts = `native=${nativeValue} eval=${evalValue ?? "?"} node=${nodeValue}`;
  if (nativeValue === nodeValue && evalValue === nodeValue) {
    console.log(`VERDICT: MATCH (${parts})`);
    process.exit(0);
  }
  const blame = evalValue === null ? "evaluator did not finish"
    : evalValue !== nodeValue ? "frontend: the evaluator already disagrees with Node"
    : "backend: the evaluator agrees with Node but native does not";
  console.log(`VERDICT: MISMATCH (${parts}) — ${blame}`);
  process.exit(1);
}
if (nativeValue !== null && nodeValue !== null) {
  const verdict = nativeValue === nodeValue ? "MATCH" : "MISMATCH";
  console.log(`VERDICT: ${verdict} (native=${nativeValue} node=${nodeValue})`);
  process.exit(verdict === "MATCH" ? 0 : 1);
}
console.log("VERDICT: incomparable (missing a result)");
process.exit(1);
