#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultIndex = join(projectRoot, "lib", "index");
const defaultLedger = join(projectRoot, "spec", "generated", "ecma262-raw-ledger.json");
const defaultPins = join(projectRoot, "spec", "ecma262-sources.json");
const defaultOutput = join(projectRoot, "spec", "generated", "jsl-provenance.json");

function tokens(source) {
  const output = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s|,/.test(char)) { index++; continue; }
    if (char === ";" || char === "#") {
      while (index < source.length && source[index] !== "\n") index++;
      continue;
    }
    if ("()[]".includes(char)) { output.push({ kind: char, value: char, start: index }); index++; continue; }
    if (char === '"') {
      let value = "";
      index++;
      while (index < source.length && source[index] !== '"') {
        if (source[index] === "\\") {
          index++;
          if (index >= source.length) throw new Error("unterminated string escape");
          const escaped = source[index++];
          value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
        } else value += source[index++];
      }
      if (source[index] !== '"') throw new Error("unterminated string");
      index++;
      output.push({ kind: "string", value, start: index - value.length - 2 });
      continue;
    }
    const start = index;
    while (index < source.length && !/[\s,;#()\[\]"]/.test(source[index])) index++;
    output.push({ kind: "atom", value: source.slice(start, index), start });
  }
  return output;
}

function parseAll(source) {
  const input = tokens(source);
  let position = 0;
  function parse() {
    const token = input[position++];
    if (!token) throw new Error("unexpected end of input");
    if (token.kind === ")" || token.kind === "]") throw new Error(`unexpected ${token.kind}`);
    if (token.kind !== "(" && token.kind !== "[") return token;
    const close = token.kind === "(" ? ")" : "]";
    const values = [];
    while (input[position]?.kind !== close) values.push(parse());
    if (!input[position]) throw new Error(`missing ${close}`);
    position++;
    return { kind: token.kind === "(" ? "list" : "vector", values, start: token.start };
  }
  const forms = [];
  while (position < input.length) forms.push(parse());
  return forms;
}

export function declarationsInSource(source, file = "<string>") {
  const declarations = parseAll(source).filter(form => form.kind === "list").map(form => {
    const [head, name, ...rest] = form.values;
    if (head?.kind !== "atom" || !["builtin", "macro", "callable"].includes(head.value) ||
        name?.kind !== "atom") return null;
    const metadata = {};
    let index = 0;
    while (index + 1 < rest.length && rest[index].kind === "atom" && rest[index].value.startsWith(":")) {
      metadata[rest[index].value.slice(1)] = rest[index + 1].value;
      index += 2;
    }
    return { file, kind: head.value, name: name.value, metadata, start: form.start, specLinkIds: [] };
  }).filter(Boolean);
  for (const match of source.matchAll(/https:\/\/tc39\.es\/ecma262\/#([A-Za-z0-9%._-]+)/g)) {
    const declaration = declarations.find(item => item.start > match.index);
    if (declaration && !declaration.specLinkIds.includes(match[1])) declaration.specLinkIds.push(match[1]);
  }
  return declarations;
}

export function validateProvenance({ declarations, ledger, pins }) {
  const clauses = new Map(ledger.clauses.map(clause => [clause.id, clause]));
  const clausesByCanonicalName = new Map();
  for (const clause of ledger.clauses.filter(item => item.normative)) {
    for (const name of [clause.aoid, clause.builtIn?.name].filter(Boolean)) {
      const matches = clausesByCanonicalName.get(name) ?? [];
      matches.push(clause);
      clausesByCanonicalName.set(name, matches);
    }
  }
  const prefix = `ecma262@${pins.ecma262.commit}#`;
  const claims = [];
  const specializations = [];
  const seen = new Map();
  for (const declaration of declarations) {
    const { spec, "spec-name": specName, status, specializes, deviation } = declaration.metadata;
    const present = [spec, specName, status].filter(value => value !== undefined).length;
    if (specializes !== undefined) {
      if (present !== 0 || !deviation)
        throw new Error(`${declaration.file}:${declaration.name} has inconsistent specialization metadata`);
      if (!specializes.startsWith(prefix))
        throw new Error(`${declaration.file}:${declaration.name} has a stale specialization pin`);
      const clauseId = specializes.slice(prefix.length);
      const clause = clauses.get(clauseId);
      if (!clause) throw new Error(`${declaration.file}:${declaration.name} specializes unknown clause ${clauseId}`);
      if (!clause.normative)
        throw new Error(`${declaration.file}:${declaration.name} specializes informative clause ${clauseId}`);
      specializations.push({ declaration: declaration.name, file: declaration.file, clauseId,
        specName: clause.aoid ?? clause.builtIn?.name ?? clause.title, deviation });
      continue;
    }
    if (present === 0 && deviation === undefined) continue;
    if (present !== 3) throw new Error(`${declaration.file}:${declaration.name} has incomplete spec metadata`);
    if (!spec.startsWith(prefix)) throw new Error(`${declaration.file}:${declaration.name} has a stale ECMA-262 pin`);
    const clauseId = spec.slice(prefix.length);
    const clause = clauses.get(clauseId);
    if (!clause) throw new Error(`${declaration.file}:${declaration.name} refers to unknown clause ${clauseId}`);
    if (!clause.normative) throw new Error(`${declaration.file}:${declaration.name} claims informative clause ${clauseId}`);
    const canonicalNames = [clause.aoid, clause.builtIn?.name, clause.title].filter(Boolean);
    if (!canonicalNames.includes(specName)) {
      throw new Error(`${declaration.file}:${declaration.name} spec-name ${specName} does not match ${clauseId}`);
    }
    if (!new Set(["complete", "partial"]).has(status)) {
      throw new Error(`${declaration.file}:${declaration.name} has invalid status ${status}`);
    }
    if ((status === "complete" && deviation !== undefined) || (status === "partial" && !deviation)) {
      throw new Error(`${declaration.file}:${declaration.name} has inconsistent deviation metadata`);
    }
    if (seen.has(spec)) throw new Error(`${declaration.file}:${declaration.name} duplicates ${seen.get(spec)}`);
    seen.set(spec, `${declaration.file}:${declaration.name}`);
    claims.push({ declaration: declaration.name, file: declaration.file, clauseId, specName, status,
      ...(deviation ? { deviation } : {}) });
  }
  const complete = claims.filter(claim => claim.status === "complete").length;
  const claimedDeclarations = new Set(claims.map(claim => claim.declaration));
  const specializedDeclarations = new Set(specializations.map(item => item.declaration));
  const candidates = declarations.filter(declaration =>
    !claimedDeclarations.has(declaration.name) && !specializedDeclarations.has(declaration.name))
    .map(declaration => {
      const matched = new Map();
      for (const clause of clausesByCanonicalName.get(declaration.name) ?? []) {
        matched.set(clause.id, { clause, reasons: ["exact-name"] });
      }
      for (const clauseId of declaration.specLinkIds ?? []) {
        const clause = clauses.get(clauseId);
        if (!clause?.normative) continue;
        const existing = matched.get(clause.id) ?? { clause, reasons: [] };
        existing.reasons.push("preceding-spec-link");
        matched.set(clause.id, existing);
      }
      return ({
      declaration: declaration.name,
      file: declaration.file,
      matches: [...matched.values()].map(({ clause, reasons }) => ({
        clauseId: clause.id,
        specName: clause.aoid ?? clause.builtIn?.name,
        clauseType: clause.clauseType,
        reasons,
      })),
    }); }).filter(candidate => candidate.matches.length > 0);
  return {
    schemaVersion: 2,
    generatedFrom: { ecma262Commit: pins.ecma262.commit, ledgerSchemaVersion: ledger.schemaVersion },
    summary: {
      declarations: declarations.length,
      declarationsWithProvenance: claims.length,
      specializedDeclarations: specializations.length,
      declarationsWithoutProvenance: declarations.length - claims.length,
      completeClaims: complete,
      partialClaims: claims.length - complete,
      uniqueNameCandidates: candidates.filter(candidate => candidate.matches.length === 1).length,
      ambiguousNameCandidates: candidates.filter(candidate => candidate.matches.length > 1).length,
      declarationsWithoutNameCandidate: declarations.length - claims.length - candidates.length,
    },
    claims,
    specializations,
    candidates,
    declarations: declarations.map(({ name, file, kind }) => ({ name, file, kind })),
  };
}

function main() {
  const check = process.argv.slice(2).includes("--check");
  const unknown = process.argv.slice(2).filter(argument => argument !== "--check");
  if (unknown.length) throw new Error(`unknown option ${unknown[0]}`);
  const ledger = JSON.parse(readFileSync(defaultLedger, "utf8"));
  const pins = JSON.parse(readFileSync(defaultPins, "utf8"));
  const paths = readFileSync(defaultIndex, "utf8").split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  const declarations = paths.flatMap(path => {
    const absolute = resolve(projectRoot, path);
    if (!existsSync(absolute)) throw new Error(`index names missing file ${path}`);
    return declarationsInSource(readFileSync(absolute, "utf8"), relative(projectRoot, absolute));
  });
  const rendered = `${JSON.stringify(validateProvenance({ declarations, ledger, pins }), null, 2)}\n`;
  if (check) {
    if (!existsSync(defaultOutput) || readFileSync(defaultOutput, "utf8") !== rendered) {
      throw new Error(`generated provenance differs from ${relative(projectRoot, defaultOutput)}; run npm run spec:provenance`);
    }
    process.stdout.write(`checked ${defaultOutput}\n`);
  } else {
    writeFileSync(defaultOutput, rendered);
    process.stdout.write(`wrote ${defaultOutput}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`jsl-provenance: ${error.message}\n`);
    process.exitCode = 1;
  }
}
