import assert from "node:assert/strict";
import test from "node:test";
import { buildCoverage } from "./ecma262-coverage.mjs";

const commit = "1".repeat(40);
const ledger = {
  schemaVersion: 1, generatedFrom: { ecma262Commit: commit },
  clauses: [
    { id: "sec-a", normative: true, aoid: "A", title: "A", builtIn: null, operationDependencies: ["B"] },
    { id: "sec-b", normative: true, aoid: "B", title: "B", builtIn: null, operationDependencies: [] },
    { id: "sec-note", normative: false, title: "Note", operationDependencies: [] },
  ],
  productions: [{ name: "Thing", normative: true }],
};
const provenance = { schemaVersion: 2, generatedFrom: { ecma262Commit: commit }, claims: [{
  clauseId: "sec-a", declaration: "A", file: "lib/a.jsl", status: "complete",
}], specializations: [{ clauseId: "sec-b", declaration: "BForMachineIndex", file: "lib/b.jsl",
  specName: "B", deviation: "Machine-index result only." }] };
const empty = { schemaVersion: 1, ecma262Commit: commit, items: [] };
const operations = { schemaVersion: 2, operations: {
  A: { focusedNativeDifferential: "tests/spec-operations/a.js" },
} };

test("merges generated JSL evidence with reviewed classifications and dependency edges", () => {
  const classifications = structuredClone(empty);
  classifications.items.push({ kind: "production", id: "Thing", disposition: "frontend",
    status: "complete", evidence: ["tests/parser-test.coil:thing"] });
  const report = buildCoverage({ ledger, provenance, classifications, operations });
  assert.equal(report.summary.normativeItems, 3);
  assert.equal(report.summary.classifiedItems, 2);
  assert.equal(report.summary.unclassifiedItems, 1);
  assert.equal(report.summary.specializedJslHelpers, 1);
  assert.deepEqual(report.jslSpecializations, provenance.specializations);
  assert.deepEqual(report.summary.byDisposition, { frontend: 1, jsl: 1, unclassified: 1 });
  assert.deepEqual(report.items.find(item => item.id === "sec-a").evidence,
    ["lib/a.jsl:A", "tests/spec-operations/a.js"]);
  assert.deepEqual(report.dependencyEdges, [{ from: "clause:sec-a", to: "clause:sec-b", operation: "B" }]);
  assert.deepEqual(report.unlockScores[0],
    { identity: "clause:sec-b", dependentItems: 1, publicAlgorithms: 0 });
});

test("rejects unsupported identities, duplicate claims, and evidence-free or dishonest states", () => {
  const duplicate = structuredClone(empty);
  duplicate.items.push({ kind: "clause", id: "sec-a", disposition: "runtime", status: "complete", evidence: ["x"] });
  assert.throws(() => buildCoverage({ ledger, provenance, classifications: duplicate, operations }), /duplicates/);
  for (const item of [
    { kind: "clause", id: "missing", disposition: "runtime", status: "complete", evidence: ["x"] },
    { kind: "clause", id: "sec-b", disposition: "runtime", status: "complete", evidence: [] },
    { kind: "clause", id: "sec-b", disposition: "runtime", status: "blocked", evidence: ["x"] },
    { kind: "clause", id: "sec-b", disposition: "runtime", status: "partial", evidence: ["x"] },
  ]) {
    const classifications = structuredClone(empty);
    classifications.items.push(item);
    assert.throws(() => buildCoverage({ ledger, provenance, classifications, operations }));
  }
  const unresolved = structuredClone(empty);
  unresolved.items.push({ kind: "clause", id: "sec-b", disposition: "host", status: "blocked",
    evidence: ["host-test"], prerequisites: ["capability:missing"] });
  assert.throws(() => buildCoverage({ ledger, provenance, classifications: unresolved, operations }),
    /unresolved prerequisite/);
});

test("a complete JSL claim cannot exist without a focused native differential witness", () => {
  assert.throws(() => buildCoverage({ ledger, provenance, classifications: empty }), /no focused/);
});

test("classification rules expand explicit ownership without allowing overlaps", () => {
  const classifications = { ...structuredClone(empty), rules: [{
    id: "all-productions", selector: { kind: "production" }, disposition: "frontend",
    status: "blocked", evidence: ["parser-test"], prerequisites: ["capability:grammar-map"],
  }] };
  const capabilities = { schemaVersion: 1, capabilities: [{ id: "capability:grammar-map",
    owner: "frontend", status: "missing", evidence: ["parser-test"], description: "Map grammar." }] };
  const report = buildCoverage({ ledger, provenance, classifications, operations, capabilities });
  assert.equal(report.items.find(item => item.id === "Thing").disposition, "frontend");
  classifications.items.push({ kind: "production", id: "Thing", disposition: "frontend",
    status: "complete", evidence: ["other"] });
  assert.throws(() => buildCoverage({ ledger, provenance, classifications, operations, capabilities }),
    /duplicates classification/);
});
