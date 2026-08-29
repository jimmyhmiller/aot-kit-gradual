function main(n) {
  const target = {};
  Object.defineProperty(target, "data", { value: n });
  const data = Object.getOwnPropertyDescriptor(target, "data");
  if (data.value !== n) return 101;
  if (data.writable !== false) return 102;
  if (data.enumerable !== false) return 103;
  if (data.configurable !== false) return 104;

  const getter = function () { return n; };
  Object.defineProperty(target, "accessor", { get: getter });
  const accessor = Object.getOwnPropertyDescriptor(target, "accessor");
  if (accessor.get !== getter) return 105;
  if (accessor.set !== undefined) return 106;
  if (accessor.enumerable !== false) return 107;
  if (accessor.configurable !== false) return 108;
  return target.accessor | 0;
}
