function step(value: number): number {
  return value + value + 1;
}

export function main(n: number): number {
  let index = 0;
  let total = 0;
  while (index < n) {
    total = total + step(index);
    index = index + 1;
  }
  return total | 0;
}
