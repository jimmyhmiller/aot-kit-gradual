function main(n) {
  const object = {};
  const array = [];
  const callable = function () { return n; };
  if (!Object.isExtensible(object)) return 101;
  if (!Object.isExtensible(array)) return 102;
  if (!Object.isExtensible(callable)) return 103;
  Object.preventExtensions(array);
  if (Object.isExtensible(array)) return 104;
  return callable() | 0;
}
