#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const statuses = new Set(["passed", "failed", "refused", "skipped"]);

export function canonicalTestPath(path) {
  if (typeof path !== "string" || path.length === 0) throw new Error("result path must be a non-empty string");
  const normalized = path.replaceAll("\\", "/");
  const marker = normalized.lastIndexOf("/test/");
  if (marker >= 0) return normalized.slice(marker + 1);
  return normalized.replace(/^\.\//, "");
}

export function variantKey(row) {
  if (typeof row.variant !== "string" || row.variant.length === 0)
    throw new Error(`result for ${row.path ?? "(unknown path)"} has no variant`);
  return JSON.stringify([canonicalTestPath(row.path), row.variant]);
}

export function indexResults(rows, label = "results") {
  const indexed = new Map();
  for (const row of rows) {
    if (!statuses.has(row.status)) throw new Error(`${label}: unknown status ${JSON.stringify(row.status)}`);
    const key = variantKey(row);
    if (indexed.has(key)) throw new Error(`${label}: duplicate expanded variant ${key}`);
    indexed.set(key, { ...row, canonicalPath: canonicalTestPath(row.path) });
  }
  return indexed;
}

export function compareResults(beforeRows, afterRows) {
  const before = indexResults(beforeRows, "before");
  const after = indexResults(afterRows, "after");
  const transitions = {};
  const regressions = [];
  const improvements = [];
  const removed = [];
  const added = [];
  for (const [key, oldRow] of before) {
    const newRow = after.get(key);
    if (!newRow) { removed.push({ path: oldRow.canonicalPath, variant: oldRow.variant, status: oldRow.status }); continue; }
    const transition = `${oldRow.status}->${newRow.status}`;
    transitions[transition] = (transitions[transition] ?? 0) + 1;
    const item = { path: oldRow.canonicalPath, variant: oldRow.variant, before: oldRow.status, after: newRow.status };
    if (oldRow.status === "passed" && newRow.status !== "passed") regressions.push(item);
    if (oldRow.status !== "passed" && newRow.status === "passed") improvements.push(item);
  }
  for (const [key, row] of after) {
    if (!before.has(key)) added.push({ path: row.canonicalPath, variant: row.variant, status: row.status });
  }
  const byIdentity = (a, b) => a.path.localeCompare(b.path) || a.variant.localeCompare(b.variant);
  regressions.sort(byIdentity); improvements.sort(byIdentity); removed.sort(byIdentity); added.sort(byIdentity);
  return {
    schemaVersion: 1,
    beforeVariants: before.size,
    afterVariants: after.size,
    sharedVariants: before.size - removed.length,
    sameCohort: added.length === 0 && removed.length === 0,
    transitions: Object.fromEntries(Object.entries(transitions).sort()),
    passToNonpass: regressions,
    newlyPassing: improvements,
    addedVariants: added,
    removedVariants: removed,
  };
}

export function readJsonl(path) {
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`${path}:${index + 1}: ${error.message}`); }
  });
}

function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2) throw new Error("usage: node tools/compare-test262-results.mjs BEFORE.jsonl AFTER.jsonl");
  const report = compareResults(readJsonl(argv[0]), readJsonl(argv[1]));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.sameCohort || report.passToNonpass.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) {
    process.stderr.write(`compare-test262-results: ${error.message}\n`);
    process.exitCode = 1;
  }
}
