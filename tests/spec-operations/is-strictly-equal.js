function main(n) {
  var object = {};
  if (!(n === 7)) return 101;
  if (!("x" === "x")) return 102;
  if (n === "7") return 103;
  if (NaN === NaN) return 104;
  if (!(object === object)) return 105;
  if (object === {}) return 106;
  return n | 0;
}
