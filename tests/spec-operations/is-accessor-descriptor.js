function main(n) {
  const target = {};
  const getter = function () { return n; };
  Object.defineProperty(target, "answer", {
    get: getter,
    enumerable: true,
    configurable: true
  });
  const descriptor = Object.getOwnPropertyDescriptor(target, "answer");
  if (descriptor.get !== getter) return 101;
  if (descriptor.set !== undefined) return 102;
  if (descriptor.enumerable !== true) return 103;
  if (descriptor.configurable !== true) return 104;
  return target.answer | 0;
}
