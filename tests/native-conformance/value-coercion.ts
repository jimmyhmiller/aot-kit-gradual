// ToNumber at the arithmetic boundary, over every value a dynamic read can produce.
//
// The frontend used to unbox a dynamic operand straight to a double, which asserts a tag rather
// than converting one, so every row below except the last two was a SIGTRAP rather than an answer.
// `arrays.ts` never caught it because it reads `sparse[0]` and `sparse[2]` and never the hole
// between them: reading a hole into arithmetic is the shape that fails.
//
// EVERY ROW IS A DIFFERENT TAG, and that is the point — one row per arm of the ToNumber table, so
// dropping any single arm changes the observable. The two number rows are here to prove the fast
// path did not regress into the coercion, not because they were ever at risk.
export function main(): number {
  let holes = [10, , 30, ,];
  let values: any[] = [null, true, false, "7", " 12 ", "oops", 4.5, 6];
  let total = 0;

  // undefined: a hole, and an index past the end. ToNumber is NaN, and `NaN | 0` is 0.
  total = total + ((holes[1] + 1) | 0);
  total = total + ((holes[9] + 1) | 0);
  // The hole's neighbours still read as themselves.
  total = total + holes[0] + holes[2];

  total = total + (values[0] + 1);        // null -> +0
  total = total + (values[1] + 1);        // true -> 1
  total = total + (values[2] + 1);        // false -> +0
  total = total + (values[3] * 2);        // "7" -> 7
  total = total + (values[4] * 2);        // " 12 " -> 12, whitespace trimmed
  total = total + ((values[5] * 2) | 0);  // "oops" -> NaN
  total = total + values[6] * 2;          // 4.5 stays a double
  total = total + values[7] * 2;          // 6 stays an integer

  // Subtraction and division reach the same boundary as addition.
  total = total + ((values[0] - 1) | 0) + ((values[1] - 1) | 0);

  return total | 0;
}
