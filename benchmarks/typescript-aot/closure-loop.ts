export function main(n: number): number {
  let value = n;
  let update = function(delta: number): number {
    value = (value * 33 + delta) | 0;
    return value;
  };
  let first = update(1);
  let second = update(2);
  return (first ^ second ^ value) | 0;
}
