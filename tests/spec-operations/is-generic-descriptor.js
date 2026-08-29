function main(n) {
  const target = {};
  Object.defineProperty(target, "answer", {
    value: n,
    writable: true,
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(target, "answer", { enumerable: false });
  const descriptor = Object.getOwnPropertyDescriptor(target, "answer");
  if (descriptor.value !== n) return 101;
  if (descriptor.writable !== true) return 102;
  if (descriptor.enumerable !== false) return 103;
  if (descriptor.configurable !== true) return 104;
  return target.answer | 0;
}
