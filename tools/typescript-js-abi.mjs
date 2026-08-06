#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const mode = process.argv[2] ?? "--verify";
if (!new Set(["--verify", "--update"]).has(mode)) throw new Error("usage: node tools/typescript-js-abi.mjs [--verify|--update]");
const archive = execFileSync(path.join(root, "tools/build-typescript-go-bridge.sh"), {encoding:"utf8"}).trim();
const executable = path.join(root, ".coil/build/typescript-js-abi-test");
execFileSync("clang", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-I", path.join(root, "native/typescript-go-bridge"),
  path.join(root, "tests/typescript-js-abi-test.c"), `-Wl,-force_load,${archive}`, "-framework", "CoreFoundation", "-framework", "Security", "-o", executable], {stdio:"inherit"});
const files = ["richards.js", "deltablue.js", "crypto.js", "raytrace.js", "earley-boyer.js", "regexp.js", "splay.js", "navier-stokes.js"];
const raw = execFileSync(executable, [path.join(root, "benchmarks/v8-v7"), ...files], {encoding:"utf8"});
const snapshot = `${JSON.stringify(JSON.parse(raw), null, 2)}\n`;
const target = path.join(root, "benchmarks/v8-v7/abi-snapshot.json");
if (mode === "--update") fs.writeFileSync(target, snapshot);
else if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== snapshot) {
  console.error("benchmarks/v8-v7/abi-snapshot.json is stale; run --update"); process.exitCode = 1;
}
if (!process.exitCode) console.log(`${mode === "--update" ? "updated" : "verified"} JavaScript ABI snapshot for 8 benchmarks`);
