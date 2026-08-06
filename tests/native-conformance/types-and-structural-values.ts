type Pair = { left: number; right: number };
function read(value: Pair | null): number { return value === null ? 0 : value.left + value.right; }

export function main(): number {
  let pair: Pair = {left: 19, right: 23};
  return (read(pair) + read(null)) | 0;
}
