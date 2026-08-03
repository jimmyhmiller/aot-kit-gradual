export function main(n: number): number {
  let i = 0;
  let total = 0;
  let add = true;
  while (i < n) {
    if (add) total = total + i;
    else total = total - i;
    add = !add;
    i = i + 1;
  }
  return total;
}
