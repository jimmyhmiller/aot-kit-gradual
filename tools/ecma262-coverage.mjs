#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readJsonl } from "./compare-test262-results.mjs";
import { validateOperationManifest, verifyEvidence } from "./ecma262-test262.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = join(projectRoot, "spec", "generated", "ecma262-raw-ledger.json");
const provenancePath = join(projectRoot, "spec", "generated", "jsl-provenance.json");
const classificationsPath = join(projectRoot, "spec", "ecma262-classifications.json");
const outputPath = join(projectRoot, "spec", "generated", "ecma262-coverage.json");
const owners = new Set(["jsl", "frontend", "runtime", "host", "composite", "unsupported"]);
const statuses = new Set(["complete", "partial", "unsupported", "blocked"]);

function countBy(items, select) {
  const counts = {};
  for (const item of items) {
    const key = select(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

export function buildCoverage({ ledger, provenance, classifications,
  operations = { schemaVersion: 2, operations: {} }, test262Evidence = [],
  capabilities = { schemaVersion: 1, capabilities: [] } }) {
  validateOperationManifest(operations);
  if (provenance.schemaVersion !== 2 || !Array.isArray(provenance.specializations))
    throw new Error("unsupported JSL provenance schema");
  if (classifications.schemaVersion !== 1) throw new Error("unsupported classification schema");
  if (capabilities.schemaVersion !== 1 || !Array.isArray(capabilities.capabilities))
    throw new Error("unsupported capability schema");
  if (classifications.ecma262Commit !== ledger.generatedFrom.ecma262Commit ||
      provenance.generatedFrom.ecma262Commit !== ledger.generatedFrom.ecma262Commit) {
    throw new Error("classification inputs do not share the pinned ECMA-262 commit");
  }
  const normativeClauses = ledger.clauses.filter(item => item.normative);
  const normativeProductions = ledger.productions.filter(item => item.normative);
  const raw = new Map([
    ...normativeClauses.map(item => [`clause:${item.id}`, { kind: "clause", id: item.id, item }]),
    ...normativeProductions.map(item => [`production:${item.name}`, { kind: "production", id: item.name, item }]),
  ]);
  const resolved = new Map();
  const test262ByOperation = new Map(test262Evidence.map(item => [item.operation, item]));
  const capabilityById = new Map();
  for (const capability of capabilities.capabilities) {
    if (capabilityById.has(capability.id)) throw new Error(`duplicate capability ${capability.id}`);
    if (typeof capability.id !== "string" || !capability.id.startsWith("capability:"))
      throw new Error(`invalid capability id ${JSON.stringify(capability.id)}`);
    if (!owners.has(capability.owner) || capability.owner === "unsupported")
      throw new Error(`${capability.id} has invalid owner ${capability.owner}`);
    if (!["missing", "partial", "complete"].includes(capability.status))
      throw new Error(`${capability.id} has invalid status ${capability.status}`);
    if (!Array.isArray(capability.evidence) || capability.evidence.length === 0 || !capability.description)
      throw new Error(`${capability.id} requires evidence and a description`);
    capabilityById.set(capability.id, capability);
  }
  function add(identity, classification, source) {
    if (!raw.has(identity)) throw new Error(`${source} refers to unknown normative item ${identity}`);
    if (resolved.has(identity)) throw new Error(`${source} duplicates classification for ${identity}`);
    resolved.set(identity, { ...classification, evidenceSource: source });
  }
  for (const rule of classifications.rules ?? []) {
    if (typeof rule.id !== "string" || rule.id.length === 0) throw new Error("classification rule requires an id");
    const selectorKeys = Object.keys(rule.selector ?? {});
    if (!selectorKeys.includes("kind") || selectorKeys.some(key => !["kind", "clauseTypes", "excludeIds", "includeIds", "titlePrefixes", "excludeTitlePrefixes", "parentIds", "topLevelIds", "excludeTopLevelIds", "minGrammarCount", "maxGrammarCount", "maxAlgorithmCount", "minProseCount", "emptyDirectContent", "remaining"].includes(key)) ||
        !["clause", "production"].includes(rule.selector.kind) ||
        (rule.selector.clauseTypes !== undefined &&
          (!Array.isArray(rule.selector.clauseTypes) || rule.selector.clauseTypes.some(x => typeof x !== "string"))) ||
        (rule.selector.excludeIds !== undefined &&
          (!Array.isArray(rule.selector.excludeIds) || rule.selector.excludeIds.some(x => typeof x !== "string"))) ||
        (rule.selector.includeIds !== undefined &&
          (!Array.isArray(rule.selector.includeIds) || rule.selector.includeIds.length === 0 ||
           rule.selector.includeIds.some(x => typeof x !== "string"))) ||
        (rule.selector.titlePrefixes !== undefined &&
          (!Array.isArray(rule.selector.titlePrefixes) || rule.selector.titlePrefixes.some(x => typeof x !== "string"))) ||
        (rule.selector.excludeTitlePrefixes !== undefined &&
          (!Array.isArray(rule.selector.excludeTitlePrefixes) ||
           rule.selector.excludeTitlePrefixes.some(x => typeof x !== "string"))) ||
        (rule.selector.parentIds !== undefined &&
          (!Array.isArray(rule.selector.parentIds) || rule.selector.parentIds.length === 0 ||
           rule.selector.parentIds.some(x => typeof x !== "string"))) ||
        (rule.selector.topLevelIds !== undefined &&
          (!Array.isArray(rule.selector.topLevelIds) || rule.selector.topLevelIds.length === 0 ||
           rule.selector.topLevelIds.some(x => typeof x !== "string"))) ||
        (rule.selector.excludeTopLevelIds !== undefined &&
          (!Array.isArray(rule.selector.excludeTopLevelIds) ||
           rule.selector.excludeTopLevelIds.some(x => typeof x !== "string"))) ||
        (rule.selector.emptyDirectContent !== undefined && rule.selector.emptyDirectContent !== true) ||
        (rule.selector.remaining !== undefined && rule.selector.remaining !== true) ||
        (rule.selector.minGrammarCount !== undefined &&
          (!Number.isInteger(rule.selector.minGrammarCount) || rule.selector.minGrammarCount < 0)) ||
        (rule.selector.maxGrammarCount !== undefined &&
          (!Number.isInteger(rule.selector.maxGrammarCount) || rule.selector.maxGrammarCount < 0)) ||
        (rule.selector.maxAlgorithmCount !== undefined &&
          (!Number.isInteger(rule.selector.maxAlgorithmCount) || rule.selector.maxAlgorithmCount < 0)) ||
        (rule.selector.minProseCount !== undefined &&
          (!Number.isInteger(rule.selector.minProseCount) || rule.selector.minProseCount < 0))) {
      throw new Error(`classification rule ${rule.id} has unsupported selector`);
    }
    if (!owners.has(rule.disposition)) throw new Error(`classification rule ${rule.id} has invalid disposition`);
    if (rule.expectedMatches !== undefined &&
        (!Number.isInteger(rule.expectedMatches) || rule.expectedMatches < 1))
      throw new Error(`classification rule ${rule.id} has invalid expectedMatches`);
    if (!statuses.has(rule.status)) throw new Error(`classification rule ${rule.id} has invalid status`);
    if (!Array.isArray(rule.evidence) || rule.evidence.length === 0)
      throw new Error(`classification rule ${rule.id} requires named evidence`);
    const prerequisites = rule.prerequisites ?? [];
    if (rule.status === "blocked" && prerequisites.length === 0)
      throw new Error(`classification rule ${rule.id} is blocked without prerequisites`);
    if (rule.status !== "blocked" && prerequisites.length > 0)
      throw new Error(`classification rule ${rule.id} has prerequisites but is not blocked`);
    for (const prerequisite of prerequisites) {
      if (!raw.has(prerequisite) && !capabilityById.has(prerequisite))
        throw new Error(`classification rule ${rule.id} has unresolved prerequisite ${prerequisite}`);
    }
    if (rule.status === "partial" && !rule.deviation)
      throw new Error(`classification rule ${rule.id} is partial without a deviation`);
    if (rule.status === "complete" && rule.deviation)
      throw new Error(`classification rule ${rule.id} is complete with a deviation`);
    const excluded = new Set(rule.selector.excludeIds ?? []);
    const included = rule.selector.includeIds ? new Set(rule.selector.includeIds) : null;
    for (const id of included ?? []) {
      if (!raw.has(`${rule.selector.kind}:${id}`))
        throw new Error(`classification rule ${rule.id} includes unknown normative item ${id}`);
    }
    for (const id of excluded) {
      if (!raw.has(`${rule.selector.kind}:${id}`))
        throw new Error(`classification rule ${rule.id} excludes unknown normative item ${id}`);
    }
    const matches = [...raw].filter(([identity, item]) => item.kind === rule.selector.kind &&
      (!rule.selector.remaining || !resolved.has(identity)) &&
      (!included || included.has(item.id)) &&
      (!rule.selector.clauseTypes || rule.selector.clauseTypes.includes(item.item.clauseType ?? "")) &&
      (!rule.selector.titlePrefixes || rule.selector.titlePrefixes.some(prefix => item.item.title.startsWith(prefix))) &&
      (!rule.selector.excludeTitlePrefixes ||
        !rule.selector.excludeTitlePrefixes.some(prefix => item.item.title.startsWith(prefix))) &&
      (!rule.selector.parentIds || rule.selector.parentIds.includes(item.item.parentId)) &&
      (!rule.selector.topLevelIds || rule.selector.topLevelIds.includes(item.item.topLevelId)) &&
      (!rule.selector.excludeTopLevelIds || !rule.selector.excludeTopLevelIds.includes(item.item.topLevelId)) &&
      (rule.selector.minGrammarCount === undefined || item.item.grammarCount >= rule.selector.minGrammarCount) &&
      (rule.selector.maxGrammarCount === undefined || item.item.grammarCount <= rule.selector.maxGrammarCount) &&
      (rule.selector.maxAlgorithmCount === undefined || item.item.algorithmCount <= rule.selector.maxAlgorithmCount) &&
      (rule.selector.minProseCount === undefined || item.item.proseCount >= rule.selector.minProseCount) &&
      (!rule.selector.emptyDirectContent ||
        (item.item.algorithmCount === 0 && item.item.grammarCount === 0 && item.item.proseCount === 0)) &&
      !excluded.has(item.id));
    if (matches.length === 0) throw new Error(`classification rule ${rule.id} matches no normative items`);
    if (rule.expectedMatches !== undefined && matches.length !== rule.expectedMatches)
      throw new Error(`classification rule ${rule.id} expected ${rule.expectedMatches} matches, got ${matches.length}`);
    for (const [identity] of matches) {
      add(identity, {
        disposition: rule.disposition,
        status: rule.status,
        evidence: [`classification-rule:${rule.id}`, ...(rule.evidence ?? [])],
        prerequisites,
        ...(rule.deviation ? { deviation: rule.deviation } : {}),
      }, `classification rule ${rule.id}`);
    }
  }
  for (const claim of provenance.claims) {
    const focused = operations.operations?.[claim.declaration]?.focusedNativeDifferential;
    const retained = test262ByOperation.get(claim.declaration);
    if (claim.status === "complete" && !focused) {
      throw new Error(`complete JSL claim ${claim.declaration} has no focused native differential witness`);
    }
    add(`clause:${claim.clauseId}`, {
      disposition: "jsl",
      status: claim.status,
      evidence: [`${claim.file}:${claim.declaration}`, ...(focused ? [focused] : []),
        ...(retained ? [operations.operations[claim.declaration].test262.evidence] : [])],
      prerequisites: [],
      ...(retained ? { test262: { expandedVariants: retained.expandedVariants, totals: retained.totals } } : {}),
      ...(claim.deviation ? { deviation: claim.deviation } : {}),
    }, "generated JSL provenance");
  }
  for (const entry of classifications.items) {
    const identity = `${entry.kind}:${entry.id}`;
    if (!owners.has(entry.disposition)) throw new Error(`${identity} has invalid disposition ${entry.disposition}`);
    if (!statuses.has(entry.status)) throw new Error(`${identity} has invalid status ${entry.status}`);
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0 ||
        entry.evidence.some(value => typeof value !== "string" || value.length === 0)) {
      throw new Error(`${identity} requires named evidence`);
    }
    const prerequisites = entry.prerequisites ?? [];
    if (entry.status === "blocked" && prerequisites.length === 0) {
      throw new Error(`${identity} is blocked without prerequisites`);
    }
    if (entry.status !== "blocked" && prerequisites.length > 0) {
      throw new Error(`${identity} has prerequisites but is not blocked`);
    }
    for (const prerequisite of prerequisites) {
      if (!raw.has(prerequisite) && !capabilityById.has(prerequisite))
        throw new Error(`${identity} has unresolved prerequisite ${prerequisite}`);
    }
    if (entry.status === "partial" && !entry.deviation) throw new Error(`${identity} is partial without a deviation`);
    if (entry.status === "complete" && entry.deviation) throw new Error(`${identity} is complete with a deviation`);
    if (entry.disposition === "unsupported" && entry.status !== "unsupported") {
      throw new Error(`${identity} has unsupported disposition without unsupported status`);
    }
    add(identity, { disposition: entry.disposition, status: entry.status,
      evidence: entry.evidence, prerequisites, ...(entry.deviation ? { deviation: entry.deviation } : {}) },
    "reviewed classification manifest");
  }
  const items = [...raw].map(([identity, rawItem]) => {
    const classification = resolved.get(identity);
    return {
      identity,
      kind: rawItem.kind,
      id: rawItem.id,
      name: rawItem.item.aoid ?? rawItem.item.builtIn?.name ?? rawItem.item.title ?? rawItem.id,
      disposition: classification?.disposition ?? "unclassified",
      status: classification?.status ?? "unclassified",
      evidence: classification?.evidence ?? [],
      prerequisites: classification?.prerequisites ?? [],
      ...(classification?.test262 ? { test262: classification.test262 } : {}),
      ...(classification?.deviation ? { deviation: classification.deviation } : {}),
    };
  }).sort((a, b) => a.identity.localeCompare(b.identity));
  const classified = items.filter(item => item.status !== "unclassified");
  const mappedTest262Totals = { passed: 0, failed: 0, refused: 0, skipped: 0 };
  for (const evidence of test262Evidence) {
    for (const status of Object.keys(mappedTest262Totals)) mappedTest262Totals[status] += evidence.totals[status];
  }
  const clausesByAoid = new Map();
  for (const clause of normativeClauses.filter(item => item.aoid)) {
    const matches = clausesByAoid.get(clause.aoid) ?? [];
    matches.push(clause.id);
    clausesByAoid.set(clause.aoid, matches);
  }
  const dependencyEdges = normativeClauses.flatMap(clause => clause.operationDependencies
    .flatMap(name => (clausesByAoid.get(name) ?? [])
      .map(id => ({ from: `clause:${clause.id}`, to: `clause:${id}`, operation: name }))))
    .sort((a, b) => `${a.from}:${a.to}:${a.operation}`.localeCompare(`${b.from}:${b.to}:${b.operation}`));
  const dependencies = new Map();
  const dependents = new Map();
  for (const edge of dependencyEdges) {
    if (!dependencies.has(edge.from)) dependencies.set(edge.from, new Set());
    dependencies.get(edge.from).add(edge.to);
    if (!dependents.has(edge.to)) dependents.set(edge.to, new Set());
    dependents.get(edge.to).add(edge.from);
  }
  const itemByIdentity = new Map(items.map(item => [item.identity, item]));
  const publicIdentities = new Set(normativeClauses.filter(item => item.clauseType === "built-in function")
    .map(item => `clause:${item.id}`));
  function closureStatus(identity, visiting = new Set()) {
    const own = itemByIdentity.get(identity)?.status ?? "unclassified";
    if (own !== "complete") return own;
    if (visiting.has(identity)) return "complete";
    const next = new Set(visiting);
    next.add(identity);
    const dependencyStatuses = [...(dependencies.get(identity) ?? [])].map(id => closureStatus(id, next));
    return dependencyStatuses.find(status => status !== "complete") ?? "complete";
  }
  const publicClosure = [...publicIdentities].map(identity => ({ identity, status: closureStatus(identity) }));
  const unlockScores = items.filter(item => item.kind === "clause").map(item => {
    const seen = new Set();
    const queue = [...(dependents.get(item.identity) ?? [])];
    while (queue.length) {
      const dependent = queue.shift();
      if (seen.has(dependent)) continue;
      seen.add(dependent);
      queue.push(...(dependents.get(dependent) ?? []));
    }
    return { identity: item.identity, dependentItems: seen.size,
      publicAlgorithms: [...seen].filter(identity => publicIdentities.has(identity)).length };
  }).filter(score => score.dependentItems > 0)
    .sort((a, b) => b.publicAlgorithms - a.publicAlgorithms || b.dependentItems - a.dependentItems ||
      a.identity.localeCompare(b.identity));
  return {
    schemaVersion: 1,
    generatedFrom: { ecma262Commit: ledger.generatedFrom.ecma262Commit,
      ledgerSchemaVersion: ledger.schemaVersion, provenanceSchemaVersion: provenance.schemaVersion,
      classifications: relative(projectRoot, classificationsPath) },
    summary: {
      normativeItems: items.length,
      classifiedItems: classified.length,
      unclassifiedItems: items.length - classified.length,
      byDisposition: countBy(items, item => item.disposition),
      byStatus: countBy(items, item => item.status),
      specializedJslHelpers: provenance.specializations.length,
      dependencyEdges: dependencyEdges.length,
      mappedTest262Operations: test262Evidence.length,
      mappedTest262Variants: Object.values(mappedTest262Totals).reduce((sum, count) => sum + count, 0),
      mappedTest262Totals,
      publicAlgorithms: publicClosure.length,
      publicAlgorithmsByClosureStatus: countBy(publicClosure, item => item.status),
    },
    items,
    dependencyEdges,
    unlockScores,
    jslSpecializations: provenance.specializations,
    capabilities: capabilities.capabilities,
  };
}

function main() {
  const check = process.argv.slice(2).includes("--check");
  const unknown = process.argv.slice(2).filter(argument => argument !== "--check");
  if (unknown.length) throw new Error(`unknown option ${unknown[0]}`);
  const operations = validateOperationManifest(JSON.parse(
    readFileSync(join(projectRoot, "spec", "ecma262-operations.json"), "utf8"),
  ));
  const sources = JSON.parse(readFileSync(join(projectRoot, "spec", "ecma262-sources.json"), "utf8"));
  const capabilities = JSON.parse(readFileSync(join(projectRoot, "spec", "ecma262-capabilities.json"), "utf8"));
  const test262Evidence = [];
  for (const [name, operation] of Object.entries(operations.operations)) {
    const witness = operation.focusedNativeDifferential;
    if (witness && (!witness.startsWith("tests/spec-operations/") || !existsSync(join(projectRoot, witness)))) {
      throw new Error(`${name} names missing or out-of-tree focused witness ${witness}`);
    }
    const evidencePath = operation.test262?.evidence;
    if (evidencePath) {
      const absoluteEvidence = join(projectRoot, evidencePath);
      if (!existsSync(absoluteEvidence)) throw new Error(`${name} Test262 evidence does not exist: ${evidencePath}`);
      const evidence = JSON.parse(readFileSync(absoluteEvidence, "utf8"));
      if (typeof evidence.results !== "string" || !evidence.results.startsWith("results/") ||
          evidence.results.includes("..")) {
        throw new Error(`${name}: retained Test262 results must be a project-relative results/* path`);
      }
      const resultPath = join(projectRoot, evidence.results);
      if (!existsSync(resultPath)) throw new Error(`${name}: retained Test262 JSONL does not exist: ${evidence.results}`);
      test262Evidence.push(verifyEvidence(name, operation.test262, sources.test262.commit, evidence,
        readJsonl(resultPath), readFileSync(resultPath)));
    }
  }
  const coverage = buildCoverage({
    ledger: JSON.parse(readFileSync(ledgerPath, "utf8")),
    provenance: JSON.parse(readFileSync(provenancePath, "utf8")),
    classifications: JSON.parse(readFileSync(classificationsPath, "utf8")),
    operations,
    test262Evidence,
    capabilities,
  });
  const rendered = `${JSON.stringify(coverage, null, 2)}\n`;
  if (check) {
    if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== rendered) {
      throw new Error(`generated coverage differs from ${relative(projectRoot, outputPath)}; run npm run spec:coverage`);
    }
    process.stdout.write(`checked ${outputPath}\n`);
  } else {
    writeFileSync(outputPath, rendered);
    process.stdout.write(`wrote ${outputPath}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`ecma262-coverage: ${error.message}\n`);
    process.exitCode = 1;
  }
}
