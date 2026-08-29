import assert from "node:assert/strict";
import test from "node:test";
import { declarationsInSource, validateProvenance } from "./jsl-provenance.mjs";

const commit = "1".repeat(40);
const pins = { ecma262: { commit } };
const ledger = { schemaVersion: 1, clauses: [{
  id: "sec-f", normative: true, aoid: "F", builtIn: null, title: "F ( x )",
}] };

test("reads multiline JSL metadata without mistaking comments or bodies for declarations", () => {
  const declarations = declarationsInSource(`
    ;; (macro Ignored :spec "bad" x)
    (macro f :spec "ecma262@${commit}#sec-f"
      :spec-name "F" :status complete :params [(x dyn)] (let [(s ";#()") ] x))
  `, "lib/f.jsl");
  assert.equal(declarations.length, 1);
  assert.equal(declarations[0].metadata.spec, `ecma262@${commit}#sec-f`);
  assert.equal(validateProvenance({ declarations, ledger, pins }).summary.completeClaims, 1);
});

test("exact names create review candidates but never implementation claims", () => {
  const declarations = declarationsInSource("(macro F :params [(x dyn)] x)", "lib/f.jsl");
  const report = validateProvenance({ declarations, ledger, pins });
  assert.equal(report.summary.declarationsWithProvenance, 0);
  assert.equal(report.summary.uniqueNameCandidates, 1);
  assert.equal(report.candidates[0].matches[0].clauseId, "sec-f");
});

test("a spec-link comment seeds the following declaration as a review candidate", () => {
  const declarations = declarationsInSource(
    `;; https://tc39.es/ecma262/#sec-f\n(macro LocalName :params [(x dyn)] x)`, "lib/f.jsl");
  const report = validateProvenance({ declarations, ledger, pins });
  assert.equal(report.summary.declarationsWithProvenance, 0);
  assert.deepEqual(report.candidates[0].matches[0].reasons, ["preceding-spec-link"]);
});

test("a pinned specialization is validated and excluded from canonical candidates", () => {
  const declarations = declarationsInSource(
    `;; https://tc39.es/ecma262/#sec-f
     (macro F :specializes "ecma262@${commit}#sec-f"
       :deviation "Handles only the machine-index result domain." x)`, "lib/f.jsl");
  const report = validateProvenance({ declarations, ledger, pins });
  assert.equal(report.summary.declarationsWithProvenance, 0);
  assert.equal(report.summary.specializedDeclarations, 1);
  assert.equal(report.candidates.length, 0);
  assert.deepEqual(report.specializations[0], {
    declaration: "F", file: "lib/f.jsl", clauseId: "sec-f", specName: "F",
    deviation: "Handles only the machine-index result domain.",
  });
});

test("specializations require a current normative target and a narrowing description", () => {
  const source = `(macro f :specializes "ecma262@${commit}#sec-f" :deviation "narrow" x)`;
  const declaration = declarationsInSource(source, "f.jsl");
  const missingDeviation = structuredClone(declaration);
  delete missingDeviation[0].metadata.deviation;
  assert.throws(() => validateProvenance({ declarations: missingDeviation, ledger, pins }), /inconsistent/);
  const stale = structuredClone(declaration);
  stale[0].metadata.specializes = `ecma262@${"2".repeat(40)}#sec-f`;
  assert.throws(() => validateProvenance({ declarations: stale, ledger, pins }), /stale/);
  const unknown = structuredClone(declaration);
  unknown[0].metadata.specializes = `ecma262@${commit}#sec-missing`;
  assert.throws(() => validateProvenance({ declarations: unknown, ledger, pins }), /unknown clause/);
});

test("rejects stale pins, unknown clauses, name mismatches, and duplicate claims", () => {
  const declaration = declarationsInSource(
    `(macro f :spec "ecma262@${commit}#sec-f" :spec-name "F" :status complete x)`, "f.jsl");
  assert.throws(() => validateProvenance({ declarations: declaration, ledger, pins: {
    ecma262: { commit: "2".repeat(40) },
  } }), /stale/);
  const unknown = structuredClone(declaration);
  unknown[0].metadata.spec = `ecma262@${commit}#sec-missing`;
  assert.throws(() => validateProvenance({ declarations: unknown, ledger, pins }), /unknown clause/);
  const mismatch = structuredClone(declaration);
  mismatch[0].metadata["spec-name"] = "NotF";
  assert.throws(() => validateProvenance({ declarations: mismatch, ledger, pins }), /does not match/);
  assert.throws(() => validateProvenance({ declarations: [...declaration, ...declaration], ledger, pins }),
    /duplicates/);
});
