#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

console.log(`backend module DAG verified: ${layers.length} layers and one compatibility facade`);
