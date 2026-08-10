// In-place Array operations implemented in lib/array/build.jsl. Read every changed position so a
// wrong loop direction, bound, or return length cannot survive this program.
export function main(): number {
  let xs = [1, 2, 3];
  let length = xs.unshift(7, 8);
  xs.reverse();
  xs.fill(9, 1, -1);
  let empty: number[] = [];
  let emptyLength = empty.unshift();
  let result = length;
  result = result * 10 + xs.length;
  result = result * 10 + xs[0];
  result = result * 10 + xs[1];
  result = result * 10 + xs[2];
  result = result * 10 + xs[3];
  result = result * 10 + xs[4];
  result = result * 10 + emptyLength;
  return result | 0;
}
