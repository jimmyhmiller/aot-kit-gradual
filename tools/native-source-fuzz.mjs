#!/usr/bin/env node
// A differential fuzzer for whole TypeScript programs through the real native pipeline.
//
//   tools/native-source-fuzz.mjs                       # 50 programs from seed 1, unoptimized
//   tools/native-source-fuzz.mjs --seed=5000 --count=200 --optimize
//   tools/native-source-fuzz.mjs --keep                # leave the failing sources on disk
//
// `native-source-conformance.sh` proves that the programs SOMEBODY WROTE still agree with Node.
// This proves it for programs nobody wrote, which is a different question and answers it about a
// part of the space no corpus covers: expression SHAPE. It found three miscompiles the corpus could
// not, and the first of them within sixty programs — a representation query that answered by
// operand depth, so a sum of ten terms and a sum of seven compiled differently.
//
// Two properties are checked per program, and the second is the one a corpus cannot state:
//
//   - the native answer equals Node's, under three schedule/register configurations;
//   - the native answer is the SAME on every run of one binary. An answer that is not a function
//     of the program reads as a wrong constant in any single-run harness, and it is the shape that
//     tells you a register nothing wrote is being read.
//
// THE GENERATOR KEEPS A LIVE MODEL of every array and evaluates each term against it as the term is
// chosen, so no term is ever `undefined`. That is not tidiness: coercing `undefined` to a number
// traps today (`xs[5] + 1` is a SIGTRAP, recorded in HANDOFF.md), and a generator that produces it
// rejects nine programs in ten and reports one defect over and over instead of finding others.
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const flags = new Set(process.argv.slice(2));
const keep = flags.delete("--keep");
const optimize = flags.delete("--optimize");
const numeric = (name, fallback) => {
  for (const flag of flags) {
    if (!flag.startsWith(`--${name}=`)) continue;
    flags.delete(flag);
    const value = Number(flag.slice(name.length + 3));
    if (!Number.isSafeInteger(value)) throw new Error(`--${name} takes an integer`);
    return value;
  }
  return fallback;
};
const startSeed = numeric("seed", 1);
const count = numeric("count", 50);
if (flags.size) throw new Error(`unknown argument: ${[...flags][0]}`);

// A seed names a program, so the same seed must name it forever: a report is worthless if the
// program it names cannot be rebuilt. Hence an explicit generator rather than Math.random.
let state = 0;
const rnd = () => {
  state = (state * 1103515245 + 12345) & 0x7fffffff;
  return state / 0x80000000;
};
const pick = list => list[Math.floor(rnd() * list.length)];
const int = (low, high) => low + Math.floor(rnd() * (high - low + 1));
const primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];

// Terms are scaled by distinct primes so that a term silently dropped, doubled, or swapped with
// another moves the total. Equal weights hide exactly the defects this is looking for.
function generate(seed) {
  state = (seed * 2654435761) % 0x7fffffff;
  const lines = [];
  const model = new Map();
  for (let index = 0; index < int(2, 4); index += 1) {
    const values = [];
    for (let element = 0; element < int(0, 5); element += 1) values.push(int(-9, 99));
    lines.push(`  let a${index}: number[] = [${values.join(", ")}];`);
    model.set(`a${index}`, values);
  }
  const names = () => [...model.keys()];
  for (let index = 0; index < int(0, 5); index += 1) {
    const name = pick(names());
    const values = model.get(name);
    switch (int(0, 4)) {
      case 0: { const one = int(-9, 99); lines.push(`  ${name}.push(${one});`); values.push(one); break; }
      case 1: {
        const one = int(-9, 99);
        const two = int(-9, 99);
        lines.push(`  ${name}.push(${one}, ${two});`);
        values.push(one, two);
        break;
      }
      case 2: if (values.length) { lines.push(`  ${name}.pop();`); values.pop(); } break;
      case 3: if (values.length) { lines.push(`  ${name}.shift();`); values.shift(); } break;
      case 4: {
        const from = int(-3, 4);
        lines.push(`  let s${index}: number[] = ${name}.slice(${from});`);
        model.set(`s${index}`, values.slice(from));
        break;
      }
    }
  }
  const terms = [];
  const wanted = int(10, 24);
  // A term the model cannot supply a defined value for is skipped rather than repaired, and the
  // attempt bound keeps a program whose arrays have all been emptied from looping.
  for (let attempt = 0; terms.length < wanted && attempt < wanted * 12; attempt += 1) {
    const name = pick(names());
    const values = model.get(name);
    let term = null;
    switch (int(0, 6)) {
      case 0: term = `${name}.length`; break;
      case 1: if (values.length) term = `${name}[${int(0, values.length - 1)}]`; break;
      case 2: { const one = int(-9, 99); term = `${name}.push(${one})`; values.push(one); break; }
      case 3: if (values.length) { term = `${name}.pop()`; values.pop(); } break;
      case 4: if (values.length) { term = `${name}.shift()`; values.shift(); } break;
      case 5: term = `${name}.slice(${int(-3, 3)}).length`; break;
      case 6: {
        const from = int(-3, 2);
        const to = int(0, 4);
        const sliced = values.slice(from, to);
        if (sliced.length) term = `${name}.slice(${from}, ${to})[${int(0, sliced.length - 1)}]`;
        break;
      }
    }
    if (term === null) continue;
    terms.push(rnd() < 0.6 ? `${term} * ${pick(primes)}` : term);
  }
  const prelude = lines.join("\n");
  return {
    source: `export function main(): number {\n${prelude}\n  return (${terms.join(" + ")}) | 0;\n}\n`,
    // The same prelude answering each term on its own. Running this first is what rejects a program
    // containing an `undefined` term before it is ever compiled.
    probe: `export function main(): any {\n${prelude}\n  return [${terms.join(", ")}];\n}\n`,
  };
}

const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root,
  encoding: options.binary ? null : "utf8",
  maxBuffer: 64 * 1024 * 1024,
  stdio: ["ignore", "pipe", "ignore"],
});
const evaluate = text => {
  const transpiled = ts.transpileModule(text, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const module_ = {exports: {}};
  new Function("exports", "module", transpiled)(module_.exports, module_);
  return module_.exports.main();
};

const modes = [{schedule: 0, registers: 10}, {schedule: 17041, registers: 10}, {schedule: 17042, registers: 3}];
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aot-native-fuzz-"));
let checked = 0;
let rejected = 0;
let failed = 0;
try {
  for (let seed = startSeed; seed < startSeed + count; seed += 1) {
    const {source, probe} = generate(seed);
    let expected;
    try {
      const values = evaluate(probe);
      if (values.some(value => typeof value !== "number" || !Number.isFinite(value))) { rejected += 1; continue; }
      expected = evaluate(source);
    } catch { rejected += 1; continue; }
    if (!Number.isSafeInteger(expected)) { rejected += 1; continue; }
    const sourcePath = path.join(directory, `f${seed}.ts`);
    const coilPath = path.join(directory, `f${seed}.coil`);
    const emitterPath = path.join(directory, `f${seed}-emitter`);
    fs.writeFileSync(sourcePath, source);
    try {
      run(process.execPath, [path.join(root, "tools", "generate-typescript-aot-benchmark.mjs"),
        sourcePath, coilPath, "0", "10", optimize ? "1" : "0"]);
      run("coil", ["build", coilPath, "-o", emitterPath]);
    } catch {
      console.log(`seed=${seed} BUILD-ERROR\n${source}`);
      failed += 1;
      continue;
    }
    let clean = true;
    for (const mode of modes) {
      const objectPath = path.join(directory, `f${seed}.o`);
      const binaryPath = path.join(directory, `f${seed}-bin`);
      let emitted;
      try {
        emitted = run(emitterPath, [String(mode.schedule), String(mode.registers)], {binary: true});
      } catch {
        console.log(`seed=${seed} EMIT-FAIL schedule=${mode.schedule} registers=${mode.registers}\n${source}`);
        clean = false;
        break;
      }
      fs.writeFileSync(objectPath, emitted);
      run("xcrun", ["clang", "-arch", "arm64", "-O1", "-fno-omit-frame-pointer",
        path.join(root, "tools", "native-gc-runtime.c"),
        path.join(root, "tools", "native-gc-trampoline.S"),
        path.join(root, "tools", "native-conformance-harness.c"), objectPath, "-o", binaryPath]);
      // Four runs of the one binary, the last under GC stress. Three of them are there to catch an
      // answer that is not a function of the program, which one run cannot distinguish from a
      // wrong constant.
      const answers = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        let output;
        try { output = run(binaryPath, ["0", attempt === 3 ? "1" : "0", "0", "0"]).trim(); }
        catch (error) { output = `signal ${error.signal ?? error.status}`; }
        const match = /^result=(-?\d+) /.exec(output);
        answers.push(match ? Number(match[1]) : output);
      }
      if (answers.some(answer => answer !== expected)) {
        const unstable = new Set(answers).size > 1 ? " UNSTABLE" : "";
        console.log(`seed=${seed} MISMATCH${unstable} schedule=${mode.schedule} registers=${mode.registers}`
          + ` node=${expected} native=${answers.join(",")}\n${source}`);
        clean = false;
      }
    }
    checked += 1;
    if (!clean) failed += 1;
  }
  console.log(`${checked} programs compiled and checked, ${rejected} rejected, ${failed} FAILED`);
} finally {
  if (keep) console.error(`kept fuzz artifacts: ${directory}`);
  else fs.rmSync(directory, {recursive: true, force: true});
}
process.exit(failed === 0 ? 0 : 1);
