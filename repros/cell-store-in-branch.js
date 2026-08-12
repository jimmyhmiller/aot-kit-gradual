// A captured cell whose ONLY store sits inside a branch. fng-if's control snapshot fixed its
// alias list before lowering the branch, so the branch's first-ever cell touch had no memory
// phi at the merge and the store was dropped: work() ran with iterations=10 forever and
// setIterations(2) was a no-op (NavierStokes ran lin_solve at 10 iterations instead of 2 —
// the last ns-small divergence). fng-control-aliases! now force-includes the cell alias in
// every control snapshot, the same way fng-loop always did for loop memory phis; and
// fng-merge-snapshots! types the merged phi by the alias's declared content (a bare t-undef
// content let inference fold loads through the merge to undefined).
function F() {
  function work() {
    var s = 0;
    for (var outer = 0; outer < 1; outer++) {
      for (var k = 0; k < iterations; k++) s = (s + k + 1) | 0;
    }
    return s;
  }
  this.work = work;
  this.setIterations = function(iters) {
    if (iters > 0 && iters <= 100) iterations = iters;
  }
  var iterations = 10;
}
function main() {
  var f = new F();
  f.setIterations(2);
  return f.work();
}
