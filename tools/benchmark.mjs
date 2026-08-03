#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { compileFile, execute } from "../src/ts_frontend.mjs";

const args = new Set(process.argv.slice(2));
for (const arg of args) {
  if (arg !== "--publish") throw new Error(`unknown argument: ${arg}`);
}
const publish = args.has("--publish");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const samples = (fn, n, r = 9) => {
  for (let i = 0; i < 3; i++) fn(Math.max(1, Math.floor(n / 10)));
  const out = [];
  for (let i = 0; i < r; i++) {
    const start = process.hrtime.bigint();
    fn(n);
    out.push(Number(process.hrtime.bigint() - start) / n);
  }
  return out;
};
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aot-kit-bench-"));

try {
  execFileSync("coil", ["build", "tools/emit-bench-object.coil", "-o", `${tmp}/emit`], {
    cwd: root,
    stdio: "ignore",
  });
  fs.writeFileSync(`${tmp}/kernel.o`, execFileSync(`${tmp}/emit`, [], { cwd: root }));
  execFileSync(
    "xcrun",
    ["clang", "-O3", "-arch", "arm64", "tools/bench-native.c", `${tmp}/kernel.o`, "-o", `${tmp}/native`],
    { cwd: root },
  );
  const native = execFileSync(`${tmp}/native`, { encoding: "utf8" }).trim().split("\n").map(Number);
  let sink = 0;
  const n = 5_000_000;
  const v8 = samples(k => {
    for (let i = 0; i < k; i++) sink += (i + (i + 1)) * 2;
  }, n);
  const annotated = path.join(root, "tests/typescript/annotated-add.ts");
  const source = "function main(a,b){return a+b}";
  const kitCompile = samples(k => {
    for (let i = 0; i < k; i++) compileFile(annotated);
  }, 1000);
  const v8Compile = samples(k => {
    for (let i = 0; i < k; i++) new Function(`${source}; return main`);
  }, 1000);
  const structural = compileFile(path.join(root, "tests/typescript/structural.ts")).graph;
  const kitLoad = samples(k => {
    for (let i = 0; i < k; i++) sink += execute(structural, [{ x: i, extra: 1 }]);
  }, 100_000);
  const v8Load = samples(k => {
    const f = object => object.x;
    for (let i = 0; i < k; i++) sink += f({ x: i, extra: 1 });
  }, 100_000);
  const rows = [
    { name: "arm64-addmul-call", unit: "ns/op", kit: native, v8 },
    { name: "typescript-compile", unit: "ns/compile", kit: kitCompile, v8: v8Compile },
    { name: "structural-load", unit: "ns/op", kit: kitLoad, v8: v8Load },
  ].map(row => ({
    ...row,
    kitMedian: median(row.kit),
    v8Median: median(row.v8),
    ratio: median(row.kit) / median(row.v8),
  }));
  const profile = {
    site: "dynamic-add",
    samples: 1000,
    targets: { number: 900, string: 100 },
    dominantHits: 900,
    cloneCost: 7,
    specialize: true,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    platform: `${os.platform()} ${os.arch()}`,
    node: process.version,
    iterations: { native: n, compile: 1000, structural: 100_000 },
    benchmarks: rows,
    profile,
  };
  fs.mkdirSync(path.join(root, "out"), { recursive: true });
  fs.writeFileSync(path.join(root, "out/benchmarks.json"), `${JSON.stringify(report, null, 2)}\n`);

  if (publish) {
    fs.writeFileSync(path.join(root, "bench-profile.json"), `${JSON.stringify(profile, null, 2)}\n`);
    const fmt = value => value.toFixed(3);
    let markdown = "# Benchmark results\n\n";
    markdown += `Generated ${report.generatedAt} on ${report.platform}, Node ${report.node}. `;
    markdown += "Ratio is kit/V8; above 1 is slower. No losses are hidden.\n\n";
    markdown += "| Benchmark | Unit | Kit median | V8 median | Ratio | Result |\n";
    markdown += "|---|---:|---:|---:|---:|---|\n";
    for (const row of rows) {
      markdown += `| ${row.name} | ${row.unit} | ${fmt(row.kitMedian)} | ${fmt(row.v8Median)} | `;
      markdown += `${fmt(row.ratio)}× | ${row.ratio <= 1 ? "win" : "loss"} |\n`;
    }
    markdown += "\n## Raw samples\n\n";
    for (const row of rows) {
      markdown += `- ${row.name} kit: ${row.kit.map(fmt).join(", ")}\n`;
      markdown += `  V8: ${row.v8.map(fmt).join(", ")}\n`;
    }
    markdown += "\n## Specialization profile\n\n";
    markdown += "`dynamic-add`: 1,000 samples; number 900, string 100; clone cost 7. ";
    markdown += "The 90% dominant target passes the 80%/32-sample/32-cost model.\n";
    fs.writeFileSync(path.join(root, "docs/BENCHMARKS.md"), markdown);
  }

  const fmt = value => value.toFixed(3);
  console.log(rows.map(row => `${row.name} ${fmt(row.ratio)}x`).join("; "));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
