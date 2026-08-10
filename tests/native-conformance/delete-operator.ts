export function main(): number {
  let object: any = { removed: undefined, kept: 7 };
  const before = "removed" in object;
  const result = delete object.removed;
  const after = "removed" in object;
  const missing = delete object.missing;
  return ((before ? 1000 : 0) + (result ? 100 : 0) +
          (after ? 10 : 0) + (missing ? 1 : 0) + object.kept) | 0;
}
