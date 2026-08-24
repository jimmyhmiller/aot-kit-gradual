// OPEN. The remote line added the TypeScript bridge kind and DSL-owned `for...in` lowering, so the
// frontend now builds this program. Selection still refuses it during independent machine-CFG
// verification: block 55 has one successor but its selected terminator has the wrong arity.
// Enumeration meaning is no longer the missing piece; the remaining defect is structural backend
// handling of the loop graph produced by this small object enumeration.
//
// node says 9 for main(7).
function main(n) {
  let acc = n | 0;
  let o = {a: 1, b: 2};
  for (const k in o) { acc = (acc + k.length) | 0; }
  return acc | 0;
}
