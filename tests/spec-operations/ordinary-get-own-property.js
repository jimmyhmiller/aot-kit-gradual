function main(n) {
  const target = {};
  const getter = function () { return n; };
  const setter = function (value) { return value; };
  Object.defineProperty(target, "entry", {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: false
  });
  const descriptor = Object.getOwnPropertyDescriptor(target, "entry");
  if (descriptor.get !== getter) return 101;
  if (descriptor.set !== setter) return 102;
  if (descriptor.enumerable !== true) return 103;
  if (descriptor.configurable !== false) return 104;
  if (Object.getOwnPropertyDescriptor(target, "missing") !== undefined) return 105;
  return descriptor.get() | 0;
}
