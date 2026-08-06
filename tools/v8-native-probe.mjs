#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const corpus = process.env.AOT_V8_CORPUS ? path.resolve(process.env.AOT_V8_CORPUS) : path.join(root, "benchmarks/v8-v7");
const manifest = JSON.parse(fs.readFileSync(path.join(corpus, "manifest.json"), "utf8"));
const probe = execFileSync(path.join(root, "tools/build-v8-native-probe.sh"), { encoding:"utf8" }).trim();
const results = manifest.benchmarks.map(entry => {
  const parsed = JSON.parse(execFileSync(probe, [path.join(corpus, entry.file)], { encoding:"utf8", maxBuffer:16 * 1024 * 1024 }));
  parsed.file = entry.file;
  parsed.benchmark = entry.name;
  return parsed;
});
const output = {
  schemaVersion: 1,
  parser: "microsoft/typescript-go",
  parserCommit: fs.readFileSync(path.join(root, "native/typescript-go-bridge/UPSTREAM_COMMIT"), "utf8").trim(),
  scriptKind: "JS",
  results,
  status: results.every(result => result.firstUnsupported !== null) ? "measured-gap" : "invalid",
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.status !== "measured-gap") process.exitCode = 1;
