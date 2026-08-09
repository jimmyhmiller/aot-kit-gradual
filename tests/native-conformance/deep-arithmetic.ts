// One arithmetic expression, long enough that its operand chain is deeper than any bound.
//
// The representation of a `+` is decided by asking whether a floating-point value reaches it. That
// question used to be answered by a recursion carrying eight units of fuel, so the answer flipped
// once the chain was longer than eight — and the two sides of one expression could disagree about
// it. The result was an integer register read for a value living in a floating-point one: wrong,
// and differently wrong on each run of the same binary, because what it read was whatever the
// general-purpose register happened to hold.
//
// FOUR ROWS, AND WHAT EACH ONE IS FOR — measured against the compiler before the fixes, because a
// row that passes on a broken compiler is not coverage:
//
//   - `deep` is a left-nested chain of 24 additions whose FIRST operand is a boxed array element.
//     Only that element is floating-point and it sits at the far end, so nothing shallower than the
//     whole expression can see it. On its own it answered 274 instead of 301: the element was
//     dropped. This is the row that fails the moment a depth bound comes back.
//   - `viaLoop` accumulates through a loop-carried Phi seeded with a boxed element. On its own it
//     answered 0 instead of 235 — the seed was widened as if it were a machine integer, so the
//     accumulator started at its own tag word. A cycle also has no depth, which is why the operand
//     walk is a marked traversal rather than a deeper recursion.
//   - `viaCall` puts the element behind a function's return value. ON ITS OWN IT PASSES on the
//     broken compiler, and that is the point: `tenth(values) + 1 + 2` was an integer add on the
//     TAG WORD, which comes back correct when the only consumer masks it to an int32. It is wrong
//     the moment the sum is read as a number, which is what multiplying it into this total does.
//   - `mixed` alternates boxed elements with unboxed lengths. It also passes alone. It is here
//     because it is the shape that made the defect NONDETERMINISTIC rather than merely wrong: with
//     several values in flight the register read is a live one holding a pointer, not a dead one
//     holding zero. `unstable-array-sum.ts` is that symptom on its own.
//
// Together they answer 0 instead of 3712. The total is read back through `| 0` on a sum that is
// exact in double precision, so a term silently dropped or a register silently swapped changes it.
function tenth(values: number[]): number {
  return values[9];
}

export function main(): number {
  let values: number[] = [];
  for (let i = 0; i < 12; i = i + 1) {
    values.push(i * 3 + 1);
  }
  let other = [5, 8, 13, 21];

  let deep = values[0] + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12
    + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20 + 21 + 22 + 23 + 24;

  let mixed = values[1] + other.length + values[2] + other.length + values[3]
    + other.length + values[4] + other.length + values[5] + other.length
    + values[6] + other.length + values[7] + other.length + values[8]
    + other.length + values[9] + other.length + values[10] + other.length;

  let viaCall = tenth(values) + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11
    + 12 + 13 + 14 + 15 + 16;

  let viaLoop = other[0];
  for (let i = 0; i < 10; i = i + 1) {
    viaLoop = viaLoop + i + other.length + values[i];
  }

  return (deep * 2 + mixed * 3 + viaCall * 5 + viaLoop * 7) | 0;
}
