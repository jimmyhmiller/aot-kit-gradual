// PARTLY FIXED. The silent wrong answer is gone; the feature is still missing.
//
// WAS: a rest parameter always had length 0.
//
//   node=10 ours=0
//
// Nothing implements `...xs`, and nothing noticed. It was indexed as an ordinary parameter named
// `xs`, the call site passed it nothing, and every read came back undefined -- so `xs.length` was
// `undefined`, `undefined | 0` is 0, and `(...xs) => xs.length` returned zero for every call with
// a well-formed graph and no diagnostic anywhere. A wrong answer nothing signals is the worst
// outcome available.
//
// NOW: `fe-rest-parameter?` refuses it by name at the indexing step.
//
//   frontend refused (unsupported/unsupported-syntax): ...xs
//
// Detected from the parameter's own source text rather than a token kind: the bridge maps every
// syntax it does not enumerate to kind 0, so a DotDotDotToken is not reliably distinguishable from
// anything else it has not been taught.
//
// This file stays here because it still does not RUN -- implementing rest parameters means
// materialising an array from the extra arguments at a call site whose ABI is fixed-arity, which
// is feature work rather than a defect. Pinned meanwhile by
// `a_rest_parameter_is_refused_rather_than_bound_to_nothing` in tests/js-source-prop.coil, whose
// second case checks that an ordinary parameter list still indexes -- otherwise the test would
// pass by refusing everything.
//
// node says 10 for main(7).
function main(n) {
  let acc = n | 0;
  { const f = (...xs) => xs.length; acc = (acc + f(1, 2, 3)) | 0; }
  return acc | 0;
}
