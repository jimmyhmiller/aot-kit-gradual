#!/usr/bin/env node
import fs from "node:fs";
import { executeNormalized, normalizeTypeScript } from "../src/frontend_ir.mjs";

const [file, args = "[]"] = process.argv.slice(2);
if (!file) { console.error("usage: ts-front.mjs FILE.ts '[args]'"); process.exit(2); }
const program = normalizeTypeScript(fs.readFileSync(file, "utf8"), file);
console.log(JSON.stringify({ result: executeNormalized(program, JSON.parse(args)), program }, null, 2));
