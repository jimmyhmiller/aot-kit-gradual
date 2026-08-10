function double(value: number): number { return value * 2; }

// The astral character is one iterable element but two UTF-16 code units. Testing both lengths
// rejects an Array.from implementation that simply loops over String.length.
export function main(): number {
  let mapped = Array.from([1, 2, 3], double);
  let text = Array.from("A😀B");
  let joined = text.join("");
  return (mapped.length * 100000 + mapped[0] * 10000 + mapped[1] * 1000
    + mapped[2] * 100 + text.length * 10 + joined.length) | 0;
}
