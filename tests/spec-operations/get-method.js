function main(n) {
  const search = {};
  let calls = 0;
  search[Symbol.replace] = function (receiver, replacement) {
    "use strict";
    calls += 1;
    if (this !== search) return 101;
    if (receiver !== "abc") return 102;
    return replacement;
  };
  if ("abc".replace(search, n) !== n) return 103;
  if (calls !== 1) return 104;

  return n | 0;
}
