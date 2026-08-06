export function main(n: number): number {
  let value = n * 1.0000001 + 0.25;
  return (value / 3.0) | 0;
}
