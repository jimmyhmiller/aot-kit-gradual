#!/usr/bin/env node

const maxDepth = Number.parseInt(process.argv[2] ?? "4", 10);
const timed = process.argv[3] === "--timed";
if (!Number.isInteger(maxDepth) || maxDepth < 4 || maxDepth > 21) {
  console.error("usage: tools/binarytrees-reference.mjs MAX_DEPTH (4..21) [--timed]");
  process.exit(2);
}

function bottomUpTree(depth) {
  if (depth < 1) return { left: null, right: null };
  return { left: bottomUpTree(depth - 1), right: bottomUpTree(depth - 1) };
}

function itemCheck(node) {
  return node.left === null ? 1 : 1 + itemCheck(node.left) + itemCheck(node.right);
}

const started = process.hrtime.bigint();
const fields = [];
const stretchDepth = maxDepth + 1;
fields.push(stretchDepth, itemCheck(bottomUpTree(stretchDepth)));
const longLivedTree = bottomUpTree(maxDepth);
for (let depth = 4; depth <= 20; depth += 2) {
  if (depth <= maxDepth) {
    const iterations = 2 ** (maxDepth - depth + 4);
    let check = 0;
    for (let i = 0; i < iterations; ++i) check += itemCheck(bottomUpTree(depth));
    fields.push(depth, iterations, check);
  } else {
    fields.push(depth, 0, 0);
  }
}
fields.push(maxDepth, itemCheck(longLivedTree));
const runtimeNs = process.hrtime.bigint() - started;
process.stdout.write(`${fields.join(" ")}\n`);
if (timed) process.stderr.write(`runtime_ns=${runtimeNs}\n`);
