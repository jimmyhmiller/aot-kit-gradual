// Math.max and Math.min, computed by lib/math/rounding.jsl's MathMax2/MathMin2.
// This frontend accepts exactly two arguments for each, so the binary definitions are the whole
// operation rather than a special case of a variadic one.
export function main(): number {
  return (Math.max(8, 2) + Math.min(8, 2) + Math.max(-3, -9) + Math.min(-3, -9)
    + Math.max(2.5, 2.4) * 2 + Math.min(-0.5, 0.5) * 2
    + Math.max(0, -0) + Math.min(-0, 0) + Math.max(7, 7)) | 0;
}
