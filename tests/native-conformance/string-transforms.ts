// padStart, padEnd, repeat, replaceAll and `at` — the other six of the twelve String.prototype
// methods that lib/string/ implemented and no program could call.
//
// THE PADDING ROWS READ A CODE UNIT, NOT A LENGTH, and that is the falsification that mattered:
// `"7".padStart(3, "0").length` is 3 whether the filler went on the front, on the back, or was the
// wrong character entirely. Reading unit 0 distinguishes all three. The same reasoning puts a
// `charCodeAt` on the replaceAll row: "a-b-c".replaceAll("-", "+") has the right length even if
// only the first separator was replaced.
//
// `at` is the row that exposed a defect rather than confirming one. `StringAt` answers `undefined`
// out of range and a substring in range, and the substring arm was unboxed while `undefined` is a
// tagged word — one Phi, two representations. `"abcdef".at(-1) === "c"` was false and
// `String("abcdef".at(9))` failed selection. Both arms are boxed now, and the `String(...)` here is
// what reads the result back through the tag.
function zero(): number { return 0; }

export function main(): number {
  let total = 0;

  total = total + "7".padStart(3, "0").charCodeAt(0);
  total = total + "7".padStart(3, "0").length * 1000;
  total = total + "7".padEnd(3, "0").charCodeAt(0) * 10000;
  total = total + "7".padStart(2).charCodeAt(0) * 1000000;
  // A target no wider than the receiver leaves it alone.
  total = total + "abcd".padStart(2, "0").length * 100000000;

  total = total + "ab".repeat(3).length * 1000000000;
  // `"ab".repeat(0)` belongs here and is NOT here: a literal zero count makes the library's loop
  // provably run zero times, the builder folds it mid-construction, and the graph fails
  // verification with VERR-ARITY — a Region and its Phi left disagreeing. It is a refused compile
  // rather than a wrong answer, it reproduces without any of this work, and it is written up under
  // "Known defects" in HANDOFF.md. A variable count of zero is fine, which is what this row is.
  total = total + "ab".repeat(zero()).length * 10000000000;

  total = total + "a-b-c".replaceAll("-", "+").charCodeAt(3) * 100000000000;

  total = total + String("abcdef".at(-2)).charCodeAt(0) * 10000000000000;
  total = total + (("abcdef".at(9) === undefined) ? 1 : 0) * 1000000000000;

  return total;
}
