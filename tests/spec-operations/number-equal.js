function main(n) {
  if (NaN === NaN) return 101;
  if (NaN === 0) return 102;
  if (!(0 === -0)) return 103;
  if (!(-0 === 0)) return 104;
  if (!(1.25 === 1.25)) return 105;
  if (1.25 === 1.5) return 106;
  const positiveInfinity = 1 / 0;
  const negativeInfinity = -1 / 0;
  if (!(positiveInfinity === positiveInfinity)) return 107;
  if (!(negativeInfinity === negativeInfinity)) return 108;
  if (positiveInfinity === negativeInfinity) return 109;
  if (!(n === 7)) return 110;
  return n | 0;
}
