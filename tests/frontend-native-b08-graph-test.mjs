import assert from "node:assert/strict";
import fs from "node:fs";

const text = fs.readFileSync(process.argv[2], "utf8");
const lines = text.trim().split("\n");
const nodes = new Map(lines.map(line => {
  const match = line.match(/^n(\d+): ([A-Za-z]+)(?:\.\d+)?(?: [^<]*)? <- (.*?) :/);
  return match ? [Number(match[1]), { op: match[2], inputs: [...match[3].matchAll(/n(\d+)/g)].map(x => Number(x[1])) }] : null;
}).filter(Boolean));
const count = op => [...nodes.values()].filter(node => node.op === op).length;

assert.equal(count("Loop"), 1, "the labeled do/while has one explicit loop header");
assert.equal(count("If"), 5, "three case tests plus loop-body and loop-condition decisions");
assert.equal(count("Region"), 4, "fallthrough, continue, and exit paths merge explicitly");
assert.equal(count("Phi"), 8, "loop-carried and targeted-exit values have explicit Phis");
const loop = [...nodes.values()].find(node => node.op === "Loop");
assert.equal(nodes.get(loop.inputs.at(-1)).op, "CProj", "the do condition owns the loop backedge");
assert.equal(count("Return"), 1);
console.log("B08 canonical graph: dispatch, fallthrough, targeted exits, and loop Phis verified");
