// DEMOLITION strike 1: `toLowerCase`/`toUpperCase` are a loop in lib/string/case.jsl over the
// string atoms `%StringNew`/`%StringSetUnit`, and the two opcodes that used to mean them are gone
// from the evaluator and from the C runtime alike.
//
// The characters are the point. `@` and `[` sit either side of `A`-`Z`, `a` sits after `Z`, so a
// comparison off by one in the shift shows up here. The empty string exercises a zero-length
// allocation, and `String(n)` a receiver that is not a constant.
//
// node says 15 for main(10).
function main(n) {
  const s = "AbZ@[a";
  let acc = 0;
  const lo = s.toLowerCase();
  const up = s.toUpperCase();
  if (lo === "abz@[a") acc += 1;
  if (up === "ABZ@[A") acc += 2;
  if ("".toLowerCase() === "") acc += 4;
  if (String(n).toUpperCase() === "10") acc += 8;
  return acc;
}
