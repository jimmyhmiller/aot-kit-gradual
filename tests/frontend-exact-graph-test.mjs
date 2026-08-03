import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeTypeScript } from "../src/frontend_ir.mjs";
import { generateCoilBuilder } from "../src/frontend_coil_codegen.mjs";

// This is the migration oracle. The native Coil frontend must reproduce this exact
// g-render byte sequence; interpreter or native-execution equivalence is insufficient.
const source = `
type Box = { value: number };
function Box(value: number): Box { return { value: value }; }
function adjust(box: Box, n: number): number {
  let x = 0;
  if (box.value < 0) { x = x + 1; } else { x = x + 2; }
  for (let i = 0; i < n; i = i + 1) { x += 1; }
  return x;
}
function main(n: number): number {
  let box = new Box(n);
  return adjust(box, n);
}`;

let generated = generateCoilBuilder(normalizeTypeScript(source, "exact.ts"), {
  moduleName: "frontendexactgraph",
});
generated = generated.replace(
  '(import "coil.slice" :use *)',
  `(import "coil.slice" :use *)
(import "gtext" :use *)
(import "coil.io" :use *)`,
);
generated += `
(defn main [] (-> i64)
  (let [buffer (stack (array i8 32768))]
    (frontend-build! 6101 true)
    (ps (stdout) (g-render (cast (ptr i8) buffer) 32768))
    0))
`;

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-exact-graph-"));
const coilFile = path.join(directory, "frontend-exact-graph.coil");
const executable = path.join(directory, "frontend-exact-graph");
try {
  fs.writeFileSync(coilFile, generated);
  const built = spawnSync("coil", ["build", coilFile, "-o", executable], { encoding: "utf8" });
  assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);
  const run = spawnSync(executable, [], { encoding: null });
  assert.equal(run.status, 0, `${run.stdout?.toString()}\n${run.stderr?.toString()}`);
  const digest = crypto.createHash("sha256").update(run.stdout).digest("hex");
  assert.equal(digest, "27c043eec283fd68f03acffd45f0a94933482960b3f13ea83d48be0d2967df1a",
    `exact frontend graph changed: ${digest}`);
  console.log(`exact TypeScript frontend graph ${digest}`);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
