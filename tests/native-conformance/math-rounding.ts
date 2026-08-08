// Math.abs, floor, ceil and round, computed by lib/math/rounding.jsl.
//
// The cases are the ones where a plausible-but-wrong definition differs from the spec: round is
// floor(x + 0.5) EXCEPT that 0.49999999999999994 + 0.5 rounds up to 1.0 in floating point, so the
// naive form answers 1 where JavaScript answers 0. Round also breaks ties toward +Infinity, which
// negative halves are the only way to see. A program built from Math.round(3.6) alone cannot tell
// any of these apart.
export function main(): number {
  return (Math.round(0.5) + Math.round(-0.5) + Math.round(2.5) + Math.round(-2.5)
    + Math.round(0.49999999999999994) + Math.round(-1.5) + Math.round(1.5)
    + Math.floor(-3.1) + Math.floor(3.9) + Math.floor(-0.5)
    + Math.ceil(-3.9) + Math.ceil(3.1) + Math.ceil(-0.5)
    + Math.abs(-7) + Math.abs(7) + Math.abs(-0.5) * 2 + Math.abs(0)) | 0;
}
