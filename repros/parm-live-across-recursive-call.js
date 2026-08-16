// A parameter that is live ACROSS a self-recursive call is unbound when read after the call
// returns:
//
//   evaluator: a Call did not match a closed-world function definition at n5
//
// n5 is the Parm node, not a Call: `ev-parm` (src/eval.coil:3003) raises EV-CALL because
// `hasenv[n5]` is false by the time the caller resumes.
//
// It is specific to SELF-recursion with the parameter live across the call. All of these pass:
//   return (1 + g(x - 1)) | 0;   // call result used, parameter NOT live across the call
//   return g(x - 1);             // tail position, real recursion three deep
//   g(0)                         // the recursive arm never taken
//   function h(x){return x+1} function g(x){return (h(x) + x)|0}   // parm live across a
//                                                                   // NON-recursive call
// and going through a local does not change it:
//   let r = g(x - 1); return (x + r) | 0;   // fails the same way
//
// The evaluator does have machinery for this -- `active-funs` and the `frame-nodes` save/restore
// in `ev-call` -- and tests/eval-test.coil covers it for HAND-BUILT fib IR, which passes. So the
// frontend is emitting a recursive graph shape that machinery does not cover. Note the frontend
// shares one TypeTest node across three different control points (before the call, and after the
// CallEnd), which the hand-built fixtures do not do.
//
// benchmarks/typescript-aot/fibonacci.ts is exactly this shape and was compiled by the
// now-deleted tools/typescript-aot-benchmarks.mjs driver, so this path used to work through the
// product emitter. The oracle here is the EVALUATOR, which is a different consumer of the graph.
//
// node says 11 for main(10).
function g(x) {
  if (x <= 0) { return 0; }
  return (x + g(x - 1)) | 0;
}
function main(n) {
  return (n + g(1)) | 0;
}
