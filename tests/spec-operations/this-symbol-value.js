function main(n) {
  const symbol = Symbol("value");
  const wrapper = Object(symbol);

  if (Symbol.prototype.valueOf.call(symbol) !== symbol) return 101;
  if (Symbol.prototype.valueOf.call(wrapper) !== symbol) return 102;
  if (Symbol.prototype[Symbol.toPrimitive].call(wrapper, "default") !== symbol) return 103;
  if (Symbol.prototype.toString.call(wrapper) !== "Symbol(value)") return 104;

  let rejected = false;
  try {
    Symbol.prototype.valueOf.call({});
  } catch (error) {
    rejected = error instanceof TypeError;
  }
  if (!rejected) return 105;
  return n | 0;
}
