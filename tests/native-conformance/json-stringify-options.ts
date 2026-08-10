function replace(this: any, key: string, value: any): any {
  if (key === "drop") return undefined;
  if (key === "n") return value + (this.n === 1 ? 1 : 100);
  return value;
}

export function main(): number {
  let result = 0;
  if (JSON.stringify({n: 1, drop: 9}, replace) === "{\"n\":2}") result += 1;
  if (JSON.stringify({a: [1, 2]}, undefined, 2) ===
      "{\n  \"a\": [\n    1,\n    2\n  ]\n}") result += 2;
  if (JSON.stringify({a: 1}, undefined, "..........++++") ===
      "{\n..........\"a\": 1\n}") result += 4;
  if (JSON.stringify({a: 1, b: 2, c: 3}, ["b", "a", "b", 3, null]) ===
      "{\"b\":2,\"a\":1}") result += 8;
  if (JSON.stringify({a: 1, b: 2}, ["b"], 1) === "{\n \"b\": 2\n}") result += 16;
  return result;
}
