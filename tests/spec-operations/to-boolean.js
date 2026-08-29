function main(n) {
  if (Boolean(undefined) || Boolean(null) || Boolean(false)) return 101;
  if (Boolean(0) || Boolean(-0) || Boolean(NaN) || Boolean("")) return 102;
  if (!Boolean(true) || !Boolean(n) || !Boolean("x")) return 201;
  return n | 0;
}
