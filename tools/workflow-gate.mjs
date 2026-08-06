#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const roadmap = JSON.parse(fs.readFileSync("workflow/roadmap.json", "utf8"));
const state = JSON.parse(fs.readFileSync("workflow/state.json", "utf8"));
assert.deepEqual(roadmap.milestones.map(milestone => milestone.id), [
  "B00", "B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09",
  "B10", "B11", "B12", "B13", "B14", "B15", "B16", "B17", "B18", "B19",
  "B21", "B20", "B22", "B23", "B24",
]);
assert.deepEqual(roadmap.completionCommands, [
  "tools/gate.sh --quick",
  "tools/gate.sh",
  "tools/extended-gate.sh",
]);
const ids = new Set(roadmap.milestones.map(milestone => milestone.id));
assert.ok(state.active === null || ids.has(state.active));
assert.ok(state.completed.every(id => ids.has(id)));
const validation = execFileSync("node", ["tools/workflow.mjs", "validate"], { encoding: "utf8" });
assert.match(validation, /25 milestones/);
if (state.active !== null) {
  const next = execFileSync("node", ["tools/workflow.mjs", "next"], { encoding: "utf8" });
  assert.match(next, new RegExp(`^${state.active}:`));
}

// Completion evidence must name a commit containing the implementation, not merely the HEAD that
// happened to precede an uncommitted working tree. Exercise the controller in an isolated repo so
// this gate never mutates the real roadmap state.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "aot-workflow-gate-"));
try {
  fs.mkdirSync(path.join(fixture, "tools"));
  fs.mkdirSync(path.join(fixture, "workflow"));
  fs.copyFileSync("tools/workflow.mjs", path.join(fixture, "tools/workflow.mjs"));
  fs.writeFileSync(path.join(fixture, "tools/pass.sh"), "#!/bin/sh\nexit 0\n");
  fs.chmodSync(path.join(fixture, "tools/pass.sh"), 0o755);
  fs.writeFileSync(path.join(fixture, "workflow/roadmap.json"), JSON.stringify({
    schemaVersion: 1,
    completionCommands: [],
    milestones: [{ id: "T00", name: "fixture", predecessors: [], gate: "tools/pass.sh" }],
  }));
  fs.writeFileSync(path.join(fixture, "workflow/state.json"), JSON.stringify({
    schemaVersion: 1,
    active: "T00",
    completed: [],
    evidence: {},
  }));
  execFileSync("git", ["init", "-q"], { cwd: fixture });
  execFileSync("git", ["config", "user.email", "workflow-gate@example.invalid"], { cwd: fixture });
  execFileSync("git", ["config", "user.name", "Workflow Gate"], { cwd: fixture });
  execFileSync("git", ["add", "."], { cwd: fixture });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: fixture });

  fs.writeFileSync(path.join(fixture, "dirty.txt"), "not evidence\n");
  const dirty = spawnSync(process.execPath, ["tools/workflow.mjs", "complete", "T00"], {
    cwd: fixture,
    encoding: "utf8",
  });
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /refusing to complete T00/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture, "workflow/state.json"))), {
    schemaVersion: 1,
    active: "T00",
    completed: [],
    evidence: {},
  });

  fs.unlinkSync(path.join(fixture, "dirty.txt"));
  const clean = spawnSync(process.execPath, ["tools/workflow.mjs", "complete", "T00"], {
    cwd: fixture,
    encoding: "utf8",
  });
  assert.equal(clean.status, 0, `${clean.stdout}\n${clean.stderr}`);
  const completedFixture = JSON.parse(fs.readFileSync(path.join(fixture, "workflow/state.json")));
  assert.deepEqual(completedFixture.completed, ["T00"]);
  assert.equal(completedFixture.evidence.T00.commit,
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: fixture, encoding: "utf8" }).trim());
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
console.log("workflow graph, state, and controller verified");
