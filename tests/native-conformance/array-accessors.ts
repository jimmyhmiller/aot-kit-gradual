// Array.prototype.at and Array.prototype.join, out of lib/array/read.jsl — written, and until now
// unreachable for the same reason the string methods were: absent from `fng-array-builtin?`.
//
// THE JOIN ROW WITH HOLES IS THE ONE THAT FOUND A BUG. `join` is the one place JavaScript disagrees
// with `String(x)`: `undefined` and `null` become the EMPTY string, not "undefined" and "null".
// `ArrayJoin` said so, and compared its element against a bare `undefined` — which is `Const : undef`,
// the machine word 0 without a tag, against a tagged element that can never equal it. The array
// below came out as "1,undefined,null,4" where Node says "1,,,4". Both constants are boxed now.
//
// `at` reads a length-3 array at 0, at -1 and past the end, so a definition that dropped the
// negative-index mapping and one that dropped the range check give different wrong answers.
export function main(): number {
  const xs = [10, 20, 30];
  let total = 0;

  // `| 0` on each element read, and it is the harness convention rather than decoration: `at`
  // returns a dynamic value, so ToNumber makes it a double and the whole accumulator with it, and
  // `main` has to hand back an integer.
  total = total + (xs.at(0) | 0);
  total = total + (xs.at(-1) | 0) * 10;
  total = total + (xs.at(-3) | 0) * 1000;
  total = total + ((xs.at(9) === undefined) ? 1 : 0) * 100000;
  total = total + ((xs.at(-9) === undefined) ? 1 : 0) * 1000000;

  total = total + xs.join("-").length * 10000000;
  // No separator is a comma, which is the default the frontend supplies rather than the library.
  total = total + xs.join().length * 1000000000;

  const mixed: any[] = [1, undefined, null, 4];
  total = total + mixed.join(",").length * 100000000000;
  total = total + mixed.join("").length * 10000000000000;

  return total;
}
