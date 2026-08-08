#!/usr/bin/env node
// The Node oracle for the JSL `String.prototype.indexOf` conformance table.
//
// WHY THIS EXISTS AS A FILE. The 24 expected values in tests/jsl-test.coil came from running Node,
// which is the right provenance — but they were transcribed by hand from a throwaway script, so
// nobody could re-derive them and a mis-transcription would have been invisible. A table that only
// agrees with itself teaches you the wrong thing. This makes the derivation reproducible: the gate
// regenerates from Node and compares against the committed tests/jsl-string-oracle.txt.
//
// FALSIFICATION. `AOT_JSL_TOINT32=1` replaces ToIntegerOrInfinity with `|0` (ToInt32), which is the
// specific wrong implementation this table exists to catch. The gate asserts the falsified output
// DIFFERS from the committed one; if it did not, the table would be discriminating nothing.
const falsifyToInt32 = process.env.AOT_JSL_TOINT32 === "1";
// A second falsification, covering the Math surface the ToInt32 one does not reach.
// `floor(x + 0.5)` is the classic wrong Math.round: it rounds a half toward -Infinity, so
// `round(-2.5)` answers -3 where the spec says -2.
const falsifyRound = process.env.AOT_JSL_ROUND_FLOOR === "1";

// ToIntegerOrInfinity, or the `|0` mistake. Real indexOf clamps the result to [0, len] afterwards,
// so the two only diverge where truncation and ToInt32 disagree: the infinities, and any magnitude
// past 2^31.
function position(p) {
  if (!falsifyToInt32) return p;
  return (p === undefined ? 0 : p) | 0;
}

const cases = [
  ["hello world", "o", 0], ["hello world", "o", 5], ["hello world", "o", 99],
  ["hello world", "o", -99], ["abcabc", "b", 2], ["abcabc", "b", 2.9],
  ["abcabc", "b", -2.9], ["abc", "c", Infinity], ["abc", "c", -Infinity],
  ["abc", "c", NaN], ["abc", "", 0], ["abc", "", 99], ["abc", "zz", 0],
  ["abc", "b", undefined], ["abc", "b", null], ["abc", "b", true],
  ["abc", "b", "1"], ["abc", "b", " 1 "], ["abc", "b", "1e0"], ["abc", "b", "0x1"],
  ["abc", "b", ""], ["abc", "b", "nonsense"], ["12345", 34, 0], ["truthy", true, 0],
];

const lines = [];
cases.forEach(([s, n, p], i) => {
  lines.push(`${String(i).padStart(2, "0")}=${s.indexOf(n, position(p))}`);
});

// The two nullish-receiver cases. Step 1 is RequireObjectCoercible, which throws; the JSL side
// reports EV-THROW. Only the fact of the throw is compared, because the error CLASS is a documented
// deviation until error objects exist (roadmap R03) and comparing it would pin the wrong thing.
for (const receiver of [null, undefined]) {
  let result;
  try {
    result = String.prototype.indexOf.call(receiver, "b", 0);
  } catch (e) {
    result = "throw";
  }
  lines.push(`${String(lines.length).padStart(2, "0")}=${result}`);
}

// ---------------------------------------------------------------------------
// The iterative builtins. These need `loop`, so none of them was expressible before it existed.
// Each is compared over already-coerced arguments, matching what the JSL definitions take.
// ---------------------------------------------------------------------------
// A string is printed with every code unit outside printable ASCII escaped as \uXXXX. That keeps
// the comparison byte-exact without either side needing UTF-8, and keeps the golden file readable:
// the whitespace fixtures are U+00A0 and U+FEFF, which would otherwise be invisible bytes in a
// diff. Iterates CODE UNITS, not code points, because that is what String.prototype operates on.
function jstr(s) {
  let o = "\"";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 34) o += "\\\"";
    else if (c === 92) o += "\\\\";
    else if (c < 32 || c > 126) o += "\\u" + c.toString(16).padStart(4, "0");
    else o += s[i];
  }
  return o + "\"";
}

// A thrown case prints the bare token `throw`, never a quoted string, so it cannot be confused
// with a builtin that legitimately RETURNS the text "throw".
function push(label, fn) {
  let r, threw = false;
  try { r = fn(); } catch (e) { threw = true; }
  lines.push(`${label}=${threw ? "throw" : typeof r === "string" ? jstr(r) : r}`);
}

// String.prototype.repeat
[["ab", 3], ["ab", 0], ["", 5], ["x", 1], ["ab", -1]].forEach(([s, n], i) =>
  push(`rep${i}`, () => s.repeat(n)));

// String.prototype.lastIndexOf, whole-receiver search
[["abcabc", "b"], ["abcabc", "zz"], ["aaa", "a"], ["abc", ""], ["abcabc", "abc"]]
  .forEach(([s, n], i) => push(`last${i}`, () => s.lastIndexOf(n)));

// String.prototype.padStart
[["abc", 6, "0"], ["abc", 2, "0"], ["abc", 3, "0"], ["abc", 8, "xy"], ["abc", 6, ""],
 ["", 3, "z"]].forEach(([s, t, f], i) => push(`pad${i}`, () => s.padStart(t, f)));

// ---------------------------------------------------------------------------
// The rest of the expressible String.prototype.
// ---------------------------------------------------------------------------
[["abc", 0], ["abc", 2], ["abc", 3], ["abc", -1], ["", 0]].forEach(([s, i], k) => {
  push(`chat${k}`, () => s.charAt(i));
  pushNum(`ccode${k}`, () => s.charCodeAt(i));
  push(`at${k}`, () => { const r = s.at(i); return r === undefined ? "undef" : r; });
});
[["abcdef", -2], ["abcdef", -99], ["abc", 1]].forEach(([s, i], k) =>
  push(`atn${k}`, () => { const r = s.at(i); return r === undefined ? "undef" : r; }));

[["abcdef", 1, 4], ["abcdef", -3, -1], ["abcdef", 4, 1], ["abcdef", -99, 99], ["abc", 2, 2]]
  .forEach(([s, a, b], k) => push(`slice${k}`, () => s.slice(a, b)));

["  ab  ", "\t\n ab", "ab\r\n", "", "   ", "a b", "\u00a0ab\u00a0", "\ufeffab"]
  .forEach((s, k) => {
    push(`trim${k}`, () => s.trim());
    push(`trimS${k}`, () => s.trimStart());
    push(`trimE${k}`, () => s.trimEnd());
  });

[["abc", 6, "0"], ["abc", 2, "0"], ["abc", 8, "xy"], ["", 3, "z"]]
  .forEach(([s, t, f], k) => push(`pade${k}`, () => s.padEnd(t, f)));

[["abcabc", "b", "X"], ["abcabc", "abc", ""], ["abc", "", "-"], ["", "", "-"],
 ["aaa", "aa", "b"], ["abc", "zz", "X"], ["abc", "c", "cc"]]
  .forEach(([s, p, r], k) => push(`repl${k}`, () => s.replaceAll(p, r)));

// ---------------------------------------------------------------------------
// Array.prototype, over arrays the JSL side BUILDS ITSELF. Nothing here passes an array across a
// call: memory cannot cross one, so each probe allocates, fills, and reads inside one function.
// `iota(n)` is [0, n), whose every element is distinguishable — a fill of one repeated value cannot
// tell an off-by-one index from a correct one.
// ---------------------------------------------------------------------------
const iota = (n) => Array.from({ length: n }, (_, i) => i);

[[5, 3], [5, 0], [5, 4], [5, 9], [0, 0], [1, 0]].forEach(([n, t], k) => {
  pushNum(`aidx${k}`, () => iota(n).indexOf(t));
  pushNum(`ainc${k}`, () => iota(n).includes(t));
  pushNum(`alast${k}`, () => iota(n).lastIndexOf(t));
});

function pushAt(label, fn) {
  let r;
  try { r = fn(); } catch (e) { lines.push(`${label}=throw`); return; }
  lines.push(`${label}=${r === undefined ? "\"undef\"" : num(r)}`);
}
[[5, 0], [5, 4], [5, -1], [5, -5], [5, 5], [5, -6], [0, 0]].forEach(([n, i], k) =>
  pushAt(`aat${k}`, () => iota(n).at(i)));

[[0, ","], [1, ","], [4, ","], [4, ""], [4, "--"], [3, "|"]].forEach(([n, sep], k) =>
  push(`ajoin${k}`, () => iota(n).join(sep)));

[0, 1, 4, 7].forEach((n, k) => {
  pushNum(`alen${k}`, () => iota(n).length);
  push(`amap${k}`, () => iota(n).map((v) => v * 2).join(","));
});

[[0, 9], [1, 9], [3, 9]].forEach(([n, v], k) =>
  push(`arep${k}`, () => new Array(n).fill(v).join(",")));

// ---------------------------------------------------------------------------
// Math and Number. A number is encoded CANONICALLY so the two sides can be compared exactly:
// `nan`, `inf`, `-inf`, a decimal integer when the value is integral and safe, and otherwise the
// IEEE bit pattern. Printing a decimal expansion instead would compare two formatters rather than
// two implementations.
// ---------------------------------------------------------------------------
const numBuf = new DataView(new ArrayBuffer(8));
function num(v) {
  if (typeof v !== "number") return String(v);
  if (Number.isNaN(v)) return "nan";
  if (v === Infinity) return "inf";
  if (v === -Infinity) return "-inf";
  if (Number.isInteger(v) && Math.abs(v) <= 9007199254740991) return String(v);
  numBuf.setFloat64(0, v, false);
  return "bits:" + BigInt.asIntN(64, numBuf.getBigUint64(0, false)).toString();
}
function pushNum(label, fn) {
  let r, threw = false;
  try { r = fn(); } catch (e) { threw = true; }
  lines.push(`${label}=${threw ? "throw" : typeof r === "boolean" ? (r ? "true" : "false") : num(r)}`);
}

// 0.49999999999999994 is the largest double below 0.5, and it is here because it is the value that
// separates `Math.round` from `floor(x + 0.5)`: the sum rounds UP to exactly 1.0, so the naive
// implementation answers 1 where the spec answers 0. Without this row the round-floor falsification
// below does not bite — -2.5 + 0.5 is exact, so every obvious half tests nothing.
const NUMS = [0, 1, -1, 2.5, -2.5, 2.4, -2.4, 0.5, -0.5, 0.49999999999999994,
              7, -7, 1e300, NaN, Infinity, -Infinity];
NUMS.forEach((v, i) => {
  pushNum(`abs${i}`,   () => Math.abs(v));
  pushNum(`sign${i}`,  () => Math.sign(v));
  pushNum(`trunc${i}`, () => Math.trunc(v));
  pushNum(`floor${i}`, () => Math.floor(v));
  pushNum(`ceil${i}`,  () => Math.ceil(v));
  pushNum(`round${i}`, () => falsifyRound ? Math.floor(v + 0.5) : Math.round(v));
});

[[1, 2], [2, 1], [NaN, 1], [1, NaN], [Infinity, 5], [-Infinity, 5], [3, 3]]
  .forEach(([a, b], i) => {
    pushNum(`max${i}`, () => Math.max(a, b));
    pushNum(`min${i}`, () => Math.min(a, b));
  });

// The predicates, over non-numbers too — that is the whole difference from the global `isNaN`.
const VALS = [0, 1, -1, 2.5, NaN, Infinity, -Infinity, 9007199254740991, 9007199254740992, 1e300];
VALS.forEach((v, i) => {
  pushNum(`isnan${i}`,  () => Number.isNaN(v));
  pushNum(`isfin${i}`,  () => Number.isFinite(v));
  pushNum(`isint${i}`,  () => Number.isInteger(v));
  pushNum(`issafe${i}`, () => Number.isSafeInteger(v));
});


// ---------------------------------------------------------------------------
// The native probes. tools/jsl-native-probes.jsl computes each of these in the library and returns
// a BOOLEAN, so a string result can be judged without the harness reading one out of the runtime.
// These lines are what tools/jsl-native-gate.sh compares its compiled output against.
//
// The deliberate false rows are not filler: a table of expected-true rows would pass against a
// string comparison that always agreed.
// ---------------------------------------------------------------------------
const STREQ = [
  () => "hello".substring(1, 3) === "el",
  () => "hello".substring(1, 3) === "XX",
  () => "  ab  ".trim() === "ab",
  () => "  ab  ".trimStart() === "ab  ",
  () => "  ab  ".trimEnd() === "  ab",
  () => "ab".repeat(3) === "ababab",
  () => "ab".repeat(0) === "",
  () => "abc".padStart(6, "0") === "000abc",
  () => "abc".padEnd(6, "0") === "abc000",
  () => "abcdef".slice(1, 4) === "bcd",
  () => "abc".charAt(1) === "b",
  () => "abc".charAt(9) === "",
  () => "abcabc".replaceAll("b", "X") === "aXcaXc",
  () => "abc".replaceAll("", "-") === "-a-b-c-",
  () => "abcdef".slice(4, 1) === "",
];
STREQ.forEach((f, i) => lines.push(`streq${i}=${f() ? "true" : "false"}`));

const STRNUM = [
  () => "hello world".indexOf("o", 0) === 4,
  () => "hello world".indexOf("o", 5) === 7,
  () => "hello world".indexOf("o", 99) === -1,
  () => "hello".length === 5,
  () => "abc".charCodeAt(1) === 98,
  () => "coil".startsWith("co") === true,
  () => "coil".startsWith("il") === false,
  () => "coil".endsWith("il") === true,
  () => "oil".endsWith("coil") === false,
  () => "abcabc".lastIndexOf("b") === 4,
  () => "abc".lastIndexOf("") === 3,
  () => "coil".includes("il") === true,
  () => "coil".includes("zz") === false,
  () => "abcdef".at(-2) === "e",
  () => "abcdef".slice(1, 4) === "bcd",
];
STRNUM.forEach((f, i) => lines.push(`strnum${i}=${f() ? "true" : "false"}`));

process.stdout.write(lines.join("\n") + "\n");
