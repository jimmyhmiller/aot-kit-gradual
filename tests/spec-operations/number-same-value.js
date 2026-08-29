function main(n) {
  if (!Object.is(NaN, NaN)) return 101;
  if (Object.is(NaN, 0)) return 102;
  if (!Object.is(0, 0)) return 103;
  if (!Object.is(-0, -0)) return 104;
  if (Object.is(0, -0)) return 105;
  if (Object.is(-0, 0)) return 106;
  if (!Object.is(n, 7)) return 107;
  if (!Object.is(1.25, 1.25)) return 108;
  if (Object.is(1.25, 1.5)) return 109;
  const positiveInfinity = 1 / 0;
  const negativeInfinity = -1 / 0;
  if (!Object.is(positiveInfinity, positiveInfinity)) return 110;
  if (!Object.is(negativeInfinity, negativeInfinity)) return 111;
  if (Object.is(positiveInfinity, negativeInfinity)) return 112;
  return n | 0;
}
