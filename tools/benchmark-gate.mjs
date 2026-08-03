#!/usr/bin/env node
import assert from "node:assert/strict";import fs from "node:fs";import {execFileSync} from "node:child_process";
execFileSync("node",["tools/benchmark.mjs"],{stdio:"inherit"});const r=JSON.parse(fs.readFileSync("out/benchmarks.json","utf8"));assert.equal(r.benchmarks.length,3);
for(const b of r.benchmarks){assert.equal(b.kit.length,9);assert.equal(b.v8.length,9);assert.ok(b.ratio>0);assert.ok(Number.isFinite(b.ratio));}
assert.equal(r.profile.specialize,true);assert.ok(r.profile.dominantHits*100>=r.profile.samples*80);assert.ok(r.profile.cloneCost<=32);const md=fs.readFileSync("docs/BENCHMARKS.md","utf8");assert.match(md,/Raw samples/);assert.match(md,/loss|win/);console.log("benchmark tables, raw samples, ratios, and specialization profile verified");
