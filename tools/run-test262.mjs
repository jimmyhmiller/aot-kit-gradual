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
  "--batch-size",
]);
const flagNames = new Set([
  "--quiet",
  "--quick",
  "--no-build",
  "--resume",
  "--es5-only",
  "--profile",
]);
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
const batchSize = Math.max(1, Number(option("--batch-size", "1")));
const quiet = hasFlag("--quiet");
const quick = hasFlag("--quick");
const resume = hasFlag("--resume");
const es5Only = hasFlag("--es5-only");
const profile = hasFlag("--profile");
const explicitResults = option("--results");
const defaultResults = resolve(
  `test262-results-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`,
);
const results = quick ? "" : resolve(explicitResults || defaultResults);
const invocationStarted = performance.now();
let buildMs = 0;
if (paths.length === 0) {
  console.error(
    "usage: node tools/run-test262.mjs --test262 DIR [--start N] [--limit N] " +
      "[--jobs N] [--timeout-ms N] [--memory-mb N] [--results FILE] [--resume] [--quiet] " +
      "[--quick] [--es5-only] TEST_OR_DIRECTORY...",
  );
  process.exit(64);
}
if (quick && explicitResults) {
  console.error("run-test262: --quick cannot be combined with --results");
  process.exit(64);
}
if (resume && !explicitResults) {
  console.error("run-test262: --resume requires an explicit --results FILE");
  process.exit(64);
}
if (results) console.error(`test262 results: ${results}`);

if (!hasFlag("--no-build")) {
  const buildStarted = performance.now();
  const build = spawnSync(
    "coil",
    ["build", "tools/test262-native.coil", "-o", native, "--meta-opt=1", "--quiet"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  buildMs = performance.now() - buildStarted;
  if (build.status !== 0) {
    process.stderr.write(build.stdout || "");
    process.stderr.write(build.stderr || "");
    process.exit(build.status || 1);
  }
}

const executionStarted = performance.now();

const localHarness = resolve("tests/test262/harness");
const sta = readFileSync(join(localHarness, "sta.js"), "utf8");
const assertion = readFileSync(join(localHarness, "assert.js"), "utf8");
const assertionMarker = (text) => {
  const at = assertion.indexOf(text);
  if (at < 0) throw new Error(`local assert.js is missing marker: ${text}`);
  return at;
};
const assertionParts = {
  base: assertion.slice(assertionMarker("function assert("), assertionMarker("assert._isSameValue")),
  sameHelper: assertion.slice(assertionMarker("assert._isSameValue"), assertionMarker("assert.sameValue")),
  sameValue: assertion.slice(assertionMarker("assert.sameValue"), assertionMarker("assert.notSameValue")),
  notSameValue: assertion.slice(assertionMarker("assert.notSameValue"), assertionMarker("assert.throws")),
  throws: assertion.slice(assertionMarker("assert.throws"), assertionMarker("function compareArray")),
  compareArray: assertion.slice(assertionMarker("function compareArray")),
};
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
  const pieces = [];
  const includes = (metadata.includes || []).map((include) =>
    readFileSync(join(root, "harness", include), "utf8")
  );
  if (!flags.has("raw")) {
    pieces.push(sta, "\n");
    // The native frontend is closed-world. Do not compile the comparatively large assertion
    // library for old-style tests that use only direct Test262Error checks; load it whenever the
    // test or one of its requested includes can reference `assert`.
    const assertionUsers = [source, ...includes].join("\n");
    if (/\bassert\b/.test(assertionUsers)) {
      pieces.push(assertionParts.base);
      const same = /\bassert\.(?:sameValue|notSameValue|compareArray)\b/.test(assertionUsers);
      if (same) pieces.push(assertionParts.sameHelper);
      if (/\bassert\.sameValue\b/.test(assertionUsers)) pieces.push(assertionParts.sameValue);
      if (/\bassert\.notSameValue\b/.test(assertionUsers)) pieces.push(assertionParts.notSameValue);
      if (/\bassert\.throws\b/.test(assertionUsers)) pieces.push(assertionParts.throws);
      if (/\bassert\.compareArray\b/.test(assertionUsers)) pieces.push(assertionParts.compareArray);
      pieces.push("\n");
    }
  }
  for (const include of includes) pieces.push(include, "\n");
  pieces.push("function main(n) {\n");
  if (strict) pieces.push('"use strict";\n');
  pieces.push(source, "\nreturn 0;\n}\n");
  return pieces.join("");
}

function assertionKey(source, includes) {
  const users = [source, ...includes].join("\n");
  if (!/\bassert\b/.test(users)) return "";
  return [
    "base",
    /\bassert\.(?:sameValue|notSameValue|compareArray)\b/.test(users) ? "helper" : "",
    /\bassert\.sameValue\b/.test(users) ? "same" : "",
    /\bassert\.notSameValue\b/.test(users) ? "notSame" : "",
    /\bassert\.throws\b/.test(users) ? "throws" : "",
    /\bassert\.compareArray\b/.test(users) ? "compare" : "",
  ].filter(Boolean).join(",");
}

function batchSignature(task) {
  const flags = new Set(task.metadata.flags || []);
  const includeNames = task.metadata.includes || [];
  const includes = includeNames.map((include) => readFileSync(join(root, "harness", include), "utf8"));
  return JSON.stringify({ raw: flags.has("raw"), strict: task.variant.strict, includeNames,
    assertions: assertionKey(task.source, includes) });
}

function assembleBatch(tasks) {
  const first = tasks[0];
  const flags = new Set(first.metadata.flags || []);
  const includes = (first.metadata.includes || []).map((include) =>
    readFileSync(join(root, "harness", include), "utf8")
  );
  const pieces = [];
  if (!flags.has("raw")) {
    pieces.push(sta, "\n");
    const key = assertionKey(first.source, includes).split(",");
    if (key.includes("base")) pieces.push(assertionParts.base);
    if (key.includes("helper")) pieces.push(assertionParts.sameHelper);
    if (key.includes("same")) pieces.push(assertionParts.sameValue);
    if (key.includes("notSame")) pieces.push(assertionParts.notSameValue);
    if (key.includes("throws")) pieces.push(assertionParts.throws);
    if (key.includes("compare")) pieces.push(assertionParts.compareArray);
    if (key.length > 0) pieces.push("\n");
  }
  for (const include of includes) pieces.push(include, "\n");
  for (let i = 0; i < tasks.length; i++) {
    pieces.push(`function __aotk_test_${i}(n) {\n`);
    if (tasks[i].variant.strict) pieces.push('"use strict";\n');
    pieces.push(tasks[i].source, "\nreturn 0;\n}\n");
  }
  pieces.push("function main(n) {\n");
  for (let i = 0; i < tasks.length - 1; i++) {
    pieces.push(`if (n === ${i}) return __aotk_test_${i}(n);\n`);
  }
  pieces.push(`return __aotk_test_${tasks.length - 1}(n);\n}\n`);
  return pieces.join("");
}

let files = [];
for (const path of paths) collect(path, files);
if (es5Only) {
  files = files.filter((path) => /(?:^|\n)es5id:/.test(readFileSync(path, "utf8")));
}
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
  const phase = detail.match(/^native-harness: ([a-z0-9-]+)/i);
  if (phase) return `pipeline-${phase[1].toLowerCase()}`;
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
  if (es5Only && !metadata.es5id) continue;
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

function runNative(assembled, count = 0) {
  return new Promise((resolveRun) => {
    const spawnStartedNs = process.hrtime.bigint();
    const detached = process.platform !== "win32";
    const command = process.platform === "linux" ? "prlimit" : native;
    const nativeArgs = [...(profile ? ["--profile"] : []), assembled,
      ...(count > 0 ? [String(count)] : [])];
    const args = process.platform === "linux"
      ? [`--as=${memoryMb * 1024 * 1024}`, "--", native, ...nativeArgs]
      : nativeArgs;
    const child = spawn(command, args, { cwd: process.cwd(), detached,
      env: { ...process.env, AOT_TRACE_THROW: "1" } });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let peakRssKb = 0;
    let readyReceivedNs;
    const monitor = setInterval(() => {
      try {
        const status = readFileSync(`/proc/${child.pid}/status`, "utf8");
        const rss = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0);
        peakRssKb = Math.max(peakRssKb, rss);
      } catch {}
    }, 20);
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
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
      if (readyReceivedNs === undefined && stderr.includes("AOTK_READY")) {
        readyReceivedNs = process.hrtime.bigint();
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      clearInterval(monitor);
      resolveRun({ pid: child.pid, status: null, signal: "SPAWN", stdout,
        stderr: error.message, spawnStartedNs, readyReceivedNs, peakRssKb });
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      clearInterval(monitor);
      resolveRun({ pid: child.pid, status, signal: timedOut ? "TIMEOUT" : signal, stdout, stderr,
        spawnStartedNs, readyReceivedNs, peakRssKb });
    });
  });
}

function timingFields(run, assemblyMs, durationMs) {
  const phases = { source_assembly: assemblyMs };
  for (const match of run.stderr.matchAll(/^AOTK_TIMING phase=([a-z0-9_]+) ns=(\d+)$/gmi)) {
    phases[match[1]] = Number(match[2]) / 1e6;
  }
  const profile = {};
  for (const match of run.stderr.matchAll(/^AOTK_PROFILE phase=([a-z0-9_]+) (.+)$/gmi)) {
    profile[match[1]] = Object.fromEntries(
      [...match[2].matchAll(/([a-z0-9_]+)=(\d+)/gi)].map((field) => [field[1], Number(field[2])]),
    );
  }
  if (run.readyReceivedNs !== undefined) {
    phases.process_startup = Number(run.readyReceivedNs - run.spawnStartedNs) / 1e6;
  }
  const compileNames = ["source_assembly", "process_startup", "frontend_index", "frontend_graph",
    "graph_verify", "selection", "scheduling", "allocation", "aarch64_encoding",
    "macho_publication", "x86_encoding", "elf_publication"];
  const compileMs = compileNames.reduce((sum, name) => sum + (phases[name] || 0), 0);
  return { phasesMs: phases, profile, compileMs, attemptWallMs: durationMs,
    peakRssKb: run.peakRssKb };
}

function nativeDiagnostic(stderr) {
  const lines = stderr.trim().split("\n");
  const phaseIndex = lines.findIndex((line) => line.startsWith("native-harness:"));
  if (phaseIndex < 0) return "";
  return [lines[phaseIndex], ...lines.slice(phaseIndex + 1).filter((line) =>
    /^[mn]\d+:/.test(line) || /^  (?:[ab] <-|call )/.test(line),
  )].join("; ");
}

function runtimeThrowDiagnostic(stderr) {
  const lines = stderr.trim().split("\n");
  const at = lines.findIndex((line) => line.startsWith("uncaught JavaScript throw"));
  if (at < 0) return "";
  return lines.slice(at).filter((line) =>
    line.startsWith("uncaught JavaScript throw") || line.startsWith(" property "),
  ).join("; ");
}

function batchRuntimeThrowDiagnostic(stderr, index) {
  const marker = `AOTK_BATCH_EXEC index=${index}\n`;
  const at = stderr.indexOf(marker);
  if (at < 0) return "";
  const tail = stderr.slice(at + marker.length);
  const next = tail.indexOf("AOTK_BATCH_EXEC index=");
  return runtimeThrowDiagnostic(next < 0 ? tail : tail.slice(0, next));
}

const diagnosticKinds = ["unknown", "assert", "sameValue", "notSameValue",
  "throws-non-function", "throws-non-object", "throws-wrong-constructor",
  "throws-missing", "compareArray", "uncaught-exception"];
const diagnosticTags = ["undefined", "null", "boolean", "integer", "number", "string",
  "object", "function", "other"];
function decodeRuntimeDiagnostic(codeText) {
  let code = Number(codeText);
  if (!Number.isSafeInteger(code) || code < 1073741824) return null;
  code -= 1073741824;
  const site = Math.floor(code / 4194304); code %= 4194304;
  const kind = Math.floor(code / 262144); code %= 262144;
  const actualTag = Math.floor(code / 16384); code %= 16384;
  const expectedTag = Math.floor(code / 1024); code %= 1024;
  const actualBits = Math.floor(code / 32);
  const expectedBits = code % 32;
  const value = (bits, tag) => bits === 31 ? undefined :
    tag === 2 ? bits !== 15 : bits - 15;
  const actualValue = value(actualBits, actualTag);
  const expectedValue = value(expectedBits, expectedTag);
  const result = { assertionSite: site, failureKind: diagnosticKinds[kind] || `kind-${kind}`,
    actualType: diagnosticTags[actualTag] || `tag-${actualTag}`,
    expectedType: diagnosticTags[expectedTag] || `tag-${expectedTag}` };
  if (actualValue !== undefined) result.actualValue = actualValue;
  if (expectedValue !== undefined) result.expectedValue = expectedValue;
  return result;
}

function runtimeFailure(codeText) {
  const diagnostic = decodeRuntimeDiagnostic(codeText);
  if (!diagnostic) return { detail: "RUNTIME-FAILED" };
  const shown = (type, value) => value === undefined ? type : `${type}(${value})`;
  return { detail: `runtime ${diagnostic.failureKind} at assertion #${diagnostic.assertionSite}: ` +
      `actual=${shown(diagnostic.actualType, diagnostic.actualValue)} ` +
      `expected=${shown(diagnostic.expectedType, diagnostic.expectedValue)}`,
    diagnostic };
}

function finishOne(task, assembled, run, assemblyMs, durationMs) {
  const { path, variant } = task;
  const timings = timingFields(run, assemblyMs, durationMs);
  rmSync(assembled, { force: true });
  for (const suffix of [".o", ".err", ""]) {
    rmSync(`/tmp/aotk-native-${run.pid}${suffix}`, { force: true });
  }
  if (run.status === 0 && run.stdout.trim().endsWith("PASS")) {
    report({ path, variant: variant.name, status: "passed", durationMs: Math.round(durationMs),
      ...timings });
  } else if (
    (run.status === 2 && run.stdout.trim().endsWith("REFUSED")) ||
    run.stderr.includes("frontend: unsupported")
  ) {
    const lines = run.stderr.trim().split("\n");
    const phaseDetail = nativeDiagnostic(run.stderr);
    const detail = phaseDetail ||
      lines.find((line) => line.startsWith("test262-native: frontend")) ||
      lines.find((line) => line.startsWith("frontend: unsupported")) || lines.at(-1);
    report({ path, variant: variant.name, status: "refused", detail,
      durationMs: Math.round(durationMs), ...timings });
    if (run.stderr && !quiet) process.stderr.write(run.stderr);
  } else {
    const stderrLines = run.stderr.trim().split("\n");
    const runtimeCode = run.stdout.trim().match(/RUNTIME-FAILED\s+(-?\d+)$/)?.[1];
    const runtime = runtimeCode === undefined ? null : runtimeFailure(runtimeCode);
    const detail = stderrLines.find((line) => line.startsWith("graph corruption:")) ||
      nativeDiagnostic(run.stderr) || runtimeThrowDiagnostic(run.stderr) || run.signal ||
      runtime?.detail || run.stdout.trim() || `exit ${run.status}`;
    report({ path, variant: variant.name, status: "failed", detail,
      ...(runtime?.diagnostic ? { diagnostic: runtime.diagnostic } : {}),
      durationMs: Math.round(durationMs), ...timings });
    if (run.stderr && !quiet) process.stderr.write(run.stderr);
  }
}

async function runOne(task) {
  const { index, path, source, metadata, variant } = task;
  const assembled = join(temporary, `${index}-${variant.name}-${basename(path)}`);
  const assemblyStarted = performance.now();
  writeFileSync(assembled, assemble(source, metadata, variant.strict));
  const assemblyMs = performance.now() - assemblyStarted;
  const started = performance.now();
  const run = await runNative(assembled);
  const durationMs = performance.now() - started;
  finishOne(task, assembled, run, assemblyMs, durationMs);
}

async function runBatch(tasks) {
  if (tasks.length === 1) return runOne(tasks[0]);
  const assembled = join(temporary, `batch-${tasks[0].index}-${tasks.length}.js`);
  const assemblyStarted = performance.now();
  writeFileSync(assembled, assembleBatch(tasks));
  const assemblyMs = performance.now() - assemblyStarted;
  const started = performance.now();
  const run = await runNative(assembled, tasks.length);
  const durationMs = performance.now() - started;
  const timings = timingFields(run, assemblyMs, durationMs);
  rmSync(assembled, { force: true });
  for (const suffix of [".o", ".err", ""]) rmSync(`/tmp/aotk-native-${run.pid}${suffix}`, { force: true });
  const outcomes = new Map(
    [...run.stdout.matchAll(/^BATCH (\d+) (PASS|RUNTIME-FAILED)(?: (-?\d+))?$/gm)]
      .map((m) => [Number(m[1]), { status: m[2], code: m[3] }]),
  );
  if (run.status === 0 && outcomes.size === tasks.length) {
    for (let i = 0; i < tasks.length; i++) {
      if (outcomes.get(i).status !== "PASS") {
        const share = timings.compileMs / tasks.length;
        const runtime = outcomes.get(i).code === undefined ? null : runtimeFailure(outcomes.get(i).code);
        report({ path: tasks[i].path, variant: tasks[i].variant.name, status: "failed",
          detail: batchRuntimeThrowDiagnostic(run.stderr, i) || runtime?.detail || "RUNTIME-FAILED",
          ...(runtime?.diagnostic ? { diagnostic: runtime.diagnostic } : {}),
          durationMs: Math.round(durationMs), ...timings,
          compileMs: share, batchCompileMs: timings.compileMs, batchSize: tasks.length });
      } else {
        const share = timings.compileMs / tasks.length;
        report({ path: tasks[i].path, variant: tasks[i].variant.name, status: "passed",
          durationMs: Math.round(durationMs), ...timings, compileMs: share,
          batchCompileMs: timings.compileMs, batchSize: tasks.length });
      }
    }
    return;
  }
  // One unsupported/corrupt member can reject a closed-world graph. Bisect until each member has
  // its ordinary standalone status; no refusal or failure is inherited from a neighbor.
  const middle = Math.floor(tasks.length / 2);
  await runBatch(tasks.slice(0, middle));
  await runBatch(tasks.slice(middle));
}

function nativeServer() {
  let child = null;
  let current = null;
  let stderr = "";
  let stdout = "";
  let stdoutBuffer = "";
  let monitor = null;
  const appendOutput = (currentOutput, chunk) =>
    currentOutput.length >= 65536
      ? currentOutput
      : (currentOutput + chunk.toString()).slice(0, 65536);

  const stopMonitor = () => {
    if (monitor) clearInterval(monitor);
    monitor = null;
  };
  const settle = (status, signal) => {
    if (!current) return;
    const request = current;
    current = null;
    clearTimeout(request.timer);
    // CASE_END is written after the ordinary PASS/REFUSED/etc line on the same stdout stream.
    const cleanStdout = stdout.replace(/^AOTK_CASE_END .*$/gm, "").trimEnd();
    const run = { pid: child?.pid, status, signal, stdout: cleanStdout, stderr,
      spawnStartedNs: request.startedNs, readyReceivedNs: request.readyReceivedNs,
      peakRssKb: request.peakRssKb };
    stdout = "";
    stderr = "";
    setTimeout(() => request.resolve(run), 0);
  };
  const start = () => {
    const detached = process.platform !== "win32";
    const command = process.platform === "linux" ? "prlimit" : native;
    const serverArgs = [...(profile ? ["--profile"] : []), "--server"];
    const args = process.platform === "linux"
      ? [`--as=${memoryMb * 1024 * 1024}`, "--", native, ...serverArgs]
      : serverArgs;
    child = spawn(command, args, { cwd: process.cwd(), detached, stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, AOT_TRACE_THROW: "1" } });
    stdoutBuffer = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      stdoutBuffer += text;
      let newline;
      while ((newline = stdoutBuffer.indexOf("\n")) >= 0) {
        const line = stdoutBuffer.slice(0, newline);
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        const end = line.match(/^AOTK_CASE_END index=\d+ status=(\d+)$/);
        if (end) settle(Number(end[1]), null);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendOutput(stderr, chunk);
      if (current && current.readyReceivedNs === undefined && stderr.includes("AOTK_READY")) {
        current.readyReceivedNs = process.hrtime.bigint();
      }
    });
    child.on("error", (error) => {
      stderr = appendOutput(stderr, error.message);
      settle(null, "SPAWN");
    });
    child.on("close", (_status, signal) => {
      stopMonitor();
      settle(null, current?.forcedSignal || signal || "SERVER-EXIT");
      child = null;
    });
    monitor = setInterval(() => {
      if (!current || !child) return;
      try {
        const status = readFileSync(`/proc/${child.pid}/status`, "utf8");
        const rss = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0);
        current.peakRssKb = Math.max(current.peakRssKb, rss);
      } catch {}
    }, 20);
  };
  const run = (assembled) => new Promise((resolveRun) => {
    if (!child) start();
    const startedNs = process.hrtime.bigint();
    current = { resolve: resolveRun, startedNs, peakRssKb: 0, timer: null };
    current.timer = setTimeout(() => {
      if (!child) return;
      current.forcedSignal = "TIMEOUT";
      try {
        if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }, timeoutMs);
    child.stdin.write(`${assembled}\n`);
  });
  const close = () => {
    if (child) child.stdin.end();
    stopMonitor();
  };
  return { run, close };
}

async function runServerOne(server, task) {
  const { index, path, source, metadata, variant } = task;
  const assembled = join(temporary, `${index}-${variant.name}-${basename(path)}`);
  const assemblyStarted = performance.now();
  writeFileSync(assembled, assemble(source, metadata, variant.strict));
  const assemblyMs = performance.now() - assemblyStarted;
  const started = performance.now();
  const run = await server.run(assembled);
  const durationMs = performance.now() - started;
  finishOne(task, assembled, run, assemblyMs, durationMs);
}

let units;
if (batchSize === 1) {
  units = work.map((task) => [task]);
} else {
  const groups = new Map();
  for (const task of work) {
    const key = batchSignature(task);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }
  units = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += batchSize) units.push(group.slice(i, i + batchSize));
  }
}
let next = 0;
async function worker() {
  const server = batchSize === 1 ? nativeServer() : null;
  while (next < units.length) {
    const unit = units[next++];
    if (server) await runServerOne(server, unit[0]);
    else await runBatch(unit);
  }
  if (server) server.close();
}
await Promise.all(Array.from({ length: Math.min(jobs, units.length) }, worker));

console.log(
  `test262 result: ${totals.passed} passed; ${totals.failed} failed; ` +
    `${totals.refused} refused; ${totals.skipped} skipped`,
);
const executionMs = performance.now() - executionStarted;
const invocationMs = performance.now() - invocationStarted;
console.error(
  `test262 timing: build=${buildMs.toFixed(0)}ms execution=${executionMs.toFixed(0)}ms ` +
    `total=${invocationMs.toFixed(0)}ms variants=${work.length}`,
);
if (results) {
  const summary = { totals, categories };
  writeFileSync(`${results}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
  console.error(`test262 results: ${results}`);
  console.error(`test262 summary: ${results}.summary.json`);
}
cleanupTemporary();
process.exit(totals.failed > 0 || totals.refused > 0 || totals.passed === 0 ? 1 : 0);
