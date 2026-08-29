function main(n) {
  const target = {};
  if (!Object.isExtensible(target)) return 101;
  Object.preventExtensions(target);
  if (Object.isExtensible(target)) return 102;
  return n | 0;
}
