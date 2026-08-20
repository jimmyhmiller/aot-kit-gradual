// OPEN. `for (x of xs)` -- an assignment target rather than a fresh `const`/`let` binding -- is
// refused during indexing. `fng-loop` binds the per-iteration value by SYMBOL, and an assignment
// target is an lvalue expression, which is a different lowering: the write has to go through
// `fng-lvalue-write` on every trip, including when the target is a field or an element.
//
// The loop machinery itself is ready; this is the binding half only.
//
// node says 13 for main(7).
function main(n) {
  let acc = n | 0;
  let x = 0;
  for (x of [1, 2, 3]) { acc = (acc + x) | 0; }
  return acc | 0;
}
