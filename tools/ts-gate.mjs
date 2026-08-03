#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compileFile, execute, guardCount } from "../src/ts_frontend.mjs";
const dir = path.resolve("tests/typescript");
const cases = JSON.parse(fs.readFileSync(path.join(dir, "cases.json"), "utf8"));
for (const c of cases) {
  const { ast, graph } = compileFile(path.join(dir, c.file));
  assert.deepEqual(execute(graph, c.args), c.want, c.file);
  assert.equal(ast.main.name, "main");
}
const annotated = compileFile(path.join(dir, "annotated-add.ts")).graph;
const dynamic = compileFile(path.join(dir, "dynamic-add.ts")).graph;
assert.equal(guardCount(annotated), 0);
assert.equal(guardCount(dynamic), 2);
assert.ok(guardCount(annotated) < guardCount(dynamic));
assert.ok(annotated.params.every(p => p.op === "Cast" && p.boundary));
const generic = compileFile(path.join(dir, "generic.ts")).graph;
assert.equal(generic.params[0].type.kind, "dynamic");
const structural = compileFile(path.join(dir, "structural.ts")).graph;
assert.equal(structural.params[0].type.kind, "object");
console.log(`${cases.length} TypeScript programs parsed, lowered, and executed; annotation guards 2 -> 0`);
