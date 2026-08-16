// OPEN. `Array.prototype.unshift` does not terminate.
//
//   evaluator stopped: step budget exhausted
//
// Not merely slow: this exhausts 200,000,000 evaluator steps on a two-element array, so the
// lowering is looping without making progress rather than doing too much work.
//
// The neighbouring operations are all fine -- `push`, `pop`, `shift`, `length =`, `slice`,
// `concat` -- which points at `unshift`'s own shifting loop rather than at array support.
//
// node says 10 for main(7).
function main(n) {
  let acc = n | 0;
  { let a = [acc]; a.unshift(2); acc = (a[0] + a.length) | 0; }
  return acc | 0;
}
