#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { build } from "ecmarkup";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultPinsPath = join(projectRoot, "spec", "ecma262-sources.json");
const defaultOutputPath = join(projectRoot, "spec", "generated", "ecma262-raw-ledger.json");

function usage() {
  return `Usage: node tools/ecma262-ledger.mjs [options]\n\n` +
    `  --fetch              Fetch the pinned ECMA-262 checkout when it is absent\n` +
    `  --check              Fail if the generated ledger differs from --output\n` +
    `  --validate           Validate the committed ledger without a spec checkout\n` +
    `  --source-dir PATH    Use an existing ECMA-262 source tree\n` +
    `  --pins PATH          Read source pins from PATH\n` +
    `  --output PATH        Write/check PATH\n` +
    `  --summary            Print the generated summary as JSON\n`;
}

function parseArgs(argv) {
  const args = {
    fetch: false,
    check: false,
    validate: false,
    summary: false,
    sourceDir: "",
    pinsPath: defaultPinsPath,
    outputPath: defaultOutputPath,
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(usage());
      process.exit(0);
    } else if (argument === "--fetch") {
      args.fetch = true;
    } else if (argument === "--check") {
      args.check = true;
    } else if (argument === "--validate") {
      args.validate = true;
    } else if (argument === "--summary") {
      args.summary = true;
    } else if (["--source-dir", "--pins", "--output"].includes(argument)) {
      if (index + 1 >= argv.length) throw new Error(`${argument} requires a path`);
      const value = resolve(argv[++index]);
      if (argument === "--source-dir") args.sourceDir = value;
      if (argument === "--pins") args.pinsPath = value;
      if (argument === "--output") args.outputPath = value;
    } else {
      throw new Error(`unknown option ${argument}`);
    }
  }
  if (args.validate && (args.fetch || args.check || args.sourceDir)) {
    throw new Error("--validate cannot be combined with --fetch, --check, or --source-dir");
  }
  return args;
}

function readPins(path) {
  const pins = JSON.parse(readFileSync(path, "utf8"));
  if (pins.schemaVersion !== 1) throw new Error(`unsupported pin schema ${pins.schemaVersion}`);
  for (const name of ["ecma262", "test262"]) {
    const source = pins[name];
    if (!source || !/^https:\/\//.test(source.repository)) {
      throw new Error(`${name}.repository must be an HTTPS URL`);
    }
    if (!/^[0-9a-f]{40}$/.test(source.commit ?? "")) {
      throw new Error(`${name}.commit must be a full Git commit`);
    }
  }
  if (!pins.ecma262.entry || !/^[0-9a-f]{64}$/.test(pins.ecma262.entrySha256 ?? "")) {
    throw new Error("ecma262 entry and SHA-256 are required");
  }
  return pins;
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"],
  }).trim();
}

function ensurePinnedCheckout(pin, cacheRoot, allowFetch) {
  const checkout = join(cacheRoot, `ecma262-${pin.commit}`);
  if (!existsSync(join(checkout, ".git"))) {
    if (!allowFetch) {
      throw new Error(`pinned checkout is absent at ${checkout}; rerun with --fetch`);
    }
    mkdirSync(cacheRoot, { recursive: true });
    git(["clone", "--depth", "1", "--filter=blob:none", pin.repository, checkout], {
      capture: false,
    });
    git(["-C", checkout, "fetch", "--depth", "1", "origin", pin.commit], { capture: false });
    git(["-C", checkout, "switch", "--detach", pin.commit], { capture: false });
  }
  const actual = git(["-C", checkout, "rev-parse", "HEAD"]);
  if (actual !== pin.commit) {
    throw new Error(`checkout ${checkout} is at ${actual}, expected ${pin.commit}`);
  }
  if (git(["-C", checkout, "status", "--porcelain"]) !== "") {
    throw new Error(`pinned checkout ${checkout} has local changes`);
  }
  return checkout;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizeSpace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function pathWithin(root, path) {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

function flattenClauses(clauses, output = [], ancestors = []) {
  for (const clause of clauses) {
    output.push({ clause, ancestorIds: ancestors.map(item => item.id).filter(Boolean) });
    flattenClauses(clause.subclauses, output, [...ancestors, clause]);
  }
  return output;
}

function directDescendants(clause, selector) {
  return [...clause.node.querySelectorAll(selector)].filter(node => {
    const owner = node.closest("emu-clause, emu-annex");
    return owner === clause.node;
  });
}

function directProseCount(spec, clause) {
  const proseTags = new Set(["P", "TABLE", "UL", "OL", "PRE", "EMU-TABLE"]);
  return [...clause.node.children].filter(node => proseTags.has(node.tagName) && spec.locate(node)).length;
}

function sourceLocation(spec, node, sourceRoot) {
  const located = spec.locate(node);
  if (!located) return null;
  const file = resolve(located.file ?? spec.rootPath);
  return {
    file: pathWithin(sourceRoot, file) ? relative(sourceRoot, file).split(sep).join("/") : file,
    line: located.startLine,
    column: located.startCol,
  };
}

function clauseEntry(spec, clause, sourceRoot, ancestorIds) {
  const bibliography = clause.id ? spec.biblio.byId(clause.id) : undefined;
  const operation = clause.aoid ? spec.biblio.byAoid(clause.aoid, clause.namespace) : undefined;
  const builtIn = spec.biblio.localEntries().find(entry =>
    entry.type === "built-in function" && entry.clause === clause.id);
  const xrefs = directDescendants(clause, "emu-xref");
  const operationDependencies = [...new Set(xrefs
    .map(xref => xref.getAttribute("aoid"))
    .filter(Boolean))].sort();
  const clauseDependencies = [...new Set(xrefs
    .map(xref => xref.getAttribute("href"))
    .filter(href => href?.startsWith("#"))
    .map(href => href.slice(1))
    .filter(id => id !== clause.id))].sort();
  const kindByClauseType = {
    "abstract operation": "abstract operation",
    "concrete method": "concrete method",
    "host-defined abstract operation": "host-defined abstract operation",
    "implementation-defined abstract operation": "implementation-defined abstract operation",
    "internal method": "internal method",
    "numeric method": "numeric method",
    sdo: "syntax-directed operation",
  };
  return {
    id: clause.id,
    parentId: ancestorIds.at(-1) ?? null,
    ancestorIds,
    topLevelId: ancestorIds[0] ?? clause.id,
    number: clause.number || null,
    title: normalizeSpace(bibliography?.title ?? clause.header?.textContent ?? ""),
    clauseType: clause.type || null,
    normative: clause.isNormative,
    annex: clause.isAnnex,
    aoid: clause.aoid || null,
    algorithmKind: operation?.kind ?? kindByClauseType[clause.type] ?? null,
    signature: operation?.signature ?? clause.signature ?? null,
    method: clause.abstractAoid ? { abstractAoid: clause.abstractAoid, for: clause.for } : null,
    effects: [...new Set(operation?.effects ?? clause.effects ?? [])].sort(),
    builtIn: builtIn ? { name: builtIn.name, params: builtIn.params } : null,
    algorithmCount: directDescendants(clause, "emu-alg").length,
    grammarCount: directDescendants(clause, "emu-grammar").length,
    proseCount: directProseCount(spec, clause),
    operationDependencies,
    clauseDependencies,
    source: sourceLocation(spec, clause.node, sourceRoot),
    disposition: "unclassified",
    status: "unclassified",
  };
}

function productionEntries(spec, clauses, sourceRoot) {
  const clauseByNode = new Map(clauses.map(clause => [clause.node, clause]));
  const productions = new Map();
  for (const node of spec.dom.window.document.querySelectorAll("emu-production[name]")) {
    const name = node.getAttribute("name");
    if (!name) continue;
    const clause = clauseByNode.get(node.closest("emu-clause, emu-annex"));
    const item = productions.get(name) ?? {
      name,
      normative: false,
      declarations: [],
      disposition: "unclassified",
      status: "unclassified",
    };
    item.normative ||= clause?.isNormative ?? false;
    item.declarations.push({
      clauseId: clause?.id ?? null,
      source: sourceLocation(spec, node, sourceRoot) ??
        (clause ? sourceLocation(spec, clause.node, sourceRoot) : null),
    });
    productions.set(name, item);
  }
  return [...productions.values()]
    .map(item => ({ ...item, declarations: item.declarations.sort((a, b) =>
      `${a.source?.file}:${a.source?.line}`.localeCompare(`${b.source?.file}:${b.source?.line}`)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] ?? "(none)";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function expectedSummary(ledger) {
  const normativeClauses = ledger.clauses.filter(item => item.normative);
  const normativeProductions = ledger.productions.filter(item => item.normative);
  return {
    clauses: ledger.clauses.length,
    normativeClauses: normativeClauses.length,
    normativeClausesUnclassified: normativeClauses.filter(item => item.status === "unclassified").length,
    productions: ledger.productions.length,
    normativeProductions: normativeProductions.length,
    normativeProductionsUnclassified: normativeProductions.filter(item => item.status === "unclassified").length,
    clauseTypes: countBy(ledger.clauses, "clauseType"),
    algorithmKinds: countBy(ledger.clauses.filter(item => item.algorithmKind), "algorithmKind"),
    ecmarkupWarnings: ledger.ecmarkupWarnings.length,
  };
}

export function validateLedger(ledger, pins) {
  if (ledger.schemaVersion !== 2) throw new Error(`unsupported ledger schema ${ledger.schemaVersion}`);
  if (!Array.isArray(ledger.clauses) || !Array.isArray(ledger.productions) ||
      !Array.isArray(ledger.ecmarkupWarnings)) {
    throw new Error("ledger clauses, productions, and ecmarkupWarnings must be arrays");
  }
  const expectedPins = {
    ecma262Commit: pins.ecma262.commit,
    ecma262EntrySha256: pins.ecma262.entrySha256,
    test262Commit: pins.test262.commit,
  };
  for (const [key, value] of Object.entries(expectedPins)) {
    if (ledger.generatedFrom?.[key] !== value) {
      throw new Error(`ledger ${key} does not match the source pin`);
    }
  }
  const clauseIds = new Set();
  for (const clause of ledger.clauses) {
    if (!clause.id) throw new Error("every clause must have an id");
    if (clauseIds.has(clause.id)) throw new Error(`duplicate clause id ${clause.id}`);
    clauseIds.add(clause.id);
    if (!clause.source?.file || !Number.isInteger(clause.source.line)) {
      throw new Error(`clause ${clause.id} has no source location`);
    }
    if (!clause.disposition || !clause.status) {
      throw new Error(`clause ${clause.id} has no disposition or status`);
    }
    if (!Number.isInteger(clause.proseCount) || clause.proseCount < 0)
      throw new Error(`clause ${clause.id} has invalid direct prose count`);
  }
  const clauseById = new Map(ledger.clauses.map(clause => [clause.id, clause]));
  for (const clause of ledger.clauses) {
    if (!Array.isArray(clause.ancestorIds) ||
        clause.ancestorIds.some(id => !clauseIds.has(id) || id === clause.id)) {
      throw new Error(`clause ${clause.id} has invalid ancestors`);
    }
    if ((clause.parentId ?? null) !== (clause.ancestorIds.at(-1) ?? null))
      throw new Error(`clause ${clause.id} parent does not match its ancestors`);
    const expectedAncestors = clause.parentId ?
      [...clauseById.get(clause.parentId).ancestorIds, clause.parentId] : [];
    if (JSON.stringify(clause.ancestorIds) !== JSON.stringify(expectedAncestors))
      throw new Error(`clause ${clause.id} ancestor chain is inconsistent`);
    if (clause.topLevelId !== (clause.ancestorIds[0] ?? clause.id))
      throw new Error(`clause ${clause.id} top-level identity is inconsistent`);
  }
  const productionNames = new Set();
  for (const production of ledger.productions) {
    if (!production.name) throw new Error("every production must have a name");
    if (productionNames.has(production.name)) throw new Error(`duplicate production ${production.name}`);
    productionNames.add(production.name);
    if (!production.disposition || !production.status || production.declarations.length === 0) {
      throw new Error(`production ${production.name} has incomplete classification metadata`);
    }
    for (const declaration of production.declarations) {
      if (!declaration.source?.file || !Number.isInteger(declaration.source.line)) {
        throw new Error(`production ${production.name} has no source location`);
      }
      if (declaration.clauseId && !clauseIds.has(declaration.clauseId)) {
        throw new Error(`production ${production.name} refers to unknown clause ${declaration.clauseId}`);
      }
    }
  }
  const actualSummary = JSON.stringify(ledger.summary);
  const computedSummary = JSON.stringify(expectedSummary(ledger));
  if (actualSummary !== computedSummary) throw new Error("ledger summary does not match its entries");
  return ledger.summary;
}

export async function generateLedger({ sourceDir, pins, pinsPath }) {
  const entryPath = join(sourceDir, pins.ecma262.entry);
  if (!existsSync(entryPath)) throw new Error(`missing ECMA-262 entry ${entryPath}`);
  const actualSha = sha256(entryPath);
  if (actualSha !== pins.ecma262.entrySha256) {
    throw new Error(`ECMA-262 entry SHA-256 ${actualSha} does not match pin ${pins.ecma262.entrySha256}`);
  }
  const warnings = [];
  const spec = await build(entryPath, path => readFileSync(path, "utf8"), {
    assets: "none",
    copyright: false,
    date: new Date(pins.ecma262.committedAt),
    location: `https://github.com/tc39/ecma262/tree/${pins.ecma262.commit}`,
    log: () => {},
    toc: false,
    warn: warning => warnings.push({
      ruleId: warning.ruleId,
      message: warning.message,
      file: warning.file ? relative(sourceDir, warning.file).split(sep).join("/") : null,
      line: warning.line ?? null,
      column: warning.column ?? null,
      nodeType: warning.nodeType ?? null,
    }),
  });
  const clauseRecords = flattenClauses(spec.subclauses);
  const clauses = clauseRecords.map(record => record.clause);
  const clauseItems = clauseRecords
    .map(record => clauseEntry(spec, record.clause, sourceDir, record.ancestorIds))
    .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
  const productions = productionEntries(spec, clauses, sourceDir);
  const normativeClauses = clauseItems.filter(item => item.normative);
  const normativeProductions = productions.filter(item => item.normative);
  return {
    schemaVersion: 2,
    generatedFrom: {
      pins: relative(projectRoot, pinsPath).split(sep).join("/"),
      ecma262Commit: pins.ecma262.commit,
      ecma262EntrySha256: pins.ecma262.entrySha256,
      test262Commit: pins.test262.commit,
      ecmarkupVersion: JSON.parse(readFileSync(join(projectRoot, "node_modules", "ecmarkup", "package.json"), "utf8")).version,
    },
    summary: expectedSummary({ clauses: clauseItems, productions, ecmarkupWarnings: warnings }),
    ecmarkupWarnings: warnings,
    clauses: clauseItems,
    productions,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pins = readPins(args.pinsPath);
  if (args.validate) {
    if (!existsSync(args.outputPath)) throw new Error(`generated ledger is absent at ${args.outputPath}`);
    const ledger = JSON.parse(readFileSync(args.outputPath, "utf8"));
    const summary = validateLedger(ledger, pins);
    if (args.summary) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    else process.stdout.write(`validated ${args.outputPath}\n`);
    return;
  }
  const sourceDir = args.sourceDir || ensurePinnedCheckout(
    pins.ecma262,
    join(projectRoot, ".spec-cache"),
    args.fetch,
  );
  const ledger = await generateLedger({ sourceDir: realpathSync(sourceDir), pins, pinsPath: args.pinsPath });
  const rendered = `${JSON.stringify(ledger, null, 2)}\n`;
  if (args.check) {
    if (!existsSync(args.outputPath)) throw new Error(`generated ledger is absent at ${args.outputPath}`);
    if (readFileSync(args.outputPath, "utf8") !== rendered) {
      throw new Error(`generated ledger differs from ${args.outputPath}; run npm run spec:ledger`);
    }
  } else {
    mkdirSync(dirname(args.outputPath), { recursive: true });
    writeFileSync(args.outputPath, rendered);
  }
  if (args.summary) process.stdout.write(`${JSON.stringify(ledger.summary, null, 2)}\n`);
  else process.stdout.write(`${args.check ? "checked" : "wrote"} ${args.outputPath}\n`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`ecma262-ledger: ${error.message}\n`);
    process.exitCode = 1;
  });
}
