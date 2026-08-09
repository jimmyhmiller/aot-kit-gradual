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
// THE TOTAL IS ACCUMULATED RATHER THAN WRITTEN AS ONE EXPRESSION, and that is a workaround for a
// defect that is NOT in anything this file tests. A single sum of about twenty terms mixing boxed
// array elements with unboxed lengths miscompiles: the answer varies from run to run of the SAME
// binary, which means a pointer is reaching the arithmetic, and every underlying array runtime call
// is correct. It reproduces without any of these operations converted, so it is older than this
// file; it is recorded in docs/CONVERSION.md rather than hidden by the shape chosen here.
export function main(): number {
  let total = 0;
  let xs: number[] = [];
  total = (total + xs.push(10)) | 0;
  total = (total + xs.push(20, 30) * 3) | 0;
  total = (total + xs.push() * 5) | 0;
  total = (total + xs.pop() * 7) | 0;
  total = (total + xs.shift() * 11) | 0;
  total = (total + xs.length * 13) | 0;
  total = (total + xs[0] * 17) | 0;

  let empty: number[] = [];
  total = (total + (empty.pop() === undefined ? 19 : 0)) | 0;
  total = (total + (empty.shift() === undefined ? 23 : 0)) | 0;
  total = (total + empty.length * 29) | 0;

  let source = [1, 2, 3, 4, 5];
  let all = source.slice();
  total = (total + all.length * 31 + all[4] * 53) | 0;
  let tail = source.slice(2);
  total = (total + tail.length * 37 + tail[0] * 59) | 0;
  let middle = source.slice(1, 3);
  total = (total + middle.length * 41 + middle[1] * 61) | 0;
  let back = source.slice(-2);
  total = (total + back.length * 43 + back[0] * 67) | 0;
  let none = source.slice(3, 1);
  total = (total + none.length * 47 + source.length * 71) | 0;
  return total | 0;
}
