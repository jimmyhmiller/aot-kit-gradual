#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const roadmap = JSON.parse(fs.readFileSync("workflow/roadmap.json", "utf8"));
const state = JSON.parse(fs.readFileSync("workflow/state.json", "utf8"));
assert.equal(roadmap.milestones.length, 16);
assert.deepEqual(roadmap.completionCommands, [
  "tools/gate.sh --quick",
  "tools/gate.sh",
  "tools/extended-gate.sh",
]);
const ids = new Set(roadmap.milestones.map(milestone => milestone.id));
assert.ok(state.active === null || ids.has(state.active));
assert.ok(state.completed.every(id => ids.has(id)));
const validation = execFileSync("node", ["tools/workflow.mjs", "validate"], { encoding: "utf8" });
assert.match(validation, /16 milestones/);
if (state.active !== null) {
  const next = execFileSync("node", ["tools/workflow.mjs", "next"], { encoding: "utf8" });
  assert.match(next, new RegExp(`^${state.active}:`));
}
console.log("workflow graph, state, and controller verified");
