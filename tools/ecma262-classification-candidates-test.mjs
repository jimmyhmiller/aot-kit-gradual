import assert from "node:assert/strict";
import test from "node:test";
import { buildCandidates } from "./ecma262-classification-candidates.mjs";

const commit = "a".repeat(40);
const clause = (id, title, clauseType, aoid, algorithmCount = 1) => ({ id, title, clauseType, aoid,
  normative: true, parentId: null, ancestorIds: [], topLevelId: id,
  algorithmCount, grammarCount: 0, proseCount: 0, operationDependencies: [], source: { file: "spec.html", line: 1 } });

test("creates a factual review queue without converting suggestions into claims", () => {
  const ledger = { generatedFrom: { ecma262Commit: commit }, clauses: [
    clause("sec-static", "Static Semantics: BoundNames", "abstract operation", "BoundNames"),
    clause("sec-eval", "EvaluateCall", "abstract operation", "EvaluateCall"),
    clause("sec-value", "ToValue", "abstract operation", "ToValue"),
    clause("sec-prose", "A prose invariant", "", null, 0),
  ] };
  const coverage = { schemaVersion: 1, generatedFrom: { ecma262Commit: commit }, items:
    ledger.clauses.map(item => ({ identity: `clause:${item.id}`, status: "unclassified" })) };
  const report = buildCandidates(ledger, coverage);
  assert.equal(report.candidates.length, 4);
  assert.deepEqual(report.candidates.map(item => item.suggestion.disposition),
    ["composite", null, "frontend", "jsl"]);
  assert.equal(report.candidates.every(item => !("status" in item)), true);
});

test("rejects mixed revisions", () => {
  assert.throws(() => buildCandidates({ generatedFrom: { ecma262Commit: commit }, clauses: [] },
    { generatedFrom: { ecma262Commit: "b".repeat(40) }, items: [] }), /do not share/);
});
