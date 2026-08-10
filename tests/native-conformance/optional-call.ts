export function main(): number {
  let effects = 0;
  let missing: any = null;
  const skipped = missing?.(effects = effects * 10 + 1);

  let fn: any = function(value: number): number { return value + 2; };
  const direct = fn?.(effects = effects * 10 + 3);

  let holder: any = { base: 7 };
  holder.run = function(this: any, value: number): number {
    return this.base + value;
  };
  const method = holder.run?.(effects = effects * 10 + 4);

  return (((skipped === undefined ? 1 : 0) * 10000) + direct * 100 + method + effects) | 0;
}
