import assert from "node:assert/strict";
import test from "node:test";
import { operationRecord } from "./ecma262-operation.mjs";

test("a checked claim resolves its classification and spec dependencies", () => {
  const record = operationRecord("A",
    { claims: [{ declaration: "A", clauseId: "sec-a", specName: "A" }], candidates: [],
      declarations: [{ name: "A", file: "lib/a.jsl", kind: "macro" }] },
    { items: [{ identity: "clause:sec-a", disposition: "jsl", status: "complete" }] },
    { clauses: [{ id: "sec-a", title: "A ( x )", operationDependencies: ["B"] }] });
  assert.equal(record.classification.status, "complete");
  assert.deepEqual(record.matches[0].operationDependencies, ["B"]);
});

test("an unreviewed candidate remains visibly unclassified", () => {
  const record = operationRecord("Local", { claims: [], declarations: [{ name: "Local", file: "local.jsl" }],
    candidates: [{ declaration: "Local", matches: [{
    clauseId: "sec-a", reasons: ["preceding-spec-link"],
  }] }] }, { items: [] }, { clauses: [{ id: "sec-a", title: "A", operationDependencies: [] }] });
  assert.equal(record.classification, null);
  assert.deepEqual(record.matches[0].reasons, ["preceding-spec-link"]);
});
