function main(n) {
  const target = { existing: n };
  const returned = Object.preventExtensions(target);
  if (returned !== target) return 101;
  if (Object.isExtensible(target)) return 102;
  target.existing = n + 1;
  if (target.existing !== n + 1) return 103;
  target.newProperty = n;
  if (target.newProperty !== undefined) return 104;
  return target.existing | 0;
}
