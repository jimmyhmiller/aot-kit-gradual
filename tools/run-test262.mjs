#!/usr/bin/env node

if (process.argv.includes("--help")) {
  process.stdout.write(`Usage: node tools/run-test262.mjs [options] [test-path]\n\n` +
    `  --test262 PATH   Test262 checkout root (required unless ./test262 exists)\n` +
    `  --jobs N         Persistent compiler worker count\n` +
    `  --limit N        Maximum source files before variant expansion\n` +
    `  --no-build       Reuse the existing native compiler build\n` +
    `  --profile        Retain compiler phase profiles\n` +
    `  --no-seed-artifact  Rebuild immutable JSL compiler state in every process\n` +
    `  --quick          Do not retain per-variant results\n` +
    `  --results PATH   JSONL result path\n` +
    `  --resume         Resume from the result path\n`);
  process.exit(0);
}

if (process.argv.includes("--test262-dir")) {
  process.stderr.write("run-test262: unknown option --test262-dir; use --test262 PATH\n");
  process.exit(2);
}

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
import { availableParallelism, tmpdir } from "node:os";
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
  "--seed-artifact",
  "--no-seed-artifact",
  "--verbose",
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
const jobs = Math.max(1, Number(option("--jobs", String(Math.min(16, availableParallelism())))));
const timeoutMs = Math.max(1, Number(option("--timeout-ms", "30000")));
const memoryMb = Math.max(1, Number(option("--memory-mb", "2048")));
// Bulk compilation remains explicit until its compiler-owned dispatcher is status-equivalent to
// singleton Script execution. Units are structurally separate, but equivalence is non-negotiable.
const batchSize = Math.max(1, Number(option("--batch-size", "1")));
const quiet = hasFlag("--quiet");
const quick = hasFlag("--quick");
const resume = hasFlag("--resume");
const es5Only = hasFlag("--es5-only");
const profile = hasFlag("--profile");
const useSeedArtifact = !hasFlag("--no-seed-artifact");
const verbose = hasFlag("--verbose");
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
      "[--quick] [--es5-only] [--verbose] TEST_OR_DIRECTORY...",
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
  const bridgeBuild = spawnSync("tools/build-typescript-go-bridge.sh", [],
    { cwd: process.cwd(), encoding: "utf8" });
  if (bridgeBuild.status !== 0) {
    process.stderr.write(bridgeBuild.stdout || "");
    process.stderr.write(bridgeBuild.stderr || "");
    process.exit(bridgeBuild.status || 1);
  }
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
// A profiled native compilation can exceed 64 KiB before reaching backend/cache timing lines.
// Keep a bounded per-request buffer, but large enough to retain the completion-side diagnostics
// that make persisted Test262 results useful for performance and failure analysis.
const nativeOutputLimit = 1024 * 1024;

const sta = readFileSync(join(root, "harness", "sta.js"), "utf8");
const assertion = readFileSync(join(root, "harness", "assert.js"), "utf8");
const temporary = mkdtempSync(join(tmpdir(), "aotk-test262-"));
const seedArtifact = join(temporary, "jsl-seed.mfts");
const cleanupTemporary = () => rmSync(temporary, { recursive: true, force: true });
process.on("exit", cleanupTemporary);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

if (useSeedArtifact) {
  const seedStarted = performance.now();
  const seed = spawnSync(native, ["--build-seed", seedArtifact],
    { cwd: process.cwd(), encoding: "utf8" });
  if (seed.status !== 0) {
    process.stderr.write(seed.stdout || "");
    process.stderr.write(seed.stderr || "");
    process.exit(seed.status || 1);
  }
  buildMs += performance.now() - seedStarted;
}

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

const runtimeNegativeKinds = new Map([
  ["EvalError", 1], ["RangeError", 2], ["ReferenceError", 3], ["SyntaxError", 4],
  ["TypeError", 5], ["URIError", 6], ["Test262Error", 7], ["Error", 8],
]);

function unsupportedReason(metadata, source) {
  const flags = new Set(metadata.flags || []);
  if (flags.has("module") &&
      metadata.negative?.phase !== "parse" && metadata.negative?.phase !== "early") {
    return "module variant";
  }
  if (flags.has("async")) return "async completion";
  if (metadata.negative) {
    const phase = metadata.negative.phase || "unknown";
    if (phase === "runtime") {
      if (!runtimeNegativeKinds.has(metadata.negative.type)) {
        return `negative runtime ${metadata.negative.type || "unknown"} type`;
      }
    } else if (phase !== "parse" && phase !== "early") {
      return `negative ${phase} phase`;
    } else if (metadata.negative.type !== "SyntaxError") {
      return `negative ${phase} ${metadata.negative.type || "unknown"} type`;
    }
  }
  if (/\$262\b/.test(source)) return "$262 host object";
  return "";
}

function variants(metadata) {
  const flags = new Set(metadata.flags || []);
  if (flags.has("module")) return [{ name: "module", strict: false }];
  if (flags.has("raw") || flags.has("noStrict")) return [{ name: "default", strict: false }];
  if (flags.has("onlyStrict")) return [{ name: "strict", strict: true }];
  return [
    { name: "default", strict: false },
    { name: "strict", strict: true },
  ];
}

function scriptRecords(source, metadata, strict) {
  const flags = new Set(metadata.flags || []);
  if (flags.has("raw")) return [Buffer.from(source, "utf8")];
  const includes = (metadata.includes || []).map((include) =>
    readFileSync(join(root, "harness", include))
  );
  return [
    Buffer.from(assertion, "utf8"),
    Buffer.from(sta, "utf8"),
    ...includes,
    Buffer.from(`${strict ? '"use strict";\n' : ""}${source}`, "utf8"),
  ];
}

function writeScriptUnit(path, source, metadata, strict) {
  const records = scriptRecords(source, metadata, strict);
  writeFileSync(path, Buffer.concat(records));
  writeFileSync(`${path}.lengths`, `${records.map((record) => record.length).join("\n")}\n`);
}

function assemblePreExecutionNegative(source, strict) {
  return strict ? `"use strict";\n${source}` : source;
}

let files = [];
for (const path of paths) collect(path, files);
if (es5Only) {
  files = files.filter((path) => /(?:^|\n)es5id:/.test(readFileSync(path, "utf8")));
}
if (start > 0) files.splice(0, start);
if (limit > 0) files.length = Math.min(files.length, limit);

console.error(
  "Test262 scope: synchronous script tests, runtime negatives for standard Error constructors, " +
    "and parser/static-semantics diagnosed parse and early negatives; modules, async completion, " +
    "negative resolution phases, complete ECMAScript early errors, " +
    "and full top-level Script semantics are not implemented.",
);
const totals = { passed: 0, failed: 0, refused: 0, skipped: 0 };
const categories = {};
const completed = new Set();
const resultKey = (result) => `${result.path}\0${result.variant}`;
function categoryFor(status, detail = "") {
  const requestSignal = detail.match(/^native-harness: request child signal (\d+)$/);
  if (requestSignal) {
    const names = { 6: "SIGABRT", 10: "SIGBUS", 11: "SIGSEGV" };
    return names[Number(requestSignal[1])] || `SIGNAL-${requestSignal[1]}`;
  }
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
  if (!quiet) {
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
    work.push({ index, path, source, metadata, variant,
      preExecutionNegative: metadata.negative?.phase === "parse" ||
        metadata.negative?.phase === "early",
      preExecutionModule: new Set(metadata.flags || []).has("module"),
      runtimeNegativeKind: metadata.negative?.phase === "runtime"
        ? runtimeNegativeKinds.get(metadata.negative.type) : 0 });
  }
}

function runNative(assembled, count = 0, requestPrefix = null) {
  return new Promise((resolveRun) => {
    const spawnStartedNs = process.hrtime.bigint();
    const detached = process.platform !== "win32";
    const command = process.platform === "linux" ? "prlimit" : native;
    const nativeArgs = [...(profile ? ["--profile"] : []),
      ...(useSeedArtifact && requestPrefix !== "!" && requestPrefix !== "^"
        ? ["--seed", seedArtifact] : []),
      ...(requestPrefix === null
        ? [assembled, ...(count > 0 ? [String(count)] : [])]
        : ["--request", `${requestPrefix}${assembled}`])];
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
      current.length >= nativeOutputLimit
        ? current
        : (current + chunk.toString()).slice(0, nativeOutputLimit);
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

function batchExecutionDiagnostic(stderr, index) {
  const marker = `AOTK_BATCH_EXEC index=${index}\n`;
  const at = stderr.indexOf(marker);
  if (at < 0) return "";
  const tail = stderr.slice(at + marker.length);
  const next = tail.indexOf("AOTK_BATCH_EXEC index=");
  return nativeDiagnostic(next < 0 ? tail : tail.slice(0, next));
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
  if (!diagnostic) return { detail: `RUNTIME-FAILED ${codeText}` };
  const shown = (type, value) => value === undefined ? type : `${type}(${value})`;
  return { detail: `runtime ${diagnostic.failureKind} at assertion #${diagnostic.assertionSite}: ` +
      `actual=${shown(diagnostic.actualType, diagnostic.actualValue)} ` +
      `expected=${shown(diagnostic.expectedType, diagnostic.expectedValue)}`,
    diagnostic };
}

function finishOne(task, assembled, run, assemblyMs, durationMs, compileBatchSize = 1) {
  const { path, variant } = task;
  const timings = timingFields(run, assemblyMs, durationMs);
  rmSync(assembled, { force: true });
  rmSync(`${assembled}.lengths`, { force: true });
  for (const suffix of [".o", ".err", ""]) {
    rmSync(`/tmp/aotk-native-${run.pid}${suffix}`, { force: true });
  }
  if (run.status === 0 && run.stdout.trim().endsWith("PASS")) {
    report({ path, variant: variant.name, status: "passed", durationMs: Math.round(durationMs),
      compileBatchSize,
      ...(profile && run.stderr ? { stderr: run.stderr } : {}),
      ...timings });
  } else if (
    run.status === 2 && run.stdout.trim().endsWith("REFUSED")
  ) {
    const lines = run.stderr.trim().split("\n");
    const phaseDetail = nativeDiagnostic(run.stderr);
    const detail = phaseDetail ||
      lines.find((line) => line.startsWith("test262-native: frontend")) ||
      lines.find((line) => line.startsWith("frontend: unsupported")) || lines.at(-1);
    report({ path, variant: variant.name, status: "refused", detail, compileBatchSize,
      ...(profile && run.stderr ? { stderr: run.stderr } : {}),
      durationMs: Math.round(durationMs), ...timings });
    if (run.stderr && verbose) process.stderr.write(run.stderr);
  } else {
    const stderrLines = run.stderr.trim().split("\n");
    const runtimeCode = run.stdout.trim().match(/RUNTIME-FAILED\s+(-?\d+)$/)?.[1];
    const runtime = runtimeCode === undefined ? null : runtimeFailure(runtimeCode);
    const detail = run.signal === "TIMEOUT" ? "TIMEOUT" :
      stderrLines.find((line) => line.startsWith("graph corruption:")) ||
        runtimeThrowDiagnostic(run.stderr) || nativeDiagnostic(run.stderr) || run.signal ||
        runtime?.detail || run.stdout.trim() || `exit ${run.status}`;
    report({ path, variant: variant.name, status: "failed", detail, compileBatchSize,
      ...(runtime?.diagnostic ? { diagnostic: runtime.diagnostic } : {}),
      ...(profile && run.stderr ? { stderr: run.stderr } : {}),
      durationMs: Math.round(durationMs), ...timings });
    if (run.stderr && verbose) process.stderr.write(run.stderr);
  }
}

function nativeServer() {
  let child = null;
  let current = null;
  let stderr = "";
  let stdout = "";
  let stdoutBuffer = "";
  let stderrBuffer = "";
  let monitor = null;
  const appendOutput = (currentOutput, chunk) =>
    currentOutput.length >= nativeOutputLimit
      ? currentOutput
      : (currentOutput + chunk.toString()).slice(0, nativeOutputLimit);

  const stopMonitor = () => {
    if (monitor) clearInterval(monitor);
    monitor = null;
  };
  const maybeSettle = () => {
    if (!current || current.markerStatus === undefined || !current.stdoutComplete) return;
    settle(current.markerStatus, null);
  };
  const settle = (status, signal) => {
    if (!current) return;
    const request = current;
    current = null;
    clearTimeout(request.timer);
    // CASE_END is written after the ordinary PASS/REFUSED/etc line on the same stdout stream.
    const cleanStdout = stdout.replace(/^AOTK_CASE_END .*$/gm, "").trimEnd();
    const run = { pid: child?.pid, status, signal: request.forcedSignal || signal,
      stdout: cleanStdout, stderr,
      spawnStartedNs: request.startedNs, readyReceivedNs: request.readyReceivedNs,
      peakRssKb: request.peakRssKb };
    stdout = "";
    stderr = "";
    stderrBuffer = "";
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
    stderrBuffer = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      stdoutBuffer += text;
      let newline;
      while ((newline = stdoutBuffer.indexOf("\n")) >= 0) {
        const line = stdoutBuffer.slice(0, newline);
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (/^(?:PASS|REFUSED|LINK-FAILED|RUNTIME-FAILED(?: -?\d+)?)$/.test(line)) {
          current.stdoutComplete = true;
        } else if (/^BATCH \d+ (?:PASS|REFUSED|RUNTIME-FAILED(?: -?\d+)?)$/.test(line)) {
          current.stdoutResults++;
          if (current.stdoutResults >= current.expectedResults) current.stdoutComplete = true;
        } else if (/^BATCH-(?:COMPILE|LINK)-FAILED$/.test(line)) {
          current.stdoutComplete = true;
        }
        maybeSettle();
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr = appendOutput(stderr, text);
      stderrBuffer += text;
      if (current && current.readyReceivedNs === undefined && stderr.includes("AOTK_READY")) {
        current.readyReceivedNs = process.hrtime.bigint();
      }
      let newline;
      while ((newline = stderrBuffer.indexOf("\n")) >= 0) {
        const line = stderrBuffer.slice(0, newline);
        stderrBuffer = stderrBuffer.slice(newline + 1);
        const end = line.match(/^AOTK_CASE_END index=\d+ status=(\d+)$/);
        if (end && current) {
          current.markerStatus = Number(end[1]);
          maybeSettle();
        }
        const requestChild = line.match(/^AOTK_REQUEST_CHILD pid=(\d+)$/);
        if (requestChild && current) current.requestPid = Number(requestChild[1]);
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
  const request = (line, expectedResults) => new Promise((resolveRun) => {
    if (!child) start();
    const startedNs = process.hrtime.bigint();
    current = { resolve: resolveRun, startedNs, peakRssKb: 0, timer: null, requestPid: null,
      expectedResults, stdoutResults: 0, stdoutComplete: false, markerStatus: undefined };
    current.timer = setTimeout(() => {
      if (!child) return;
      current.forcedSignal = "TIMEOUT";
      try {
        if (process.platform !== "win32" && current.requestPid)
          process.kill(-current.requestPid, "SIGKILL");
        else if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }, timeoutMs);
    child.stdin.write(`${line}\n`);
  });
  const run = (assembled, preExecutionNegative = false, multiScript = false,
    runtimeNegativeKind = 0, preExecutionModule = false) => {
    const prefix = runtimeNegativeKind ? `?${runtimeNegativeKind}:` :
      preExecutionNegative ? (preExecutionModule ? "^" : "!") : multiScript ? "@" : "";
    return request(`${prefix}${assembled}`, 1);
  };
  const runBatch = (manifest, count) => request(`#${manifest}`, count);
  const close = () => {
    if (child) child.stdin.end();
    stopMonitor();
  };
  return { run, runBatch, close };
}

async function runServerOne(server, task) {
  const { index, path, source, metadata, variant } = task;
  const assembled = join(temporary, `${index}-${variant.name}-${basename(path)}`);
  const assemblyStarted = performance.now();
  try {
    if (task.preExecutionNegative) {
      writeFileSync(assembled, assemblePreExecutionNegative(source, variant.strict));
    } else {
      writeScriptUnit(assembled, source, metadata, variant.strict);
    }
  } catch (error) {
    rmSync(assembled, { force: true });
    rmSync(`${assembled}.lengths`, { force: true });
    const missingInclude = error?.code === "ENOENT" && String(error.path || "").includes("/harness/");
    report({ path, variant: variant.name, status: "failed",
      category: missingInclude ? "harness-missing-include" : "source-assembly-failure",
      detail: missingInclude
        ? `missing Test262 harness include: ${basename(error.path)}`
        : `source assembly failed: ${error.message}`,
      durationMs: Math.round(performance.now() - assemblyStarted) });
    return;
  }
  const assemblyMs = performance.now() - assemblyStarted;
  const started = performance.now();
  const run = await server.run(assembled, task.preExecutionNegative, !task.preExecutionNegative,
    task.runtimeNegativeKind || 0, task.preExecutionModule);
  const durationMs = performance.now() - started;
  finishOne(task, assembled, run, assemblyMs, durationMs);
}

const oneShotCompiler = {
  run(assembled, preExecutionNegative = false, multiScript = false,
    runtimeNegativeKind = 0, preExecutionModule = false) {
    const prefix = runtimeNegativeKind ? `?${runtimeNegativeKind}:` :
      preExecutionNegative ? (preExecutionModule ? "^" : "!") : multiScript ? "@" : "";
    return runNative(assembled, 0, prefix);
  },
  runBatch(manifest) {
    return runNative(manifest, 0, "#");
  },
};

function batchStderr(stderr, index) {
  const first = stderr.indexOf("AOTK_BATCH_EXEC index=");
  const compile = first < 0 ? stderr : stderr.slice(0, first);
  const marker = `AOTK_BATCH_EXEC index=${index}\n`;
  const at = stderr.indexOf(marker);
  if (at < 0) return compile;
  const tail = stderr.slice(at + marker.length);
  const next = tail.indexOf("AOTK_BATCH_EXEC index=");
  return compile + marker + (next < 0 ? tail : tail.slice(0, next));
}

async function runServerBatch(server, tasks) {
  const retrySingletonsInFreshWorker = async () => {
    for (const task of tasks) await runServerOne(oneShotCompiler, task);
  };
  if (tasks.length === 1) {
    await runServerOne(server, tasks[0]);
    return;
  }
  const assembledUnits = [];
  const assemblyTimes = [];
  for (const task of tasks) {
    const assembled = join(temporary, `${task.index}-${task.variant.name}-${basename(task.path)}`);
    const started = performance.now();
    try {
      writeScriptUnit(assembled, task.source, task.metadata, task.variant.strict);
    } catch (error) {
      for (const prior of assembledUnits) {
        rmSync(prior, { force: true });
        rmSync(`${prior}.lengths`, { force: true });
      }
      await retrySingletonsInFreshWorker();
      return;
    }
    assembledUnits.push(assembled);
    assemblyTimes.push(performance.now() - started);
  }
  const manifest = join(temporary, `batch-${tasks[0].index}-${tasks.length}.manifest`);
  writeFileSync(manifest, tasks.map((task, index) =>
    `${task.runtimeNegativeKind || 0}\t${assembledUnits[index]}\n`).join(""));
  const started = performance.now();
  const run = await server.runBatch(manifest, tasks.length);
  const durationMs = performance.now() - started;
  rmSync(manifest, { force: true });
  if (run.stdout.includes("BATCH-COMPILE-FAILED") ||
      run.stdout.includes("BATCH-LINK-FAILED")) {
    for (const assembled of assembledUnits) {
      rmSync(assembled, { force: true });
      rmSync(`${assembled}.lengths`, { force: true });
    }
    await retrySingletonsInFreshWorker();
    return;
  }
  const outcomes = new Map();
  for (const line of run.stdout.trim().split("\n")) {
    const match = line.match(/^BATCH (\d+) (PASS|REFUSED|RUNTIME-FAILED(?: -?\d+)?)$/);
    if (match) outcomes.set(Number(match[1]), match[2]);
  }
  // A compiler/server failure is a batch failure, not a JavaScript result for every member.
  // Runtime crashes are confined to children and still produce one BATCH row, so an incomplete
  // outcome set unambiguously means attribution requires singleton retries.
  if (run.signal || outcomes.size !== tasks.length) {
    for (const assembled of assembledUnits) {
      rmSync(assembled, { force: true });
      rmSync(`${assembled}.lengths`, { force: true });
    }
    await retrySingletonsInFreshWorker();
    return;
  }
  for (let index = 0; index < tasks.length; index++) {
    const outcome = outcomes.get(index);
    const itemRun = { ...run,
        status: outcome === "PASS" ? 0 : outcome === "REFUSED" ? 2 : 1,
      signal: outcome ? null : (run.signal || "MISSING-BATCH-RESULT"),
      stdout: outcome || "",
      stderr: batchStderr(run.stderr, index) };
    finishOne(tasks[index], assembledUnits[index], itemRun, assemblyTimes[index],
      durationMs / tasks.length, tasks.length);
  }
}

const expectedCompleted = completed.size + work.length;
const progressStarted = performance.now();
const progressInitial = completed.size;
const progressTimer = quiet ? setInterval(() => {
  const elapsedSeconds = (performance.now() - progressStarted) / 1000;
  const finished = completed.size - progressInitial;
  const remaining = expectedCompleted - completed.size;
  const rate = finished / Math.max(elapsedSeconds, 0.001);
  const etaSeconds = rate > 0 ? remaining / rate : 0;
  console.error(
    `test262 progress: ${completed.size}/${expectedCompleted} ` +
      `(${(completed.size * 100 / expectedCompleted).toFixed(1)}%) ` +
      `elapsed=${elapsedSeconds.toFixed(0)}s rate=${rate.toFixed(1)}/s ` +
      `eta=${etaSeconds.toFixed(0)}s`,
  );
}, 60000) : null;
if (progressTimer) progressTimer.unref();
const negativeUnits = work.filter((task) => task.preExecutionNegative).map((task) => [task]);
// Every Script compilation begins in a freshly exec'd process. A long-lived compiler retains
// mutable compiler and TypeScript runtime state, and both same-process restoration and a
// post-seed fork supervisor failed broad equivalence. Keep the clean process boundary.
const positiveTasks = work.filter((task) => !task.preExecutionNegative);
const positiveUnits = [];
for (let index = 0; index < positiveTasks.length; index += batchSize) {
  positiveUnits.push(positiveTasks.slice(index, index + batchSize));
}

async function runUnits(units) {
  let next = 0;
  async function worker() {
    while (next < units.length) {
      const unit = units[next++];
      if (unit.length === 1) await runServerOne(oneShotCompiler, unit[0]);
      else await runServerBatch(oneShotCompiler, unit);
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, units.length) }, worker));
}

// Pre-execution-negative mode covers Test262 parse and early SyntaxError phases: both must reject
// before execution. Keep it in an explicit phase so completion policy cannot leak into positives.
await runUnits(negativeUnits);
await runUnits(positiveUnits);
if (progressTimer) clearInterval(progressTimer);

if (completed.size !== expectedCompleted) {
  throw new Error(
    `test262 accounting mismatch: expected ${expectedCompleted} results, recorded ${completed.size}`,
  );
}

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
