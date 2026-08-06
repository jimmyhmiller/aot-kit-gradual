export function main(n: number): number {
  let i = 0;
  let total = 0;
  while (i < n) {
    let value = (i ^ 0x13579bdf) | 0;
    value = ((value << 7) | (value >>> 25)) | 0;
    total = total + value + (i & 255);
    i = i + 1;
  }
  return total | 0;
}
