// OPEN. `for (const k in o)` has no kind number in the TypeScript bridge at all, so it arrives as
// kind 0 and the frontend refuses it by name -- with an abort, which is why this file's status is
// "refused-abort" rather than "refused": there is no recoverable path out of an unmapped syntax.
//
//   frontend: unsupported statement syntax (bridge kind 0): for (const k in o) { ... }
//
// Enumeration itself is not the missing piece -- `lib/object/enumeration.jsl` already owns
// `Object.keys`, and `%OwnKeyCount`/`%OwnKeyAt` are the primitives a for-in desugars onto. What is
// missing is the bridge kind, the frontend statement case, and the decision about prototype-chain
// keys, which is the part `Object.keys` does not answer.
//
// node says 9 for main(7).
function main(n) {
  let acc = n | 0;
  let o = {a: 1, b: 2};
  for (const k in o) { acc = (acc + k.length) | 0; }
  return acc | 0;
}
