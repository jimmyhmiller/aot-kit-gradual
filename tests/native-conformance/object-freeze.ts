export function main(): number {
  let object: any = { x: 7 };
  let alias: any = Object.freeze(object);
  let array: any = Object.freeze([3, 4]);
  return ((alias === object ? 100 : 0)
          + alias.x
          + array[0]
          + array[1]
          + (Object.freeze(9) === 9 ? 10 : 0)) | 0;
}
