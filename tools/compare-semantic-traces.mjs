#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

export function readTrace(filename) {
  const text = fs.readFileSync(filename, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`${filename}:${index + 1}: ${error.message}`); }
  });
}

export function semanticEvent(event) {
  // Sequence, evaluator step, and graph identities are useful evidence but are not semantic:
  // optimization is expected to change all three.
  return {
    depth: event.depth,
    kind: event.kind,
    op: event.op,
    object: event.object,
    name: event.name,
    valueTag: event.valueTag,
    valuePayload: event.valuePayload,
  };
}

export function compareTraces(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (JSON.stringify(semanticEvent(left[index])) !== JSON.stringify(semanticEvent(right[index]))) {
      return {equal: false, index, reason: "event", left: left[index], right: right[index]};
    }
  }
  if (left.length !== right.length) {
    return {equal: false, index: length, reason: "length", left: left[length], right: right[length]};
  }
  return {equal: true, count: left.length};
}

function context(trace, index, radius = 2) {
  return trace.slice(Math.max(0, index - radius), Math.min(trace.length, index + radius + 1));
}

export function formatComparison(result, left, right, leftName = "raw", rightName = "optimized") {
  if (result.equal) return `Semantic traces agree (${result.count} events).\n`;
  const lines = [`First semantic divergence at event ${result.index} (${result.reason}).`];
  for (const [name, trace] of [[leftName, left], [rightName, right]]) {
    lines.push(`\n${name}:`);
    for (const event of context(trace, result.index)) {
      const marker = event === trace[result.index] ? ">" : " ";
      lines.push(`${marker} ${JSON.stringify(event)}`);
    }
    if (!trace[result.index]) lines.push("> <end of trace>");
  }
  return `${lines.join("\n")}\n`;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [leftFile, rightFile] = process.argv.slice(2);
  if (!leftFile || !rightFile) {
    console.error("usage: compare-semantic-traces.mjs RAW.jsonl OPTIMIZED.jsonl");
    process.exit(2);
  }
  const left = readTrace(leftFile);
  const right = readTrace(rightFile);
  const result = compareTraces(left, right);
  process.stdout.write(formatComparison(result, left, right, path.basename(leftFile), path.basename(rightFile)));
  process.exitCode = result.equal ? 0 : 1;
}
