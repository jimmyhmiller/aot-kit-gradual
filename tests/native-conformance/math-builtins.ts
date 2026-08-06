export function main(): number {
  let value = Math.sqrt(81) + Math.pow(2, 5) + Math.abs(-7);
  value += Math.floor(3.9) + Math.ceil(3.1) + Math.round(3.6);
  value += Math.min(8, 2) + Math.max(8, 2);
  return value | 0;
}
