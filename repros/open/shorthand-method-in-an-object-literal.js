// OPEN. `{ get() { return 7; } }` is refused during indexing. The long form
// `{ get: function() { return 7; } }` and the arrow form `{ get: () => 7 }` both compile and run,
// so the object side and the call side are fine: what is missing is the indexer recognising a
// shorthand method definition as a function-valued property.
//
// node says 14 for main(7).
function main(n) {
  let o = { get() { return 7; } };
  return (n + o.get()) | 0;
}
