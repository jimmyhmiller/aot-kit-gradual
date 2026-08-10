export function main(): number {
  let object = { x: 1 };
  Object.freeze(object);
  object.x = 2;
  return object.x | 0;
}
