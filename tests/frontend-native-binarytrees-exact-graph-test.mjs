import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeTypeScript } from "../src/frontend_ir.mjs";
import { generateCoilBuilder } from "../src/frontend_coil_codegen.mjs";

const archive = process.argv[2];
if (!archive) throw new Error("usage: frontend-native-binarytrees-exact-graph-test.mjs LIBAOT_TYPESCRIPT.a");
const source = fs.readFileSync("tests/typescript/binarytrees.ts", "utf8");
const native = `(module frontendnativebinarytreesexact)
(import "frontendnative" :use *)
(import "frontendnativegraph" :use *)
(import "gtext" :use *)
(import "ty" :use *)
(import "coil.io" :use *)
(import "coil.alloc" :use *)
(import "coil.fmt" :use *)
(defn main [] (-> i64)
  (let [source ${JSON.stringify(source)} (mut frontend) (fe-native-new source)
        buffer (stack (array i8 1048576))]
    (if (!= (fe-native-index! (mut frontend)) FE-OK)
        (do (fe-native-free! (mut frontend)) 2)
        (do (frontend-native-build! (mut frontend) 6205 true)
            (ps (stdout) (g-render (cast (ptr i8) buffer) 1048576))
            (fe-native-free! (mut frontend)) 0))))`;
let legacy = generateCoilBuilder(normalizeTypeScript(source, "tests/typescript/binarytrees.ts"), {
  moduleName: "frontendlegacybinarytreesexact",
});
legacy = legacy.replace('(import "coil.slice" :use *)', `(import "coil.slice" :use *)
(import "gtext" :use *)
(import "coil.io" :use *)`);
legacy += `
(defn main [] (-> i64)
  (let [buffer (stack (array i8 1048576))]
    (frontend-build! 6205 true)
    (ps (stdout) (g-render (cast (ptr i8) buffer) 1048576)) 0))`;

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-native-binarytrees-exact-"));
try {
  const nativeFile = path.join(directory, "native.coil");
  const legacyFile = path.join(directory, "legacy.coil");
  const nativeExe = path.join(directory, "native");
  const legacyExe = path.join(directory, "legacy");
  fs.writeFileSync(nativeFile, native);
  fs.writeFileSync(legacyFile, legacy);
  const nativeBuild = spawnSync("coil", ["build", nativeFile, "-o", nativeExe,
    "--link-flag", `-Wl,-force_load,${archive}`, "--link-flag", "-framework",
    "--link-flag", "CoreFoundation", "--link-flag", "-framework", "--link-flag", "Security"],
  { encoding: "utf8" });
  assert.equal(nativeBuild.status, 0, `${nativeBuild.stdout}\n${nativeBuild.stderr}`);
  const legacyBuild = spawnSync("coil", ["build", legacyFile, "-o", legacyExe], { encoding: "utf8" });
  assert.equal(legacyBuild.status, 0, `${legacyBuild.stdout}\n${legacyBuild.stderr}`);
  const nativeRun = spawnSync(nativeExe, [], { encoding: null, maxBuffer: 2 * 1024 * 1024 });
  const nativeRepeat = spawnSync(nativeExe, [], { encoding: null, maxBuffer: 2 * 1024 * 1024 });
  const legacyRun = spawnSync(legacyExe, [], { encoding: null, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(nativeRun.status, 0, `signal=${nativeRun.signal} error=${nativeRun.error?.message ?? "none"}\n${nativeRun.stderr?.toString() ?? ""}`);
  assert.equal(nativeRepeat.status, 0, `signal=${nativeRepeat.signal} error=${nativeRepeat.error?.message ?? "none"}\n${nativeRepeat.stderr?.toString() ?? ""}`);
  assert.equal(legacyRun.status, 0, `signal=${legacyRun.signal} error=${legacyRun.error?.message ?? "none"}\n${legacyRun.stderr?.toString() ?? ""}`);
  if (!nativeRun.stdout.equals(nativeRepeat.stdout)) {
    const nativeLines = nativeRun.stdout.toString().split("\n");
    const repeatLines = nativeRepeat.stdout.toString().split("\n");
    const mismatch = nativeLines.findIndex((line, index) => line !== repeatLines[index]);
    assert.fail(`native Coil binarytrees graph is nondeterministic at line ${mismatch + 1}:\n` +
      `native: ${nativeLines[mismatch]}\nrepeat: ${repeatLines[mismatch]}\n` +
      `native head:\n${nativeLines.slice(0, 45).join("\n")}\nrepeat head:\n${repeatLines.slice(0, 45).join("\n")}\n` +
      `native bytes=${nativeRun.stdout.length} repeat bytes=${nativeRepeat.stdout.length}`);
  }
  console.log(`canonical native binarytrees graph ${crypto.createHash("sha256").update(nativeRun.stdout).digest("hex")}; legacy smoke bytes=${legacyRun.stdout.length}`);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
