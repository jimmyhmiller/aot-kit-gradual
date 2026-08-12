// Provision THE resident emitter: one compiled binary that reads its JavaScript/TypeScript
// source (plus seeds, register count, script kind, and mode) from argv at runtime. Every tool
// that needs to compile a source file shares this one binary and this one cache — building a
// bespoke emitter per input was ~4s of `coil build` per program (the conformance suite paid it
// 75 times per run).
//
// The cache invalidates when any compiler input changes: src/ and lib/ sources, Coil.toml, the
// generator, and the `coil` binary itself (a compiler upgrade must not keep running stale
// emitters).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {execFileSync, spawnSync} from "node:child_process";

export function ensureResidentEmitter(root, {debug = false} = {}) {
  const cacheDirectory = path.join(root, ".coil", "build", "js-resident");
  fs.mkdirSync(cacheDirectory, {recursive: true});
  const emitter = path.join(cacheDirectory, debug ? "emitter-O0" : "emitter");
  const stampPath = path.join(cacheDirectory, debug ? "emitter-O0.stamp" : "emitter.stamp");

  const stampInputs = [];
  const collect = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(target);
      else if (/\.(coil|jsl)$/.test(entry.name)) stampInputs.push(target);
    }
  };
  collect(path.join(root, "src"));
  collect(path.join(root, "lib"));
  stampInputs.push(path.join(root, "Coil.toml"));
  stampInputs.push(path.join(root, "tools", "generate-typescript-aot-benchmark.mjs"));
  const coilBinary = spawnSync("which", ["coil"], {encoding: "utf8"}).stdout.trim();
  if (coilBinary) stampInputs.push(coilBinary);
  stampInputs.sort();
  const hash = crypto.createHash("sha256");
  for (const file of stampInputs) {
    hash.update(file);
    hash.update(fs.readFileSync(file));
  }
  const stamp = hash.digest("hex");

  if (!fs.existsSync(emitter) || !fs.existsSync(stampPath) ||
      fs.readFileSync(stampPath, "utf8") !== stamp) {
    console.error("compiler changed; rebuilding resident emitter (~seconds, then cached)...");
    const harness = path.join(cacheDirectory, "resident.coil");
    execFileSync("node", [path.join(root, "tools", "generate-typescript-aot-benchmark.mjs"),
                          "--resident", harness], {cwd: root, stdio: "inherit"});
    execFileSync("coil", ["build", ...(debug ? ["-O0"] : []), harness, "-o", emitter],
                 {cwd: root, stdio: "inherit"});
    fs.writeFileSync(stampPath, stamp);
  }
  return emitter;
}
