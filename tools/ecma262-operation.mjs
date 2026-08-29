#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateOperationManifest } from "./ecma262-test262.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function operationRecord(name, provenance, coverage, ledger) {
  const claim = provenance.claims.find(item => item.declaration === name);
  const candidate = provenance.candidates.find(item => item.declaration === name);
  const declaration = provenance.declarations?.find(item => item.name === name);
  if (!declaration) throw new Error(`no JSL declaration ${name}`);
  const matches = claim ? [{ clauseId: claim.clauseId, specName: claim.specName, reasons: ["checked-claim"] }]
    : candidate?.matches ?? [];
  return {
    declaration: name,
    source: declaration.file,
    classification: claim ? coverage.items.find(item => item.identity === `clause:${claim.clauseId}`) : null,
    matches: (matches ?? []).map(match => {
      const clause = ledger.clauses.find(item => item.id === match.clauseId);
      return { ...match, title: clause?.title, operationDependencies: clause?.operationDependencies ?? [] };
    }),
  };
}

function main() {
  const name = process.argv[2];
  if (!name || process.argv.length !== 3) throw new Error("usage: npm run spec:operation -- DECLARATION");
  const provenance = JSON.parse(readFileSync(join(projectRoot, "spec/generated/jsl-provenance.json"), "utf8"));
  const coverage = JSON.parse(readFileSync(join(projectRoot, "spec/generated/ecma262-coverage.json"), "utf8"));
  const ledger = JSON.parse(readFileSync(join(projectRoot, "spec/generated/ecma262-raw-ledger.json"), "utf8"));
  const operations = validateOperationManifest(JSON.parse(
    readFileSync(join(projectRoot, "spec/ecma262-operations.json"), "utf8"),
  ));
  const record = operationRecord(name, provenance, coverage, ledger);
  execFileSync("npm", ["run", "spec:provenance:check", "--silent"], { cwd: projectRoot, stdio: "inherit" });
  execFileSync("npm", ["run", "spec:coverage:check", "--silent"], { cwd: projectRoot, stdio: "inherit" });
  execFileSync("coil", ["run", "tools/jsl-operation-check.coil", "--quiet", "--", name],
    { cwd: projectRoot, stdio: "inherit" });
  const focused = operations.operations[name]?.focusedNativeDifferential;
  if (focused) {
    execFileSync("coil", ["run", "tools/js-probe.coil", "--quiet", "--", focused, "7"],
      { cwd: projectRoot, stdio: "inherit" });
    record.focusedNativeDifferential = { path: focused, status: "agrees-with-node" };
  }
  if (operations.operations[name]?.test262) record.test262 = operations.operations[name].test262;
  process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`ecma262-operation: ${error.message}\n`);
    process.exitCode = 1;
  }
}
