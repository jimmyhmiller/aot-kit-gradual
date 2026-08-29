import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { generateLedger, validateLedger } from "./ecma262-ledger.mjs";

const fixtureDir = resolve(fileURLToPath(new URL("../tests/fixtures/ecma262-ledger", import.meta.url)));
const fixtureEntry = join(fixtureDir, "spec.html");
const fixtureSha = createHash("sha256").update(readFileSync(fixtureEntry)).digest("hex");

function fixturePins() {
  return {
    schemaVersion: 1,
    ecma262: {
      repository: "https://example.invalid/ecma262.git",
      commit: "1111111111111111111111111111111111111111",
      committedAt: "2026-08-27T00:00:00Z",
      entry: "spec.html",
      entrySha256: fixtureSha,
    },
    test262: {
      repository: "https://example.invalid/test262.git",
      commit: "2222222222222222222222222222222222222222",
      committedAt: "2026-08-27T00:00:00Z",
    },
  };
}

test("extracts imported normative structure, operation dependencies, built-ins, and grammar", async () => {
  const ledger = await generateLedger({
    sourceDir: fixtureDir,
    pins: fixturePins(),
    pinsPath: join(fixtureDir, "pins.json"),
  });
  const byId = new Map(ledger.clauses.map(clause => [clause.id, clause]));
  assert.equal(byId.get("sec-add-one").algorithmKind, "abstract operation");
  assert.deepEqual(byId.get("sec-add-two").operationDependencies, ["AddOne"]);
  assert.equal(byId.get("sec-widget.prototype.read").builtIn.name, "Widget.prototype.read");
  assert.equal(byId.get("sec-runtime-semantics-evaluation").algorithmKind, "syntax-directed operation");
  assert.equal(byId.get("sec-runtime-semantics-evaluation").parentId, "sec-widget-literal");
  assert.deepEqual(byId.get("sec-runtime-semantics-evaluation").ancestorIds, ["sec-widget-literal"]);
  assert.equal(byId.get("sec-runtime-semantics-evaluation").topLevelId, "sec-widget-literal");
  assert.equal(byId.get("sec-add-one").parentId, null);
  assert.deepEqual(byId.get("sec-add-one").ancestorIds, []);
  assert.equal(byId.get("sec-add-one").proseCount, 0);
  assert.equal(byId.get("sec-legacy-extra").proseCount, 1);
  assert.equal(byId.get("sec-legacy-extra").normative, true);
  assert.equal(byId.get("sec-informative-extra").normative, false);
  assert.ok(ledger.productions.some(production => production.name === "WidgetLiteral"));
  assert.equal(ledger.summary.normativeClausesUnclassified, ledger.summary.normativeClauses);
  assert.equal(ledger.summary.normativeProductionsUnclassified, ledger.summary.normativeProductions);
  assert.ok(ledger.productions.every(production =>
    production.declarations.every(declaration => declaration.source)));
});

test("rejects source content that does not match the pinned digest", async () => {
  const pins = fixturePins();
  pins.ecma262.entrySha256 = "0".repeat(64);
  await assert.rejects(
    generateLedger({ sourceDir: fixtureDir, pins, pinsPath: join(fixtureDir, "pins.json") }),
    /does not match pin/,
  );
});

test("validates ledger pins, identities, references, source locations, and totals offline", async () => {
  const pins = fixturePins();
  const ledger = await generateLedger({
    sourceDir: fixtureDir,
    pins,
    pinsPath: join(fixtureDir, "pins.json"),
  });
  assert.deepEqual(validateLedger(ledger, pins), ledger.summary);

  const stalePins = structuredClone(pins);
  stalePins.test262.commit = "3".repeat(40);
  assert.throws(() => validateLedger(ledger, stalePins), /test262Commit/);

  const duplicate = structuredClone(ledger);
  duplicate.clauses.push(structuredClone(duplicate.clauses[0]));
  assert.throws(() => validateLedger(duplicate, pins), /duplicate clause id/);

  const staleSummary = structuredClone(ledger);
  staleSummary.summary.clauses += 1;
  assert.throws(() => validateLedger(staleSummary, pins), /summary does not match/);

  const corruptHierarchy = structuredClone(ledger);
  corruptHierarchy.clauses.find(clause => clause.id === "sec-runtime-semantics-evaluation").ancestorIds = [];
  assert.throws(() => validateLedger(corruptHierarchy, pins), /parent does not match/);
});
