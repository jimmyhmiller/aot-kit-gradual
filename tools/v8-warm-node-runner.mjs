#!/usr/bin/env node
import fs from "node:fs";
import vm from "node:vm";

const [sourcePath, warmupText, sampleText, iterationText] = process.argv.slice(2);
const warmups = Number(warmupText);
const samples = Number(sampleText);
const iterations = Number(iterationText);
if (!sourcePath || !Number.isInteger(warmups) || warmups < 0 ||
    !Number.isInteger(samples) || samples < 1 ||
    !Number.isInteger(iterations) || iterations < 1) process.exit(2);

const context = vm.createContext({ alert(message) { throw new Error(String(message)); } });
vm.runInContext(fs.readFileSync(sourcePath, "utf8"), context, { filename: sourcePath });
const run = vm.runInContext("main", context);
let result;
for (let i = 0; i < warmups; ++i) result = run();
for (let sample = 0; sample < samples; ++sample) {
  const before = process.hrtime.bigint();
  for (let i = 0; i < iterations; ++i) result = run();
  const elapsed = process.hrtime.bigint() - before;
  console.log(`sample=${sample} runtime_ns=${elapsed} per_iteration_ns=${Number(elapsed) / iterations} result=${result}`);
}
