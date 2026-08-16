// OPEN. A method called on a primitive receiver fails representation checking.
//
//   verify: 1 violation(s), first VERR-CALL-RECEIVER-TAG at n14
//
// Two probes in the sweep produce the identical violation at the identical node, which is why they
// share a repro: `(acc / 4).toFixed(2)` on a number, and `'aXa'.replace('X', 'bb')` on a string
// literal. Both are a call whose receiver is a primitive rather than an object, and the receiver
// reaches the call in the wrong representation.
//
// Method calls on primitives that DO work are the ones already covered by templates --
// `String(acc).length`, `s.toLowerCase()`, `s.indexOf(...)` -- so it is not "methods on primitives"
// wholesale. Narrowing which of those differ is the first step.
//
// node says 11 for main(7).
function main(n) {
  let acc = n | 0;
  { let s = (acc / 4).toFixed(2); acc = (acc + s.length) | 0; }
  return acc | 0;
}
