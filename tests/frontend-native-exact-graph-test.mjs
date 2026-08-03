import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeTypeScript } from "../src/frontend_ir.mjs";
import { generateCoilBuilder } from "../src/frontend_coil_codegen.mjs";

const nativePath = process.argv[2];
if (!nativePath) throw new Error("usage: frontend-native-exact-graph-test.mjs NATIVE_GRAPH.txt");

const source = "function main(n: number): number { return n + 1; }";
let generated = generateCoilBuilder(normalizeTypeScript(source, "native-exact.ts"), {
  moduleName: "frontendnativeexactlegacy",
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
    (frontend-build! 6201 true)
    (ps (stdout) (g-render (cast (ptr i8) buffer) 32768))
    0))
`;

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-native-exact-"));
try {
  const coilFile = path.join(directory, "legacy.coil");
  const executable = path.join(directory, "legacy");
  fs.writeFileSync(coilFile, generated);
  const built = spawnSync("coil", ["build", coilFile, "-o", executable], { encoding: "utf8" });
  assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);
  const legacy = spawnSync(executable, [], { encoding: null });
  assert.equal(legacy.status, 0, legacy.stderr?.toString());
  const native = fs.readFileSync(nativePath);
  assert.deepEqual(native, legacy.stdout, "native Coil frontend graph differs from legacy frontend graph");
  const digest = crypto.createHash("sha256").update(native).digest("hex");
  console.log(`native/legacy exact graph ${digest}`);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
