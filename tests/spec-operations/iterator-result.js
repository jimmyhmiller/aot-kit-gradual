function main(n) {
  let total = 0;
  for (const value of [n, 2]) {
    total = (total + value) | 0;
  }
  if (total !== ((n + 2) | 0)) return 101;

  const iterator = [n].values();
  const first = iterator.next();
  if (first.done || first.value !== n) return 102;
  const ordinary = {};
  if (Object.getPrototypeOf(first) !== Object.getPrototypeOf(ordinary)) return 104;
  if (!first.hasOwnProperty("value") || !first.hasOwnProperty("done")) return 108;
  const valueDescriptor = Object.getOwnPropertyDescriptor(first, "value");
  const doneDescriptor = Object.getOwnPropertyDescriptor(first, "done");
  if (!valueDescriptor.writable || !valueDescriptor.enumerable ||
      !valueDescriptor.configurable) return 105;
  if (!doneDescriptor.writable || !doneDescriptor.enumerable ||
      !doneDescriptor.configurable) return 106;
  first.value = (n + 1) | 0;
  if (first.value !== ((n + 1) | 0)) return 107;
  const exhausted = iterator.next();
  if (!exhausted.done || exhausted.value !== undefined) return 103;
  return n | 0;
}
