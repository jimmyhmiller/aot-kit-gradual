// Callback invocation originates in lib/array/build.jsl. Reading several mapped elements makes a
// definition that skips the call, passes the wrong index, or stores the source value fail.
function scale(value: number, index: number, source: number[]): number {
  // Keep the third spec argument present in the ABI; its contents are covered by later callback
  // methods once array-typed parameter inference reaches `.length`.
  if (source === undefined) return -999;
  return value * 3 + index;
}

function even(value: number, index: number, source: number[]): boolean {
  return ((value + index + source[0]) & 1) === 0;
}

function bump(value: number, index: number, source: number[]): number {
  source[index] = value + 10;
  return 0;
}

function combine(acc: number, value: number, index: number, source: number[]): number {
  if (source === undefined) return -999;
  return acc * 10 + value + index;
}

function descending(left: number, right: number): number {
  return right - left;
}

function pair(value: number, index: number, source: number[]): number[] {
  if (source === undefined) return [];
  return [value, index];
}

export function main(): number {
  let source = [4, 7, 11];
  let mapped = source.map(scale);
  let filtered = source.filter(even);
  let found = source.find(even);
  let foundIndex = source.findIndex(even);
  let some = source.some(even);
  let every = source.every(even);
  let reduced = source.reduce(combine, 1);
  let reducedRight = source.reduceRight(combine, 1);
  let sorted = [3, 1, 2].sort(descending);
  let defaultSorted = [10, 2, 1].sort();
  let flattened = [4, 7].flatMap(pair);
  source.forEach(bump);

  return ((mapped[0] === 12 ? 1 : 0)
    + (mapped[1] === 22 ? 2 : 0)
    + (mapped[2] === 35 ? 4 : 0)
    + (mapped.length === 3 ? 8 : 0)
    + (filtered.length === 2 ? 16 : 0)
    + (filtered[0] === 4 && filtered[1] === 7 ? 32 : 0)
    + ((found | 0) === 4 ? 64 : 0)
    + (foundIndex === 0 ? 128 : 0)
    + (some ? 256 : 0)
    + (!every ? 512 : 0)
    + (reduced === 1493 ? 1024 : 0)
    + (reducedRight === 2384 ? 2048 : 0)
    + (source[0] === 14 && source[1] === 17 && source[2] === 21 ? 4096 : 0)
    + (sorted[0] === 3 && sorted[1] === 2 && sorted[2] === 1 ? 8192 : 0)
    + (defaultSorted[0] === 1 && defaultSorted[1] === 10 && defaultSorted[2] === 2 ? 16384 : 0)
    + (flattened.length === 4 && flattened[0] === 4 && flattened[1] === 0
       && flattened[2] === 7 && flattened[3] === 1 ? 32768 : 0)) | 0;
}
