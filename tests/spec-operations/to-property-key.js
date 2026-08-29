function main(n) {
  const object = {};
  object[n] = 1;
  object[true] = 2;
  object[null] = 3;
  object[undefined] = 4;
  object[[1, 2]] = 5;

  if (object[String(n)] !== 1) return 101;
  object[1] = 8;
  if (object["1"] !== 8 || object[1] !== 8) return 108;
  if (object.true !== 2) return 102;
  if (object.null !== 3) return 103;
  if (object.undefined !== 4) return 104;
  if (object["1,2"] !== 5) return 105;

  const symbol = Symbol("key");
  object[symbol] = n;
  if (object[symbol] !== n) return 106;
  if (object["Symbol(key)"] !== undefined) return 107;
  return n | 0;
}
