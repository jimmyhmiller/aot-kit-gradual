function main(n) {
  let order = 0;
  const inherited = {
    get enumerable() {
      order = (order * 10 + 1) | 0;
      return true;
    },
    get configurable() {
      order = (order * 10 + 2) | 0;
      return true;
    }
  };

  const descriptor = Object.create(inherited);
  descriptor.value = n;

  const target = {};
  Object.defineProperty(target, "answer", descriptor);
  const actual = Object.getOwnPropertyDescriptor(target, "answer");

  if (order !== 12) return 101;
  if (actual.value !== n) return 102;
  if (actual.writable !== false) return 103;
  if (actual.enumerable !== true) return 104;
  if (actual.configurable !== true) return 105;
  return n | 0;
}
