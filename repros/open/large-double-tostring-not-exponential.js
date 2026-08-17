// OPEN. ToString of a double at or beyond 1e21 must switch to exponential notation
// ("1e+21"), and the evaluator's number formatting does not: it prints the fixed
// expansion instead. The native runtime's %.17g path is also not the spec algorithm
// (it prints noise digits for e.g. 0.1). Both want the real shortest-round-trip
// digit generator. Number.prototype.toFixed delegates to ToString at >= 1e21 per
// spec, so (1e21).toFixed(2) inherits this gap; everything below 1e21 is exact.
//
// node says 13 for main(7).
function main(n) {
  let acc = n | 0;
  let s = String(1e21);
  acc += (s === "1e+21") ? 1 : 10;
  return (acc + s.length) | 0;
}
