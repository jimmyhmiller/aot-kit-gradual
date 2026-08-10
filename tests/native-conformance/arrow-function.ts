export function main(): number {
  let offset = 3;
  const add = (left: number, right: number): number => {
    offset = offset + 1;
    return left + right + offset;
  };
  const twice = (value: number): number => value * 2;
  return (twice(add(10, 20)) * 10 + offset) | 0;
}
