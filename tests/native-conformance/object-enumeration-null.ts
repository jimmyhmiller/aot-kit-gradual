export function main(): number {
  // @ts-ignore — this intentionally exercises the runtime TypeError path.
  return Object.keys(null).length | 0;
}
