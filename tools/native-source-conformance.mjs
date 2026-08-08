#!/usr/bin/env node
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const argumentsSet = new Set(process.argv.slice(2));
const extended = argumentsSet.delete("--extended");
const keep = argumentsSet.delete("--keep");
const audit = argumentsSet.delete("--audit");
const selected = [...argumentsSet].map(argument => {
  if (!argument.startsWith("--case=")) throw new Error(`unknown argument: ${argument}`);
  return argument.slice("--case=".length);
});
const corpus = path.join(root, "tests", "native-conformance");
const manifest = JSON.parse(fs.readFileSync(path.join(corpus, "manifest.json"), "utf8"));
assert.equal(manifest.schemaVersion, 1);
const selectedCases = selected.length
  ? manifest.cases.filter(test => selected.includes(test.name))
  : manifest.cases.filter(test => audit || test.status !== "gap");
const cases = selectedCases;
assert.equal(cases.length, selected.length || selectedCases.length, "every selected case must exist");

const modes = extended
  ? [
      {name: "normal", seed: 0, registers: 10, stress: 0},
      {name: "seeded", seed: 17041, registers: 10, stress: 0},
      {name: "pressure-gc", seed: 17042, registers: 3, stress: 1},
    ]
  : [{name: "normal", seed: 0, registers: 10, stress: 0}];
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aot-native-conformance-"));
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root,
  encoding: options.binary ? null : "utf8",
  maxBuffer: 64 * 1024 * 1024,
  stdio: options.stdio,
});
const archive = run(path.join(root, "tools", "build-typescript-go-bridge.sh"), []).trim();
// Coil.toml's [link] flags already force-load this archive and name the frameworks, and the
// compiler applies them to every build in the project. Passing them again here loads the archive
// twice and the link fails with ~73 duplicate symbols, each reported against itself.
const linkFlags = [];

const report = {schemaVersion: 1, extended, modes, cases: []};
try {
  for (const test of cases) {
    const sourcePath = path.join(corpus, test.file);
    const argumentsSetForCase = test.args ?? [];
    const source = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
      fileName: sourcePath,
      reportDiagnostics: true,
    });
    const errors = (transpiled.diagnostics ?? []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(errors, [], `${sourcePath} must transpile without TypeScript errors`);
    const nodeMain = test.nodeGlobal
      ? new Function(`${transpiled.outputText}\nreturn main;`)()
      : (await import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString("base64")}`)).main;
    assert.equal(typeof nodeMain, "function", `${sourcePath} defines main`);
    const expected = nodeMain(...argumentsSetForCase);
    assert.ok(Number.isSafeInteger(expected), `${sourcePath} returns a safe integer observable`);
    const coilPath = path.join(directory, `${test.name}.coil`);
    const emitterPath = path.join(directory, `${test.name}-emitter`);
    run(process.execPath, [path.join(root, "tools", "generate-typescript-aot-benchmark.mjs"), sourcePath, coilPath,
      String(test.buildSeed ?? 0), "10", test.optimize === false ? "0" : "1"]);
    run("coil", ["build", coilPath, "-o", emitterPath, ...linkFlags]);
    const observations = [];
    for (const mode of modes) {
      const objectPath = path.join(directory, `${test.name}-${mode.name}.o`);
      const binaryPath = path.join(directory, `${test.name}-${mode.name}`);
      const scheduleSeed = mode.name === "normal" && test.scheduleSeed !== undefined ? test.scheduleSeed : mode.seed;
      fs.writeFileSync(objectPath, run(emitterPath, [String(scheduleSeed), String(test.registers ?? mode.registers)], {binary: true}));
      run("xcrun", ["clang", "-arch", "arm64", "-O1", "-fno-omit-frame-pointer",
        path.join(root, "tools", "native-gc-runtime.c"),
        path.join(root, "tools", "native-gc-trampoline.S"),
        path.join(root, "tools", test.harness ?? "native-conformance-harness.c"), objectPath, "-o", binaryPath]);
      const nativeArgs = test.harness
        ? (mode.stress ? ["stress"] : [])
        : [String(argumentsSetForCase[0] ?? 0), String(mode.stress), test.warmup ? "1" : "0",
            argumentsSetForCase.length ? "1" : "0"];
      const output = run(binaryPath, nativeArgs).trim();
      const match = /^result=(-?\d+) collections=(\d+) moves=(\d+)$/.exec(output);
      assert.ok(match, `${test.name}/${mode.name} emitted a structured native result: ${output}`);
      const actual = Number(match[1]);
      assert.equal(actual, expected, `${test.name}/${mode.name}: native result agrees with Node`);
      observations.push({mode: mode.name, result: actual, collections: Number(match[2]), moves: Number(match[3])});
    }
    report.cases.push({name: test.name, file: test.file, args: argumentsSetForCase, optimize: test.optimize !== false,
      features: test.features, node: expected, native: observations});
    console.log(`${test.name.padEnd(30)} Node=${expected} native=${observations.map(item => item.result).join(",")}`);
  }
  fs.mkdirSync(path.join(root, "out"), {recursive: true});
  fs.writeFileSync(path.join(root, "out", "native-conformance.json"), `${JSON.stringify(report, null, 2)}\n`);
  const featureCount = new Set(report.cases.flatMap(test => test.features)).size;
  console.log(`NATIVE CONFORMANCE GREEN — ${report.cases.length} programs, ${featureCount} feature labels, ${modes.length} mode(s)`);
} finally {
  if (keep) console.error(`kept conformance artifacts: ${directory}`);
  else fs.rmSync(directory, {recursive: true, force: true});
}
