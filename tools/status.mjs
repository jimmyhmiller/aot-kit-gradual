#!/usr/bin/env node
// Generate docs/STATUS.md — the checklist of what this compiler supports, and for the parts it
// supports, whether the code that runs comes from lib/ or from hand-written IR.
//
// IT IS GENERATED, AND THE GATE CHECKS IT, because the last hand-maintained version of this went
// stale and stayed stale: docs/CONVERSION.md claimed "all of String.prototype except split" while
// twelve methods sat in lib/ that no program could name. A checklist nobody can trust is worse than
// no checklist, so the supported half is READ OUT OF THE SOURCE and the claims are verified:
//
//   * the recognised method names come from the frontend's own tables, not from this file
//   * every JSL definition named below must exist in lib/ and be referenced from src/
//   * every recognised operation must be accounted for here, or this tool fails
//
// `node tools/status.mjs` rewrites docs/STATUS.md; `--check` fails if it would change.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const stripComments = text => text.split("\n").map(l => l.replace(/;;.*$/, "")).join("\n");

const graph = stripComments(read("src/frontend_native_graph.coil"));
const frontend = stripComments(read("src/frontend_native.coil"));
const descriptors = stripComments(read("src/jsbuiltin_desc.coil"));
const srcAll = fs.readdirSync(path.join(root, "src"))
  .filter(f => f.endsWith(".coil")).map(f => stripComments(read(`src/${f}`))).join("\n");

const libFiles = fs.readdirSync(path.join(root, "lib"), {recursive: true})
  .filter(f => f.endsWith(".jsl"));
const libText = libFiles.map(f => read(path.join("lib", f))).join("\n");
const declared = new Set([...libText.matchAll(/\((?:builtin|macro)\s+([A-Za-z0-9.]+)/g)].map(m => m[1]));

// --- what the frontend actually recognises, read out of its own tables ----------------------
const between = (text, start, end) => {
  const from = text.indexOf(start);
  assert.ok(from >= 0, `status.mjs: could not find ${start}`);
  const to = text.indexOf(end, from);
  assert.ok(to >= 0, `status.mjs: could not find ${end} after ${start}`);
  return text.slice(from, to);
};
const quoted = text => [...text.matchAll(/"([^"]+)"/g)].map(m => m[1]);

const stringMethods = quoted(between(graph, "(defn fng-string-builtin-arity?", ":else false"));
const arrayMethods = quoted(between(graph, "(defn fng-array-builtin?", "\n\n"));
const mathMembers = quoted(between(descriptors, "(defn jbi-name", "\"<unknown>\""))
  .filter(n => n.startsWith("Math.")).map(n => n.slice(5));
const intrinsics = quoted(between(frontend, "(defn fe-intrinsic-name", ":else -1"));

// --- the claims, verified against the two sources above -------------------------------------
// `jsl` names the definition the frontend emits. `null` means the frontend still builds the IR
// itself, with the reason. Anything recognised and missing from here fails the run.
const STRING = {
  charAt: "StringCharAt", charCodeAt: "StringCharCodeAt", codePointAt: "StringCodePointAt",
  indexOf: "StringIndexOfFrom",
  slice: "StringSlice", substring: "StringSubstring", substr: "StringSubstr",
  toLowerCase: "StringToLowerCase", toUpperCase: "StringToUpperCase",
  split: "StringSplit", startsWith: "StringStartsWith", endsWith: "StringEndsWith",
  includes: "StringIncludesFrom", lastIndexOf: "StringLastIndexOf",
  padStart: "StringPadStart", padEnd: "StringPadEnd", repeat: "StringRepeatCount",
  replaceAll: "StringReplaceAll", trim: "StringTrim", trimStart: "StringTrimStart",
  trimEnd: "StringTrimEnd", at: "StringAt",
};
const ARRAY = {
  push: "ArrayPush1", pop: "ArrayPop", shift: "ArrayShift", slice: "ArraySlice",
  indexOf: "ArrayIndexOfFrom", includes: "ArrayIncludes", lastIndexOf: "ArrayLastIndexOf",
  at: "ArrayAt", join: "ArrayJoin",
  map: "ArrayMap", filter: "ArrayFilter", forEach: "ArrayForEach",
  reduce: "ArrayReduce", reduceRight: "ArrayReduceRight", find: "ArrayFind",
  findIndex: "ArrayFindIndex", some: "ArraySome", every: "ArrayEvery",
  sort: "ArraySort", flatMap: "ArrayFlatMap", fill: "ArrayFill",
  reverse: "ArrayReverse", unshift: "ArrayUnshift1", splice: "ArraySpliceDelete",
  concat: "ArrayConcatValue", flat: "ArrayFlat",
};
const MATH = {
  abs: "MathAbs", floor: "MathFloor", ceil: "MathCeil", round: "MathRound",
  max: "MathMax2", min: "MathMin2", sign: "MathSign", trunc: "MathTrunc",
  sqrt: null, pow: null, exp: null, log: null, sin: null, cos: null, tan: null,
  asin: null, acos: null, atan: null, random: null,
};
const LIBM_NOTE = "The hand-written rows are libm calls and a PRNG, not JavaScript semantics: there is no\nalgorithm for a DSL to express. `MathFloor` earns its place because the library adds the\n`if (%IsInt v)` guard around `%FloorNum`; `sqrt` would get no guard and no rule, only a different\nspelling of the same call. **These are not a backlog.**";

// Operations that are not a method on a receiver.
const OTHER = [
  ["`String(x)`", "ToStringValue"],
  ["`parseInt(s, radix)`", "ParseIntValue"],
  ["`isNaN(x)`", "GlobalIsNaN"],
  ["`String.fromCharCode(c)`", "StringFromCharCode"],
  ["`Number(x)`", "ToNumberValue"],
  ["`Number.isNaN`", "NumberIsNaN"],
  ["`Number.isFinite`", "NumberIsFinite"],
  ["`Number.isInteger`", "NumberIsInteger"],
  ["`Number.isSafeInteger`", "NumberIsSafeInteger"],
  ["ToNumber at an arithmetic operand", "ToNumberValue"],
  ["implicit ToString at `+`", "ToStringValue"],
  ["string `===` / `!==`", "StringEquals"],
  ["string `<` `>` `<=` `>=`", "StringCompare"],
  ["string `+`", "StringConcat"],
  ["`s.length`", "StringLength"],
  ["`a.length`", "ArrayLength"],
  ["`Array.of(...)`", "ArrayOfAppend1"],
  ["`Array.isArray(x)`", "IsArray"],
  ["`Array.from(iterable)`", "ArrayFrom"],
  ["`Infinity`", "Infinity"],
  ["`Number.MAX_SAFE_INTEGER`", "MaxSafeInteger"],
  ["`parseFloat(x)`", "ParseFloatValue"],
  ["`Number.parseFloat(x)`", "ParseFloatValue"],
  ["`void x`", "VoidValue"],
  ["`typeof x`", "TypeOfValue"],
  ["`x ?? y`", "IsNullishValue"],
  ["`o?.p`", "IsNullishValue"],
  ["`o?.[i]`", "IsNullishValue"],
];

// Not supported by the frontend at all: the call or the syntax does not compile. Grouped by what
// each would take, because that is the only useful thing to know about an item on this list.
const UNSUPPORTED = {
  "Needs the allocating-definition shape `split` now has": [
    "`Array.prototype.keys`/`values`/`entries`",
  ],
  "Needs a regular-expression engine": [
    "regex literals", "`String.prototype.match`", "`String.prototype.matchAll`",
    "`String.prototype.search`", "`String.prototype.replace`", "`RegExp`",
  ],
  "Needs a frontend intrinsic, like the one `Number` just got": [
    "`Object.keys`/`values`/`entries`", "`Object.assign`", "`Object.freeze`",
    "`JSON.parse`/`stringify`", "`String.prototype.normalize`",
    "`String.prototype.localeCompare`", "`String.raw`",
  ],
  "Needs new syntax in the frontend": [
    "tagged template literals", "destructuring", "spread and rest",
    "`for...of` / `for...in`", "`class`", "getters and setters", "computed property names",
    "optional calls through unknown present callables (needs call descriptors/adapters)", "`try`/`catch`/`finally`",
    "computed-key `in` and `delete`; dynamic-RHS/custom-`Symbol.hasInstance` `instanceof`",
  ],
  "Needs a runtime this compiler does not have": [
    "`Map` / `Set` / `WeakMap`", "`Promise` and `async`/`await`", "generators and iterators",
    "`Symbol`", "`BigInt`", "`Proxy` / `Reflect`", "`Date`", "modules (`import`/`export`)",
  ],
};

// --- verify the claims ----------------------------------------------------------------------
const problems = [];
const claim = (label, name) => {
  if (name === null) return;
  if (!declared.has(name)) problems.push(`${label}: claims ${name}, which lib/ does not declare`);
  else if (!srcAll.includes(`"${name}"`)) problems.push(`${label}: ${name} is never named in src/, so no program reaches it`);
};
for (const [name, jsl] of Object.entries(STRING)) claim(`String.prototype.${name}`, jsl);
for (const [name, jsl] of Object.entries(ARRAY)) claim(`Array.prototype.${name}`, jsl);
for (const [name, jsl] of Object.entries(MATH)) claim(`Math.${name}`, jsl);
for (const [label, jsl] of OTHER) claim(label, jsl);

const missing = (recognised, table, area) => {
  for (const name of recognised) {
    if (!(name in table)) problems.push(`${area}: the frontend recognises "${name}" and STATUS.md does not list it`);
  }
  for (const name of Object.keys(table)) {
    if (!recognised.includes(name)) problems.push(`${area}: STATUS.md lists "${name}" and the frontend does not recognise it`);
  }
};
missing(stringMethods, STRING, "String.prototype");
missing(arrayMethods, ARRAY, "Array.prototype");
missing(mathMembers, MATH, "Math");

// Every declaration in lib/ is either reachable from src/ or has to be named here as knowingly not.
const KNOWN_UNREACHED = new Set([
  "ArrayIota", "ArrayRepeat", "ArrayMapDouble",           // conformance fixtures, not operations
  "String.prototype.indexOf", "RequireObjectCoercible",   // spec-shaped entry the frontend bypasses
  "ToBoolean", "ToInt32", "ToUint32", "ToLength", "IsNumber", "ClampedIndex",
  "Infinity", "NegInfinity", "BoxedInf", "BoxedNegInf",
  "FltTrunc", "FltFloorFrom", "FltCeilFrom",
]);

// --- render -----------------------------------------------------------------------------------
const tick = jsl => jsl === null ? "hand-written" : "**done**";
const row = (op, jsl) => `| ${op} | ${tick(jsl)} | ${jsl ?? "—"} |`;
const out = [];
out.push("<!-- GENERATED by tools/status.mjs. Do not edit; run `node tools/status.mjs`. -->");
out.push("# Status: what compiles, and where the code comes from");
out.push("");
out.push("**done** means a program written in TypeScript compiles through a definition in `lib/`.");
out.push("**hand-written** means it compiles, but through IR the frontend builds itself.");
out.push("Everything under \"Not supported\" does not compile at all — the call or the syntax is refused.");
out.push("");
out.push("This file is generated and `tools/gate.sh` fails if it is out of date. The method names are");
out.push("read out of the frontend's own tables, and every definition named here is checked to exist in");
out.push("`lib/` and to be referenced from `src/`, so it cannot claim a conversion that is not wired up.");
out.push("");

const section = (title, entries, note) => {
  out.push(`## ${title}`);
  out.push("");
  out.push("| Operation | Status | Definition |");
  out.push("|---|---|---|");
  for (const [op, jsl] of entries) out.push(row(op, jsl));
  out.push("");
  if (note) { out.push(note); out.push(""); }
};

section("String.prototype", Object.entries(STRING)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([n, j]) => [`\`${n}\``, j]));
section("Array.prototype", Object.entries(ARRAY)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([n, j]) => [`\`${n}\``, j]));
section("Math", Object.entries(MATH)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([n, j]) => [`\`${n}\``, j]), LIBM_NOTE);
section("Globals, coercions and operators", OTHER.map(([op, j]) => [op, j]));

out.push("## Language surface that compiles");
out.push("");
out.push("Numbers and all 25 arithmetic, bitwise, comparison and logical operators including their");
out.push("compound-assignment forms; `if`, `for`, `while`, `do`, `switch`, labels, `break`, `continue`,");
out.push("ternaries, short-circuit operators and optional calls with known targets; function declarations, function expressions and block/expression-bodied arrows with lexical `this`, default parameters, closures with");
out.push("mutable capture, recursion, `this`, `new` and constructors; object literals, structural types,");
out.push("prototypes, dynamic and missing properties, named-key `in`, named-property `delete`, and ordinary `instanceof` with known constructors; array literals with holes, indexing and growth;");
out.push("string and template literals with interpolation and cooked escapes, concatenation; `throw`; type aliases, interfaces and union annotations.");
out.push("");
out.push("## Not supported");
out.push("");
for (const [reason, items] of Object.entries(UNSUPPORTED)) {
  out.push(`### ${reason}`);
  out.push("");
  for (const item of items) out.push(`- ${item}`);
  out.push("");
}

out.push("## Definitions in `lib/` that no program reaches");
out.push("");
out.push("Each one is deliberate; a new name appearing here is a bug, and this tool fails on one.");
out.push("");
for (const name of [...KNOWN_UNREACHED].sort()) {
  const reached = srcAll.includes(`"${name}"`);
  if (reached && !["Infinity"].includes(name)) continue;
  out.push(`- \`${name}\``);
}
out.push("");

for (const name of declared) {
  if (KNOWN_UNREACHED.has(name)) continue;
  const named = srcAll.includes(`"${name}"`);
  const calledInLib = new RegExp(`(?<![A-Za-z0-9.])${name.replace(/\./g, "\\.")}(?![A-Za-z0-9.])`)
    .test(libText.replace(new RegExp(`\\((?:builtin|macro)\\s+${name.replace(/\./g, "\\.")}`, "g"), ""));
  if (!named && !calledInLib) problems.push(`lib/: ${name} is reachable from nothing and is not listed as knowingly unreached`);
}

const rendered = `${out.join("\n")}\n`;
const target = path.join(root, "docs", "STATUS.md");

if (problems.length) {
  for (const p of problems) console.error(`status: ${p}`);
  process.exit(1);
}
if (process.argv.includes("--check")) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current !== rendered) {
    console.error("status: docs/STATUS.md is out of date — run `node tools/status.mjs`");
    process.exit(1);
  }
  const done = [...Object.values(STRING), ...Object.values(ARRAY), ...Object.values(MATH), ...OTHER.map(o => o[1])]
    .filter(Boolean).length;
  console.log(`STATUS.md current — ${done} operations from lib/, ${Object.values(UNSUPPORTED).flat().length} not supported`);
} else {
  fs.writeFileSync(target, rendered);
  console.log(`wrote docs/STATUS.md`);
}
