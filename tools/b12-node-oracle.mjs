#!/usr/bin/env node

const disableGrowth = process.env.AOT_B12_DISABLE_GROWTH === "1";
const omitElementScan = process.env.AOT_B12_OMIT_ELEMENT_SCAN === "1";
const show = value => value === undefined ? "undefined" : String(value);

const mixedObject = { marker: 7 };
const mixed = [1, true, null, mixedObject];
if (omitElementScan) mixed[3] = undefined;
console.log(`literal|${mixed.length}|${mixed.map(show).join("|")}|${show(mixed[3]?.marker)}`);

const growth = [1];
if (!disableGrowth) growth[3] = 4;
console.log(`growth|${growth.length}|${show(growth[0])}|${show(growth[1])}|${show(growth[2])}|${show(growth[3])}`);

const keys = [10];
keys[-1] = 20;
keys[1.5] = 30;
keys.extra = 40;
console.log(`keys|${keys.length}|${keys[0]}|${keys[-1]}|${keys[1.5]}|${keys.extra}`);

const stack = [2, 3];
const pushed = stack.push(4, 5);
const popped = stack.pop();
console.log(`push-pop|${pushed}|${popped}|${stack.length}|${stack.join("|")}`);

const sparse = [0, , 2, 3];
const sliced = sparse.slice(1, 4);
console.log(`slice|${sliced.length}|${0 in sliced}|${show(sliced[0])}|${sliced[1]}|${sliced[2]}`);
