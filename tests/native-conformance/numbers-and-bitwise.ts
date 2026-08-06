export function main(): number {
  let a = 37;
  let b = 11;
  let bits = ((a & b) ^ (a | b));
  bits <<= 33;
  bits = (bits >>> 1) + (a >> b);
  bits %= 97;
  let fp = 1.5 * 4 + 7 / 2 - 0.5;
  let comparisons = (fp === 9 ? 1 : 0) + (NaN !== NaN ? 2 : 0) + (-0 === 0 ? 4 : 0);
  let radixLiterals = 0x13579bdf ^ 0b101101 ^ 0o765;
  return (~bits) * 10 + comparisons + (radixLiterals & 255);
}
