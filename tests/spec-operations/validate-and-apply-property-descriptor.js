function main(n) {
  const target = {};
  Object.defineProperty(target, "fixed", {
    value: n,
    writable: false,
    enumerable: false,
    configurable: false
  });
  Object.defineProperty(target, "fixed", { value: n });
  let rejected = false;
  try {
    Object.defineProperty(target, "fixed", { value: n + 1 });
  } catch (error) {
    rejected = error instanceof TypeError;
  }
  if (!rejected) return 101;

  Object.defineProperty(target, "changing", {
    value: n,
    configurable: true
  });
  Object.defineProperty(target, "changing", {
    get: function () { return n + 2; }
  });
  if (target.fixed !== n) return 102;
  return target.changing | 0;
}
