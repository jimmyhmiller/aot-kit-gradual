#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const corpus = process.env.AOT_V8_CORPUS ? path.resolve(process.env.AOT_V8_CORPUS) : path.join(root, "benchmarks/v8-v7");
const manifestPath = path.join(corpus, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const expectedCommit = "f96b55bd7c9c36e9ab5cbef08f094bf4c57f9707";
const expectedBenchmarks = ["Richards", "DeltaBlue", "Crypto", "RayTrace", "EarleyBoyer", "RegExp", "Splay", "NavierStokes"];
if (manifest.version !== 7 || manifest.upstream.tag !== "7.4.77" || manifest.upstream.commit !== expectedCommit) {
  throw new Error("provenance mismatch: expected V8 v7 tag 7.4.77 at the pinned commit");
}
if (manifest.license.spdx !== "BSD-3-Clause" || manifest.license.file !== "LICENSE") throw new Error("license inventory mismatch");
if (JSON.stringify(manifest.benchmarks.map(entry => entry.name)) !== JSON.stringify(expectedBenchmarks)) throw new Error("benchmark inventory mismatch");
const mode = process.argv[2] ?? "--verify";
if (!new Set(["--verify", "--update"]).has(mode)) {
  throw new Error("usage: node tools/v8-fetch.mjs [--verify|--update]");
}

const entries = [
  { file: manifest.license.file, sha256: manifest.license.sha256, repositoryRoot: true },
  ...manifest.harness,
  ...manifest.benchmarks,
];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const base = `${manifest.upstream.repository}/+/${manifest.upstream.commit}`;

async function upstreamBytes(entry) {
  const relative = entry.repositoryRoot ? entry.file : `${manifest.upstream.directory}/${entry.file}`;
  const url = `${base}/${relative}?format=TEXT`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url);
    if (response.ok) return Buffer.from((await response.text()).replace(/\s/g, ""), "base64");
    if (attempt === 4 || ![429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`fetch ${url}: HTTP ${response.status}`);
    }
    await new Promise(resolve => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  }
}

const failures = [];
for (const entry of entries) {
  const target = path.join(corpus, entry.file);
  if (mode === "--update") {
    const bytes = await upstreamBytes(entry);
    const actual = sha256(bytes);
    if (actual !== entry.sha256) throw new Error(`${entry.file}: upstream hash ${actual}, expected ${entry.sha256}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) fs.writeFileSync(target, bytes);
  }
  if (!fs.existsSync(target)) {
    failures.push(`${entry.file}: missing`);
    continue;
  }
  const actual = sha256(fs.readFileSync(target));
  if (actual !== entry.sha256) failures.push(`${entry.file}: hash ${actual}, expected ${entry.sha256}`);
}
if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  console.log(`verified ${entries.length} files at ${manifest.upstream.commit}`);
}
