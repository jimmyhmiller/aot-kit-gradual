function keep(value: number): boolean {
  return (value & 3) !== 0;
}

export function main(n: number): number {
  let filtered = [n, 2, 3, 4, 5, 6, 7, 8].filter(keep);
  return (filtered[0] + filtered[filtered.length - 1] + filtered.length) | 0;
}
