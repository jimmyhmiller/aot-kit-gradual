#!/usr/bin/env node
// Legacy oracle fixture generator. Never use this as a product compiler path.
import fs from "node:fs";
import path from "node:path";
import { normalizeTypeScript } from "../src/frontend_ir.mjs";
import { generateCoilBuilder } from "../src/frontend_coil_codegen.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: ts-to-coil.mjs INPUT.ts OUTPUT.coil");
  process.exit(2);
}

// Parse, resolve, validate, and generate completely before opening an output. A diagnostic can
// therefore never leave a plausible partial Coil module behind.
const source = fs.readFileSync(input, "utf8");
const program = normalizeTypeScript(source, input);
const generated = generateCoilBuilder(program, {
  moduleName: path.basename(output, path.extname(output)),
});
const temporary = `${output}.tmp-${process.pid}`;
try {
  fs.writeFileSync(temporary, generated);
  fs.renameSync(temporary, output);
} finally {
  if (fs.existsSync(temporary)) fs.rmSync(temporary);
}
