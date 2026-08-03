import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeTypeScript } from "../src/frontend_ir.mjs";
import { generateCoilBuilder } from "../src/frontend_coil_codegen.mjs";

const nativePath = process.argv[2];
if (!nativePath) throw new Error("usage: frontend-native-control-exact-graph-test.mjs NATIVE_GRAPH.txt");
const source = "function main(n: number): number { let x = 0; if (n < 0) { x = x + 1; } else { x = x + 2; } for (let i = 0; i < n; i = i + 1) { x = x + 1; } return x; }";
let generated = generateCoilBuilder(normalizeTypeScript(source, "native-control-exact.ts"), {
  moduleName: "frontendnativecontrolexactlegacy",
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
    (frontend-build! 6203 true)
    (ps (stdout) (g-render (cast (ptr i8) buffer) 32768))
    0))
`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-native-control-exact-"));
try {
  const coilFile = path.join(directory, "legacy.coil");
  const executable = path.join(directory, "legacy");
  fs.writeFileSync(coilFile, generated);
  const built = spawnSync("coil", ["build", coilFile, "-o", executable], { encoding: "utf8" });
  assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);
  const legacy = spawnSync(executable, [], { encoding: null });
  assert.equal(legacy.status, 0, legacy.stderr?.toString());
  const native = fs.readFileSync(nativePath);
  assert.deepEqual(native, legacy.stdout, "native Coil control graph differs from legacy frontend graph");
  console.log(`native/legacy exact control graph ${crypto.createHash("sha256").update(native).digest("hex")}`);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
