function transform(value: number, index: number, source: number[]): number {
  return (value * 3 + index + source[0]) | 0;
}

export function main(n: number): number {
  let mapped = [n, 2, 3, 4, 5, 6, 7, 8].map(transform);
  return (mapped[0] + mapped[3] + mapped[7] + mapped.length) | 0;
}
