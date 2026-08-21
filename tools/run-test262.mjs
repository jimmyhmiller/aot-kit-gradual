#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import process from "node:process";
import * as yaml from "js-yaml";

const argv = process.argv.slice(2);
const option = (name, fallback = "") => {
  const equals = argv.find((arg) => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const at = argv.indexOf(name);
  return at >= 0 && at + 1 < argv.length ? argv[at + 1] : fallback;
};
const optionNames = new Set(["--test262", "--native", "--limit"]);
const paths = [];
for (let i = 0; i < argv.length; i++) {
  if (optionNames.has(argv[i])) {
    i++;
  } else if (![...optionNames].some((name) => argv[i].startsWith(`${name}=`))) {
    paths.push(argv[i]);
  }
}

const root = resolve(option("--test262", process.env.TEST262_ROOT || "test262"));
const native = resolve(option("--native", ".coil/build/test262-native"));
const limit = Number(option("--limit", "0"));
if (paths.length === 0) {
  console.error("usage: node tools/run-test262.mjs --test262 DIR [--limit N] TEST_OR_DIRECTORY...");
  process.exit(64);
}

const build = spawnSync(
  "coil",
  ["build", "tools/test262-native.coil", "-o", native, "--meta-opt=1", "--quiet"],
  { cwd: process.cwd(), encoding: "utf8" },
);
if (build.status !== 0) {
  process.stderr.write(build.stdout || "");
  process.stderr.write(build.stderr || "");
  process.exit(build.status || 1);
}

const localHarness = resolve("tests/test262/harness");
const sta = readFileSync(join(localHarness, "sta.js"), "utf8");
const assertion = readFileSync(join(localHarness, "assert.js"), "utf8");
const temporary = mkdtempSync(join(tmpdir(), "aotk-test262-"));

function collect(path, out) {
  const absolute = resolve(path);
  if (statSync(absolute).isDirectory()) {
    for (const entry of readdirSync(absolute).sort()) collect(join(absolute, entry), out);
  } else if (absolute.endsWith(".js")) {
    out.push(absolute);
  }
}

function record(source, path) {
  const match = source.match(/\/\*---\s*\n([\s\S]*?)\n---\*\//);
  if (!match) throw new Error(`${path}: missing Test262 frontmatter`);
  const parsed = yaml.load(match[1]);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function unsupportedReason(metadata) {
  const flags = new Set(metadata.flags || []);
  if (flags.has("module")) return "module variant";
  if (flags.has("async")) return "async completion";
  if (metadata.negative) return `negative ${metadata.negative.phase || "unknown"} phase`;
  return "";
}

function variants(metadata) {
  const flags = new Set(metadata.flags || []);
  if (flags.has("raw") || flags.has("noStrict")) return [{ name: "default", strict: false }];
  if (flags.has("onlyStrict")) return [{ name: "strict", strict: true }];
  return [
    { name: "default", strict: false },
    { name: "strict", strict: true },
  ];
}

function assemble(source, metadata, strict) {
  const flags = new Set(metadata.flags || []);
  const pieces = ["function main(n) {\n"];
  if (strict) pieces.push('"use strict";\n');
  if (!flags.has("raw")) pieces.push(sta, "\n", assertion, "\n");
  for (const include of metadata.includes || []) {
    pieces.push(readFileSync(join(root, "harness", include), "utf8"), "\n");
  }
  pieces.push(source, "\nreturn 0;\n}\n");
  return pieces.join("");
}

const files = [];
for (const path of paths) collect(path, files);
if (limit > 0) files.length = Math.min(files.length, limit);

console.error(
  "Test262 scope: synchronous script tests executed in the current function-body entry ABI; " +
    "module/async/negative phases and full top-level Script semantics are not implemented.",
);
const totals = { passed: 0, failed: 0, refused: 0, skipped: 0 };
for (let index = 0; index < files.length; index++) {
  const path = files[index];
  const source = readFileSync(path, "utf8");
  let metadata;
  try {
    metadata = record(source, path);
  } catch (error) {
    totals.failed++;
    console.log(`FAIL ${path} (${error.message})`);
    continue;
  }
  const reason = unsupportedReason(metadata);
  if (reason) {
    totals.skipped++;
    console.log(`SKIP ${path} (${reason} is not implemented)`);
    continue;
  }
  for (const variant of variants(metadata)) {
    const assembled = join(temporary, `${index}-${variant.name}-${basename(path)}`);
    writeFileSync(assembled, assemble(source, metadata, variant.strict));
    const run = spawnSync(native, [assembled], { cwd: process.cwd(), encoding: "utf8" });
    const label = `${path} [${variant.name}]`;
    if (run.status === 0 && run.stdout.trim().endsWith("PASS")) {
      totals.passed++;
      console.log(`PASS ${label}`);
    } else if (
      (run.status === 2 && run.stdout.trim().endsWith("REFUSED")) ||
      run.stderr.includes("frontend: unsupported")
    ) {
      totals.refused++;
      const lines = run.stderr.trim().split("\n");
      const detail = lines.find((line) => line.startsWith("test262-native: frontend")) ||
        lines.find((line) => line.startsWith("frontend: unsupported")) || lines.at(-1);
      console.log(`REFUSED ${label}${detail ? ` (${detail})` : ""}`);
    } else {
      totals.failed++;
      console.log(`FAIL ${label} (${run.signal || run.stdout.trim() || `exit ${run.status}`})`);
      if (run.stderr) process.stderr.write(run.stderr);
    }
  }
}

console.log(
  `test262 result: ${totals.passed} passed; ${totals.failed} failed; ` +
    `${totals.refused} refused; ${totals.skipped} skipped`,
);
rmSync(temporary, { recursive: true, force: true });
process.exit(totals.failed > 0 || totals.refused > 0 || totals.passed === 0 ? 1 : 0);
