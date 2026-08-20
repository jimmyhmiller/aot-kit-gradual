// OPEN, AND DELIBERATELY SO. `for await` shares `KindForOfStatement`'s node shape but is a
// different operation, so the bridge leaves it at kind 0 and the frontend refuses it by name
// rather than silently lowering it as an ordinary `for ... of`.
//
//   frontend: unsupported statement syntax (bridge kind 0): for await (const x of [1, 2]) { ... }
//
// It stays here rather than in a "won't do" list because the refusal is what is being pinned: the
// day someone maps the kind, this file says whether they also implemented the await.
//
// node says 10 for main(7).
async function main(n) {
  let acc = n | 0;
  for await (const x of [1, 2]) { acc = (acc + x) | 0; }
  return acc | 0;
}
