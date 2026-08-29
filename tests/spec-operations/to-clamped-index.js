function main(n) {
  const value = "abcdef";
  if (!value.startsWith("ab", -9)) return 101;
  if (!value.startsWith("cd", 2.9)) return 102;
  if (value.startsWith("", Infinity) !== true) return 103;
  if (value.startsWith("f", Infinity)) return 104;

  return n | 0;
}
