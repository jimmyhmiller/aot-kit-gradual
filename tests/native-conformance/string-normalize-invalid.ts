export function main(): number {
  return "x".normalize("BAD").length | 0;
}
