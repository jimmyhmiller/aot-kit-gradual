function transform(value: number, index: number, source: number[]): number {
  return (value * 3 + index + source[0]) | 0;
}

function keep(value: number): boolean {
  return (value & 3) !== 0;
}

function combine(total: number, value: number): number {
  return (total + value) | 0;
}

export function main(n: number): number {
  let source = [n, 2, 3, 4, 5, 6, 7, 8];
  let mapped = source.map(transform);
  let filtered = mapped.filter(keep);
  return (filtered.reduce(combine, 0) + filtered.length) | 0;
}
