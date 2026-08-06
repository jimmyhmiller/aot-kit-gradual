const bits = value => {
  const bytes = new ArrayBuffer(8);
  new DataView(bytes).setFloat64(0, value, false);
  return new DataView(bytes).getBigUint64(0, false).toString(16).padStart(16, "0");
};
const sqrt = process.env.AOT_B14_PERTURB_SQRT ? x => Math.sqrt(x) + 1 : Math.sqrt;
let randomSeed = 49734321;
const random = () => {
  randomSeed = randomSeed & 0xffffffff;
  randomSeed = ((randomSeed + 0x7ed55d16) + (randomSeed << 12)) & 0xffffffff;
  randomSeed = ((randomSeed ^ 0xc761c23c) ^ (randomSeed >>> 19)) & 0xffffffff;
  randomSeed = ((randomSeed + 0x165667b1) + (randomSeed << 5)) & 0xffffffff;
  randomSeed = ((randomSeed + 0xd3a2646c) ^ (randomSeed << 9)) & 0xffffffff;
  randomSeed = ((randomSeed + 0xfd7046c5) + (randomSeed << 3)) & 0xffffffff;
  randomSeed = ((randomSeed ^ 0xb55a4f09) ^ (randomSeed >>> 16)) & 0xffffffff;
  return (randomSeed & 0xfffffff) / 0x10000000;
};
const cases = [
  ["abs", Math.abs(-0), Math.abs(-3.5)],
  ["rounding", Math.floor(3.9), Math.ceil(-3.1), Math.round(-0.5), Math.round(1.5)],
  ["exp-log", Math.exp(0), Math.log(1), Math.LN2],
  ["trig", Math.sin(0), Math.cos(0), Math.tan(0), Math.asin(0), Math.acos(1), Math.atan(0)],
  ["roots-power", sqrt(81), Math.pow(2, 10)],
  ["minmax", Math.min(-0, 0), Math.max(-0, 0), Math.min(4, 7), Math.max(4, 7)],
  ["random", random(), random(), random()],
];
for (const [name, ...values] of cases) console.log([name, ...values.map(bits)].join("|"));
