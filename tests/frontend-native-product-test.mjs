import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aot-native-product-"));
try {
  const output = path.join(directory, "graph.txt");
  const product = spawnSync(process.execPath, ["--experimental-loader", "./tests/reject-typescript-loader.mjs", "tools/aot-compile.mjs", "tests/typescript/annotated-add.ts", "--output", output], {cwd:root, encoding:"utf8"});
  assert.equal(product.status, 0, `${product.stdout}\n${product.stderr}`);
  assert.match(fs.readFileSync(output, "utf8"), /Add/);

  // String literals became product syntax in B13. Keep this product-path failure pinned to RegExp,
  // which remains a named later milestone rather than relying on an obsolete capability gap.
  const unsupported = spawnSync(process.execPath, ["tools/aot-compile.mjs", "tests/v8-witnesses/regexp.js"], {cwd:root, encoding:"utf8"});
  assert.equal(unsupported.status, 1);
  const diagnostic = JSON.parse(unsupported.stderr.trim());
  assert.deepEqual({code:diagnostic.code, kind:diagnostic.kind, role:diagnostic.role}, {code:"AOT1001", kind:"RegularExpressionLiteral", role:"node"});
  assert.deepEqual(diagnostic.range, {start:12, end:17});
  assert.equal(unsupported.stdout, "");

  const operatorFailure = spawnSync(process.execPath, ["tools/aot-compile.mjs", "tests/v8-witnesses/unsupported-operator.ts"], {cwd:root, encoding:"utf8"});
  assert.equal(operatorFailure.status, 1);
  const operatorDiagnostic = JSON.parse(operatorFailure.stderr.trim());
  assert.deepEqual({code:operatorDiagnostic.code, kind:operatorDiagnostic.kind, role:operatorDiagnostic.role},
    {code:"AOT1002", kind:"BinaryExpression", role:"operator"});
  console.log("native product compiler is npm-independent and retains bounded unsupported diagnostics");
} finally {
  fs.rmSync(directory, {recursive:true, force:true});
}
