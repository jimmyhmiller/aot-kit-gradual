export function main(n: number): number {
  let point = {x: n, y: n & 255, weight: 2};
  point.y = point.y + 1;
  point.x = point.x + point.weight;
  return (point.x * point.weight + point.y) | 0;
}
