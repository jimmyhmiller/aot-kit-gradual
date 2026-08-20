// OPEN. ToString of a double must produce the SHORTEST decimal that round-trips, and the runtime's
// %.17g path is not that algorithm: it prints noise digits.
//
//   String(1 / 3)   ours 19 characters, node 18
//
// This file replaces `large-double-tostring-not-exponential.js`, which pinned the 1e21 exponential
// switch -- that half now agrees with node and is pinned in `tests/native-execution-test.coil`
// instead. The digit generator is the half that is still owed, and it is the same one: Ryu or
// Grisu, in `lib/`, over the primitives rather than a `printf` format.
//
// node says 25 for main(7).
function main(n) {
  let s = String(1 / 3);
  return (n + s.length) | 0;
}
