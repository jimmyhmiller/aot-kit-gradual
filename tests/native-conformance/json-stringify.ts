export function main(): number {
  let result = 0;
  if (JSON.stringify("A\n\"\\\u0001é") === "\"A\\n\\\"\\\\\\u0001é\"") result += 1;
  if (JSON.stringify(-12.5) === "-12.5") result += 2;
  if (JSON.stringify([true, null, undefined, Infinity]) === "[true,null,null,null]") result += 4;
  if (JSON.stringify({x: 1}) === "{\"x\":1}") result += 8;
  if (JSON.stringify({missing: undefined, x: 1}) === "{\"x\":1}") result += 16;
  if (JSON.stringify({nested: {x: 1}}) === "{\"nested\":{\"x\":1}}") result += 32;
  if (JSON.stringify(undefined) === undefined) result += 64;
  return result;
}
