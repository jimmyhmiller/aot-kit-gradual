function main(n) {
  const values = [10, 20, 30, 40];

  if (values.at(1.9) !== 20) return 101;
  if (values.at(-1.9) !== 40) return 102;
  if (values.at(NaN) !== 10) return 103;
  if (values.at(Infinity) !== undefined) return 104;
  if (values.at(-Infinity) !== undefined) return 105;
  if (values.at("2.8") !== 30) return 106;
  if (values.at(true) !== 20) return 107;
  if (values.at(false) !== 10) return 108;
  if (values.at(null) !== 10) return 109;
  if (values.at(undefined) !== 10) return 110;
  if (values.at([]) !== 10) return 111;
  if (values.at([2]) !== 30) return 112;

  let calls = 0;
  const index = {
    valueOf: function () {
      calls = (calls + 1) | 0;
      return -1.9;
    }
  };
  if (values.at(index) !== 40) return 113;
  if (calls !== 1) return 114;

  return n | 0;
}
