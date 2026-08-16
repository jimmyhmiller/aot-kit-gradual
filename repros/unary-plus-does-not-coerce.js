// FIXED. Unary `+` returned its operand unchanged.
//
//   evaluator stopped: undefined for these values
//
// `+x` is ToNumber, and the lowering had `(str-eq operator "+") value` -- a no-op. Right for a
// number, wrong for everything else: `+String(acc)` handed a string straight to the arithmetic
// that consumed it.
//
// TWO WRONG FIXES CAME FIRST, and both are worth keeping:
//
//   - `fng-number-value` looked like the answer, since unary `-` uses it. It is not:
//     `fng-needs-to-number?` asks whether the value is `dyn`, and a STRING is not `dyn`, so the
//     operand was waved through a second time. Same shape as the loose-equality defect -- asking
//     "is it tagged" when the question is "is it a number".
//   - reaching `ToNumberValue` through `fng-to-number-operand`, which passes its operand UNBOXED
//     because its callers hand it an already-tagged `dyn`. That left the string's node collected
//     out from under the inlined macro: `VERR-DEAD-INPUT`. `Number(x)` boxes first, and copying
//     that is what worked.
//
// node says 9 for main(7).
function main(n) {
  let acc = n | 0;
  acc = (+String(acc) + 2) | 0;
  return acc | 0;
}
