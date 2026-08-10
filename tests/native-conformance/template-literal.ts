export function main(): number {
  let order = 0;
  const value = `x${true}${null}${undefined}${(order = order * 10 + 1)}:${(order = order * 10 + 2)}`;
  return (value.length * 100 + order) | 0;
}
