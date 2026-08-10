function helper(): number { return 1; }
function matches(value: any, expected: string): number {
  return typeof value === expected ? 1 : 0;
}

export function main(): number {
  const values: any[] = [undefined, null, true, 3, 3.5, "x", {}, []];
  return (matches(values[0], "undefined")
    + matches(values[1], "object") * 2
    + matches(values[2], "boolean") * 4
    + matches(values[3], "number") * 8
    + matches(values[4], "number") * 16
    + matches(values[5], "string") * 32
    + matches(values[6], "object") * 64
    + matches(values[7], "object") * 128
    + (typeof helper === "function" ? 256 : 0)) | 0;
}
