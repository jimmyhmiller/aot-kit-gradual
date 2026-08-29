function main(n) {
  var calls = 0;
  const object = { valueOf: null };
  object.toString = function () {
    calls = (calls + 1) | 0;
    return "converted";
  };
  if (String(object) !== "converted") return 101;
  if (calls !== 1) return 102;
  return n | 0;
}
