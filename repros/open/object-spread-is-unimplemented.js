// PARTLY FIXED. The silent drop is now a named refusal; object spread is still unimplemented.
//
// WAS: object spread produced a Cast the evaluator would not accept.
//
//   evaluator stopped: a Cast was not satisfied: the compiler narrowed without proof
//
// `{...a, y: 2}` builds an object whose shape the frontend asserts with a Cast, and the assertion
// does not hold at run time. ARRAY spread is refused outright by name (`unsupported array element
// syntax`), so the two spreads take different paths and only this one gets as far as a graph.
//
// The real cause: `fe-index-object-layouts!` gives a literal a static shape only when EVERY
// property is a plain `TSK-PROPERTY-ASSIGNMENT`. A spread element is a different kind, so the
// literal got no layout and the spread contributed nothing at all -- `{...a, y: 2}` ended up with
// a shape carrying `y` and not `x`.
//
// That is exactly the ARRAY spread defect, which was fixed the same way: `[...a, 3]` silently
// evaluated to length 2, and the repair was to make the drop LOUD rather than to guess at
// semantics. `fng-refuse-object-spread!` now reports it:
//
//   frontend: unsupported object literal element syntax (bridge kind 0): ...a
//
// `Object.assign({}, a, {y: 2})` -- the same operation spelled without spread -- passes, which is
// the useful contrast: the shape logic is reachable and correct by the other route, and it is the
// workaround until spread is implemented.
//
// node says 9 for main(7).
function main(n) {
  let acc = n | 0;
  { let a = {x: acc}; let b = {...a, y: 2}; acc = (b.x + b.y) | 0; }
  return acc | 0;
}
