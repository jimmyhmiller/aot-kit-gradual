import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeTypeScript } from "../src/frontend_ir.mjs";
import { generateCoilBuilder } from "../src/frontend_coil_codegen.mjs";

const source = `
type Box = { value: number };
function Box(value: number): Box { return { value: value }; }
function main(n: number): number {
  let box = new Box(n);
  let x = 0;
  if (box.value < 0) { x = x + 1; } else { x = x + 2; }
  for (let i = 0; i < n; i = i + 1) { x = x + 1; }
  return x;
}`;
let generated = generateCoilBuilder(normalizeTypeScript(source, "control.ts"), { moduleName: "frontendcodegentest" });
generated = generated.replace("(import \"coil.slice\" :use *)",
  `(import "coil.slice" :use *)
(import "eval" :use *)
(import "coil.assert" :use *)
(import "coil.io" :use *)
(import "coil.fmt" :use *)`);
generated += `
(defn run-frontend-control! [(input i64) (expected i64)] (-> i64)
  (let [arg (frontend-build! (+ input 5100) true)]
    (if (= (g-verify) 0) 0
      (do (fmt (stderr) "frontend control verify={d}:{d}\\n" (g-verify-code) (g-verify-node))
          (g-print-flat (stderr)) 0))
    (assert (= (g-verify) 0)) (ev-reset!) (ev-bind! arg (RInt input))
    (assert (= (ev-run-nobind 1000000) EV-OK))
    (assert (= (rt-payload (ev-result)) expected)) 0))
(deftest normalized_control_lowers_to_coil
  (run-frontend-control! -1 1)
  (run-frontend-control! 3 5))
`;

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-codegen-"));
const file = path.join(directory, "frontend-codegen-test.coil");
try {
  fs.writeFileSync(file, generated);
  const result = spawnSync("coil", ["test", file], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log("normalized if/else, for-loop, constructor, and object field lower through Coil ideal IR");
