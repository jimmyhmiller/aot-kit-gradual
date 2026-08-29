function main(n) {
  if (Object.isExtensible(n)) return 101;
  const target = {};
  if (!Object.isExtensible(target)) return 102;
  Object.preventExtensions(target);
  if (Object.isExtensible(target)) return 103;
  return n | 0;
}
