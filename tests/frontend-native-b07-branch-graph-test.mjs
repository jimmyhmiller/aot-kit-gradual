import assert from "node:assert/strict";
import fs from "node:fs";

const graph = fs.readFileSync(process.argv[2], "utf8");
const opCount = op => [...graph.matchAll(new RegExp(`\\b${op}\\b`, "g"))].length;

assert.equal(opCount("If"), 3, "conditional, &&, and || each lower through one If");
assert.equal(opCount("Region"), 3, "each value-producing branch has one Region");
assert.ok(opCount("Phi") >= 6, "branch values and updated locals are explicitly merged");
assert.match(graph, /Return/, "graph remains executable after the value merges");
console.log("B07 canonical graph: three explicit branch diamonds and value/local Phis verified");
