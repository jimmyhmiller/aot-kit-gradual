export function bitwise(a: number, b: number): number {
  let x = (a & b) ^ (a | b);
  x <<= 33;
  x = (x >>> 1) + (a >> b);
  x %= 97;
  return ~x;
}
