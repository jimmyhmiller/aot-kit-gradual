// Storing a field read straight into another field of the same object fails representation
// checking, because the read stays boxed and nothing unboxes it before the store:
//
//   REP n19:Store slot 3 <- n12:Box is tagged, needs raw-num
//   REP n44:Add slot 1 <- n12:Box is tagged, needs raw-num
//
// It is the BARE copy that fails. Both of these pass:
//   o.q = (o.p + 0) | 0;      // arithmetic forces the unbox
//   o.x += o.y;               // which is why every existing template survived
// and routing through a local does NOT help, so it is not about the syntax of the assignment:
//   let t = o.p; o.q = t;     // fails the same way
//
// The nested-object form is the same defect with an object-typed field instead of a numeric one:
//   let o = {inner: {x: n}}; o.inner.x = (o.inner.x + 5) | 0;
//   REP n50:Store slot 2 <- n48:Cast is tagged, needs raw-ptr
// and there, reading `o.inner.x` alone is fine -- only the write fails.
//
// node says 20 for main(10).
function main(n) {
  let acc = n | 0;
  let o = {p: acc, q: 1};
  o.q = o.p;
  return (o.p + o.q) | 0;
}
