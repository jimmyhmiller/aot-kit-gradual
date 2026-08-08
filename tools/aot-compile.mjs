#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const input = process.argv[2];
const outputIndex = process.argv.indexOf("--output");
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (!input || (outputIndex >= 0 && !output)) {
  console.error("usage: node tools/aot-compile.mjs INPUT.{js,ts} [--output GRAPH.txt]");
  process.exit(2);
}
const filename = path.resolve(input);
const source = fs.readFileSync(filename, "utf8");
const extension = path.extname(filename).toLowerCase();
if (extension !== ".js" && extension !== ".ts") throw new Error("input extension must be .js or .ts");
const scriptKind = extension === ".js" ? 1 : 2;
const archive = process.env.AOT_TYPESCRIPT_ARCHIVE ?? execFileSync(path.join(root, "tools/build-typescript-go-bridge.sh"), {encoding:"utf8"}).trim();
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aot-native-compile-"));

const driver = `(module aotnativecompile)
(import "frontendnative" :use *)
(import "frontendnativegraph" :use *)
(import "typescriptnative" :use *)
(import "gtext" :use *)
(import "ty" :use *)
(import "coil.io" :use *)
(import "coil.fmt" :use *)
(import "coil.alloc" :use *)
(import "coil.str" :use *)
(defn main [] (-> i64)
  (let [source ${JSON.stringify(source)} filename ${JSON.stringify(filename)}
        (mut frontend) (fe-native-new-file source filename ${scriptKind})
        status (fe-native-index! (mut frontend))]
    (if (= status FE-OK)
        (let [buffer (stack (array i8 1048576))]
          (frontend-native-build! (mut frontend) 0 true)
          (ps (stdout) (g-render (cast (ptr i8) buffer) 1048576))
          (fe-native-free! (mut frontend)) 0)
        (let [ast (field frontend ast)
              node (load (field frontend error-node))
              diagnostic-code (if (= status FE-PARSE) (ts-diagnostic-code ast 0) (load (field frontend error-code)))
              start (if (= status FE-PARSE) (ts-diagnostic-start ast 0) (ts-start ast node))
              finish (if (= status FE-PARSE) (+ start (ts-diagnostic-length ast 0)) (ts-end ast node))
              kind (if (= status FE-PARSE) (ts-kind ast 0) (ts-kind ast node))]
          (fmt (stderr) "AOT-DIAGNOSTIC {d} {d} {d} {d} {d}\\n"
               diagnostic-code kind (load (field frontend error-role)) start finish)
          (fe-native-free! (mut frontend)) status))))`;

const kindNames = new Map([[0,"Unknown"],[1,"EndOfFile"],[8,"NumericLiteral"],[11,"StringLiteral"],[14,"RegularExpressionLiteral"],[79,"Identifier"],[210,"ArrayLiteralExpression"],[211,"ObjectLiteralExpression"],[212,"PropertyAccessExpression"],[213,"ElementAccessExpression"],[214,"CallExpression"],[215,"NewExpression"],[218,"ParenthesizedExpression"],[219,"FunctionExpression"],[224,"ConditionalExpression"],[225,"PrefixUnaryExpression"],[226,"PostfixUnaryExpression"],[227,"BinaryExpression"],[242,"Block"],[244,"VariableStatement"],[245,"ExpressionStatement"],[246,"IfStatement"],[248,"WhileStatement"],[249,"ForStatement"],[254,"ReturnStatement"],[261,"VariableDeclaration"],[262,"VariableDeclarationList"],[263,"FunctionDeclaration"],[307,"SourceFile"]]);
const roleNames = new Map([[0,"node"],[1,"name"],[2,"body"],[3,"type"],[4,"initializer"],[5,"expression"],[6,"left"],[7,"operator"],[8,"right"],[9,"condition"],[10,"then"],[11,"else"],[12,"statement"],[13,"callee"],[14,"argument"],[15,"parameter"],[16,"object"],[17,"property"],[18,"element"],[19,"member"],[20,"whenTrue"],[21,"whenFalse"]]);

try {
  const coilFile = path.join(directory, "driver.coil");
  const executable = path.join(directory, "driver");
  fs.writeFileSync(coilFile, driver);
  // Coil.toml [link] already force-loads the archive and names the frameworks, and the compiler
  // applies manifest link flags to every build. Passing them again loads the archive twice and the
  // link fails with ~73 duplicate symbols, each reported against itself.
  const build = spawnSync("coil", ["build", coilFile, "-o", executable], {encoding:"utf8"});
  if (build.status !== 0) throw new Error(`native frontend driver build failed:\n${build.stdout}${build.stderr}`);
  const run = spawnSync(executable, [], {encoding:"utf8", maxBuffer:2 * 1024 * 1024});
  if (run.status !== 0) {
    const match = /AOT-DIAGNOSTIC (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+)/.exec(run.stderr);
    if (!match) throw new Error(`native frontend failed without a bounded diagnostic:\n${run.stderr}`);
    const [, code, kind, role, start, end] = match.map(Number);
    console.error(JSON.stringify({code:`AOT${code}`, kind:kindNames.get(kind) ?? `Kind${kind}`, role:roleNames.get(role) ?? `role${role}`, range:{start,end}, file:filename}));
    process.exitCode = 1;
  } else if (output) fs.writeFileSync(output, run.stdout);
  else process.stdout.write(run.stdout);
} finally {
  fs.rmSync(directory, {recursive:true, force:true});
}
