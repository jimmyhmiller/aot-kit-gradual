function main(n) {
  function f(x) { return x + 1; }
  if (typeof f !== "function") return 101;
  if (typeof function () {} !== "function") return 102;
  if (typeof n === "function") return 103;
  if (typeof {} === "function") return 104;
  return n | 0;
}
