#!/usr/bin/env node

const falsifyMask = process.env.AOT_B06_DROP_SHIFT_MASK === "1";
const falsifyUnsigned = process.env.AOT_B06_SIGNED_USHR === "1";
const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);
function bits(value) {
  view.setFloat64(0, value, false);
  return BigInt.asIntN(64, view.getBigUint64(0, false));
}
function shiftCount(value) { return falsifyMask ? 0 : value & 31; }
const cases = [
  ["to-int32-nan", NaN | 0],
  ["to-int32-infinity", Infinity | 0],
  ["to-int32-negative-zero", -0 | 0],
  ["to-int32-fraction", -3.9 | 0],
  ["to-int32-sign", 2147483648 | 0],
  ["to-int32-wrap", 4294967297.75 | 0],
  ["to-uint32-negative-one", -1 >>> 0],
  ["bit-and", -1 & 0x0f0f0f0f],
  ["bit-or", 2147483648 | 1],
  ["bit-xor", -1 ^ 0xffffffff],
  ["bit-not", ~0],
  ["shift-left-mask", 1 << shiftCount(33)],
  ["shift-right-mask", -1 >> shiftCount(65)],
  ["unsigned-right-zero", falsifyUnsigned ? (-1 >> 0) : (-1 >>> 0)],
  ["unsigned-right-one", falsifyUnsigned ? (-2147483648 >> 1) : (-2147483648 >>> 1)],
];
for (const [name, value] of cases) console.log(`${name}|int|${value}`);
for (const [name, value] of [
  ["remainder-negative-zero", -4 % 2],
  ["remainder-fraction", 5.5 % 2],
  ["remainder-zero-divisor", 1 % 0],
  ["remainder-infinite-dividend", Infinity % 2],
  ["remainder-infinite-divisor", 7 % Infinity],
]) console.log(`${name}|number|${bits(value)}`);
