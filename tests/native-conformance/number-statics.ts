// Number.isNaN, isFinite, isInteger, isSafeInteger and Number(x) itself.
//
// These are the last of the written-but-unreachable definitions. lib/number/predicates.jsl has had
// all four since it was written, verified against Node by the JSL gates, and until `Number` became
// a frontend intrinsic there was no resolution for the receiver at all — a program naming one
// crashed the emitter rather than compiling. `Number(x)` is the same `ToNumberValue` the arithmetic
// seam emits, differing only in that the result is the expression rather than an operand.
//
// THE ROWS ARE THE COERCION DIFFERENCE, because that is the whole reason `Number.isNaN` is a
// separate definition from the global `isNaN`. `isNaN("12x")` is TRUE — ToNumber of the argument is
// NaN — and `Number.isNaN("12x")` is FALSE, because the argument is a string rather than the NaN
// value. A definition that forwarded to the global passes nothing here. Same shape for isFinite:
// the string "1" is not finite because it is not a Number at all.
//
// The values come out of a dynamic array so nothing folds to a constant before the library runs.
//
// The global `isNaN` is deliberately ABSENT even though it belongs beside these: `isNaN(v[0])` on a
// dynamic array element fails selection with MSEL-TERMINATOR, at f3f5efe as much as here. It is
// recorded under known defects in HANDOFF.md.
export function main(): number {
  const big = 1e308 * 10;
  const vals: any[] = [NaN, 1, "12x", 1.5, big, 9007199254740993, "1", true, ""];
  let flags = 0;

  flags = flags + (Number.isNaN(vals[0]) ? 1 : 0);
  flags = flags + (Number.isNaN(vals[2]) ? 2 : 0);
  flags = flags + (Number.isNaN(vals[1]) ? 4 : 0);

  flags = flags + (Number.isFinite(vals[1]) ? 8 : 0);
  flags = flags + (Number.isFinite(vals[4]) ? 16 : 0);
  flags = flags + (Number.isFinite(vals[6]) ? 32 : 0);
  flags = flags + (Number.isFinite(vals[0]) ? 64 : 0);

  flags = flags + (Number.isInteger(vals[1]) ? 128 : 0);
  flags = flags + (Number.isInteger(vals[3]) ? 256 : 0);

  flags = flags + (Number.isSafeInteger(vals[1]) ? 512 : 0);
  // The literal is 2^53+1, which is not representable and arrives as 2^53 — still not safe.
  flags = flags + (Number.isSafeInteger(vals[5]) ? 1024 : 0);

  let converted = 0;
  converted = converted + Number("42");
  converted = converted + Number(vals[7]) * 100;      // true -> 1
  converted = converted + Number(vals[8]) * 1000;     // "" -> +0
  converted = converted + Number() * 10000;           // no argument -> +0, not NaN
  converted = converted + Number(vals[3]) * 100000;   // 1.5 stays a double

  return (flags + (converted | 0) * 100000) | 0;
}
