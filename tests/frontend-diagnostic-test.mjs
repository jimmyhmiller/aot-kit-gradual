import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-diagnostic-"));
try {
  const invalid = path.join(directory, "invalid.ts");
  const output = path.join(directory, "partial.coil");
  fs.writeFileSync(invalid, "function main(x: number): number { switch (x) { default: return 0; } }");
  const failed = spawnSync("node", ["tools/ts-to-coil.mjs", invalid, output], { encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /FE_UNSUPPORTED/);
  assert.match(failed.stderr, /invalid\.ts:1:/);
  assert.equal(fs.existsSync(output), false, "unsupported input published a partial Coil module");

  const valid = path.join(directory, "valid.ts");
  fs.writeFileSync(valid, "function main(x: number): number { return x + 1; }");
  const compiled = spawnSync("node", ["tools/ts-to-coil.mjs", valid, output], { encoding: "utf8" });
  assert.equal(compiled.status, 0, compiled.stderr);
  assert.ok(fs.statSync(output).size > 0);
  const checked = spawnSync("coil", ["check", output], { encoding: "utf8" });
  assert.equal(checked.status, 0, checked.stderr);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log("unsupported TypeScript reports a source range and publishes no partial object");
