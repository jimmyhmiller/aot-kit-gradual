import assert from "node:assert/strict";
import test from "node:test";
import { buildDependencyPlan, renderDot } from "./ecma262-dependency-plan.mjs";

const coverage = {
  generatedFrom: { ecma262Commit: "1".repeat(40) },
  items: [
    { identity: "clause:a", name: "A", kind: "clause", disposition: "jsl", status: "blocked",
      prerequisites: ["capability:all-jsl"] },
    { identity: "clause:b", name: "B", kind: "clause", disposition: "jsl", status: "partial", prerequisites: [] },
    { identity: "clause:c", name: "C", kind: "clause", disposition: "jsl", status: "complete", prerequisites: [] },
  ],
  capabilities: [{ id: "capability:all-jsl", owner: "jsl", status: "missing",
    description: "Complete every JSL operation." }],
  dependencyEdges: [
    { from: "clause:a", to: "clause:b", operation: "B" },
    { from: "clause:b", to: "clause:c", operation: "C" },
  ],
};
const ledger = { clauses: [
  { id: "a", clauseType: "built-in function" },
  { id: "b", clauseType: "abstract operation" },
  { id: "c", clauseType: "abstract operation" },
] };

test("separates concrete dependencies from aggregate capability debt", () => {
  const plan = buildDependencyPlan({ coverage, ledger });
  assert.equal(plan.summary.specOperationEdges, 2);
  assert.equal(plan.summary.aggregatePrerequisiteEdges, 1);
  assert.deepEqual(plan.itemAnalysis.find(item => item.identity === "clause:a").incompleteConcretePrerequisites,
    ["clause:b"]);
  assert.deepEqual(plan.itemAnalysis.find(item => item.identity === "clause:a").incompleteAggregatePrerequisites,
    ["capability:all-jsl"]);
  assert.equal(plan.actionCandidates.find(item => item.identity === "clause:b").soleRemainingConcreteDependency, 1);
});

test("emits the complete graph with visually distinct aggregate edges", () => {
  const dot = renderDot(buildDependencyPlan({ coverage, ledger }));
  assert.match(dot, /"clause:a" -> "clause:b" \[style=solid/);
  assert.match(dot, /"clause:a" -> "capability:all-jsl" \[style=dashed/);
});

test("condenses recursive dependencies into one actionable work unit", () => {
  const recursiveCoverage = structuredClone(coverage);
  recursiveCoverage.dependencyEdges.push({ from: "clause:b", to: "clause:b", operation: "B" });
  const plan = buildDependencyPlan({ coverage: recursiveCoverage, ledger });
  const unit = plan.workUnits.find(item => item.members.includes("clause:b"));
  assert.equal(unit.concreteReady, true);
  assert.deepEqual(unit.incompleteConcretePrerequisiteUnits, []);
});
