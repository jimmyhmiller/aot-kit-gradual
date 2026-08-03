function step(value: number): number {
  return value + value + 1;
}

export function main(n: number): number {
  let i = 0;
  let sum = 0;
  while (i < n) {
    sum = sum + step(i);
    i = i + 1;
  }
  return sum;
}
