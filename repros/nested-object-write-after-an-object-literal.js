// OPEN, AND A COMPOSITION DEFECT -- both halves are correct on their own.
//
//   evaluator stopped: an Unbox input did not satisfy its requested type
//
// A plain object literal, then a write through a nested object. Each block passes by itself, in
// every constant the sweep tried; only the sequence fails. That is the class of finding this
// project keeps producing (see docs/FUZZ-FINDINGS.md), and the reason tools/js-sweep.coil
// enumerates ORDERED PAIRS rather than single constructs.
//
// Two pairings produce it, differing only in the first block:
//
//   { let o0 = {x: acc, y: 2}; acc = (o0.x + o0.y) | 0; }            // obj-literal
//   { let o0 = {x: acc, y: 2}; o0.x += o0.y; acc = o0.x | 0; }       // obj-compound
//
// followed in both cases by the nested write below. Since the first block only reads and writes
// its own fresh object, what survives it and reaches the second is an ALIAS STATE, which is
// exactly where `object_literal_replaces_shared_field_alias_state` and the `MemMerge` findings
// before it lived. `x` is a field name both objects use.
//
// node says 12 for main(7).
function main(n) {
  let acc = n | 0;
  { let o0 = {x: acc, y: 2}; acc = (o0.x + o0.y) | 0; }
  { let o1 = {inner: {x: acc}}; o1.inner.x = (o1.inner.x + 3) | 0; acc = o1.inner.x | 0; }
  return acc | 0;
}
