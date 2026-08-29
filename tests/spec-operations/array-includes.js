function main(n) {
  if (![NaN].includes(NaN)) return 101;
  if (![0].includes(-0)) return 102;
  if (![-0].includes(0)) return 103;
  if (!["value"].includes("value")) return 104;
  if (["value"].includes("other")) return 105;
  if (![1, 2, 3].includes(2, 2)) return 106;
  if ([1, 2, 3].includes(2, 3)) return 107;
  if (![1, 2, 3].includes(2, -2)) return 108;
  if (![undefined].includes(undefined)) return 109;
  const object = {};
  if (![object].includes(object)) return 110;
  if ([object].includes({})) return 111;
  if ([0].includes()) return 112;
  return n | 0;
}
