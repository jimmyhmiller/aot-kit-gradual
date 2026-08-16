// A `do`/`while` computed the WRONG ANSWER -- no crash, no verifier complaint -- whenever its body
// touched memory outside the declared fields:
//
//   node=23 ours=20
//
// `fng-loop` builds its loop memory phis over the CONTROL alias list: declared fields converted to
// aliases, plus every dynamic alias, plus the runtime JavaScript property heap force-included, plus
// the captured-cell alias. `fng-do-loop` called `fng-active-memory!` and nothing else, and that
// publishes DECLARED FIELDS ONLY. So an array element store, a computed property, or a captured
// cell had no phi: the loop header kept reading pre-loop memory on every iteration, and the second
// iteration could not see what the first one wrote.
//
// The graph is well formed either way, which is why this outlived the three crashes fixed before
// it -- `g-verify` has nothing to object to, and only an oracle notices.
//
// The SAME body written as `while` is correct, and that is the whole diagnosis:
//
//   while (d < 4) { a[d] = (a[0] + d + 1) | 0; d++; }     // 23, correct
//
// The captured-cell half of the same defect, node=19 ours=14 before the fix:
//
//   let c = 0;
//   const bump = function () { c = (c + 1) | 0; return c; };
//   let d = 0;
//   do { acc = (acc + bump()) | 0; d++; } while (d < 3);
//   return (acc + c) | 0;
//
// Found by auditing `fng-do-loop` against `fng-loop` line by line, which docs/FUZZ-FINDINGS.md had
// predicted would be faster than one counterexample at a time. It was: the diff named both.
//
// node says 23 for main(10).
function main(n) {
  let acc = n | 0;
  let a = [0, 0, 0, 0];
  let d = 0;
  do { a[d] = (a[0] + d + 1) | 0; d++; } while (d < 4);
  return (acc + a[0] + a[1] + a[2] + a[3]) | 0;
}
