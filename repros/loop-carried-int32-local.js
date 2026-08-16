// FIXED 2026-08-15 in `g-analyze!` (src/node.coil): a node whose type changed is now re-queued
// ALONGSIDE its outs, because a Loop phi's compute reads the phi's own current type. Kept as a
// repro because the failure was silent -- the graph verified as "built", and only `g-verify`
// noticed. Pinned by `loop_carried_int32_local_reaches_its_type_fixpoint` in
// tests/js-source-prop.coil.
//
// A loop-carried LOCAL whose update goes through `| 0` left the graph off its type fixpoint:
//
//   verify: 1 violation(s), first VERR-STALE-TYPE at n11
//   n11: stored=int=[-2147483648..2147483647] computed=int
//
// The stored type is NARROWER than the recomputed one, which is the miscompile direction: an
// optimisation trusting the int32 range on a value the analysis says is any int is unsound.
// `g-analyze!` cannot repair it either, because `n-set-ty-falling!` only lets types narrow.
//
// The cause is that `phi-compute` (src/node.coil, the Loop arm at the end) widens with
// `ty-widen-from` using the phi's OWN CURRENT TYPE as fuel, so `n-compute` is not a pure function
// of the phi's inputs -- and `v-pass-types` (src/verify.coil:939) demands exactly that it is.
//
// Variations that DO pass, which is what pins it to the `| 0`:
//   - `z += d` instead of `z = (z + d) | 0`
//   - carrying the parameter-derived `acc` around the loop rather than a constant-initialised local
//
// Every earlier form of this we hit had the same shape: `s = (s + a[i]) | 0` reading an array
// element in a loop, and `s = (s + o.x) | 0` reading a field of an object allocated in the loop.
//
// node says 11 for main(10).
function main(n) {
  let acc = n | 0;
  let z = 0;
  let d = 0;
  while (d < 2) { z = (z + d) | 0; d++; }
  return (acc + z) | 0;
}
