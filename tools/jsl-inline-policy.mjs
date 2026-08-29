#!/usr/bin/env node
// WHICH JSL DECLARATIONS ARE INLINED, AND WHY IT IS NOT A FREE CHOICE.
//
// A `macro` is expanded into its caller and brings its whole transitive macro closure with it. That
// made one `[1,2,3].join("-")` lower to 26,594 basic blocks and one 253-line Test262 file compile in
// 88 seconds against a 28.5 GB peak. A `builtin` is compiled once and called, so the same closure is
// one call node in the caller and one function in the retained seed.
//
// Torque draws this line at "a macro is a few nodes plus a name". This library had drifted to 406
// macros against 126 builtins, with 485-token algorithms and three-deep loops still declared macro.
//
// THREE RULES DECIDE ELIGIBILITY, and each is a real ABI limit rather than a preference:
//
//   * a `(rest ...)` parameter is a compile-away specification list and cannot cross a call;
//   * a `(slot-list)` parameter or return is compile-time only, for the same reason;
//   * a `(record ...)` in the signature at all, argument or return. A record RETURN cannot cross
//     the result-area ABI, which has a hidden result pointer and a flat result vector with no
//     place for a record's fields. A record ARGUMENT is accepted by three long-standing builtins,
//     but turning a record-taking MACRO into a builtin breaks its callers: with the callee inlined
//     the record is a compile-time bundle that folds away, and once it is a call
//     `ToPropertyDescriptor` fails to check with JSL-ERR-BAD-RECORD. Records stay inside macros;
//   * a body that DIVERGES -- one whose whole body is `%Throw` -- cannot become a builtin. Inlined,
//     it lowers to an expression with no normal value, so `(if c (ThrowTypeError ...) <record>)`
//     types as the record. Called, it returns its declared `:ret`, the two arms disagree, and
//     `ToPropertyDescriptor` fails to check with JSL-ERR-BAD-RECORD. Divergence at a call boundary
//     is a real feature the checker does not have yet; until it does, throwers stay macros;
//   * a definition that passes one of its OWN PARAMETERS as the key of `%PropLoadNamed`,
//     `%PropStoreNamed`, `%PropHasNamed` or `%PropDeleteNamed` cannot cross a call. Named-property
//     IR carries the interned name in the node's aux field, not as a data input, so the key has to
//     be a literal at lowering time (`jl-static-property-key`). Inlined, the caller's literal
//     argument is visible and it folds; called, the key is a runtime value and lowering refuses it
//     with "a named-property key must be an interned id or string literal".
//
// A definition that calls a callback stays an expansion whatever it is declared, because the
// frontend needs the caller's memory at the callback site (`frontend_native_graph.coil`, the
// `calls-back` branch). Declaring one `builtin` is not an error, it is just not honoured, so this
// tool reports it rather than proposing it.
//
// `--check` is the gate-facing mode: it fails when a declaration violates an ABI rule, and lists
// eligible macros over the size threshold without failing on them, because shrinking that list is
// ongoing work rather than a regression.

import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const at = argv.indexOf(name);
  return at >= 0 && at + 1 < argv.length ? argv[at + 1] : fallback;
};
if (flag("--help")) {
  process.stdout.write(`Usage: node tools/jsl-inline-policy.mjs [--check] [--apply] ` +
    `[--min-tokens N] [--transitioning]\n\n` +
    `  --check          report policy violations; exit 1 if any\n` +
    `  --apply          retag eligible macros at or over --min-tokens, or with a loop\n` +
    `  --min-tokens N   size threshold for --apply (default 80)\n` +
    `  --transitioning  add :transitioning true wherever the lowered graph will need it\n`);
  process.exit(0);
}

function jslFiles(root = "lib") {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith(".jsl")) out.push(path);
    }
  };
  walk(root);
  return out;
}

const HEAD = /^\((macro|builtin|callable)\s+(\S+)/gm;

// The body with the declaration header (name, :params, :ret and friends) removed, so a match is
// about what the definition DOES rather than how it is declared.
function stripHeader(code) {
  const ret = /:ret\s+\S+/.exec(code);
  return ret ? code.slice(ret.index + ret[0].length) : code;
}
const NAMED_KEY_PRIMS = ["%PropLoadNamed", "%PropStoreNamed", "%PropHasNamed", "%PropDeleteNamed"];

// True when the key operand of a named-property primitive is one of this declaration's parameters,
// rather than a literal. Such a definition only lowers when it is inlined into a call site that
// supplies the literal.
function staticKeyParameter(code, params) {
  const names = new Set([...params.matchAll(/\((\w+)\s/g)].map((m) => m[1]));
  for (const prim of NAMED_KEY_PRIMS) {
    const uses = code.matchAll(new RegExp(`${prim}\\s+\\S+\\s+([A-Za-z_]\\w*)`, "g"));
    for (const use of uses) if (names.has(use[1])) return true;
  }
  return false;
}

function read() {
  const declarations = [];
  for (const file of jslFiles()) {
    const source = readFileSync(file, "utf8");
    const heads = [...source.matchAll(HEAD)].map((m) => ({
      at: m.index, kind: m[1], name: m[2],
    }));
    for (let i = 0; i < heads.length; i++) {
      const end = i + 1 < heads.length ? heads[i + 1].at : source.length;
      // Prose carries example code; a commented `(loop` must not read as a loop.
      const code = source.slice(heads[i].at, end).split("\n")
        .filter((line) => !line.trimStart().startsWith(";;")).join("\n");
      const params = /:params\s*\[([\s\S]*?)\]\s*(?::|\n)/.exec(code)?.[1] ?? "";
      declarations.push({
        file, kind: heads[i].kind, name: heads[i].name, code,
        tokens: code.split(/\s+/).filter(Boolean).length,
        loops: (code.match(/\(loop\b/g) || []).length,
        transitioning: code.includes(":transitioning true"),
        rest: /\(rest\s/.test(params),
        slotList: code.includes("(slot-list)"),
        recordReturn: /:ret\s*\(record\s/.test(code),
        recordParam: /\(record\s/.test(params),
        diverges: /\(%Throw\b/.test(stripHeader(code)),
        staticKey: staticKeyParameter(code, params),
      });
    }
  }
  return declarations;
}

const eligible = (d) =>
  !d.rest && !d.slotList && !d.recordReturn && !d.recordParam && !d.staticKey && !d.diverges;
const violation = (d) => {
  if (d.kind === "macro") return null;
  if (d.rest) return "a rest parameter cannot cross a call";
  if (d.slotList) return "a slot list cannot cross a call";
  if (d.recordReturn) return "a record return cannot cross a call";
  if (d.staticKey) return "a parameter used as a named-property key cannot cross a call";
  if (d.diverges) return "a diverging body cannot cross a call";
  return null;
};

const declarations = read();
const byName = new Map(declarations.map((d) => [d.name, d]));

// Callees: every known declaration name the body mentions. Over-approximate on purpose -- a name
// that appears but is not called only adds a `:transitioning true` the graph check would have
// demanded anyway if it were.
for (const d of declarations) {
  d.callees = new Set(
    (d.code.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [])
      .filter((t) => t !== d.name && byName.has(t)),
  );
}

// A lowered graph gets a Call node when the definition calls a builtin, or expands a macro that
// does -- an inlined macro's nodes ARE the caller's. That is exactly what jl-transition-check
// asserts against the graph, so deriving it here from the same rule keeps the two in step.
function transitioningClosure() {
  const need = new Map(declarations.map((d) => [
    d.name, d.transitioning || [...d.callees].some((c) => byName.get(c).kind !== "macro"),
  ]));
  for (let changed = true; changed;) {
    changed = false;
    for (const d of declarations) {
      if (need.get(d.name)) continue;
      if ([...d.callees].some((c) => byName.get(c).kind === "macro" && need.get(c))) {
        need.set(d.name, true);
        changed = true;
      }
    }
  }
  return need;
}

function rewrite(edits) {
  const byFile = new Map();
  for (const { file, ...edit } of edits) {
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(edit);
  }
  for (const [file, fileEdits] of byFile) {
    let source = readFileSync(file, "utf8");
    for (const edit of fileEdits) {
      const head = new RegExp(`^\\((macro|builtin|callable)\\s+${edit.name}(\\s)`, "m");
      const match = head.exec(source);
      if (!match) throw new Error(`${file}: no declaration head for ${edit.name}`);
      const replacement = edit.retag
        ? `(builtin ${edit.name}${match[2]}`
        : `(${match[1]} ${edit.name} :transitioning true${match[2]}`;
      source = source.slice(0, match.index) + replacement +
        source.slice(match.index + match[0].length);
    }
    writeFileSync(file, source);
  }
  return byFile.size;
}

const minTokens = Number(option("--min-tokens", "80"));

if (flag("--apply")) {
  const retag = declarations.filter((d) =>
    d.kind === "macro" && eligible(d) && (d.tokens >= minTokens || d.loops > 0));
  rewrite(retag.map((d) => ({ file: d.file, name: d.name, retag: true })));
  console.log(`retagged ${retag.length} macros as builtins ` +
    `(>= ${minTokens} tokens, or containing a loop)`);
}

if (flag("--transitioning")) {
  const fresh = read();
  const freshByName = new Map(fresh.map((d) => [d.name, d]));
  for (const d of fresh) {
    d.callees = new Set((d.code.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [])
      .filter((t) => t !== d.name && freshByName.has(t)));
  }
  declarations.length = 0;
  declarations.push(...fresh);
  byName.clear();
  for (const d of fresh) byName.set(d.name, d);
  const need = transitioningClosure();
  const add = fresh.filter((d) => need.get(d.name) && !d.transitioning);
  rewrite(add.map((d) => ({ file: d.file, name: d.name, retag: false })));
  console.log(`annotated ${add.length} declarations :transitioning true`);
}

if (flag("--check") || (!flag("--apply") && !flag("--transitioning"))) {
  const violations = declarations.map((d) => [d, violation(d)]).filter(([, v]) => v);
  const macros = declarations.filter((d) => d.kind === "macro");
  const oversized = macros.filter((d) => eligible(d) && (d.tokens >= minTokens || d.loops > 0));
  console.log(`${declarations.length} declarations: ` +
    `${macros.length} macro, ${declarations.length - macros.length} builtin/callable`);
  console.log(`${oversized.length} macros are builtin-eligible and at or over ` +
    `${minTokens} tokens or contain a loop`);
  for (const d of oversized.sort((a, b) => b.tokens - a.tokens).slice(0, 15)) {
    console.log(`   ${String(d.tokens).padStart(4)} tokens  loops=${d.loops}  ` +
      `${d.name}  ${d.file}`);
  }
  for (const [d, why] of violations) {
    console.error(`${d.file}: ${d.kind} ${d.name}: ${why}`);
  }
  if (violations.length) process.exit(1);
}
