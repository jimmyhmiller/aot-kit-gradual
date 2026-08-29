#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coveragePath = join(projectRoot, "spec", "generated", "ecma262-coverage.json");
const ledgerPath = join(projectRoot, "spec", "generated", "ecma262-raw-ledger.json");
const outputPath = join(projectRoot, "spec", "generated", "ecma262-dependency-plan.json");
const dotPath = join(projectRoot, "spec", "generated", "ecma262-dependency-graph.dot");
const documentationPath = join(projectRoot, "docs", "ECMA262-DEPENDENCY-GRAPH.md");

function countBy(values, select) {
  const result = {};
  for (const value of values) {
    const key = select(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort((a, b) => a[0].localeCompare(b[0])));
}

function escapeDot(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
}

function stronglyConnectedComponents(ids, outgoing) {
  let nextIndex = 0;
  const indexes = new Map();
  const lowlinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  function visit(id) {
    indexes.set(id, nextIndex);
    lowlinks.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);
    for (const target of outgoing.get(id) ?? []) {
      if (!indexes.has(target)) {
        visit(target);
        lowlinks.set(id, Math.min(lowlinks.get(id), lowlinks.get(target)));
      } else if (onStack.has(target)) {
        lowlinks.set(id, Math.min(lowlinks.get(id), indexes.get(target)));
      }
    }
    if (lowlinks.get(id) !== indexes.get(id)) return;
    const members = [];
    while (stack.length) {
      const member = stack.pop();
      onStack.delete(member);
      members.push(member);
      if (member === id) break;
    }
    components.push(members.sort());
  }
  for (const id of ids) if (!indexes.has(id)) visit(id);
  return components;
}

export function buildDependencyPlan({ coverage, ledger }) {
  const itemById = new Map(coverage.items.map(item => [item.identity, item]));
  const capabilityById = new Map(coverage.capabilities.map(item => [item.id, item]));
  const rawClauseByIdentity = new Map(ledger.clauses.map(clause => [`clause:${clause.id}`, clause]));
  const nodes = [
    ...coverage.items.map(item => ({ id: item.identity, type: "normative-item", name: item.name,
      kind: item.kind, disposition: item.disposition, status: item.status })),
    ...coverage.capabilities.map(item => ({ id: item.id, type: "aggregate-capability", name: item.description,
      kind: "capability", disposition: item.owner, status: item.status })),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const edgeKeys = new Set();
  const edges = [];
  function addEdge(from, to, type, label) {
    if (!itemById.has(from)) throw new Error(`dependency edge has unknown source ${from}`);
    if (!itemById.has(to) && !capabilityById.has(to)) throw new Error(`dependency edge has unknown target ${to}`);
    const key = `${from}\0${to}\0${type}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, type, ...(label ? { label } : {}) });
  }
  for (const edge of coverage.dependencyEdges) addEdge(edge.from, edge.to, "spec-operation", edge.operation);
  for (const item of coverage.items) {
    for (const prerequisite of item.prerequisites ?? []) {
      addEdge(item.identity, prerequisite,
        prerequisite.startsWith("capability:") ? "aggregate-prerequisite" : "declared-prerequisite");
    }
  }
  edges.sort((a, b) => `${a.from}\0${a.to}\0${a.type}`.localeCompare(`${b.from}\0${b.to}\0${b.type}`));

  const concreteOutgoing = new Map();
  const concreteDependents = new Map();
  for (const edge of edges.filter(edge => edge.type !== "aggregate-prerequisite")) {
    if (!concreteOutgoing.has(edge.from)) concreteOutgoing.set(edge.from, new Set());
    concreteOutgoing.get(edge.from).add(edge.to);
    if (!concreteDependents.has(edge.to)) concreteDependents.set(edge.to, new Set());
    concreteDependents.get(edge.to).add(edge.from);
  }
  const aggregateOutgoing = new Map();
  for (const edge of edges.filter(edge => edge.type === "aggregate-prerequisite")) {
    if (!aggregateOutgoing.has(edge.from)) aggregateOutgoing.set(edge.from, new Set());
    aggregateOutgoing.get(edge.from).add(edge.to);
  }
  const statusOf = id => itemById.get(id)?.status ?? capabilityById.get(id)?.status ?? "unclassified";
  const complete = id => statusOf(id) === "complete";
  const incompleteItems = coverage.items.filter(item => item.status !== "complete");
  const sccs = stronglyConnectedComponents(coverage.items.map(item => item.identity), concreteOutgoing);
  const componentByItem = new Map();
  sccs.forEach((members, index) => members.forEach(id => componentByItem.set(id, index)));
  const incompleteConcreteFor = identity => [...(concreteOutgoing.get(identity) ?? [])]
    .filter(id => !complete(id) && componentByItem.get(id) !== componentByItem.get(identity)).sort();
  const itemAnalysis = incompleteItems.map(item => {
    const concrete = incompleteConcreteFor(item.identity);
    const aggregate = [...(aggregateOutgoing.get(item.identity) ?? [])].filter(id => !complete(id)).sort();
    return { identity: item.identity, name: item.name, disposition: item.disposition, status: item.status,
      incompleteConcretePrerequisites: concrete, incompleteAggregatePrerequisites: aggregate,
      concreteReady: concrete.length === 0, blockedOnlyByAggregates: concrete.length === 0 && aggregate.length > 0 };
  }).sort((a, b) => a.identity.localeCompare(b.identity));

  const cycleComponents = sccs.filter(component => component.length > 1 ||
    (concreteOutgoing.get(component[0]) ?? new Set()).has(component[0]))
    .map((members, index) => ({ id: `cycle:${index + 1}`, members,
      incompleteMembers: members.filter(id => !complete(id)) }))
    .filter(component => component.incompleteMembers.length > 0)
    .sort((a, b) => b.members.length - a.members.length || a.members[0].localeCompare(b.members[0]));

  const actionCandidates = incompleteItems.map(item => {
    const seen = new Set();
    const queue = [...(concreteDependents.get(item.identity) ?? [])];
    while (queue.length) {
      const dependent = queue.shift();
      if (seen.has(dependent)) continue;
      seen.add(dependent);
      queue.push(...(concreteDependents.get(dependent) ?? []));
    }
    let soleRemainingConcreteDependency = 0;
    let readyDependents = 0;
    for (const dependent of concreteDependents.get(item.identity) ?? []) {
      const unmet = incompleteConcreteFor(dependent);
      if (unmet.length === 1 && unmet[0] === item.identity) soleRemainingConcreteDependency += 1;
      if (unmet.length === 0) readyDependents += 1;
    }
    return { identity: item.identity, name: item.name, disposition: item.disposition,
      status: item.status, transitiveDependents: seen.size,
      transitivePublicAlgorithms: [...seen].filter(id => {
        const raw = rawClauseByIdentity.get(id);
        return raw?.clauseType === "built-in function";
      }).length,
      soleRemainingConcreteDependency, readyDependents,
      incompleteConcretePrerequisites: incompleteConcreteFor(item.identity),
      incompleteAggregatePrerequisites: [...(aggregateOutgoing.get(item.identity) ?? [])]
        .filter(id => !complete(id)).sort() };
  }).sort((a, b) => b.soleRemainingConcreteDependency - a.soleRemainingConcreteDependency ||
    b.transitivePublicAlgorithms - a.transitivePublicAlgorithms ||
    b.transitiveDependents - a.transitiveDependents || a.identity.localeCompare(b.identity));

  const componentOutgoing = new Map();
  const componentDependents = new Map();
  for (const edge of edges.filter(edge => edge.type !== "aggregate-prerequisite")) {
    const from = componentByItem.get(edge.from);
    const to = componentByItem.get(edge.to);
    if (from === to) continue;
    if (!componentOutgoing.has(from)) componentOutgoing.set(from, new Set());
    componentOutgoing.get(from).add(to);
    if (!componentDependents.has(to)) componentDependents.set(to, new Set());
    componentDependents.get(to).add(from);
  }
  const incompleteComponent = index => sccs[index].some(id => !complete(id));
  const workUnits = sccs.map((members, index) => ({ members, index }))
    .filter(unit => incompleteComponent(unit.index)).map(unit => {
      const seen = new Set();
      const queue = [...(componentDependents.get(unit.index) ?? [])];
      while (queue.length) {
        const dependent = queue.shift();
        if (seen.has(dependent)) continue;
        seen.add(dependent);
        queue.push(...(componentDependents.get(dependent) ?? []));
      }
      const incompleteDependencies = [...(componentOutgoing.get(unit.index) ?? [])]
        .filter(incompleteComponent).sort((a, b) => a - b);
      let soleRemainingConcreteDependency = 0;
      for (const dependent of componentDependents.get(unit.index) ?? []) {
        const unmet = [...(componentOutgoing.get(dependent) ?? [])].filter(incompleteComponent);
        if (unmet.length === 1 && unmet[0] === unit.index) soleRemainingConcreteDependency += 1;
      }
      const aggregatePrerequisites = [...new Set(unit.members.flatMap(id =>
        [...(aggregateOutgoing.get(id) ?? [])].filter(target => !complete(target))))].sort();
      return { id: `work-unit:${unit.members[0]}`, members: unit.members,
        names: unit.members.map(id => itemById.get(id)?.name ?? id),
        dispositions: [...new Set(unit.members.map(id => itemById.get(id)?.disposition))].sort(),
        incompleteConcretePrerequisiteUnits: incompleteDependencies.map(index => `work-unit:${sccs[index][0]}`),
        incompleteAggregatePrerequisites: aggregatePrerequisites,
        concreteReady: incompleteDependencies.length === 0,
        soleRemainingConcreteDependency,
        transitiveDependentUnits: seen.size,
        transitivePublicAlgorithms: [...seen].flatMap(index => sccs[index])
          .filter(id => rawClauseByIdentity.get(id)?.clauseType === "built-in function").length };
    }).sort((a, b) => Number(b.concreteReady) - Number(a.concreteReady) ||
      b.soleRemainingConcreteDependency - a.soleRemainingConcreteDependency ||
      b.transitivePublicAlgorithms - a.transitivePublicAlgorithms ||
      b.transitiveDependentUnits - a.transitiveDependentUnits || a.id.localeCompare(b.id));

  const capabilityImpact = coverage.capabilities.map(capability => {
    const directItems = edges.filter(edge => edge.type === "aggregate-prerequisite" && edge.to === capability.id)
      .map(edge => edge.from);
    return { identity: capability.id, status: capability.status, directItems: directItems.length,
      concreteReadyItems: directItems.filter(id => {
        return incompleteConcreteFor(id).length === 0;
      }).length };
  }).sort((a, b) => b.directItems - a.directItems || a.identity.localeCompare(b.identity));

  return { schemaVersion: 1, generatedFrom: coverage.generatedFrom,
    summary: { nodes: nodes.length, normativeItems: coverage.items.length,
      capabilities: coverage.capabilities.length, edges: edges.length,
      specOperationEdges: edges.filter(edge => edge.type === "spec-operation").length,
      declaredPrerequisiteEdges: edges.filter(edge => edge.type === "declared-prerequisite").length,
      aggregatePrerequisiteEdges: edges.filter(edge => edge.type === "aggregate-prerequisite").length,
      concreteReadyItems: itemAnalysis.filter(item => item.concreteReady).length,
      concreteReadyWorkUnits: workUnits.filter(unit => unit.concreteReady).length,
      blockedOnlyByAggregates: itemAnalysis.filter(item => item.blockedOnlyByAggregates).length,
      incompleteCycleComponents: cycleComponents.length },
    nodes, edges, itemAnalysis, workUnits, actionCandidates, capabilityImpact, cycleComponents,
    byIncompleteDisposition: countBy(incompleteItems, item => item.disposition) };
}

export function renderDot(plan) {
  const lines = ["digraph ecma262_dependencies {", "  rankdir=LR;", "  graph [overlap=false];",
    "  node [shape=box, fontsize=8];"];
  for (const node of plan.nodes) {
    const color = node.status === "complete" ? "#6aa84f" : node.type === "aggregate-capability" ? "#cc0000" :
      node.status === "partial" ? "#f1c232" : "#999999";
    lines.push(`  "${escapeDot(node.id)}" [label="${escapeDot(node.name)}\\n${escapeDot(node.id)}", color="${color}"];`);
  }
  for (const edge of plan.edges) {
    const style = edge.type === "aggregate-prerequisite" ? "dashed" : "solid";
    lines.push(`  "${escapeDot(edge.from)}" -> "${escapeDot(edge.to)}" [style=${style}, label="${escapeDot(edge.label ?? edge.type)}"];`);
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

export function renderDocumentation(plan) {
  const top = plan.workUnits.slice(0, 25);
  const capabilities = plan.capabilityImpact;
  return `# ECMA-262 Fine-Grained Dependency Graph\n\n` +
    `This file is generated by \`npm run spec:dependency-plan\`. Do not edit it by hand. The complete ` +
    `machine-readable graph is \`spec/generated/ecma262-dependency-plan.json\`; the complete Graphviz ` +
    `form is \`spec/generated/ecma262-dependency-graph.dot\`.\n\n` +
    `## Graph semantics\n\n- Solid edges are concrete specification-operation or explicitly reviewed item dependencies.\n` +
    `- Dashed edges are aggregate capability prerequisites. They describe milestone debt but must not hide ` +
    `which concrete operation can be implemented next.\n- \`concreteReady\` means an incomplete item has no known ` +
    `incomplete concrete prerequisite. It does not mean the item is implemented.\n- \`soleRemainingConcreteDependency\` ` +
    `counts direct dependents for which one candidate is the last incomplete concrete prerequisite.\n\n` +
    `## Current graph\n\n| Measure | Count |\n|---|---:|\n` +
    Object.entries(plan.summary).map(([key, value]) => `| ${key} | ${value} |`).join("\n") + `\n\n` +
    `## Aggregate capability impact\n\n| Capability | Status | Direct items | Concrete-ready items |\n|---|---|---:|---:|\n` +
    capabilities.map(item => `| \`${item.identity}\` | ${item.status} | ${item.directItems} | ${item.concreteReadyItems} |`).join("\n") + `\n\n` +
    `## Ranked concrete action candidates\n\nRecursive specification dependencies are condensed into one work unit, so a recursive operation is not reported as its own blocker.\n\n| Work unit | Owner | Last blocker for | Transitive public algorithms | Transitive units | Incomplete concrete prerequisite units | Aggregate prerequisites |\n|---|---|---:|---:|---:|---|---|\n` +
    top.map(item => `| \`${item.id}\` ${item.names.join(" / ")} | ${item.dispositions.join(", ")} | ` +
      `${item.soleRemainingConcreteDependency} | ${item.transitivePublicAlgorithms} | ${item.transitiveDependentUnits} | ` +
      `${item.incompleteConcretePrerequisiteUnits.map(x => `\`${x}\``).join("<br>") || "—"} | ` +
      `${item.incompleteAggregatePrerequisites.map(x => `\`${x}\``).join("<br>") || "—"} |`).join("\n") + `\n\n` +
    `## Incomplete dependency cycles\n\n` + (plan.cycleComponents.length ?
      plan.cycleComponents.map(component => `- ${component.members.length} nodes: ${component.members.map(x => `\`${x}\``).join(", ")}`).join("\n") :
      `No incomplete concrete dependency cycles.`) + `\n`;
}

function main() {
  const check = process.argv.slice(2).includes("--check");
  const unknown = process.argv.slice(2).filter(argument => argument !== "--check");
  if (unknown.length) throw new Error(`unknown option ${unknown[0]}`);
  const plan = buildDependencyPlan({ coverage: JSON.parse(readFileSync(coveragePath, "utf8")),
    ledger: JSON.parse(readFileSync(ledgerPath, "utf8")) });
  const outputs = [[outputPath, `${JSON.stringify(plan, null, 2)}\n`], [dotPath, renderDot(plan)],
    [documentationPath, renderDocumentation(plan)]];
  if (check) {
    for (const [path, rendered] of outputs) {
      if (!existsSync(path) || readFileSync(path, "utf8") !== rendered)
        throw new Error(`generated dependency plan differs from ${relative(projectRoot, path)}; run npm run spec:dependency-plan`);
    }
    process.stdout.write(`checked ${relative(projectRoot, outputPath)} and graph views\n`);
  } else {
    for (const [path, rendered] of outputs) writeFileSync(path, rendered);
    process.stdout.write(`wrote ${relative(projectRoot, outputPath)} and graph views\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`ecma262-dependency-plan: ${error.message}\n`);
    process.exitCode = 1;
  }
}
