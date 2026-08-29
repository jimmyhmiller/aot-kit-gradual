function main(n) {
  const object = { valueOf: null, toString: null };
  let calls = 0;
  object[Symbol.toPrimitive] = function (hint) {
    "use strict";
    calls = (calls + 1) | 0;
    if (this !== object) return 101;
    if (hint !== "default") return 102;
    return n;
  };

  if (object + 1 !== 8) return 103;
  if (calls !== 1) return 104;
  return n | 0;
}
