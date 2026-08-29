function main(n) {
  if (Object.preventExtensions(n) !== n) return 101;
  const target = { value: n };
  if (Object.preventExtensions(target) !== target) return 102;
  if (Object.isExtensible(target)) return 103;
  return target.value | 0;
}
