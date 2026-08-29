function main(n) {
  const target = {};
  Object.defineProperty(target, "existing", {
    value: n,
    writable: true,
    configurable: false
  });
  Object.preventExtensions(target);
  Object.defineProperty(target, "existing", { value: n + 1 });

  let rejected = false;
  try {
    Object.defineProperty(target, "newProperty", { value: n });
  } catch (error) {
    rejected = error instanceof TypeError;
  }
  if (!rejected) return 101;
  return target.existing | 0;
}
