// A builtin call followed by a provably-dead branch ABORTED THE COMPILER:
//
//   graph corruption: n-in: input index out of range
//     phi-idealize -> n-peephole -> fng-analyze-fresh!
//
// Two separate defects, one on top of the other.
//
// THE GRAPH. `Math.trunc` lowers through a ToNumber diamond, so the dead branch contains a
// Region with a Phi on it. Both of that Region's paths are proven XCtrl, and `region-idealize`
// drops them one at a time -- each removal taking the matching arm off every attached Phi with
// it. Taking a two-input Region down to one therefore leaves its phis holding nothing but their
// control input, and the next visit turns the Region into XCtrl and retargets those phis onto it.
// What survives is a one-input Phi on XCtrl: unreachable, never analysed (still typed ANY), and
// rejected by the Phi arity rule -- which is right to reject it.
//
// Fixed by collapsing the Region one step earlier, while each phi still has exactly one value to
// reduce to. That value is the one on the dead path, which is sound precisely because nothing on
// this control can execute.
//
// THE ABORT. `phi-idealize`'s first rule is "a phi that is not on a merge is simply its one
// value", and it read input 1 to get that value without checking the phi has one. So the
// malformed phi above did not produce a verdict, it killed the process inside the analysis pass.
// A phi with fewer than two inputs now idealizes to nothing.
//
// The Region fix is the repair; the guard alone leaves `VERR-ARITY at n47` on a valid program,
// and with the Region fix in place nothing produces a short phi here at all. The guard stays
// anyway, because reading an input without checking it exists is a defect in `phi-idealize`
// whoever else stops supplying the shape -- and a malformed graph is supposed to get a verdict
// rather than kill the process.
//
// It is not about division, and not about `Math.trunc`. Any builtin call does it --
// `Math.abs(acc)`, `Math.max(acc, 1)` -- and so does the dead branch with no `else`. These are
// all fine, which is what localised it:
//
//   if (false) { acc += 1000; }                 // the dead branch ALONE
//   acc = acc / 2; if (false) { ... }           // `/` without the builtin call
//   Math.trunc(acc); if (acc > 3) { ... }       // a condition that is not decidable
//   Math.trunc(acc); while (false) { ... }      // a dead LOOP rather than a dead branch
//
// Found by tests/js-source-prop.coil composing two generated blocks:
//   ops = ((Div) (XCtrl))
//
// node says 3 for main(7).
function main(n) {
  let acc = n | 0;
  acc = Math.trunc(acc / 2);
  if (false) { acc += 1000; }
  return acc | 0;
}
