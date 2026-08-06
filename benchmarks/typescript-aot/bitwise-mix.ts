export function main(n: number): number {
  let value = (n ^ 0x13579bdf) | 0;
  value = ((value << 7) | (value >>> 25)) | 0;
  return (value + (n & 255)) | 0;
}
