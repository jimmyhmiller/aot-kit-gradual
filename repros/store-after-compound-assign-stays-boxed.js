// A field store of a value that came out of the DSL's own arithmetic:
//
//   REP Store slot 3 <- Box is tagged, needs raw-num
//
// `fng-coerce-to-alias` decided whether to unbox with `fng-value-tagged?`, whose last resort is
// `(= (n-ty value) (t-dyn))` -- a MOMENTARY analysis state during construction. A compiler
// update changed an unspecified iteration order, the DSL call's fresh Phi no longer happened to
// have its type computed at store-lowering time, and the tagged word went into the raw slot with
// the source tree unchanged. The fix keys the decision on SHAPE (the boxed walk), like every
// other build-time decision in the frontend. The `Array.isArray` line is the fuzz counterexample
// ((ArrayTest) (PropStore)) that reported it; `acc += 1` alone reproduces.
function main(n) {
  let acc = n | 0;
  { let a0 = [1, 2]; acc += Array.isArray(a0) ? 1 : 10; }
  acc += 1;
  { let o1 = {x: 0}; o1.x = acc; acc = o1.x | 0; }
  return acc | 0;
}
