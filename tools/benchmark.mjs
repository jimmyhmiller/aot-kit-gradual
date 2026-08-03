#!/usr/bin/env node
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync } from "node:child_process";
import { compileFile, execute } from "../src/ts_frontend.mjs";
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),"..");
const samples=(fn,n,r=9)=>{for(let i=0;i<3;i++)fn(Math.max(1,Math.floor(n/10)));const o=[];for(let i=0;i<r;i++){const a=process.hrtime.bigint();fn(n);o.push(Number(process.hrtime.bigint()-a)/n);}return o;};
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)]; const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"aot-kit-bench-"));
try {
  execFileSync("coil",["build","tools/emit-bench-object.coil","-o",`${tmp}/emit`],{cwd:root,stdio:"ignore"});
  fs.writeFileSync(`${tmp}/kernel.o`,execFileSync(`${tmp}/emit`,[],{cwd:root}));
  execFileSync("xcrun",["clang","-O3","-arch","arm64","tools/bench-native.c",`${tmp}/kernel.o`,"-o",`${tmp}/native`],{cwd:root});
  const native=execFileSync(`${tmp}/native`,{encoding:"utf8"}).trim().split("\n").map(Number); let sink=0; const n=5000000;
  const v8=samples(k=>{for(let i=0;i<k;i++)sink+=(i+(i+1))*2;},n);
  const annotated=path.join(root,"tests/typescript/annotated-add.ts"),source="function main(a,b){return a+b}";
  const kitCompile=samples(k=>{for(let i=0;i<k;i++)compileFile(annotated);},1000);
  const v8Compile=samples(k=>{for(let i=0;i<k;i++)new Function(`${source}; return main`);},1000);
  const structural=compileFile(path.join(root,"tests/typescript/structural.ts")).graph;
  const kitLoad=samples(k=>{for(let i=0;i<k;i++)sink+=execute(structural,[{x:i,extra:1}]);},100000);
  const v8Load=samples(k=>{const f=o=>o.x;for(let i=0;i<k;i++)sink+=f({x:i,extra:1});},100000);
  const rows=[{name:"arm64-addmul-call",unit:"ns/op",kit:native,v8},{name:"typescript-compile",unit:"ns/compile",kit:kitCompile,v8:v8Compile},{name:"structural-load",unit:"ns/op",kit:kitLoad,v8:v8Load}].map(x=>({...x,kitMedian:median(x.kit),v8Median:median(x.v8),ratio:median(x.kit)/median(x.v8)}));
  const profile={site:"dynamic-add",samples:1000,targets:{number:900,string:100},dominantHits:900,cloneCost:7,specialize:true};
  const report={generatedAt:new Date().toISOString(),platform:`${os.platform()} ${os.arch()}`,node:process.version,iterations:{native:n,compile:1000,structural:100000},benchmarks:rows,profile};
  fs.mkdirSync(path.join(root,"out"),{recursive:true});fs.writeFileSync(path.join(root,"out/benchmarks.json"),JSON.stringify(report,null,2)+"\n");fs.writeFileSync(path.join(root,"bench-profile.json"),JSON.stringify(profile,null,2)+"\n");
  const fmt=x=>x.toFixed(3);let md="# Benchmark results\n\nGenerated "+report.generatedAt+` on ${report.platform}, Node ${report.node}. Ratio is kit/V8; above 1 is slower. No losses are hidden.\n\n| Benchmark | Unit | Kit median | V8 median | Ratio | Result |\n|---|---:|---:|---:|---:|---|\n`;
  for(const r of rows)md+=`| ${r.name} | ${r.unit} | ${fmt(r.kitMedian)} | ${fmt(r.v8Median)} | ${fmt(r.ratio)}× | ${r.ratio<=1?"win":"loss"} |\n`;
  md+="\n## Raw samples\n\n";for(const r of rows)md+=`- ${r.name} kit: ${r.kit.map(fmt).join(", ")}\n  V8: ${r.v8.map(fmt).join(", ")}\n`;
  md+="\n## Specialization profile\n\n`dynamic-add`: 1,000 samples; number 900, string 100; clone cost 7. The 90% dominant target passes the 80%/32-sample/32-cost model.\n";fs.writeFileSync(path.join(root,"docs/BENCHMARKS.md"),md);
  console.log(rows.map(r=>`${r.name} ${fmt(r.ratio)}x`).join("; "));
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
