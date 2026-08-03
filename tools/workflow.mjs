#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roadmapPath = path.join(root, "workflow/roadmap.json");
const statePath = path.join(root, "workflow/state.json");
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const roadmap = readJson(roadmapPath);
const state = readJson(statePath);
const milestones = new Map(roadmap.milestones.map(milestone => [milestone.id, milestone]));

function fail(message) {
  console.error(`workflow: ${message}`);
  process.exit(1);
}

function validate() {
  if (roadmap.schemaVersion !== 1 || state.schemaVersion !== 1) fail("unsupported schema version");
  if (milestones.size !== roadmap.milestones.length) fail("duplicate milestone id");
  for (const milestone of roadmap.milestones) {
    for (const predecessor of milestone.predecessors) {
      if (!milestones.has(predecessor)) fail(`${milestone.id} has unknown predecessor ${predecessor}`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) fail(`dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const predecessor of milestones.get(id).predecessors) visit(predecessor);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of milestones.keys()) visit(id);
  if (state.active !== null && !milestones.has(state.active)) fail(`unknown active milestone ${state.active}`);
  for (const id of state.completed) if (!milestones.has(id)) fail(`unknown completed milestone ${id}`);
  if (new Set(state.completed).size !== state.completed.length) fail("duplicate completed milestone");
  for (const id of state.completed) {
    for (const predecessor of milestones.get(id).predecessors) {
      if (!state.completed.includes(predecessor)) fail(`${id} completed before predecessor ${predecessor}`);
    }
  }
  if (state.active && state.completed.includes(state.active)) fail(`${state.active} is both active and completed`);
}

function ready(milestone, completed = state.completed) {
  return milestone.predecessors.every(id => completed.includes(id));
}

function nextMilestone(completed = state.completed) {
  return roadmap.milestones.find(milestone => !completed.includes(milestone.id) && ready(milestone, completed));
}

function run(command) {
  console.log(`\n>>> ${command}`);
  const result = spawnSync("/bin/sh", ["-c", command], { cwd: root, stdio: "inherit" });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited ${result.status}`);
}

function writeState(nextState) {
  const temporary = `${statePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(nextState, null, 2)}\n`);
  fs.renameSync(temporary, statePath);
}

validate();
const [command = "status", id] = process.argv.slice(2);

if (command === "validate") {
  console.log(`workflow valid: ${roadmap.milestones.length} milestones, active ${state.active ?? "none"}`);
} else if (command === "status") {
  for (const milestone of roadmap.milestones) {
    const status = state.completed.includes(milestone.id)
      ? "done"
      : state.active === milestone.id
        ? "active"
        : ready(milestone)
          ? "ready"
          : "blocked";
    console.log(`${milestone.id.padEnd(3)} ${status.padEnd(7)} ${milestone.name}`);
  }
} else if (command === "next") {
  const milestone = nextMilestone();
  if (!milestone) {
    if (state.completed.length === roadmap.milestones.length) console.log("all milestones complete");
    else fail("no milestone is ready; state or dependency graph is inconsistent");
  } else {
    console.log(`${milestone.id}: ${milestone.name}`);
  }
} else if (command === "check" || command === "complete") {
  const target = id ?? state.active;
  if (!target) fail(`${command} requires a milestone id when none is active`);
  const milestone = milestones.get(target);
  if (!milestone) fail(`unknown milestone ${target}`);
  if (!ready(milestone)) fail(`${target} predecessors are not complete`);
  if (state.completed.includes(target)) fail(`${target} is already complete`);
  if (!fs.existsSync(path.join(root, milestone.gate))) fail(`${target} gate does not exist: ${milestone.gate}`);
  run(milestone.gate);
  for (const gate of roadmap.completionCommands) {
    if (!fs.existsSync(path.join(root, gate.split(" ")[0]))) fail(`required gate does not exist: ${gate}`);
    run(gate);
  }
  if (command === "complete") {
    const completed = [...state.completed, target];
    const candidate = nextMilestone(completed);
    const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
    const evidence = {
      ...state.evidence,
      [target]: {
        completedAt: new Date().toISOString(),
        commit,
        gates: [milestone.gate, ...roadmap.completionCommands],
      },
    };
    writeState({ ...state, active: candidate?.id ?? null, completed, evidence });
    console.log(`\n${target} complete; next ${candidate?.id ?? "none"}`);
  }
} else {
  fail("usage: workflow.mjs [status|validate|next|check [ID]|complete [ID]]");
}
