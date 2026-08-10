export function main(): number {
  let holder: any = { base: 7 };
  holder.run = function(this: any, value: number): number {
    const add = (extra: number): number => this.base + extra;
    const nested = (): number => (() => this.base)();
    return add(value) * 10 + nested();
  };
  return holder.run(3) | 0;
}
