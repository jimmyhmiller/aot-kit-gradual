// Math.sign and Math.trunc, computed by MathSign and MathTrunc in lib/math/rounding.jsl.
//
// THESE TWO ARE THE ONLY PURE MATH CONVERSIONS. abs, floor, ceil and round all still reach the
// descriptor runtime underneath — the library's contribution to `MathFloor` is the `if (%IsInt v)`
// guard around `%FloorNum` — where these are the whole operation in the DSL. They were written and
// Node-verified while `jbi-find` had no entry for either name, so no program could call them.
//
// The rows are the ones a plausible-but-wrong definition gets wrong. `sign` must return its
// argument UNCHANGED at zero rather than a canonical 0, and must answer NaN for NaN rather than 0
// — a definition written as `x > 0 ? 1 : x < 0 ? -1 : 0` passes every other row here. `trunc` is
// toward zero, so the negative rows are the only ones that distinguish it from `floor`, and the
// integer row is the arm the library short-circuits before touching `%ToInteger` at all.
//
// Everything is offset into a column of its own so a wrong -1 cannot cancel a wrong +1, and the
// weights stop at 1e9 so the closing `| 0` never truncates a digit away.
export function main(): number {
  let total = 0;

  total = total + (Math.sign(-7) + 2);
  total = total + (Math.sign(7) + 2) * 10;
  total = total + (Math.sign(0) + 2) * 100;
  total = total + (Math.sign(-4.5) + 2) * 1000;
  total = total + (Math.sign(4.5) + 2) * 10000;
  // NaN reaches arithmetic and dies there, so `| 0` is 0 for a correct sign and 5 for one that
  // folded NaN into the zero arm.
  total = total + (7 - ((Math.sign(NaN) + 5) | 0)) * 100000;
  let signedNaN = Math.sign(NaN);
  total = total + (signedNaN !== signedNaN ? 8 : 0);

  total = total + Math.trunc(4.9) * 1000000;
  total = total + (Math.trunc(-4.9) + 9) * 10000000;
  total = total + Math.trunc(7) * 100000000;
  total = total + (Math.trunc(-0.5) + 1) * 1000000000;

  return total | 0;
}
