#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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
const optionNames = new Set([
  "--test262",
  "--native",
  "--limit",
  "--start",
  "--results",
  "--jobs",
  "--timeout-ms",
  "--memory-mb",
]);
const flagNames = new Set(["--quiet", "--no-build", "--resume"]);
const hasFlag = (name) => argv.includes(name);
const paths = [];
for (let i = 0; i < argv.length; i++) {
  if (optionNames.has(argv[i])) {
    i++;
  } else if (
    !flagNames.has(argv[i]) &&
    ![...optionNames].some((name) => argv[i].startsWith(`${name}=`))
  ) {
    paths.push(argv[i]);
  }
}

const root = resolve(option("--test262", process.env.TEST262_ROOT || "test262"));
const native = resolve(option("--native", ".coil/build/test262-native"));
const limit = Number(option("--limit", "0"));
const start = Number(option("--start", "0"));
const jobs = Math.max(1, Number(option("--jobs", "1")));
const timeoutMs = Math.max(1, Number(option("--timeout-ms", "30000")));
const memoryMb = Math.max(1, Number(option("--memory-mb", "2048")));
const results = option("--results");
const quiet = hasFlag("--quiet");
const resume = hasFlag("--resume");
if (paths.length === 0) {
  console.error(
    "usage: node tools/run-test262.mjs --test262 DIR [--start N] [--limit N] " +
      "[--jobs N] [--timeout-ms N] [--memory-mb N] [--results FILE] [--resume] [--quiet] " +
      "TEST_OR_DIRECTORY...",
  );
  process.exit(64);
}
if (resume && !results) {
  console.error("run-test262: --resume requires --results FILE");
  process.exit(64);
}

if (!hasFlag("--no-build")) {
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
}

const localHarness = resolve("tests/test262/harness");
const sta = readFileSync(join(localHarness, "sta.js"), "utf8");
const assertion = readFileSync(join(localHarness, "assert.js"), "utf8");
const temporary = mkdtempSync(join(tmpdir(), "aotk-test262-"));
const cleanupTemporary = () => rmSync(temporary, { recursive: true, force: true });
process.on("exit", cleanupTemporary);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

function collect(path, out) {
  const absolute = resolve(path);
  if (statSync(absolute).isDirectory()) {
    for (const entry of readdirSync(absolute).sort()) collect(join(absolute, entry), out);
  } else if (absolute.endsWith(".js") && !absolute.endsWith("_FIXTURE.js")) {
    out.push(absolute);
  }
}

function record(source, path) {
  const match = source.replace(/\r\n?/g, "\n").match(/\/\*---\s*\n([\s\S]*?)\n---\*\//);
  if (!match) throw new Error(`${path}: missing Test262 frontmatter`);
  const parsed = yaml.load(match[1]);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function unsupportedReason(metadata, source) {
  const flags = new Set(metadata.flags || []);
  if (flags.has("module")) return "module variant";
  if (flags.has("async")) return "async completion";
  if (metadata.negative) return `negative ${metadata.negative.phase || "unknown"} phase`;
  if (/\bassert\.throws\s*\(/.test(source)) return "catchable exception assertions";
  if (/\$262\b/.test(source)) return "$262 host object";
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
if (start > 0) files.splice(0, start);
if (limit > 0) files.length = Math.min(files.length, limit);

console.error(
  "Test262 scope: synchronous script tests executed in the current function-body entry ABI; " +
    "module/async/negative phases and full top-level Script semantics are not implemented.",
);
const totals = { passed: 0, failed: 0, refused: 0, skipped: 0 };
const categories = {};
const completed = new Set();
const resultKey = (result) => `${result.path}\0${result.variant}`;
function categoryFor(status, detail = "") {
  const code = detail.match(/frontend status=\d+ code=(\d+)/);
  if (code) return `frontend-code-${code[1]}`;
  const bridgeKind = detail.match(/bridge kind (-?\d+)/);
  if (bridgeKind) return `frontend-bridge-kind-${bridgeKind[1]}`;
  if (status === "skipped") return detail.split(" is not implemented", 1)[0].replaceAll(" ", "-");
  if (status === "refused") return "pipeline-refused";
  if (detail.startsWith("graph corruption:"))
    return `graph-corruption-${detail.slice("graph corruption:".length).trim().replaceAll(" ", "-")}`;
  if (status === "failed") return detail || "unknown-failure";
  return "passed";
}
if (results && resume && existsSync(results)) {
  for (const line of readFileSync(results, "utf8").split("\n")) {
    if (!line) continue;
    const prior = JSON.parse(line);
    completed.add(resultKey(prior));
    totals[prior.status]++;
    const category = prior.category || categoryFor(prior.status, prior.detail);
    categories[category] = (categories[category] || 0) + 1;
  }
} else if (results) {
  writeFileSync(results, "");
}

function report(result) {
  const key = resultKey(result);
  if (completed.has(key)) return;
  completed.add(key);
  totals[result.status]++;
  result.category ||= categoryFor(result.status, result.detail);
  categories[result.category] = (categories[result.category] || 0) + 1;
  if (results) appendFileSync(results, `${JSON.stringify(result)}\n`);
  if (!quiet || result.status === "failed") {
    const detail = result.detail ? ` (${result.detail})` : "";
    console.log(`${result.status.toUpperCase()} ${result.path} [${result.variant}]${detail}`);
  }
}

const work = [];
for (let index = 0; index < files.length; index++) {
  const path = files[index];
  const source = readFileSync(path, "utf8");
  let metadata;
  try {
    metadata = record(source, path);
  } catch (error) {
    report({ path, variant: "metadata", status: "failed", detail: error.message });
    continue;
  }
  const reason = unsupportedReason(metadata, source);
  if (reason) {
    report({ path, variant: "policy", status: "skipped", detail: `${reason} is not implemented` });
    continue;
  }
  for (const variant of variants(metadata)) {
    if (completed.has(resultKey({ path, variant: variant.name }))) continue;
    work.push({ index, path, source, metadata, variant });
  }
}

function runNative(assembled) {
  return new Promise((resolveRun) => {
    const detached = process.platform !== "win32";
    const command = process.platform === "linux" ? "prlimit" : native;
    const args = process.platform === "linux"
      ? [`--as=${memoryMb * 1024 * 1024}`, "--", native, assembled]
      : [assembled];
    const child = spawn(command, args, { cwd: process.cwd(), detached });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (detached) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }, timeoutMs);
    const append = (current, chunk) =>
      current.length >= 65536 ? current : (current + chunk.toString()).slice(0, 65536);
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveRun({ pid: child.pid, status: null, signal: "SPAWN", stdout, stderr: error.message });
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolveRun({ pid: child.pid, status, signal: timedOut ? "TIMEOUT" : signal, stdout, stderr });
    });
  });
}

async function runOne(task) {
  const { index, path, source, metadata, variant } = task;
  const assembled = join(temporary, `${index}-${variant.name}-${basename(path)}`);
  writeFileSync(assembled, assemble(source, metadata, variant.strict));
  const run = await runNative(assembled);
  rmSync(assembled, { force: true });
  for (const suffix of [".o", ".err", ""]) {
    rmSync(`/tmp/aotk-native-${run.pid}${suffix}`, { force: true });
  }
  if (run.status === 0 && run.stdout.trim().endsWith("PASS")) {
    report({ path, variant: variant.name, status: "passed" });
  } else if (
    (run.status === 2 && run.stdout.trim().endsWith("REFUSED")) ||
    run.stderr.includes("frontend: unsupported")
  ) {
    const lines = run.stderr.trim().split("\n");
    const detail = lines.find((line) => line.startsWith("test262-native: frontend")) ||
      lines.find((line) => line.startsWith("frontend: unsupported")) || lines.at(-1);
    report({ path, variant: variant.name, status: "refused", detail });
  } else {
    const stderrLines = run.stderr.trim().split("\n");
    const detail = stderrLines.find((line) => line.startsWith("graph corruption:")) ||
      stderrLines.find((line) => line.startsWith("native-harness:")) || run.signal ||
      run.stdout.trim() || `exit ${run.status}`;
    report({ path, variant: variant.name, status: "failed", detail });
    if (run.stderr && !quiet) process.stderr.write(run.stderr);
  }
}

let next = 0;
async function worker() {
  while (next < work.length) {
    const task = work[next++];
    await runOne(task);
  }
}
await Promise.all(Array.from({ length: Math.min(jobs, work.length) }, worker));

console.log(
  `test262 result: ${totals.passed} passed; ${totals.failed} failed; ` +
    `${totals.refused} refused; ${totals.skipped} skipped`,
);
if (results) {
  const summary = { totals, categories };
  writeFileSync(`${results}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
}
cleanupTemporary();
process.exit(totals.failed > 0 || totals.refused > 0 || totals.passed === 0 ? 1 : 0);
