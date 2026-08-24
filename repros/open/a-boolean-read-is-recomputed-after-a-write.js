// OPEN, and it is a WRONG ANSWER rather than a refusal, which makes it the worst kind. Found on
// 2026-08-20 by writing demonstration programs for the object-model work -- not by the gate, which
// is green and has no case of this shape.
//
// A boolean read out of the property heap, stored in a binding, and USED after a write to the same
// heap answers with the state AFTER the write. Node says `wasExtensible` is true; we say false.
//
// IT IS NOT THE MEMORY EDGE AND IT IS NOT SELECTION'S PLACEMENT. Six variants narrow it:
//
//   * `const before = Object.isExtensible(o) ? 11 : 22;` before the write -- AGREES. Forcing the
//     boolean into an integer at the point of the read makes the bug vanish, so the READ happens
//     at the right time and it is the boolean's later USE that is wrong.
//   * `const before = Object.isSealed(o)` in the same shape -- AGREES. `isSealed` goes through
//     the `TestIntegrityLevel` BUILTIN, so its result crosses a CallEnd; `isExtensible` is an
//     inlined macro over `(%Lt 0 (%IsExtensible o 0))` and its result never does.
//   * `const v = o.a; o.a = 5; return v` -- AGREES. `%PropLoadKey` computes `dyn`;
//     `%IsExtensible` computes `int`. Same selection arm, same memory plumbing, same op family.
//   * Two reads either side of the write -- AGREES, so GVN is not merging them.
//   * The same program with an ordinary write instead of `preventExtensions` -- AGREES, because
//     nothing changes the answer, which is what makes recomputation invisible everywhere else.
//
// The suspect is therefore representation, not ordering: a raw `int`-typed heap read consumed as a
// JavaScript boolean, stored into a binding and reloaded across a write. `docs/DECISIONS.md` D12
// and the HANDOFF entry for 2026-08-19 say the same sentence about four other sites -- A TYPE IS
// NOT A REPRESENTATION.
//
// node says 8 for main(7).
function main(n) {
  const o = {};
  o.a = 1;
  const wasExtensible = Object.isExtensible(o);
  Object.preventExtensions(o);
  o.b = 5;
  return (n + (wasExtensible ? 1 : 0)) | 0;
}
