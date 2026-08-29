import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const manifestPath = path.join(root, "spec/intrinsics.json");
export const generatedPath = path.join(root, "src/generated_intrinsics.coil");
export const generatedPublicationPath = path.join(root, "lib/generated/intrinsic-publication.jsl");
export const generatedSupportPath = path.join(root, "spec/generated/intrinsic-support.json");

const kinds = new Set(["constructor", "function", "namespace", "value"]);
const owners = new Set(["jsl", "frontend", "runtime", "host", "composite"]);
const propertyKinds = new Set(["well-known-symbol", "data", "method", "accessor"]);
const propertyTargets = new Set(["constructor", "prototype"]);
const propertyKeyKinds = new Set(["string", "well-known-symbol"]);
const dataValueKinds = new Set(["constructor", "prototype", "string", "number", "jsl"]);

export function validateIntrinsicManifest(manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (manifest?.scope !== "currently-published-global-bindings") {
    errors.push("scope must name the current publication boundary exactly");
  }
  if (!Array.isArray(manifest?.intrinsics) || manifest.intrinsics.length === 0) {
    errors.push("intrinsics must be a non-empty array");
    return errors;
  }

  const ids = new Set();
  const constants = new Set();
  const symbols = new Set();
  const globals = new Set();
  for (const [index, intrinsic] of manifest.intrinsics.entries()) {
    const where = `intrinsics[${index}]`;
    if (typeof intrinsic.id !== "string" || intrinsic.id.length === 0) {
      errors.push(`${where}.id must be a non-empty string`);
    } else if (ids.has(intrinsic.id)) errors.push(`duplicate intrinsic id ${intrinsic.id}`);
    else ids.add(intrinsic.id);

    if (!/^FE-INTRINSIC-[A-Z0-9]+$/.test(intrinsic.constant ?? "")) {
      errors.push(`${where}.constant must be a FE-INTRINSIC-* identifier`);
    } else if (constants.has(intrinsic.constant)) {
      errors.push(`duplicate intrinsic constant ${intrinsic.constant}`);
    } else constants.add(intrinsic.constant);

    if (!Number.isSafeInteger(intrinsic.symbol) || intrinsic.symbol >= 0) {
      errors.push(`${where}.symbol must be a negative safe integer`);
    } else if (symbols.has(intrinsic.symbol)) errors.push(`duplicate intrinsic symbol ${intrinsic.symbol}`);
    else symbols.add(intrinsic.symbol);

    if (!kinds.has(intrinsic.kind)) errors.push(`${where}.kind is invalid`);
    if (!owners.has(intrinsic.owner)) errors.push(`${where}.owner is invalid`);
    if (typeof intrinsic.callable !== "boolean") errors.push(`${where}.callable must be boolean`);
    if (typeof intrinsic.constructable !== "boolean") errors.push(`${where}.constructable must be boolean`);
    if (intrinsic.prototype !== null && typeof intrinsic.prototype !== "string") {
      errors.push(`${where}.prototype must be a string or null`);
    }
    if (typeof intrinsic.implementation !== "string" || intrinsic.implementation.length === 0) {
      errors.push(`${where}.implementation must name its current owner entry`);
    }
    if (intrinsic.initializer !== undefined &&
        !/^[A-Za-z][A-Za-z0-9]*$/.test(intrinsic.initializer)) {
      errors.push(`${where}.initializer must name a JSL declaration`);
    }
    if (!Array.isArray(intrinsic.properties)) errors.push(`${where}.properties must be an array`);
    else {
      const propertyKeys = new Set();
      for (const [propertyIndex, property] of intrinsic.properties.entries()) {
        const propertyWhere = `${where}.properties[${propertyIndex}]`;
        if (typeof property.key !== "string" || property.key.length === 0) {
          errors.push(`${propertyWhere}.key must be a non-empty string`);
        } else {
          const propertyIdentity = `${property.target ?? "constructor"}:${property.key}`;
          if (propertyKeys.has(propertyIdentity)) {
            errors.push(`${where} has duplicate property ${propertyIdentity}`);
          } else propertyKeys.add(propertyIdentity);
        }
        if (!propertyKinds.has(property.kind)) {
          errors.push(`${propertyWhere}.kind is not supported`);
        }
        if (!propertyTargets.has(property.target ?? "constructor")) {
          errors.push(`${propertyWhere}.target must be constructor or prototype`);
        }
        if (!propertyKeyKinds.has(property.keyKind ?? "string")) {
          errors.push(`${propertyWhere}.keyKind must be string or well-known-symbol`);
        }
        if ((property.keyKind ?? "string") === "well-known-symbol" &&
            !/^[A-Za-z][A-Za-z0-9]*$/.test(property.keyRoot ?? "")) {
          errors.push(`${propertyWhere}.keyRoot must name the well-known Symbol root`);
        }
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(property.implementation ?? "")) {
          errors.push(`${propertyWhere}.implementation must be a JSL declaration name`);
        }
        if (property.kind === "well-known-symbol" &&
            (typeof property.description !== "string" || property.description.length === 0)) {
          errors.push(`${propertyWhere}.description must be a non-empty string`);
        }
        if (property.kind === "well-known-symbol" && (property.keyKind ?? "string") !== "string") {
          errors.push(`${propertyWhere}.well-known-symbol publication key must be a string`);
        }
        if (property.kind === "data") {
          if (!dataValueKinds.has(property.value?.kind)) {
            errors.push(`${propertyWhere}.value.kind must be constructor, prototype, string, number, or jsl`);
          } else if (property.value.kind === "string" && typeof property.value.value !== "string") {
            errors.push(`${propertyWhere}.value.value must be a string`);
          } else if (property.value.kind === "number" && !Number.isSafeInteger(property.value.value)) {
            errors.push(`${propertyWhere}.value.value must be a safe integer`);
          } else if (property.value.kind === "jsl" &&
                     !/^[A-Za-z][A-Za-z0-9]*$/.test(property.value.root ?? "")) {
            errors.push(`${propertyWhere}.value.root must name a zero-argument JSL declaration`);
          }
        }
        if (property.kind === "method") {
          if (!/^[A-Za-z][A-Za-z0-9]*$/.test(property.closure ?? "")) {
            errors.push(`${propertyWhere}.closure must be a JSL callable name`);
          }
          if (typeof property.name !== "string" || property.name.length === 0) {
            errors.push(`${propertyWhere}.name must be a non-empty string`);
          }
          if (!Number.isSafeInteger(property.length) || property.length < 0) {
            errors.push(`${propertyWhere}.length must be a non-negative safe integer`);
          }
        }
        if (property.kind === "accessor") {
          if (!/^[A-Za-z][A-Za-z0-9]*$/.test(property.getter ?? "")) {
            errors.push(`${propertyWhere}.getter must be a JSL callable name`);
          }
          if (typeof property.getterName !== "string" || property.getterName.length === 0) {
            errors.push(`${propertyWhere}.getterName must be a non-empty string`);
          }
          if (property.setter !== null &&
              !/^[A-Za-z][A-Za-z0-9]*$/.test(property.setter ?? "")) {
            errors.push(`${propertyWhere}.setter must be null or a JSL callable name`);
          }
          if (property.setter !== null &&
              (typeof property.setterName !== "string" || property.setterName.length === 0)) {
            errors.push(`${propertyWhere}.setterName must be a non-empty string when setter is present`);
          }
          if (property.writable !== false) {
            errors.push(`${propertyWhere}.writable must be false for an accessor`);
          }
        }
        for (const attribute of ["writable", "enumerable", "configurable"]) {
          if (typeof property[attribute] !== "boolean") {
            errors.push(`${propertyWhere}.${attribute} must be boolean`);
          }
        }
      }
    }
    if (!Array.isArray(intrinsic.globals) || intrinsic.globals.length === 0) {
      errors.push(`${where}.globals must be a non-empty array`);
    } else {
      for (const global of intrinsic.globals) {
        if (typeof global !== "string" || global.length === 0) errors.push(`${where}.globals contains an invalid name`);
        else if (globals.has(global)) errors.push(`duplicate global binding ${global}`);
        else globals.add(global);
      }
    }
    if (intrinsic.kind === "namespace" && (intrinsic.callable || intrinsic.constructable)) {
      errors.push(`${where}: namespace objects cannot be callable or constructable`);
    }
    if (intrinsic.kind === "value" && (intrinsic.callable || intrinsic.constructable || intrinsic.prototype !== null)) {
      errors.push(`${where}: value bindings cannot be callable, constructable, or have a prototype`);
    }
    if (intrinsic.kind === "function" && intrinsic.constructable) {
      errors.push(`${where}: function entries in this schema are explicitly non-constructable`);
    }
  }

  if (!Array.isArray(manifest.lowering)) {
    errors.push("lowering must be an array");
  } else {
    const loweringIds = new Set();
    for (const [index, lowering] of manifest.lowering.entries()) {
      const where = `lowering[${index}]`;
      if (typeof lowering.id !== "string" || !ids.has(lowering.id)) {
        errors.push(`${where}.id must reference an intrinsic`);
      } else if (loweringIds.has(lowering.id)) {
        errors.push(`duplicate lowering metadata for ${lowering.id}`);
      } else loweringIds.add(lowering.id);
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(lowering.family ?? "")) {
        errors.push(`${where}.family must be a kebab-case lowering family`);
      }
      if (lowering.runtimeKind !== null &&
          (!Number.isSafeInteger(lowering.runtimeKind) || lowering.runtimeKind < 0)) {
        errors.push(`${where}.runtimeKind must be a non-negative safe integer or null`);
      }
    }
    for (const id of ids) {
      if (!loweringIds.has(id)) errors.push(`missing lowering metadata for ${id}`);
    }
  }
  return errors;
}

function coilString(value) {
  return JSON.stringify(value);
}

export function renderIntrinsicCoil(manifest) {
  const errors = validateIntrinsicManifest(manifest);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const entries = [...manifest.intrinsics].sort((a, b) => a.symbol - b.symbol);
  const globals = entries.flatMap(entry => entry.globals.map(name => ({ name, entry })))
    .sort((a, b) => a.name.localeCompare(b.name));
  const loweringById = new Map(manifest.lowering.map(entry => [entry.id, entry]));
  const families = [...new Set(manifest.lowering.map(entry => entry.family))].sort();
  const familyConstant = family => `FE-INTRINSIC-FAMILY-${family.toUpperCase().replaceAll("-", "_")}`;

  const lines = [
    ";; GENERATED by tools/intrinsic-manifest.mjs from spec/intrinsics.json. DO NOT EDIT.",
    ";; This is the compiler view of the currently published global-binding surface; prototype",
    ";; properties remain empty until their publication descriptors are migrated explicitly.",
    "(module generated_intrinsics)",
    "(import \"coil.slice\" :use *)",
    "",
  ];
  for (const entry of entries) lines.push(`(const ${entry.constant} i64 ${entry.symbol})`);
  lines.push("", "(const FE-INTRINSIC-FAMILY-UNKNOWN i64 0)");
  families.forEach((family, index) => lines.push(`(const ${familyConstant(family)} i64 ${index + 1})`));
  lines.push("", "(defn fe-intrinsic-name-generated [(name (slice u8))] (-> i64)", "  (cond");
  for (const { name, entry } of globals) lines.push(`    (= name ${coilString(name)}) ${entry.constant}`);
  lines.push("    :else -1))", "", "(defn fe-intrinsic-family [(symbol i64)] (-> i64)", "  (cond");
  for (const entry of entries) {
    lines.push(`    (= symbol ${entry.constant}) ${familyConstant(loweringById.get(entry.id).family)}`);
  }
  lines.push("    :else FE-INTRINSIC-FAMILY-UNKNOWN))",
    "", "(defn fe-intrinsic-runtime-kind [(symbol i64)] (-> i64)", "  (cond");
  for (const entry of entries) {
    const runtimeKind = loweringById.get(entry.id).runtimeKind;
    if (runtimeKind !== null) lines.push(`    (= symbol ${entry.constant}) ${runtimeKind}`);
  }
  lines.push("    :else -1))",
    "", "(defn fe-intrinsic-callable? [(symbol i64)] (-> bool)", "  (cond");
  for (const entry of entries) lines.push(`    (= symbol ${entry.constant}) ${entry.callable}`);
  lines.push("    :else false))",
    "", "(defn fe-intrinsic-constructable? [(symbol i64)] (-> bool)", "  (cond");
  for (const entry of entries) lines.push(`    (= symbol ${entry.constant}) ${entry.constructable}`);
  lines.push("    :else false))",
    "", "(defn fe-intrinsic-property-implementation [(symbol i64) (name (slice u8))] (-> (slice u8))", "  (cond");
  for (const entry of entries) {
    for (const property of entry.properties) {
      if ((property.target ?? "constructor") !== "constructor") continue;
      lines.push(`    (and (= symbol ${entry.constant}) (= name ${coilString(property.key)})) ${coilString(property.implementation)}`);
    }
  }
  lines.push("    :else \"\"))",
    "", "(defn fe-intrinsic-initializer [(symbol i64)] (-> (slice u8))",
    "  (cond");
  for (const entry of entries) {
    if (entry.initializer !== undefined) {
      lines.push(`    (= symbol ${entry.constant}) ${coilString(entry.initializer)}`);
    }
  }
  lines.push("    :else \"\"))",
    "", "(defn fe-intrinsic-property-callable? [(symbol i64) (name (slice u8))] (-> bool)",
    "  (cond");
  for (const entry of entries) {
    for (const property of entry.properties) {
      if ((property.target ?? "constructor") !== "constructor" || property.kind !== "method") continue;
      lines.push(`    (and (= symbol ${entry.constant}) (= name ${coilString(property.key)})) true`);
    }
  }
  lines.push("    :else false))",
    "", "(defn fe-intrinsic-property-value-root [(symbol i64) (name (slice u8))] (-> (slice u8))",
    "  (cond");
  for (const entry of entries) {
    for (const property of entry.properties) {
      if ((property.target ?? "constructor") !== "constructor" ||
          property.kind !== "data" || property.value.kind !== "jsl") continue;
      lines.push(`    (and (= symbol ${entry.constant}) (= name ${coilString(property.key)})) ${coilString(property.value.root)}`);
    }
  }
  lines.push("    :else \"\"))",
    "", "(defn fe-error-intrinsic? [(symbol i64)] (-> bool)",
    "  (= (fe-intrinsic-family symbol) FE-INTRINSIC-FAMILY-ERROR))");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function renderIntrinsicPublicationJsl(manifest) {
  const errors = validateIntrinsicManifest(manifest);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const properties = manifest.intrinsics.flatMap(intrinsic =>
    intrinsic.properties.map(property => ({ intrinsic, property })));
  const lines = [
    ";; GENERATED by tools/intrinsic-manifest.mjs from spec/intrinsics.json. DO NOT EDIT.",
    ";; Each declaration publishes one independently demand-loadable intrinsic root and its exact",
    ";; descriptor attributes; consumers never initialize an unrelated constructor surface.",
    "",
  ];
  for (const { intrinsic, property } of properties) {
    const lowering = manifest.lowering.find(entry => entry.id === intrinsic.id);
    if (lowering?.runtimeKind === null) continue;
    const attributes = (property.writable ? 1 : 0) |
      (property.enumerable ? 2 : 0) | (property.configurable ? 4 : 0);
    const targetName = (property.target ?? "constructor") === "prototype" ? "prototype" : "constructor";
    const targetValue = targetName === "prototype"
      ? `(BuiltinPrototypeValue ${lowering.runtimeKind})`
      : `(BuiltinConstructorValue ${lowering.runtimeKind})`;
    const keyValue = (property.keyKind ?? "string") === "well-known-symbol"
      ? `(${property.keyRoot})`
      : `(ToPropertyKey ${coilString(property.key)})`;
    if (property.kind === "well-known-symbol") {
      lines.push(
        `(builtin ${property.implementation} :transitioning true :params [] :ret dyn`,
        `  (let [(${targetName} ${targetValue})`,
        `        (value (WellKnownSymbol ${targetName} ${coilString(property.key)} ${coilString(property.description)}))`,
        `        (marked (%SetPropertyAttributes ${targetName} (ToPropertyKey ${coilString(property.key)}) ${attributes}))]`,
        "    value))",
        "",
      );
    } else if (property.kind === "data") {
      const value = property.value.kind === "constructor"
        ? "constructor"
        : property.value.kind === "prototype"
          ? "prototype"
          : property.value.kind === "jsl"
            ? `(%Box (${property.value.root}))`
            : `(%Box ${coilString(property.value.value)})`;
      lines.push(
        `(builtin ${property.implementation} :transitioning true :params [] :ret dyn`,
        `  (let [(constructor (BuiltinConstructorValue ${lowering.runtimeKind}))`,
        `        (prototype (BuiltinPrototypeValue ${lowering.runtimeKind}))`,
        `        (key ${keyValue})`,
        `        (value ${value})`,
        `        (stored (if (HasOwnProperty ${targetName} key)`,
        `                    (GetProperty ${targetName} key)`,
        `                    (%DefinePropertyValue ${targetName} key value)))`,
        `        (marked (%SetPropertyAttributes ${targetName} key ${attributes}))]`,
        "    value))",
        "",
      );
    } else if (property.kind === "method") {
      lines.push(
        `(builtin ${property.implementation} :transitioning true :params [] :ret dyn`,
        `  (let [(${targetName} ${targetValue})`,
        `        (key ${keyValue})]`,
        `    (if (HasOwnProperty ${targetName} key)`,
        `        (GetProperty ${targetName} key)`,
        `        (let [(function (%Box (closure ${property.closure})))`,
        `              (lengthStored (%DefinePropertyValue function (ToPropertyKey "length") (%Box ${property.length})))`,
        `              (lengthMarked (%SetPropertyAttributes function (ToPropertyKey "length") 4))`,
        `              (nameStored (%DefinePropertyValue function (ToPropertyKey "name") (%Box ${coilString(property.name)})))`,
        `              (nameMarked (%SetPropertyAttributes function (ToPropertyKey "name") 4))`,
        `              (stored (%DefinePropertyValue ${targetName} key function))`,
        `              (marked (%SetPropertyAttributes ${targetName} key ${attributes}))]`,
        "          function))))",
        "",
      );
    } else if (property.kind === "accessor") {
      const setterBindings = property.setter === null
        ? [`              (setterStored (%DefinePropertySetter ${targetName} key (%Box undefined)))`]
        : [
            `              (setter (%Box (closure ${property.setter})))`,
            `              (setterLengthStored (%DefinePropertyValue setter (ToPropertyKey "length") (%Box 1)))`,
            `              (setterLengthMarked (%SetPropertyAttributes setter (ToPropertyKey "length") 4))`,
            `              (setterNameStored (%DefinePropertyValue setter (ToPropertyKey "name") (%Box ${coilString(property.setterName)})))`,
            `              (setterNameMarked (%SetPropertyAttributes setter (ToPropertyKey "name") 4))`,
            `              (setterStored (%DefinePropertySetter ${targetName} key setter))`,
          ];
      lines.push(
        `(builtin ${property.implementation} :transitioning true :params [] :ret dyn`,
        `  (let [(${targetName} ${targetValue})`,
        `        (key ${keyValue})]`,
        `    (if (HasOwnProperty ${targetName} key)`,
        `        (%PropertyGetter ${targetName} key)`,
        `        (let [(getter (%Box (closure ${property.getter})))`,
        `              (lengthStored (%DefinePropertyValue getter (ToPropertyKey "length") (%Box 0)))`,
        `              (lengthMarked (%SetPropertyAttributes getter (ToPropertyKey "length") 4))`,
        `              (nameStored (%DefinePropertyValue getter (ToPropertyKey "name") (%Box ${coilString(property.getterName)})))`,
        `              (nameMarked (%SetPropertyAttributes getter (ToPropertyKey "name") 4))`,
        `              (getterStored (%DefinePropertyGetter ${targetName} key getter))`,
        ...setterBindings,
        `              (marked (%SetPropertyAttributes ${targetName} key ${attributes | 8}))]`,
        "          getter))))",
        "",
      );
    }
  }
  for (const intrinsic of manifest.intrinsics) {
    if (intrinsic.initializer === undefined) continue;
    const lowering = manifest.lowering.find(entry => entry.id === intrinsic.id);
    if (lowering?.runtimeKind === null) continue;
    const roots = intrinsic.properties.map(property => property.implementation);
    lines.push(
      `(builtin ${intrinsic.initializer} :transitioning true :params [] :ret dyn`,
      `  (let [(constructor (BuiltinConstructorValue ${lowering.runtimeKind}))`,
      ...roots.map((root, index) => `        (property${index} (${root}))`),
      "        ]",
      "    constructor))",
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderIntrinsicSupport(manifest, sourceText = `${JSON.stringify(manifest, null, 2)}\n`) {
  const errors = validateIntrinsicManifest(manifest);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const loweringById = new Map(manifest.lowering.map(entry => [entry.id, entry]));
  const entries = [...manifest.intrinsics]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(entry => ({
      id: entry.id,
      globals: [...entry.globals].sort(),
      kind: entry.kind,
      callable: entry.callable,
      constructable: entry.constructable,
      prototype: entry.prototype,
      owner: entry.owner,
      implementation: entry.implementation,
      initializer: entry.initializer ?? null,
      loweringFamily: loweringById.get(entry.id).family,
      runtimeKind: loweringById.get(entry.id).runtimeKind,
      publishedProperties: entry.properties.length,
      properties: entry.properties.map(property => ({ ...property })),
    }));
  const support = {
    schemaVersion: 1,
    generatedFrom: {
      path: "spec/intrinsics.json",
      sha256: crypto.createHash("sha256").update(sourceText).digest("hex"),
      scope: manifest.scope,
    },
    summary: {
      intrinsicIdentities: entries.length,
      globalBindings: entries.reduce((sum, entry) => sum + entry.globals.length, 0),
      publishedProperties: entries.reduce((sum, entry) => sum + entry.publishedProperties, 0),
    },
    entries,
  };
  return `${JSON.stringify(support, null, 2)}\n`;
}

export function loadIntrinsicManifest(file = manifestPath) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  const check = process.argv.includes("--check");
  const sourceText = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(sourceText);
  const output = renderIntrinsicCoil(manifest);
  const publication = renderIntrinsicPublicationJsl(manifest);
  const support = renderIntrinsicSupport(manifest, sourceText);
  if (check) {
    const stale = [
      [generatedPath, output],
      [generatedPublicationPath, publication],
      [generatedSupportPath, support],
    ].filter(([file, expected]) => !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== expected);
    if (stale.length > 0) {
      for (const [file] of stale) console.error(`stale generated intrinsic artifact: ${file}`);
      process.exitCode = 1;
      return;
    }
    console.log(`checked ${generatedPath}`);
    console.log(`checked ${generatedPublicationPath}`);
    console.log(`checked ${generatedSupportPath}`);
    return;
  }
  fs.writeFileSync(generatedPath, output);
  fs.mkdirSync(path.dirname(generatedPublicationPath), { recursive: true });
  fs.writeFileSync(generatedPublicationPath, publication);
  fs.writeFileSync(generatedSupportPath, support);
  console.log(`generated ${generatedPath}`);
  console.log(`generated ${generatedPublicationPath}`);
  console.log(`generated ${generatedSupportPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
