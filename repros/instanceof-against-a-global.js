// FIXED, in two stages. The graph corruption went first; then `instanceof Object` and
// `instanceof Array` lowered to the DSL's `InstanceOfObjectValue`/`InstanceOfArrayValue`
// (lib/abstract/property.jsl) -- the prototype-chain question specialised to the two chains the
// runtime itself maintains. The dispatch is by NAME and only when the name resolves to no user
// binding, so a shadowing constructor still takes `OrdinaryHasInstance`.
//
// WAS:
//
//   graph corruption: jsl argument 1 is NO-NODE
//
// `x instanceof Object` resolves no user constructor, so the lowering fell back to passing the
// RIGHT OPERAND as a value -- and `Object` has no value node. This frontend knows the name only as
// the owner of `Object.keys` and friends, never as a value, so the expression was NO-NODE. Handing
// that to the JSL layer aborted inside the callee, by which point the graph was already corrupt
// and the message named `OrdinaryInstanceOf` rather than the source that caused it.
//
// It was the ONLY genuine crash in 29,068 sweep cases; everything else that died was a deliberate
// refusal naming its construct.
//
// NOW the operand is checked where the evidence is:
//
//   frontend: unsupported instanceof right-operand syntax (bridge kind 79): Object
//
// `instanceof` against a USER constructor was always fine and still is, which is what localised
// it -- the defect is the fallback path, not the operator:
//
//   function B(v) { this.v = v; } let b = new B(1); b instanceof B      // 9, correct
//
// `instanceof Function` remains refused: `Function` is not an indexed global name at all.
//
// node says 9 for main(7).
function main(n) {
  let acc = n | 0;
  { let o = {}; acc += (o instanceof Object) ? 2 : 9; }
  return acc | 0;
}
