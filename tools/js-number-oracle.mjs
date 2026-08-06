#!/usr/bin/env node

const falsifyIntegerDivision = process.env.AOT_B04_INTEGER_DIVISION === "1";
const falsifyNanReflexive = process.env.AOT_B04_NAN_REFLEXIVE === "1";
const falsifyDropNegativeZero = process.env.AOT_B04_DROP_NEGATIVE_ZERO === "1";
const falsifyWrappedOverflow = process.env.AOT_B04_WRAP_OVERFLOW === "1";

const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);
function signedBits(value) {
  if (falsifyDropNegativeZero && Object.is(value, -0)) value = 0;
  view.setFloat64(0, value, false);
  return BigInt.asIntN(64, view.getBigUint64(0, false)).toString();
}
function encode(value) {
  return typeof value === "boolean" ? `bool|${value ? 1 : 0}` : `number|${signedBits(value)}`;
}

const taggedMax = 140737488355327;
const tagOverflow = falsifyWrappedOverflow
  ? Number(BigInt.asIntN(48, BigInt(taggedMax) + 1n))
  : taggedMax + 1;
const cases = [
  ["tag-max-plus-one", tagOverflow],
  ["max-safe-plus-two", Number.MAX_SAFE_INTEGER + 2],
  ["large-add", 5000000000000000000 + 5000000000000000000],
  ["mixed-add", 1 + 0.5],
  ["zero-times-negative", 0 * -1],
  ["zero-div-negative", 0 / -1],
  ["negative-zero-times-negative", -0 * -1],
  ["one-div-zero", 1 / 0],
  ["one-div-negative-zero", 1 / -0],
  ["zero-div-zero", 0 / 0],
  ["infinity-minus-infinity", Infinity - Infinity],
  ["infinity-times-zero", Infinity * 0],
  ["negate-negative-zero", -(-0)],
  ["half", falsifyIntegerDivision ? Math.trunc(1 / 2) : 1 / 2],
  ["nan-strict-equal", falsifyNanReflexive ? true : NaN === NaN],
  ["signed-zero-strict-equal", 0 === -0],
  ["nan-less-than-one", NaN < 1],
  ["negative-infinity-less-than-infinity", -Infinity < Infinity],
  ["nan-truthy", Boolean(NaN)],
  ["negative-zero-truthy", Boolean(-0)],
  ["infinity-truthy", Boolean(Infinity)],
];

for (const [name, value] of cases) process.stdout.write(`${name}|${encode(value)}\n`);
