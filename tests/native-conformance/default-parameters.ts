function score(first: number = 1, second: number = first + 1): number {
  return first * 100 + second;
}

export function main(): number {
  const omitted = score();
  const explicitUndefined = score(undefined, 7);
  const earlierParameter = score(3);
  const supplied = score(3, 4);
  return (omitted * 1000000 + explicitUndefined * 10000 + earlierParameter * 100 + supplied) | 0;
}
