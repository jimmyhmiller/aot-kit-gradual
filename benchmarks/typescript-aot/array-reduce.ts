function combine(total: number, value: number): number {
  return (total + value) | 0;
}

export function main(n: number): number {
  return [n, 2, 3, 4, 5, 6, 7, 8].reduce(combine, 0) | 0;
}
