export function main(): number {
  let object: any = Object.freeze({ x: 1 });
  delete object.x;
  return 0;
}
