#!/usr/bin/env node

const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);
function bits(value) {
  view.setFloat64(0, value, false);
  return BigInt.asIntN(64, view.getBigUint64(0, false));
}
for (const [name, value] of [
  ["mixed-add", 1.25 + 3], ["subtract", 7.5 - 2], ["multiply", 1.5 * -2],
  ["divide", 7 / 2], ["negative-zero", -(-0 + 0)],
]) console.log(`${name}|number|${bits(value)}`);
console.log(`nan-equal|bool|${NaN === NaN ? 1 : 0}`);
console.log(`nan-less-than|bool|${NaN < 1 ? 1 : 0}`);
console.log(`signed-zero-less-equal|bool|${-0 <= 0 ? 1 : 0}`);
console.log(`int-division|number|${bits(1 / 2)}`);
