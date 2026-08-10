export function main(): number {
  let object: any = Object.freeze({ x: 1 });
  object.x = 2;
  return object.x | 0;
}
