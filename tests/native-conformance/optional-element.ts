export function main(): number {
  const missing: any = null;
  const present: any = [7];
  let key = 0;
  const a = missing?.[key++];
  const b = present?.[key++];
  return ((a === undefined ? 1 : 100) + b * 10 + key) | 0;
}
