export function main(): number {
  const missing: any = null;
  const present: any = {x: 7};
  const a = missing?.x;
  const b = present?.x;
  return ((a === undefined ? 1 : 100) + b * 10) | 0;
}
