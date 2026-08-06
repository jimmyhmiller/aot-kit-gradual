export function main(n: number): number {
  let i = 0;
  let value = 0.25;
  while (i < n) {
    value = value * 1.0000001 + (i & 255);
    i = i + 1;
  }
  return (value / 3.0) | 0;
}
