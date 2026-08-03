export function main(n: number): number {
  let i = 0;
  let sum = 0;
  while (i < n) {
    sum = sum + i;
    i = i + 1;
  }
  return sum;
}
