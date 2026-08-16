// OPEN, AND A COMPOSITION DEFECT -- both halves are correct on their own.
//
//   REP n36:Add slot 1 <- n34:ToNumber is tagged, needs raw-num
//   verify: 1 violation(s), first VERR-REPRESENTATION at n36
//
// `Math.trunc` lowers through a ToNumber, and the `++`/`--` block then consumes that value with an
// Add that wants a raw number. Nothing between them unboxes it.
//
// Both blocks pass alone. The increment block after any OTHER arithmetic passes too -- it is the
// builtin call in front of it that leaves the accumulator tagged, which makes this the third
// distinct defect the sweep found sitting behind `Math.trunc`, after
// repros/dead-branch-after-builtin.js and repros/open/single-path-region-keeps-its-phi.js. A
// builtin's result being tagged where the next block expects raw looks like one root cause with
// three symptoms rather than three defects.
//
// node says 6 for main(7).
function main(n) {
  let acc = n | 0;
  acc = Math.trunc(acc / 2);
  { let i1 = acc; i1++; ++i1; i1--; --i1; acc = i1 + 3; }
  return acc | 0;
}
