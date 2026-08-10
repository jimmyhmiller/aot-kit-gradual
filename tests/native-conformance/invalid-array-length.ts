export function main(): number {
  let values: any = [1, 2, 3];
  values.length = -1;
  return values.length;
}
