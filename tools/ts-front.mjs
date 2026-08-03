#!/usr/bin/env node
import { compileFile, execute, guardCount } from "../src/ts_frontend.mjs";
const [file, args = "[]"] = process.argv.slice(2);
if (!file) { console.error("usage: ts-front.mjs FILE.ts '[args]'"); process.exit(2); }
const { graph } = compileFile(file);
console.log(JSON.stringify({ result: execute(graph, JSON.parse(args)), guards: guardCount(graph), graph }, null, 2));
