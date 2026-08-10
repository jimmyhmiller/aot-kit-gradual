function Base() { this.base = 1; }
function Other() { this.other = 1; }

export function main(): number {
  let holder: any = { C: Base };
  return ((new Base() instanceof holder.C ? 10000 : 0) +
          (new Other() instanceof holder.C ? 0 : 1) +
          (new Base() instanceof Base ? 1000 : 0) +
          (new Base() instanceof Other ? 100 : 0) +
          (new Other() instanceof Base ? 10 : 0) +
          ({ base: 1 } instanceof Base ? 1 : 0)) | 0;
}
