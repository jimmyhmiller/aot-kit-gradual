import fs from "node:fs";

const input = process.argv[2] ?? "test262-results-observed-full-2026-08-24.jsonl";
const output = process.argv[3] ?? "test262-full-breakdown-2026-08-24.json";
const rows = fs.readFileSync(input, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const increment = (object, key) => object[key] = (object[key] ?? 0) + 1;
const sorted = object => Object.fromEntries(Object.entries(object).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
const relativePath = path => {
  const marker = "/test/";
  const index = path.indexOf(marker);
  return index < 0 ? path : path.slice(index + marker.length);
};
const area = path => relativePath(path).split("/")[0] || "(root)";
const prefix = (path, count) => relativePath(path).split("/").slice(0, count).join("/");

function properties(detail = "") {
  const result = {};
  for (const match of detail.matchAll(/property name=([^ ]+) value=0x[0-9a-f]+ decoded=(.*?)(?=;\s+property name=|$)/gi)) {
    let value = match[2];
    if (value.startsWith("string(") && value.endsWith(")")) value = value.slice(7, -1);
    result[match[1]] = value;
  }
  return result;
}

function reason(row) {
  const detail = row.detail ?? "";
  const category = row.category ?? "";
  if (row.status === "passed") return "passed";
  if (row.status === "skipped") return `skipped: ${detail || category || "unspecified"}`;
  if (detail.startsWith("uncaught JavaScript throw")) {
    const props = properties(detail);
    if (props.name) return `runtime throw: ${props.name}`;
    if (props.message) return "runtime throw: assertion/error object";
    return "runtime throw: opaque value";
  }
  if (detail === "RUNTIME-FAILED") return "runtime: nonzero exit without diagnostic";
  if (/^SIG[A-Z]+/.test(detail)) return `runtime: ${detail}`;
  if (/^TIMEOUT/.test(detail)) return "runtime: timeout";
  if (detail.startsWith("native-harness: selection")) return detail.includes("Region : ctrl") ? "compiler selection: control/Region fanout" : "compiler selection: other";
  if (detail.startsWith("native-harness: frontend")) {
    const match = detail.match(/^native-harness: frontend status=(\d+) code=(\d+)/);
    return `compiler frontend: ${match ? `status=${match[1]} code=${match[2]}` : "other"}`;
  }
  if (detail.startsWith("graph corruption:")) {
    if (detail.includes("folding did not converge")) return "compiler graph: folding did not converge";
    if (detail.includes("NO-NODE")) return "compiler graph: NO-NODE";
    return "compiler graph: other";
  }
  return `refused: ${category || detail.slice(0, 100) || row.status}`;
}

const report = {
  metadata: { input, totalRecords: rows.length, runTimingMs: { build: 7072, execution: 939302, total: 946374 }, executedVariants: 81927 },
  outcomes: {}, variants: {}, statusByArea: {}, failureReasons: {}, failureReasonsByArea: {},
  pathPrefix2Failures: {}, pathPrefix3Failures: {}, throwNames: {}, referenceErrorBindings: {},
  assertionMessages: {}, opaqueThrowPaths: {},
};

for (const row of rows) {
  increment(report.outcomes, row.status);
  increment(report.variants, row.variant ?? "(none)");
  const rowArea = area(row.path);
  report.statusByArea[rowArea] ??= {};
  increment(report.statusByArea[rowArea], row.status);
  if (row.status === "passed") continue;
  const rowReason = reason(row);
  increment(report.failureReasons, rowReason);
  report.failureReasonsByArea[rowArea] ??= {};
  increment(report.failureReasonsByArea[rowArea], rowReason);
  if (row.status !== "skipped") {
    increment(report.pathPrefix2Failures, prefix(row.path, 2));
    increment(report.pathPrefix3Failures, prefix(row.path, 3));
  }
  if ((row.detail ?? "").startsWith("uncaught JavaScript throw")) {
    const props = properties(row.detail);
    increment(report.throwNames, props.name ?? "(no name)");
    if (props.name === "ReferenceError") increment(report.referenceErrorBindings, props.message ?? "(no message)");
    else if (props.message) increment(report.assertionMessages, props.message);
    else increment(report.opaqueThrowPaths, prefix(row.path, 3));
  }
}

for (const key of ["outcomes", "variants", "failureReasons", "pathPrefix2Failures", "pathPrefix3Failures", "throwNames", "referenceErrorBindings", "assertionMessages", "opaqueThrowPaths"]) report[key] = sorted(report[key]);
for (const value of Object.values(report.statusByArea)) Object.assign(value, sorted(value));
for (const value of Object.values(report.failureReasonsByArea)) Object.assign(value, sorted(value));
report.statusByArea = Object.fromEntries(Object.entries(report.statusByArea).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0)));
report.failureReasonsByArea = Object.fromEntries(Object.entries(report.failureReasonsByArea).sort());
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outcomes: report.outcomes, statusByArea: report.statusByArea, failureReasons: report.failureReasons, throwNames: report.throwNames, topMissing: Object.entries(report.referenceErrorBindings).slice(0, 20), topPaths: Object.entries(report.pathPrefix3Failures).slice(0, 25) }, null, 2));
