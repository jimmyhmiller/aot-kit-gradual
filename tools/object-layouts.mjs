#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(projectRoot, "spec", "object-layouts.json");
const outputPath = join(projectRoot, "spec", "generated", "object-layouts.json");
const jslOutputPath = join(projectRoot, "lib", "generated", "object-layouts.jsl");
const runtimeOutputPath = join(projectRoot, "native", "gc", "generated-object-layouts.h");
const identifier = /^[A-Z][A-Za-z0-9]*$/;
const storageKinds = new Set(["js-value", "boolean", "spec-list"]);

function uniqueByName(values, label) {
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} must be a non-empty array`);
  const names = new Set();
  for (const value of values) {
    if (!value || typeof value !== "object" || !identifier.test(value.name ?? ""))
      throw new Error(`${label} entry has an invalid name`);
    if (names.has(value.name)) throw new Error(`duplicate ${label} name ${value.name}`);
    names.add(value.name);
  }
  return names;
}

export function extractMakeBasicObjectInputs(source) {
  const shapes = new Map();
  for (const match of source.matchAll(/MakeBasicObject\(([^)]*)\)/g)) {
    const argument = match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!argument.startsWith("«")) continue;
    const slots = [...argument.matchAll(/\[\[([A-Za-z0-9]+)\]\]/g)].map(item => item[1]);
    if (slots.length === 0) throw new Error(`could not read MakeBasicObject slot list ${argument}`);
    shapes.set(slots.join(","), slots);
  }
  return [...shapes.values()].sort((a, b) => a.join(",").localeCompare(b.join(",")));
}

export function extractOrdinaryCreateFromConstructorInputs(source) {
  const shapes = new Map();
  for (const match of source.matchAll(/OrdinaryCreateFromConstructor\(([^)]*)\)/g)) {
    const argument = match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const additionalSlots = [...argument.matchAll(/\[\[([A-Za-z0-9]+)\]\]/g)]
      .map(item => item[1]);
    if (additionalSlots.length === 0) continue;
    const slots = ["Prototype", "Extensible", ...additionalSlots];
    shapes.set(slots.join(","), slots);
  }
  return [...shapes.values()].sort((a, b) => a.join(",").localeCompare(b.join(",")));
}

export function buildObjectLayouts(manifest, sourceInputs = null,
                                   ordinaryCreateFromConstructorInputs = null) {
  if (manifest.schemaVersion !== 1) throw new Error(`unsupported object-layout schema ${manifest.schemaVersion}`);
  const slotNames = uniqueByName(manifest.slots, "slot");
  const essentialMethodNames = uniqueByName(manifest.essentialMethods, "essential method");
  if (manifest.essentialMethods.length > 64) throw new Error("at most 64 essential methods are supported");
  const methodNames = uniqueByName(manifest.methodFamilies, "method family");
  uniqueByName(manifest.makeBasicObjectInputs, "MakeBasicObject input");
  for (const slot of manifest.slots) {
    if (!storageKinds.has(slot.storage)) throw new Error(`${slot.name}: invalid storage kind ${slot.storage}`);
    if (typeof slot.traced !== "boolean") throw new Error(`${slot.name}: traced must be boolean`);
    if ((slot.storage === "boolean") === slot.traced)
      throw new Error(`${slot.name}: boolean storage must be untraced and value-bearing storage must be traced`);
  }
  if (!slotNames.has("PrivateElements")) throw new Error("the PrivateElements slot is mandatory");
  if (!methodNames.has("OrdinaryObjectMethods")) throw new Error("OrdinaryObjectMethods is mandatory");
  if (!Array.isArray(manifest.activeDispatchMethods))
    throw new Error("activeDispatchMethods must be an array");
  const activeDispatchMethods = new Set();
  for (const method of manifest.activeDispatchMethods) {
    if (!essentialMethodNames.has(method)) throw new Error(`unknown active dispatch method ${method}`);
    if (activeDispatchMethods.has(method)) throw new Error(`duplicate active dispatch method ${method}`);
    activeDispatchMethods.add(method);
  }

  for (const family of manifest.methodFamilies) {
    if (!Array.isArray(family.overrides)) throw new Error(`${family.name}: overrides must be an array`);
    const seen = new Set();
    for (const method of family.overrides) {
      if (!essentialMethodNames.has(method)) throw new Error(`${family.name}: unknown essential method ${method}`);
      if (seen.has(method)) throw new Error(`${family.name}: duplicate override ${method}`);
      seen.add(method);
    }
    if (family.name === "OrdinaryObjectMethods" && family.overrides.length)
      throw new Error("OrdinaryObjectMethods cannot override its own defaults");
  }

  const slots = manifest.slots.map((slot, index) => ({ id: index + 1, ...slot }));
  const slotByName = new Map(slots.map(slot => [slot.name, slot]));
  const essentialMethods = manifest.essentialMethods.map((method, index) => ({ id: index + 1, ...method }));
  const methods = manifest.methodFamilies.map((method, index) => ({ id: index + 1, ...method }));
  const methodByName = new Map(methods.map(method => [method.name, method]));
  const fingerprints = new Set();
  const layouts = manifest.makeBasicObjectInputs.map((input, index) => {
    const creation = input.creation ?? "MakeBasicObject";
    if (creation !== "MakeBasicObject" && creation !== "OrdinaryCreateFromConstructor")
      throw new Error(`${input.name}: unknown object creation operation ${creation}`);
    if (!Array.isArray(input.slots)) throw new Error(`${input.name}: slots must be an array`);
    const seen = new Set();
    for (const name of input.slots) {
      if (!slotByName.has(name)) throw new Error(`${input.name}: unknown slot ${name}`);
      if (name === "PrivateElements")
        throw new Error(`${input.name}: PrivateElements is appended by MakeBasicObject, not supplied by its caller`);
      if (seen.has(name)) throw new Error(`${input.name}: duplicate slot ${name}`);
      seen.add(name);
    }
    const method = methodByName.get(input.methods);
    if (!method) throw new Error(`${input.name}: unknown method family ${input.methods}`);
    const finalSlots = [...input.slots, "PrivateElements"];
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ slots: finalSlots.map(name => slotByName.get(name)), methods: method.name }))
      .digest("hex");
    if (fingerprints.has(fingerprint)) throw new Error(`${input.name}: duplicate final layout fingerprint`);
    fingerprints.add(fingerprint);
    return { id: index + 1, name: input.name, creation, inputSlots: input.slots, slots: finalSlots,
      slotIds: finalSlots.map(name => slotByName.get(name).id), methods: method.name,
      methodFamilyId: method.id, fingerprint };
  });
  if (sourceInputs) {
    const declared = new Set(layouts.filter(layout => layout.creation === "MakeBasicObject")
      .map(layout => layout.inputSlots.join(",")));
    const extracted = new Set(sourceInputs.map(slots => slots.join(",")));
    for (const shape of extracted) if (!declared.has(shape))
      throw new Error(`pinned ECMA-262 has undeclared MakeBasicObject input [${shape}]`);
    for (const shape of declared) if (!extracted.has(shape))
      throw new Error(`object-layout manifest has no pinned MakeBasicObject call shape [${shape}]`);
  }
  if (ordinaryCreateFromConstructorInputs) {
    const pinned = new Set(ordinaryCreateFromConstructorInputs.map(slots => slots.join(",")));
    for (const layout of layouts.filter(layout =>
      layout.creation === "OrdinaryCreateFromConstructor")) {
      const shape = layout.inputSlots.join(",");
      if (!pinned.has(shape))
        throw new Error(`${layout.name}: no pinned OrdinaryCreateFromConstructor slot shape [${shape}]`);
    }
  }
  return { schemaVersion: 1, generatedFrom: "spec/object-layouts.json", slots, essentialMethods,
    activeDispatchMethods: [...activeDispatchMethods],
    methodFamilies: methods, ...(sourceInputs ? { pinnedMakeBasicObjectInputs: sourceInputs } : {}), layouts };
}

export function renderObjectLayoutJsl(generated) {
  const lines = [
    "; GENERATED by tools/object-layouts.mjs from spec/object-layouts.json. DO NOT EDIT.",
    "; These are specification-pinned internal-slot Lists accepted by object creation operations.",
    "; PrivateElements is deliberately absent: ordinary object creation appends it exactly once.",
    "",
  ];
  for (const family of generated.methodFamilies)
    lines.push(`(internal-method-family ${family.name})`);
  lines.push("");
  for (const method of generated.essentialMethods)
    lines.push(`(internal-method ${method.name})`);
  lines.push("");
  for (const method of generated.essentialMethods.filter(method =>
    generated.activeDispatchMethods.includes(method.name)))
    lines.push(`(macro UsesOrdinary${method.name} :params [(object dyn)] :ret bool (object-method-is-ordinary object ${method.name}))`);
  lines.push("");
  for (const slot of generated.slots)
    lines.push(`(internal-slot ${slot.name} ${slot.storage})`);
  lines.push("");
  for (const layout of generated.layouts)
    lines.push(`(slot-list ${layout.name} [${layout.inputSlots.join(" ")}])`);
  return `${lines.join("\n")}\n`;
}

export function renderObjectLayoutRuntime(generated) {
  const lines = [
    "/* GENERATED by tools/object-layouts.mjs. DO NOT EDIT. */",
    "#ifndef AOT_GENERATED_OBJECT_LAYOUTS_H",
    "#define AOT_GENERATED_OBJECT_LAYOUTS_H",
    "#include <stddef.h>",
    "#include <stdint.h>",
    "enum { AOT_SLOT_JS_VALUE = 1, AOT_SLOT_BOOLEAN = 2, AOT_SLOT_SPEC_LIST = 3 };",
    "typedef struct { uint16_t id, slot_count, method_family_id; const uint16_t *slot_ids; const uint8_t *storage; } AotObjectLayoutDesc;",
    "",
  ];
  const kind = { "js-value": "AOT_SLOT_JS_VALUE", boolean: "AOT_SLOT_BOOLEAN", "spec-list": "AOT_SLOT_SPEC_LIST" };
  for (const slot of generated.slots)
    lines.push(`#define AOT_INTERNAL_SLOT_${slot.name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()} ${slot.id}`);
  lines.push("");
  for (const family of generated.methodFamilies)
    lines.push(`#define AOT_METHOD_FAMILY_${family.name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()} ${family.id}`);
  lines.push(`#define AOT_METHOD_FAMILY_COUNT ${generated.methodFamilies.length}`);
  lines.push("");
  for (const method of generated.essentialMethods)
    lines.push(`#define AOT_INTERNAL_METHOD_${method.name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()} ${method.id}`);
  lines.push(`#define AOT_INTERNAL_METHOD_COUNT ${generated.essentialMethods.length}`);
  lines.push("static const uint64_t aot_method_family_override_masks[] = {");
  for (const family of generated.methodFamilies) {
    const mask = family.overrides.reduce((bits, name) =>
      bits | (1n << BigInt(generated.essentialMethods.find(method => method.name === name).id - 1)), 0n);
    lines.push(`  UINT64_C(0x${mask.toString(16)}), /* ${family.name} */`);
  }
  lines.push("};");
  lines.push("");
  for (const layout of generated.layouts) {
    lines.push(`static const uint16_t aot_layout_${layout.id}_slots[] = { ${layout.slotIds.join(", ")} };`);
    lines.push(`static const uint8_t aot_layout_${layout.id}_storage[] = { ${layout.slots.map(name => kind[generated.slots.find(slot => slot.name === name).storage]).join(", ")} };`);
  }
  lines.push("", "static const AotObjectLayoutDesc aot_object_layouts[] = {");
  for (const layout of generated.layouts)
    lines.push(`  { ${layout.id}, ${layout.slots.length}, ${layout.methodFamilyId}, aot_layout_${layout.id}_slots, aot_layout_${layout.id}_storage },`);
  lines.push("};", `static const size_t aot_object_layout_count = ${generated.layouts.length};`, "#endif", "");
  return lines.join("\n");
}

function main() {
  const check = process.argv.slice(2).includes("--check");
  if (process.argv.slice(2).some(argument => argument !== "--check"))
    throw new Error("usage: object-layouts.mjs [--check]");
  const sources = JSON.parse(readFileSync(join(projectRoot, "spec", "ecma262-sources.json"), "utf8"));
  const sourcePath = join(projectRoot, ".spec-cache", `ecma262-${sources.ecma262.commit}`, sources.ecma262.entry);
  if (!existsSync(sourcePath)) throw new Error(`pinned ECMA-262 source is absent: ${sourcePath}`);
  const sourceBytes = readFileSync(sourcePath);
  const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
  if (sourceDigest !== sources.ecma262.entrySha256) throw new Error("pinned ECMA-262 source digest differs from manifest");
  const sourceInputs = extractMakeBasicObjectInputs(sourceBytes.toString("utf8"));
  const ordinaryCreateInputs = extractOrdinaryCreateFromConstructorInputs(sourceBytes.toString("utf8"));
  const generated = buildObjectLayouts(JSON.parse(readFileSync(manifestPath, "utf8")), sourceInputs,
    ordinaryCreateInputs);
  const rendered = `${JSON.stringify(generated, null, 2)}\n`;
  const jslRendered = renderObjectLayoutJsl(generated);
  const runtimeRendered = renderObjectLayoutRuntime(generated);
  if (check) {
    if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== rendered)
      throw new Error(`generated object layouts differ from ${relative(projectRoot, outputPath)}; run npm run object-layouts`);
    if (!existsSync(jslOutputPath) || readFileSync(jslOutputPath, "utf8") !== jslRendered)
      throw new Error(`generated JSL slot lists differ from ${relative(projectRoot, jslOutputPath)}; run npm run object-layouts`);
    if (!existsSync(runtimeOutputPath) || readFileSync(runtimeOutputPath, "utf8") !== runtimeRendered)
      throw new Error(`generated runtime layouts differ from ${relative(projectRoot, runtimeOutputPath)}; run npm run object-layouts`);
    process.stdout.write(`checked ${outputPath}\n`);
    process.stdout.write(`checked ${jslOutputPath}\n`);
    process.stdout.write(`checked ${runtimeOutputPath}\n`);
  } else {
    writeFileSync(outputPath, rendered);
    writeFileSync(jslOutputPath, jslRendered);
    writeFileSync(runtimeOutputPath, runtimeRendered);
    process.stdout.write(`wrote ${outputPath}\n`);
    process.stdout.write(`wrote ${jslOutputPath}\n`);
    process.stdout.write(`wrote ${runtimeOutputPath}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`object-layouts: ${error.message}\n`);
    process.exitCode = 1;
  }
}
