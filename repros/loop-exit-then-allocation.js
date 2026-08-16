// A `break` out of a loop, followed by anything that allocates, leaves a memory Phi holding a DEAD
// input:
//
//   verify: 1 violation(s), first VERR-DEAD-INPUT at n38
//   n38 is a Phi, inputs: [0]=n35 [1]=n34 [2]=n8(DEAD)
//
// n35 is the region merging the normal loop exit with the break exit; n34 is the memory on the
// normal path; n8 is the memory recorded for the BREAK path, and it has since died. Nothing
// updates the phi when that happens.
//
// The `break` ALONE is fine -- this returns 1 with the second block deleted. It is the allocation
// after it that exposes the phi. A labelled `continue` does exactly the same thing:
//
//   ou0: for (let i0 = 0; i0 < 3; i0++) {
//     for (let j0 = 0; j0 < 3; j0++) { if (j0 > i0) { continue ou0; } lb0 = (lb0 + 1) | 0; }
//   }
//   { let o = {a: acc}; acc = o.a | 0; }        // <-- VERR-DEAD-INPUT
//
// and the same loop with an ordinary conditional instead of an abrupt exit passes:
//
//   for (let i0 = 0; i0 < 4; i0++) { if (i0 <= 0) { bk0 = (bk0 + 1) | 0; } }   // fine
//
// so it is the abrupt-exit merge, not loops or allocation on their own.
//
// node says 1 for main(0).
//
// Found by tests/js-source-prop.coil composing two generated blocks:
//   ops = ((OwnKeyAt) (InternalStore :operation 0))
function main(n) {
  let acc = n | 0;
  { let bk0 = 0; for (let i0 = 0; i0 < 4; i0++) { if (i0 > 0) { break; } bk0 = (bk0 + 1) | 0; } acc = (acc + bk0) | 0; }
  { let o = {a: acc}; acc = o.a | 0; }
  return acc | 0;
}
