export function main(): number {
  const value: any = {};
  value.self = value;
  JSON.stringify(value);
  return 0;
}
