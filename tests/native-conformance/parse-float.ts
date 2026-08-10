export function main(): number {
  let side = 0;
  let a = parseFloat("  -12.5xyz", side = 7);
  let b = Number.parseFloat("1.25e2tail");
  let c = parseFloat("3e+");
  let flags = (Number.isNaN(parseFloat("nope")) ? 1 : 0)
    + (parseFloat("Infinity!" ) === Infinity ? 2 : 0);
  return (a * 10 + b + c + side * 10 + flags) | 0;
}
