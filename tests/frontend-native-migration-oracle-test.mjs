import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const nativePath = process.argv[2];
if (!nativePath) throw new Error("usage: frontend-native-migration-oracle-test.mjs NATIVE_GRAPH.txt");
const native = fs.readFileSync(nativePath);
const digest = crypto.createHash("sha256").update(native).digest("hex");
assert.equal(digest, "27c043eec283fd68f03acffd45f0a94933482960b3f13ea83d48be0d2967df1a",
  `native Coil frontend changed the migration graph: ${digest}`);
console.log(`native Coil migration graph ${digest}`);
