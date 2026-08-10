export function main(): number {
  // @ts-ignore — this intentionally exercises Object.assign's ToObject throw.
  return Object.assign(null, { value: 1 }).value | 0;
}
