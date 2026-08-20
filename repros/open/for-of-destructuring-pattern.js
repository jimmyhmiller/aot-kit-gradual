// OPEN. `for (const [a, b] of xs)` is refused during indexing. Nothing in the frontend implements
// a binding PATTERN anywhere -- not in `let`, not in a parameter, not here -- so this is the
// for-of face of a missing feature rather than a for-of defect.
//
// node says 21 for main(7).
function main(n) {
  let acc = n | 0;
  for (const [a, b] of [[1, 2], [3, 4]]) { acc = (acc + a * b) | 0; }
  return acc | 0;
}
