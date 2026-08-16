// OPEN. A builtin call followed by a branch whose condition folds to TRUE:
//
//   REP n81:Unbox slot 1 <- n63:Phi is raw-num, needs tagged
//   verify: 1 violation(s), first VERR-REPRESENTATION at n81
//
// The mirror of repros/dead-branch-after-builtin.js -- there the taken arm died, here the untaken
// one does -- and it is NOT fixed by that fix. The relevant nodes:
//
//   n62: Region : ctrl <- _ n52        <- one live path
//   n63: Phi : int     <- n62 n58      <- still attached to it
//   n81: Unbox : flt   <- _ n63        <- unboxing a value that is already raw
//
// `region-idealize` reduces a two-input Region to its single path only when the Region has no Phi
// on it:
//
//   (if (and (= (n-nins n) 2) (or (op-is? n Loop []) (not (region-has-phi? n))))
//       (do (region-reduce-phis! n) (n-in n 1))
//       (region-collapse-diamond n))
//
// so a one-path Region that DOES carry a phi survives as a merge that merges one thing. The phi
// then narrows to `int` as analysis proves the single arm, while the `| 0` lowering that consumed
// it was built when it was `dyn` and still has its Unbox. Unboxing a raw number is what the
// verifier objects to.
//
// Which of the two is wrong is the open question, and they are different repairs:
//   - if the Region should reduce, `region-has-phi?` is guarding too much and the phi should
//     reduce with it, exactly as the Loop arm already does;
//   - if the Unbox should not be there, the frontend is emitting a representation conversion
//     against a type that had not settled, and the fix belongs with `fng-coerce-to-alias`.
//
// NOT REACHED BY THE FUZZER TODAY: no template emits a constant-true condition. `XCtrl`'s
// template emits `if (false)`, which is the fixed case. This was found by hand while minimising
// that one, so adding an `if (true)` template is what would keep it honest -- after the fix.
//
// node says 1007 for main(7).
function main(n) {
  let acc = n | 0;
  acc = Math.trunc(acc);
  if (true) { acc += 1000; }
  return acc | 0;
}
