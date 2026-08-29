function main(n) {
  const described = Symbol("value");
  const absent = Symbol();
  const explicitUndefined = Symbol(undefined);

  if (described.toString() !== "Symbol(value)") return 101;
  if (Object(described).toString() !== "Symbol(value)") return 102;
  if (absent.toString() !== "Symbol()") return 103;
  if (explicitUndefined.toString() !== "Symbol()") return 104;
  if (Symbol.prototype.toString.call(described) !== "Symbol(value)") return 105;
  return n | 0;
}
