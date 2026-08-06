#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const corpus = path.join(root, "benchmarks/v8-v7");
const mode = process.argv[2] ?? "--verify";
if (!new Set(["--verify", "--update"]).has(mode)) throw new Error("usage: node tools/v8-inventory.mjs [--verify|--update]");
const manifest = JSON.parse(fs.readFileSync(path.join(corpus, "manifest.json"), "utf8"));
const native = JSON.parse(execFileSync(process.execPath, [path.join(root, "tools/v8-native-probe.mjs")], { encoding:"utf8", maxBuffer:32 * 1024 * 1024 }));

const categoryKinds = {
  syntax: ["KindFunctionExpression", "KindConditionalExpression", "KindDoStatement", "KindSwitchStatement", "KindBreakStatement", "KindContinueStatement"],
  objectBehavior: ["KindPropertyAccessExpression", "KindElementAccessExpression", "KindObjectLiteralExpression", "KindThisKeyword", "KindInKeyword", "KindInstanceOfKeyword", "KindDeleteExpression"],
  allocation: ["KindNewExpression", "KindArrayLiteralExpression", "KindObjectLiteralExpression", "KindFunctionExpression"],
  exceptions: ["KindThrowStatement", "KindTryStatement", "KindCatchClause"],
  regexp: ["KindRegularExpressionLiteral"],
};
const operatorKinds = ["KindPercentToken", "KindAmpersandToken", "KindBarToken", "KindCaretToken", "KindLessThanLessThanToken", "KindGreaterThanGreaterThanToken", "KindGreaterThanGreaterThanGreaterThanToken", "KindPlusPlusToken", "KindMinusMinusToken", "KindAmpersandAmpersandToken", "KindBarBarToken", "KindQuestionToken", "KindCommaToken"];

function count(kinds, names) { return Object.fromEntries(names.filter(name => kinds[name]).map(name => [name, kinds[name]])); }
function analyze(entry, parsed) {
  const source = fs.readFileSync(path.join(corpus, entry.file), "utf8");
  const ast = ts.createSourceFile(entry.file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const builtins = new Map();
  const mathMembers = new Map();
  const globalBuiltinCalls = new Map();
  const stringLiterals = new Map();
  const stringCalls = new Map();
  let fractionalNumericLiterals = 0;
  let mixedLiteralAdds = 0;
  function visit(node) {
    if (ts.isNumericLiteral(node) && /[.eE]/.test(node.getText(ast))) fractionalNumericLiterals++;
    if (ts.isStringLiteral(node)) stringLiterals.set(node.text, (stringLiterals.get(node.text) ?? 0) + 1);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        (ts.isStringLiteral(node.left) || ts.isStringLiteral(node.right))) mixedLiteralAdds++;
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(ast) === "Math") {
      const member = `Math.${node.name.text}`;
      mathMembers.set(member, (mathMembers.get(member) ?? 0) + 1);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(ast);
      if (/^(Math\.|parseInt$|isNaN$|String$|String\.fromCharCode$|RegExp$)/.test(callee) || /\.(push|pop|slice|split|substring|substr|charAt|charCodeAt|indexOf|toLowerCase|toUpperCase|toString|match|replace|exec|test)$/.test(callee)) {
        builtins.set(callee, (builtins.get(callee) ?? 0) + 1);
      }
      if (/^(parseInt|isNaN|String|String\.fromCharCode)$/.test(callee))
        globalBuiltinCalls.set(callee, (globalBuiltinCalls.get(callee) ?? 0) + 1);
      if (/^(parseInt|isNaN|String|String\.fromCharCode)$/.test(callee) ||
          /\.(slice|split|substring|substr|charAt|charCodeAt|indexOf|toLowerCase|toUpperCase|toString)$/.test(callee))
        stringCalls.set(callee, (stringCalls.get(callee) ?? 0) + 1);
    }
    if (ts.isNewExpression(node) && node.expression.getText(ast) === "String") {
      stringCalls.set("new String", (stringCalls.get("new String") ?? 0) + 1);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return {
    benchmark: entry.name,
    file: entry.file,
    lines: source.split(/\r?\n/).length,
    nativeNodeCount: parsed.nodeCount,
    nativeDiagnostics: parsed.diagnostics,
    firstUnsupported: parsed.firstUnsupported,
    syntax: count(parsed.kinds, categoryKinds.syntax),
    operators: count(parsed.kinds, operatorKinds),
    builtinCalls: Object.fromEntries([...builtins].sort(([a],[b]) => a.localeCompare(b))),
    builtinSurface: {
      mathMembers: Object.fromEntries([...mathMembers].sort(([a],[b]) => a.localeCompare(b))),
      globalCalls: Object.fromEntries([...globalBuiltinCalls].sort(([a],[b]) => a.localeCompare(b))),
    },
    stringSurface: {
      literalCount: [...stringLiterals.values()].reduce((a, b) => a + b, 0),
      distinctLiteralCount: stringLiterals.size,
      literals: Object.fromEntries([...stringLiterals].sort(([a], [b]) => a.localeCompare(b))),
      calls: Object.fromEntries([...stringCalls].sort(([a], [b]) => a.localeCompare(b))),
      mixedLiteralAdds,
    },
    objectBehavior: count(parsed.kinds, categoryKinds.objectBehavior),
    numericRepresentation: { numericLiterals: parsed.kinds.KindNumericLiteral ?? 0, fractionalNumericLiterals },
    allocation: count(parsed.kinds, categoryKinds.allocation),
    exceptions: count(parsed.kinds, categoryKinds.exceptions),
    regexp: count(parsed.kinds, categoryKinds.regexp),
  };
}

const results = manifest.benchmarks.map((entry, index) => analyze(entry, native.results[index]));
const inventory = {
  schemaVersion: 1,
  upstreamCommit: manifest.upstream.commit,
  nativeParserCommit: native.parserCommit,
  generatedBy: "tools/v8-inventory.mjs",
  matrices: {
    quick: "one unchanged canonical workload invocation per benchmark check",
    extended: "upstream BenchmarkSuite timing and repetition policy",
  },
  witnessDirectory: "tests/v8-witnesses",
  results,
};
const json = `${JSON.stringify(inventory, null, 2)}\n`;
const md = `# V8 Benchmark Suite v7 capability gap\n\n` +
  `Generated by \`tools/v8-inventory.mjs\` from the pinned corpus and native Microsoft typescript-go parser. Do not edit by hand.\n\n` +
  `| Benchmark | Nodes | Native diagnostics | First unsupported capability | Kind | Range |\n|---|---:|---:|---|---|---:|\n` +
  results.map(r => `| ${r.benchmark} | ${r.nativeNodeCount} | ${r.nativeDiagnostics.length} | \`${r.firstUnsupported.code}\` | \`${r.firstUnsupported.kind}\` | ${r.firstUnsupported.start}..${r.firstUnsupported.end} |`).join("\n") +
  `\n\nThe JSON inventory at \`benchmarks/v8-v7/capabilities.json\` is authoritative and includes per-benchmark syntax, operator, builtin, object, number, allocation, exception, RegExp, and exact string-surface inventories. Builtin evidence records every direct global call and every Math member reference, including aliases and constants; string evidence records every literal value and count, every corpus string/conversion call spelling, and mixed literal concatenations. EarleyBoyer's legacy escape diagnostics are retained as baseline data; any diagnostic change fails B00. Reduced, benchmark-independent witnesses live in \`tests/v8-witnesses/\`.\n`;

const outputs = [[path.join(corpus, "capabilities.json"), json], [path.join(root, "docs/V8-BENCHMARK-GAP.md"), md]];
let mismatch = false;
for (const [file, content] of outputs) {
  if (mode === "--update") fs.writeFileSync(file, content);
  else if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) { console.error(`${path.relative(root, file)} is stale; run --update`); mismatch = true; }
}
if (mismatch) process.exitCode = 1;
else console.log(`${mode === "--update" ? "updated" : "verified"} capability inventory for ${results.length} benchmarks`);
