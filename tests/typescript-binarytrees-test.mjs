import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { executeNormalized, normalizeTypeScript } from "../src/frontend_ir.mjs";

const file = "tests/typescript/binarytrees.ts";
const program = normalizeTypeScript(fs.readFileSync(file, "utf8"), file);
assert.deepEqual(program.functions.map(fn => fn.symbol.name),
  ["bottomUpTree", "itemCheck", "pow2", "work", "iterationsAt", "main"]);

const resultFields = ["stretchDepth", "stretchCheck"];
for (let depth = 4; depth <= 20; depth += 2)
  resultFields.push(`depth${depth}`, `iterations${depth}`, `check${depth}`);
resultFields.push("longLivedDepth", "longLivedCheck");

for (const depth of [4, 6, 8, 10]) {
  const result = executeNormalized(program, [depth]);
  const actual = resultFields.map(field => result[field]).join(" ");
  const expected = execFileSync("node", ["tools/binarytrees-reference.mjs", `${depth}`], { encoding: "utf8" }).trim();
  assert.equal(actual, expected, `depth ${depth}`);
}

console.log("TypeScript normalized binary-trees agrees with Node through depth 10");
