#!/usr/bin/env node
import fs from "node:fs";

const [benchmark, input] = process.argv.slice(2);
const entries = {
  richards: { suite: "Richards", run: "runRichards" },
  deltablue: { suite: "DeltaBlue", run: "deltaBlue" },
};
if (!entries[benchmark] || !input) {
  console.error("usage: b15-adapt.mjs [richards|deltablue] INPUT.js");
  process.exit(2);
}

const {suite, run} = entries[benchmark];
let source = fs.readFileSync(input, "utf8");
const start = source.indexOf(`var ${suite} = new BenchmarkSuite`);
const finish = source.indexOf("]);", start);
if (start < 0 || finish < 0) throw new Error(`missing ${suite} registration`);
source = `${source.slice(0, start)}${source.slice(finish + 3)}`;
const mutation = process.env.AOT_B15_MUTATION ?? "";
if (mutation === "richards-queue") {
  if (benchmark !== "richards") throw new Error("Richards mutation requested for another benchmark");
  source = source.replace("var EXPECTED_QUEUE_COUNT = 2322;", "var EXPECTED_QUEUE_COUNT = 2323;");
} else if (mutation === "deltablue-projection") {
  if (benchmark !== "deltablue") throw new Error("DeltaBlue mutation requested for another benchmark");
  source = source.replace('dst.value != 1170', 'dst.value != 1171');
} else if (mutation !== "") {
  throw new Error(`unknown B15 mutation: ${mutation}`);
}

// The upstream shell supplies these two services. The adapter preserves failure semantics while
// excluding timing/registration machinery from a correctness kernel.
const alertAdapter = benchmark === "deltablue"
  ? "function alert(message) { throw new Error(message); }\n"
  : "";
const nodeInvocation = process.env.AOT_B15_NODE_RUN === "1" ? "main();\n" : "";
process.stdout.write(`${alertAdapter}${source}\nfunction main() { ${run}(); return 0; }\n${nodeInvocation}`);
