function main(n) {
  const values = [NaN, 0, 1.25, 1 / 0, -1 / 0];
  if (!values.includes(NaN)) return 101;
  if (!values.includes(-0)) return 102;
  if (!values.includes(1.25)) return 103;
  if (values.includes(1.5)) return 104;
  if (!values.includes(1 / 0)) return 105;
  if (!values.includes(-1 / 0)) return 106;
  if (values.includes(n + 1)) return 107;
  return n | 0;
}
