// Runtime array-kind detection is deliberately tested through values loaded from arrays, where
// frontend inference has no useful answer. concat and flat must therefore reach %IsArray.
export function main(): number {
  let joined = [1].concat([2, 3], 4, [5]);
  let nested = [1, [2, [3]], 4];
  let once = nested.flat();
  let twice = nested.flat(2);
  let flags = (Array.isArray(joined) ? 1 : 0)
    + (Array.isArray({}) ? 0 : 2)
    + (Array.isArray(once[2]) ? 4 : 0);
  let result = flags;
  result = result * 10 + joined.length;
  result = result * 10 + joined[0];
  result = result * 10 + joined[1];
  result = result * 10 + joined[2];
  result = result * 10 + joined[3];
  result = result * 10 + joined[4];
  result = result * 10 + once.length;
  result = result * 10 + twice.length;
  result = result * 10 + twice[2];
  return result | 0;
}
