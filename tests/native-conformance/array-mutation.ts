// Array.prototype push, pop, shift and slice, computed by lib/array/build.jsl.
//
// EVERY ROW HERE IS ONE `arrays.ts` DOES NOT HAVE, and each was chosen because a plausible defect
// is invisible without it:
//
//   - `push()` with no argument writes nothing and answers the length. It reaches a different
//     definition (`ArrayLength`) from every other push, because with no argument the frontend's
//     argument loop produces no result at all.
//   - `shift` had NO test anywhere before this file. It is the only operation that moves every
//     element, and the loop that does it is the one place this conversion changed the emitted shape
//     rather than only its author.
//   - `pop` and `shift` on an EMPTY array must answer `undefined` and leave the length at 0. The
//     hand-written paths they replace resized an empty array to -1 and returned whatever the load
//     of index 0 found.
//   - `slice` is read back through BOTH `.length` and an element, because a copy loop that runs one
//     trip too many writes a correct prefix and shows up only in the length. That is not
//     hypothetical: it is the defect `ms-gcm-anchor-bound` fixes.
//
// THE TOTAL IS ONE EXPRESSION. It was written as an accumulation into a local to get around a
// defect that was in none of the operations above: a sum of about twenty terms mixing boxed array
// elements with unboxed lengths miscompiled, and the answer varied between runs of the same binary.
// That is fixed — the representation of an `+` was decided by a query carrying eight units of fuel,
// so it flipped once the operand chain was longer than that. `deep-arithmetic.ts` covers the depth
// itself and `unstable-array-sum.ts` keeps the run-to-run symptom. The shape here is back to the
// one the file wanted, which also means these twenty terms are no longer a workaround pretending
// to be a style.
export function main(): number {
  let xs: number[] = [];
  let empty: number[] = [];
  let source = [1, 2, 3, 4, 5];
  let all = source.slice();
  let tail = source.slice(2);
  let middle = source.slice(1, 3);
  let back = source.slice(-2);
  let none = source.slice(3, 1);
  return (xs.push(10) + xs.push(20, 30) * 3 + xs.push() * 5 + xs.pop() * 7
    + xs.shift() * 11 + xs.length * 13 + xs[0] * 17
    + (empty.pop() === undefined ? 19 : 0) + (empty.shift() === undefined ? 23 : 0)
    + empty.length * 29
    + all.length * 31 + all[4] * 53
    + tail.length * 37 + tail[0] * 59
    + middle.length * 41 + middle[1] * 61
    + back.length * 43 + back[0] * 67
    + none.length * 47 + source.length * 71) | 0;
}
