// OPEN. Three unrelated constructs all stop the evaluator the same way.
//
//   evaluator stopped: undefined for these values
//
// The status is shared; whether the cause is depends on nobody having looked yet. All three are
// single-probe failures in tools/js-sweep.sh, together accounting for 836 cases:
//
//   unary-plus      acc = (+String(acc) + 2) | 0;
//   arr-foreach     let s = 0; [1,2,3].forEach((x) => { s += x; }); acc = (acc + s) | 0;
//   json-stringify  let s = JSON.stringify({x: acc}); acc = (acc + s.length + 2) | 0;
//
// Worth separating before fixing: unary `+` is an operator, `forEach` is a callback taking a
// closure that mutates an enclosing local, and `JSON.stringify` is an intrinsic. The only reason
// they are in one file is that the sweep grouped them by the status they produce, and that
// grouping is a hypothesis rather than a diagnosis.
//
// node says 9 for main(7).
function main(n) {
  let acc = n | 0;
  acc = (+String(acc) + 2) | 0;
  return acc | 0;
}
