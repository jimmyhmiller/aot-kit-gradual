export function main(): number {
  let array: any = Object.freeze([1, 2]);
  array[0] = 7;
  return array[0] | 0;
}
