#!/usr/bin/env node
import fs from "node:fs";

const [benchmark, input] = process.argv.slice(2);
const entries = {
  richards: { suite: "Richards", run: "runRichards" },
  deltablue: { suite: "DeltaBlue", run: "deltaBlue" },
};
if (!entries[benchmark] || !input) {
  console.error("usage: b15-adapt.mjs [richards|deltablue] INPUT.js");
  process.exit(2);
}

const {suite, run} = entries[benchmark];
let source = fs.readFileSync(input, "utf8");
const start = source.indexOf(`var ${suite} = new BenchmarkSuite`);
const finish = source.indexOf("]);", start);
if (start < 0 || finish < 0) throw new Error(`missing ${suite} registration`);
source = `${source.slice(0, start)}${source.slice(finish + 3)}`;
const mutation = process.env.AOT_B15_MUTATION ?? "";
if (mutation === "richards-queue") {
  if (benchmark !== "richards") throw new Error("Richards mutation requested for another benchmark");
  source = source.replace("var EXPECTED_QUEUE_COUNT = 2322;", "var EXPECTED_QUEUE_COUNT = 2323;");
} else if (mutation === "deltablue-projection") {
  if (benchmark !== "deltablue") throw new Error("DeltaBlue mutation requested for another benchmark");
  source = source.replace('dst.value != 1170', 'dst.value != 1171');
} else if (mutation !== "") {
  throw new Error(`unknown B15 mutation: ${mutation}`);
}

// A bounded Richards run is a diagnostic oracle for the scheduler's first divergent transition.
// It deliberately preserves the original task implementations and dispatch paths.
const richardsSteps = Number(process.env.AOT_B15_RICHARDS_STEPS ?? -1);
const richardsExpected = Number(process.env.AOT_B15_RICHARDS_EXPECT ?? -1);
if (!Number.isSafeInteger(richardsSteps) || richardsSteps < -1)
  throw new Error("AOT_B15_RICHARDS_STEPS must be -1 or a non-negative integer");
if (benchmark === "richards" && richardsSteps >= 0) {
  const expectedQueue = Math.floor(richardsExpected / 10000);
  const expectedHold = Math.floor(richardsExpected / 100) % 100;
  const expectedCurrentId = Math.floor(richardsExpected / 10) % 10;
  const expectedCurrentTcbId = richardsExpected % 10;
  // The packed oracle coerces null to zero. The first three transitions only skip suspended
  // device/handler TCBs, so `currentId` remains the constructor's null until step three runs a task.
  const expectedCurrentIdLiteral = richardsSteps < 3 ? "null" : String(expectedCurrentId);
  const currentTcbCheck = expectedCurrentTcbId === 9
    ? "scheduler.currentTcb != null"
    : `scheduler.currentTcb.id != ${expectedCurrentTcbId}`;
  const setupChecks = [
    ["scheduler.addIdleTask(ID_IDLE, 0, null, COUNT);", 0],
    ["scheduler.addWorkerTask(ID_WORKER, 1000, queue);", 1],
    ["scheduler.addHandlerTask(ID_HANDLER_A, 2000, queue);", 2],
    ["scheduler.addHandlerTask(ID_HANDLER_B, 3000, queue);", 3],
    ["scheduler.addDeviceTask(ID_DEVICE_A, 4000, null);", 4],
    ["scheduler.addDeviceTask(ID_DEVICE_B, 5000, null);", 5],
  ];
  for (const [statement, expected] of setupChecks)
    source = source.replace(statement,
      `${statement}\n  if (scheduler.list.id != ${expected}) throw new Error("Richards setup ${expected}: " + scheduler.list.id);`);
  source = source.replace(
    "Scheduler.prototype.schedule = function () {\n  this.currentTcb = this.list;",
    `Scheduler.prototype.schedule = function () {\n  var diagnosticSteps = ${richardsSteps};\n  this.currentTcb = this.list;`);
  source = source.replace("while (this.currentTcb != null) {",
                          "while (this.currentTcb != null) {\n    if (diagnosticSteps == 0) break;\n    diagnosticSteps--;");
  source = source.replace(
    "  if (scheduler.queueCount != EXPECTED_QUEUE_COUNT ||",
    `  var diagnosticResult = (((scheduler.queueCount * 1000 + scheduler.holdCount) * 10 + scheduler.currentId) * 10 + (scheduler.currentTcb == null ? 9 : scheduler.currentTcb.id)) | 0;
  ${richardsExpected >= 0 ? `if (scheduler.queueCount != ${expectedQueue}) throw new Error("Richards diagnostic queue: " + diagnosticResult);
  if (scheduler.holdCount != ${expectedHold}) throw new Error("Richards diagnostic hold: " + diagnosticResult);
  if (scheduler.currentId != ${expectedCurrentIdLiteral}) throw new Error("Richards diagnostic currentId: " + diagnosticResult);
  if (${currentTcbCheck}) throw new Error("Richards diagnostic currentTcb: " + diagnosticResult);` : ""}
  return diagnosticResult;

  if (scheduler.queueCount != EXPECTED_QUEUE_COUNT ||`);
}

// The upstream shell supplies these two services. The adapter preserves failure semantics while
// excluding timing/registration machinery from a correctness kernel.
const alertAdapter = benchmark === "deltablue"
  ? "function alert(message) { throw new Error(message); }\n"
  : "";
const diagnosticResult = benchmark === "richards" && richardsSteps >= 0;
const nodeInvocation = process.env.AOT_B15_NODE_RUN === "1"
  ? diagnosticResult ? "console.log(`result=${main()}`);\n" : "main();\n"
  : "";
process.stdout.write(`${alertAdapter}${source}\nfunction main() { ${diagnosticResult ? `return ${run}();` : `${run}(); return 0;`} }\n${nodeInvocation}`);
