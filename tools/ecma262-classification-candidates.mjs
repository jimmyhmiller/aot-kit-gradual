#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(projectRoot, "spec/generated/ecma262-classification-candidates.json");

function suggestion(clause) {
  if (clause.clauseType === "abstract operation") {
    if (clause.title.startsWith("Static Semantics:"))
      return { disposition: "frontend", confidence: "high", reason: "abstract-operation-static-semantics" };
    if (/^(Evaluate|ForBodyEvaluation|.*DeclarationInstantiation$|InnerModule|ExecuteAsyncModule$|AsyncModuleExecution)/.test(clause.aoid ?? ""))
      return { disposition: "composite", confidence: "medium", reason: "evaluation-or-instantiation-structure" };
    return { disposition: "jsl", confidence: "medium", reason: "abstract-operation-semantic-default" };
  }
  if ((clause.algorithmCount ?? 0) > 0)
    return { disposition: null, confidence: "low", reason: "untyped-normative-algorithm-requires-review" };
  return { disposition: null, confidence: "low", reason: "normative-prose-or-publication-requires-review" };
}

export function buildCandidates(ledger, coverage) {
  if (ledger.generatedFrom.ecma262Commit !== coverage.generatedFrom.ecma262Commit)
    throw new Error("candidate inputs do not share the pinned ECMA-262 commit");
  const unclassified = new Set(coverage.items.filter(item => item.status === "unclassified")
    .map(item => item.identity));
  const candidates = ledger.clauses.filter(clause => unclassified.has(`clause:${clause.id}`)).map(clause => ({
    identity: `clause:${clause.id}`,
    id: clause.id,
    title: clause.title,
    parentId: clause.parentId,
    ancestorIds: clause.ancestorIds,
    topLevelId: clause.topLevelId,
    clauseType: clause.clauseType || null,
    aoid: clause.aoid,
    algorithmCount: clause.algorithmCount,
    grammarCount: clause.grammarCount,
    proseCount: clause.proseCount,
    operationDependencies: clause.operationDependencies,
    source: clause.source,
    suggestion: suggestion(clause),
  })).sort((a, b) => a.identity.localeCompare(b.identity));
  const counts = {};
  const topLevelCounts = {};
  for (const candidate of candidates) {
    const key = `${candidate.suggestion.confidence}:${candidate.suggestion.disposition ?? "manual"}:${candidate.suggestion.reason}`;
    counts[key] = (counts[key] ?? 0) + 1;
    topLevelCounts[candidate.topLevelId] = (topLevelCounts[candidate.topLevelId] ?? 0) + 1;
  }
  return {
    schemaVersion: 1,
    generatedFrom: { ecma262Commit: ledger.generatedFrom.ecma262Commit,
      coverageSchemaVersion: coverage.schemaVersion },
    summary: { candidates: candidates.length, groups: Object.fromEntries(Object.entries(counts).sort()),
      byTopLevelClause: Object.fromEntries(Object.entries(topLevelCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) },
    candidates,
  };
}

function main() {
  const check = process.argv.slice(2).includes("--check");
  const unknown = process.argv.slice(2).filter(arg => arg !== "--check");
  if (unknown.length) throw new Error(`unknown option ${unknown[0]}`);
  const report = buildCandidates(
    JSON.parse(readFileSync(join(projectRoot, "spec/generated/ecma262-raw-ledger.json"), "utf8")),
    JSON.parse(readFileSync(join(projectRoot, "spec/generated/ecma262-coverage.json"), "utf8")),
  );
  const rendered = `${JSON.stringify(report, null, 2)}\n`;
  if (check) {
    if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== rendered)
      throw new Error(`classification candidates differ from ${relative(projectRoot, outputPath)}; run npm run spec:classification-candidates`);
    process.stdout.write(`checked ${outputPath}\n`);
  } else {
    writeFileSync(outputPath, rendered);
    process.stdout.write(`wrote ${outputPath}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`ecma262-classification-candidates: ${error.message}\n`);
    process.exitCode = 1;
  }
}
