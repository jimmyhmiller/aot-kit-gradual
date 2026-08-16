// OPEN. A closure that captures a `let` loop variable fails representation checking.
//
//   REP n90:Add slot 1 <- n161:Phi is tagged, needs raw-num
//   verify: 1 violation(s), first VERR-REPRESENTATION at n90
//
// Each iteration of a `let` loop gets its OWN binding, so the three closures must return 0, 1, 2.
// The captured cell arrives at the summing `Add` still tagged.
//
// A closure that captures an ordinary local is fine, and a loop with no closure in it is fine, so
// it is the per-iteration capture -- the one case where the cell is genuinely loop-carried.
//
// node says 10 for main(7).
function main(n) {
  let acc = n | 0;
  {
    let fs = [];
    for (let i = 0; i < 3; i++) { fs.push(() => i); }
    let s = 0;
    for (let j = 0; j < fs.length; j++) { s += fs[j](); }
    acc = (acc + s) | 0;
  }
  return acc | 0;
}
