#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { compareResults, indexResults, readJsonl } from "./compare-test262-results.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function validateOperationManifest(manifest) {
  if (manifest.schemaVersion !== 2 || !manifest.operations || typeof manifest.operations !== "object")
    throw new Error("unsupported operation-workbench schema");
  for (const [name, operation] of Object.entries(manifest.operations)) {
    if (!operation || typeof operation !== "object") throw new Error(`${name}: operation entry must be an object`);
    if (operation.focusedNativeDifferential &&
        (!operation.focusedNativeDifferential.startsWith("tests/spec-operations/") ||
         !operation.focusedNativeDifferential.endsWith(".js")))
      throw new Error(`${name}: focusedNativeDifferential must name a tests/spec-operations/*.js file`);
    if (!operation.test262) continue;
    const keys = Object.keys(operation.test262);
    if (keys.some(key => !["paths", "features", "includes", "rationale", "evidence"].includes(key)))
      throw new Error(`${name}: unknown Test262 mapping field`);
    if (!Array.isArray(operation.test262.paths) || operation.test262.paths.length === 0)
      throw new Error(`${name}: Test262 mapping requires at least one path`);
    for (const path of operation.test262.paths) {
      if (typeof path !== "string" || !path.startsWith("test/") || path.includes("..") || path.includes("\\"))
        throw new Error(`${name}: invalid Test262 path ${JSON.stringify(path)}`);
    }
    for (const field of ["features", "includes"]) {
      if (operation.test262[field] !== undefined &&
          (!Array.isArray(operation.test262[field]) || operation.test262[field].some(x => typeof x !== "string")))
        throw new Error(`${name}: Test262 ${field} must be an array of strings`);
    }
    if (typeof operation.test262.rationale !== "string" || operation.test262.rationale.length === 0)
      throw new Error(`${name}: Test262 mapping requires a rationale`);
    if (operation.test262.evidence !== undefined &&
        (!operation.test262.evidence.startsWith("spec/evidence/") ||
         !operation.test262.evidence.endsWith(".json") || operation.test262.evidence.includes("..")))
      throw new Error(`${name}: Test262 evidence must name a spec/evidence/*.json file`);
  }
  return manifest;
}

export function mappedPaths(name, manifest, test262Root) {
  const operation = manifest.operations[name];
  if (!operation) throw new Error(`no operation manifest entry ${name}`);
  if (!operation.test262) throw new Error(`${name} has no mapped Test262 cohort`);
  return operation.test262.paths.map(path => {
    const absolute = resolve(test262Root, path);
    const rootPrefix = resolve(test262Root) + sep;
    if (!absolute.startsWith(rootPrefix) || !existsSync(absolute))
      throw new Error(`${name}: mapped Test262 path does not exist at pinned revision: ${path}`);
    return absolute;
  });
}

export function verifyPinnedCheckout(test262Root, expectedCommit, run = spawnSync) {
  const result = run("git", ["-C", test262Root, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${test262Root} is not a Git Test262 checkout`);
  const actual = result.stdout.trim();
  if (actual !== expectedCommit)
    throw new Error(`Test262 checkout is ${actual}; expected pinned ${expectedCommit}`);
  return actual;
}

export function buildEvidence(name, mapping, test262Commit, resultsPath, rows, bytes) {
  const indexed = indexResults(rows, `${name} retained Test262 evidence`);
  const totals = { passed: 0, failed: 0, refused: 0, skipped: 0 };
  const prefixes = mapping.paths.map(path => path.endsWith("/") ? path : `${path}/`);
  for (const row of indexed.values()) {
    const covered = mapping.paths.includes(row.canonicalPath) || prefixes.some(path => row.canonicalPath.startsWith(path));
    if (!covered) throw new Error(`${name}: retained result is outside its mapped cohort: ${row.canonicalPath}`);
    totals[row.status]++;
  }
  return {
    schemaVersion: 1,
    operation: name,
    test262Commit,
    mapping: { paths: mapping.paths, features: mapping.features ?? [], includes: mapping.includes ?? [] },
    results: resultsPath.replaceAll("\\", "/"),
    resultsSha256: createHash("sha256").update(bytes).digest("hex"),
    expandedVariants: indexed.size,
    totals,
  };
}

export function verifyEvidence(name, mapping, test262Commit, evidence, rows, bytes) {
  if (!evidence || evidence.schemaVersion !== 1) throw new Error(`${name}: unsupported Test262 evidence schema`);
  const expected = buildEvidence(name, mapping, test262Commit, evidence.results, rows, bytes);
  if (JSON.stringify(evidence) !== JSON.stringify(expected))
    throw new Error(`${name}: retained Test262 evidence is stale or inconsistent with its JSONL`);
  return evidence;
}

function option(argv, name, fallback = "") {
  const equals = argv.find(arg => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const at = argv.indexOf(name);
  return at >= 0 && at + 1 < argv.length ? argv[at + 1] : fallback;
}

function main() {
  const argv = process.argv.slice(2);
  const name = argv[0];
  if (!name) throw new Error("usage: node tools/ecma262-test262.mjs NAME [--test262 ROOT] [--results FILE] [--compare BEFORE.jsonl] [--no-build] [--quick]");
  const root = resolve(option(argv, "--test262", process.env.TEST262_ROOT || ".spec-cache/test262"));
  const results = option(argv, "--results");
  const before = option(argv, "--compare");
  const quick = argv.includes("--quick");
  if (before && !results) throw new Error("--compare requires --results so exact after variants are retained");
  if (quick && results) throw new Error("--quick cannot be combined with --results");
  const sources = JSON.parse(readFileSync(join(projectRoot, "spec/ecma262-sources.json"), "utf8"));
  const manifest = validateOperationManifest(JSON.parse(
    readFileSync(join(projectRoot, "spec/ecma262-operations.json"), "utf8"),
  ));
  verifyPinnedCheckout(root, sources.test262.commit);
  const paths = mappedPaths(name, manifest, root);
  const runnerArgs = [join(projectRoot, "tools/run-test262.mjs"), "--test262", root];
  for (const flag of ["--no-build", "--quick", "--quiet", "--profile"]) if (argv.includes(flag)) runnerArgs.push(flag);
  for (const valued of ["--jobs", "--timeout-ms", "--memory-mb", "--batch-size"]) {
    const value = option(argv, valued); if (value) runnerArgs.push(valued, value);
  }
  if (results) runnerArgs.push("--results", resolve(results));
  runnerArgs.push(...paths);
  const run = spawnSync(process.execPath, runnerArgs, { cwd: projectRoot, stdio: "inherit" });
  const mapping = manifest.operations[name].test262;
  if (results && existsSync(resolve(results)) && mapping.evidence) {
    const bytes = readFileSync(resolve(results));
    const evidence = buildEvidence(name, mapping, sources.test262.commit,
      resolve(results).startsWith(projectRoot + sep) ? resolve(results).slice(projectRoot.length + 1) : resolve(results),
      readJsonl(resolve(results)), bytes);
    writeFileSync(join(projectRoot, mapping.evidence), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  let comparisonFailed = false;
  if (before) {
    const report = compareResults(readJsonl(resolve(before)), readJsonl(resolve(results)));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    comparisonFailed = !report.sameCohort || report.passToNonpass.length > 0;
  }
  if ((run.status ?? 1) !== 0 || comparisonFailed) process.exitCode = run.status || 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`ecma262-test262: ${error.message}\n`);
    process.exitCode = 1;
  }
}
