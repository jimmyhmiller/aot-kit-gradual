// FIXED. `==` between a number and its own string form was false; JavaScript says true.
//
//   node=9 ours=8
//
// `acc == String(acc)` must be TRUE for every number: `==` applies ToNumber to the string operand
// and compares numerically. We take the false branch, so the answer is off by exactly the
// difference between the two arms -- which is what makes it easy to miss and dangerous to ship.
//
// Strict equality is not affected: `acc === acc` is fine, and `String(acc) === String(acc)` is
// fine, so it is the loose-equality coercion path rather than comparison or string building.
//
// Found by tools/js-sweep.sh: probe `loose-eq`, failing alone and in 69 of its pairings.
//
// FIXED by giving `==`/`!=` their own lowering. `fng-equal-value` is STRICT equality's, and
// `switch` shares it because `switch` matches with `===`; loose equality coerces, and that
// lowering unboxes a tagged operand as a float on the evidence that the OTHER side is numeric --
// no evidence about the tagged one at all. `fng-loose-equal` now keeps one fast path, both
// operands PROVABLY raw machine numbers, and sends everything else to `LooseEqual` in
// lib/abstract/conversions.jsl.
//
// The first attempt used "is either side tagged?" as the fast-path test and did not move the
// repro at all: a string is not `dyn`-typed either, so `acc == String(acc)` still took the raw
// compare. The proof has to be that both sides ARE numbers, not that neither looks dynamic.
//
// Pinned by `loose_equality_coerces_a_string_to_a_number` in tests/js-source-prop.coil, whose
// last three cases check that strict equality, `true == 1` and `null == undefined` still work --
// a fix that coerced unconditionally would break all three.
//
// node says 9 for main(7).
function main(n) {
  let acc = n | 0;
  acc += (acc == String(acc) ? 2 : 1);
  return acc | 0;
}
