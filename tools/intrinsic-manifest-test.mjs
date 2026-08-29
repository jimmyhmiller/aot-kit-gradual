import test from "node:test";
import assert from "node:assert/strict";
import {
  loadIntrinsicManifest,
  renderIntrinsicCoil,
  renderIntrinsicPublicationJsl,
  renderIntrinsicSupport,
  validateIntrinsicManifest,
} from "./intrinsic-manifest.mjs";

test("the checked manifest generates one deterministic global lookup table", () => {
  const manifest = loadIntrinsicManifest();
  assert.deepEqual(validateIntrinsicManifest(manifest), []);
  const first = renderIntrinsicCoil(manifest);
  const second = renderIntrinsicCoil(structuredClone(manifest));
  assert.equal(first, second);
  for (const intrinsic of manifest.intrinsics) {
    for (const name of intrinsic.globals) {
      assert.match(first, new RegExp(`\\(= name ${JSON.stringify(name)}\\) ${intrinsic.constant}`));
    }
  }
  assert.match(first,
    /\(= symbol FE-INTRINSIC-TYPEERROR\) FE-INTRINSIC-FAMILY-ERROR/);
  assert.match(first, /\(= symbol FE-INTRINSIC-TYPEERROR\) 5/);
  assert.match(first, /\(= symbol FE-INTRINSIC-ARRAYBUFFER\) 25/);
  assert.match(first, /\(defn fe-intrinsic-callable\?/);
  assert.match(first, /\(defn fe-intrinsic-constructable\?/);
  assert.match(first,
    /\(and \(= symbol FE-INTRINSIC-SYMBOL\) \(= name "species"\)\) "SymbolSpeciesValue"/);
});

test("the support report is deterministic and counts only migrated property publication", () => {
  const manifest = loadIntrinsicManifest();
  const report = JSON.parse(renderIntrinsicSupport(manifest));
  assert.equal(report.generatedFrom.scope, "currently-published-global-bindings");
  assert.equal(report.summary.intrinsicIdentities, manifest.intrinsics.length);
  assert.equal(report.summary.globalBindings,
    manifest.intrinsics.reduce((sum, entry) => sum + entry.globals.length, 0));
  assert.equal(report.summary.publishedProperties, 49);
  assert.equal(report.entries.find(entry => entry.id === "%TypeError%").owner, "composite");
  assert.equal(report.entries.find(entry => entry.id === "%TypeError%").loweringFamily, "error");
  assert.equal(report.entries.find(entry => entry.id === "%TypeError%").runtimeKind, 5);
});

test("well-known roots generate focused JSL publication with exact attributes", () => {
  const manifest = loadIntrinsicManifest();
  const generated = renderIntrinsicPublicationJsl(manifest);
  assert.match(generated, /\(builtin SymbolSpeciesValue :transitioning true/);
  assert.match(generated,
    /\(WellKnownSymbol constructor "species" "Symbol\.species"\)/);
  assert.match(generated,
    /\(%SetPropertyAttributes constructor \(ToPropertyKey "species"\) 0\)/);
  assert.match(generated, /\(builtin SymbolToStringTagValue :transitioning true/);
  assert.equal(generated, renderIntrinsicPublicationJsl(structuredClone(manifest)));
});

test("method roots generate callable metadata, exact descriptors, and frontend routing", () => {
  const manifest = loadIntrinsicManifest();
  const generated = renderIntrinsicPublicationJsl(manifest);
  const compiler = renderIntrinsicCoil(manifest);
  assert.match(generated, /\(builtin SymbolForValue :transitioning true/);
  assert.match(generated, /\(closure SymbolFor1\)/);
  assert.match(generated, /\(%Box 1\)/);
  assert.match(generated, /\(%Box "for"\)/);
  assert.match(generated, /\(%SetPropertyAttributes constructor key 5\)/);
  assert.match(compiler,
    /\(and \(= symbol FE-INTRINSIC-SYMBOL\) \(= name "for"\)\) "SymbolForValue"/);
  assert.match(compiler,
    /\(defn fe-intrinsic-property-callable\?/);
  assert.match(compiler,
    /\(and \(= symbol FE-INTRINSIC-SYMBOL\) \(= name "for"\)\) true/);
});

test("prototype methods and accessors generate against the prototype target", () => {
  const manifest = loadIntrinsicManifest();
  const generated = renderIntrinsicPublicationJsl(manifest);
  const compiler = renderIntrinsicCoil(manifest);
  assert.match(generated, /\(builtin SymbolPrototypeValueOfValue :transitioning true/);
  assert.match(generated, /\(prototype \(BuiltinPrototypeValue 22\)\)/);
  assert.match(generated, /\(closure SymbolValueOf0\)/);
  assert.match(generated, /\(builtin SymbolPrototypeDescriptionAccessor :transitioning true/);
  assert.match(generated, /\(closure SymbolDescriptionGetter0\)/);
  assert.match(generated, /\(%DefinePropertySetter prototype key \(%Box undefined\)\)/);
  assert.match(generated, /\(%SetPropertyAttributes prototype key 12\)/);
  assert.match(compiler,
    /\(and \(= symbol FE-INTRINSIC-SYMBOL\) \(= name "valueOf"\)\) "SymbolPrototypeValueOfValue"/);
  assert.match(compiler, /\(defn fe-intrinsic-prototype-property-callable\?/);
  assert.match(compiler,
    /\(and \(= symbol FE-INTRINSIC-SYMBOL\) \(= name "valueOf"\)\) true/);
});

test("data roots and well-known Symbol keys generate exact values and descriptors", () => {
  const generated = renderIntrinsicPublicationJsl(loadIntrinsicManifest());
  assert.match(generated, /\(builtin SymbolConstructorNameValue :transitioning true/);
  assert.match(generated, /\(value \(%Box "Symbol"\)\)/);
  assert.match(generated, /\(%SetPropertyAttributes constructor key 4\)/);
  assert.match(generated, /\(builtin SymbolPrototypeConstructorValue :transitioning true/);
  assert.match(generated, /\(value constructor\)/);
  assert.match(generated, /\(builtin SymbolPrototypeToPrimitiveValue :transitioning true/);
  assert.match(generated, /\(key \(SymbolToPrimitiveValue\)\)/);
  assert.match(generated, /\(closure SymbolToPrimitive1\)/);
  assert.match(generated, /\(builtin SymbolPrototypeToStringTagValue :transitioning true/);
  assert.match(generated, /\(key \(SymbolToStringTagValue\)\)/);
});

test("duplicate identities, symbols, and global bindings are rejected", () => {
  const manifest = loadIntrinsicManifest();
  const duplicate = structuredClone(manifest.intrinsics[0]);
  manifest.intrinsics.push(duplicate);
  const errors = validateIntrinsicManifest(manifest).join("\n");
  assert.match(errors, /duplicate intrinsic id/);
  assert.match(errors, /duplicate intrinsic constant/);
  assert.match(errors, /duplicate intrinsic symbol/);
  assert.match(errors, /duplicate global binding/);
});

test("the schema refuses impossible callable and value shapes", () => {
  const manifest = loadIntrinsicManifest();
  const namespace = manifest.intrinsics.find(entry => entry.kind === "namespace");
  namespace.callable = true;
  const value = manifest.intrinsics.find(entry => entry.kind === "value");
  value.constructable = true;
  const errors = validateIntrinsicManifest(manifest).join("\n");
  assert.match(errors, /namespace objects cannot be callable/);
  assert.match(errors, /value bindings cannot be callable/);
});

test("property descriptors require unique keys, supported kinds, and complete attributes", () => {
  const manifest = loadIntrinsicManifest();
  const symbol = manifest.intrinsics.find(entry => entry.id === "%Symbol%");
  symbol.properties.push(structuredClone(symbol.properties[0]));
  symbol.properties[0].writable = "no";
  const errors = validateIntrinsicManifest(manifest).join("\n");
  assert.match(errors, /duplicate property constructor:length/);
  assert.match(errors, /writable must be boolean/);
});

test("method descriptors require a callable, name, length, and valid target", () => {
  const manifest = loadIntrinsicManifest();
  const method = manifest.intrinsics.find(entry => entry.id === "%Symbol%")
    .properties.find(property => property.kind === "method");
  method.closure = "not callable";
  method.name = "";
  method.length = -1;
  method.target = "nowhere";
  const errors = validateIntrinsicManifest(manifest).join("\n");
  assert.match(errors, /closure must be a JSL callable name/);
  assert.match(errors, /name must be a non-empty string/);
  assert.match(errors, /length must be a non-negative safe integer/);
  assert.match(errors, /target must be constructor or prototype/);
});

test("accessor descriptors require valid getter and optional setter callable shapes", () => {
  const manifest = loadIntrinsicManifest();
  const accessor = manifest.intrinsics.find(entry => entry.id === "%Symbol%")
    .properties.find(property => property.kind === "accessor");
  accessor.getter = "not callable";
  accessor.getterName = "";
  accessor.setter = "not callable";
  accessor.setterName = "";
  accessor.writable = true;
  const errors = validateIntrinsicManifest(manifest).join("\n");
  assert.match(errors, /getter must be a JSL callable name/);
  assert.match(errors, /getterName must be a non-empty string/);
  assert.match(errors, /setter must be null or a JSL callable name/);
  assert.match(errors, /setterName must be a non-empty string when setter is present/);
  assert.match(errors, /writable must be false for an accessor/);
});

test("data descriptors and well-known Symbol keys require explicit valid shapes", () => {
  const manifest = loadIntrinsicManifest();
  const symbol = manifest.intrinsics.find(entry => entry.id === "%Symbol%");
  const data = symbol.properties.find(property => property.kind === "data");
  data.value = {kind: "invented"};
  const method = symbol.properties.find(property => property.key === "@@toPrimitive");
  method.keyRoot = "not a root";
  const errors = validateIntrinsicManifest(manifest).join("\n");
  assert.match(errors, /value.kind must be constructor, prototype, string, number, or jsl/);
  assert.match(errors, /keyRoot must name the well-known Symbol root/);
});

test("JSL-valued data roots publish specification constants through named declarations", () => {
  const manifest = loadIntrinsicManifest();
  const number = manifest.intrinsics.find(entry => entry.id === "%Number%");
  const nan = number.properties.find(property => property.key === "NaN");
  assert.deepEqual(nan.value, {kind: "jsl", root: "NumberNaN"});
  const generated = renderIntrinsicPublicationJsl(manifest);
  assert.match(generated, /\(builtin NumberNaNValue :transitioning true/);
  assert.match(generated, /\(value \(%Box \(NumberNaN\)\)\)/);
  const compiler = renderIntrinsicCoil(manifest);
  assert.match(compiler,
    /\(and \(= symbol FE-INTRINSIC-NUMBER\) \(= name "NaN"\)\) "NumberNaN"/);

  nan.value.root = "not a declaration";
  assert.match(validateIntrinsicManifest(manifest).join("\n"),
    /value\.root must name a zero-argument JSL declaration/);
});

test("constructor initializers compose all declared roots behind one shared JSL boundary", () => {
  const manifest = loadIntrinsicManifest();
  const generated = renderIntrinsicPublicationJsl(manifest);
  const compiler = renderIntrinsicCoil(manifest);
  assert.match(generated, /\(builtin NumberConstructorValue :transitioning true/);
  assert.match(generated, /\(property0 \(NumberConstructorLengthValue\)\)/);
  assert.match(generated, /\(property10 \(NumberPositiveInfinityValue\)\)/);
  assert.match(compiler,
    /\(= symbol FE-INTRINSIC-NUMBER\) "NumberConstructorValue"/);

  manifest.intrinsics.find(entry => entry.id === "%Number%").initializer = "not valid";
  assert.match(validateIntrinsicManifest(manifest).join("\n"),
    /initializer must name a JSL declaration/);
});

test("every intrinsic has exactly one valid lowering description", () => {
  const missing = loadIntrinsicManifest();
  missing.lowering.pop();
  assert.match(validateIntrinsicManifest(missing).join("\n"), /missing lowering metadata/);

  const duplicate = loadIntrinsicManifest();
  duplicate.lowering.push(structuredClone(duplicate.lowering[0]));
  assert.match(validateIntrinsicManifest(duplicate).join("\n"), /duplicate lowering metadata/);

  const malformed = loadIntrinsicManifest();
  malformed.lowering[0].family = "Not A Family";
  malformed.lowering[0].runtimeKind = -1;
  const errors = validateIntrinsicManifest(malformed).join("\n");
  assert.match(errors, /kebab-case lowering family/);
  assert.match(errors, /non-negative safe integer or null/);
});
