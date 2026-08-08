export function main(n: number): number {
  let i = 0;
  let acc = 0;
  while (i < n) {
    acc = acc + Math.abs(i - 500) + Math.floor(i / 3) + Math.ceil(i / 7) + Math.round(i / 11);
    i = i + 1;
  }
  return acc | 0;
}
