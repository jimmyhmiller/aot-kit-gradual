// An object allocation followed by a `do`/`while` corrupts the graph.
//
//   graph corruption: n-in: input index out of range
//
// and with a wider object (four fields) the builder segfaults outright instead.
// The SAME object followed by `while` or by `for` is fine, so it is specific to the
// do-while lowering, not to loops in general.
//
// node says 10 for main(10).
//
// Found by tests/js-source-prop.coil composing two generated blocks:
//   ops = ((New :shape 0) (CallEnd))
function main(n) {
  let acc = n | 0;
  { let o = {a: acc}; acc = o.a | 0; }
  { let d = 0; do { acc = (acc + d) | 0; d++; } while (d < 1); }
  return acc | 0;
}
