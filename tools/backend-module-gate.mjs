#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const layers = [
  "backend_core",
  "backend_cfg",
  "backend_select",
  "backend_liveness",
  "backend_schedule",
  "backend_allocate",
  "backend_aarch64",
  "backend_macho",
];

const sources = new Map();
for (const layer of layers) {
  const source = await readFile(new URL(`../src/${layer}.coil`, import.meta.url), "utf8");
  assert.match(source, new RegExp(`\\(module ${layer}\\)`), `${layer} declares its namespace`);
  sources.set(layer, source);
}

for (const [index, layer] of layers.entries()) {
  const imports = [...sources.get(layer).matchAll(/\(import "(backend_[^"]+)"/g)].map(
    ([, dependency]) => dependency,
  );
  for (const dependency of imports) {
    const dependencyIndex = layers.indexOf(dependency);
    assert.notEqual(dependencyIndex, -1, `${layer} imports a known backend layer: ${dependency}`);
    assert.ok(
      dependencyIndex < index,
      `${layer} may only import earlier backend layers, not ${dependency}`,
    );
  }
}

const facade = await readFile(new URL("../src/backend.coil", import.meta.url), "utf8");
assert.doesNotMatch(facade, /^\(def/m, "backend facade contains no implementation definitions");
const reexports = [...facade.matchAll(/\(import "(backend_[^"]+)" :reexport\)/g)].map(
  ([, dependency]) => dependency,
);
assert.deepEqual(reexports, layers, "backend facade reexports every layer in dependency order");

async function coilSources(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) files.push(...(await coilSources(child)));
    else if (entry.name.endsWith(".coil")) files.push(child);
  }
  return files;
}

let callers = 0;
for (const root of ["../src/", "../tests/", "../tools/"]) {
  for (const file of await coilSources(new URL(root, import.meta.url))) {
    if (file.pathname.endsWith("/src/backend.coil")) continue;
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /^\(import "backend"/m,
      `${fileURLToPath(file)} must import the phases it actually uses`,
    );
    const implementation = /\/src\/backend_[^/]+\.coil$/.test(file.pathname);
    if (!implementation && /^\(import "backend_[^"]+" :use \*\)/m.test(source)) callers += 1;
  }
}

console.log(
  `backend module DAG verified: ${layers.length} layers, ${callers} explicit callers, one public facade`,
);
