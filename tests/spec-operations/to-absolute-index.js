function main(n) {
  const values = [10, 20, 30, 40];
  if (values.at(-1.9) !== 40) return 101;
  if (values.at(-4) !== 10) return 102;
  if (values.at(-5) !== undefined) return 103;
  if (values.at(1.9) !== 20) return 104;
  if (values.at(Infinity) !== undefined) return 105;
  if (values.at(-Infinity) !== undefined) return 106;

  let calls = 0;
  const index = { valueOf: function () { calls = (calls + 1) | 0; return -2.8; } };
  if (values.at(index) !== 30 || calls !== 1) return 107;
  return n | 0;
}
