function main(n) {
  const wrapper = Object("abc");
  Object.defineProperty(wrapper, "1", {});
  Object.defineProperty(wrapper, "1", { value: "b" });
  if (wrapper[1] !== "b") return 101;

  let rejectedValue = false;
  try {
    Object.defineProperty(wrapper, "1", { value: "x" });
  } catch (error) {
    rejectedValue = error instanceof TypeError;
  }
  if (!rejectedValue || wrapper[1] !== "b") return 102;

  let rejectedWritable = false;
  try {
    Object.defineProperty(wrapper, "1", { writable: true });
  } catch (error) {
    rejectedWritable = error instanceof TypeError;
  }
  if (!rejectedWritable) return 103;

  Object.defineProperty(wrapper, "extra", {
    value: n, writable: true, enumerable: true, configurable: true
  });
  if (wrapper.extra !== n) return 104;
  return n | 0;
}
