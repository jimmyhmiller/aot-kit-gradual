// String.prototype.split, out of lib/string/split.jsl — the last hand-written IR node in the
// frontend that had JavaScript semantics in it. This file is the SHAPE: how many pieces each form
// produces. string-split-contents.ts is the pieces themselves.
//
// THE ROWS ARE THE BOUNDARY CASES, because the interior of split is easy and its edges are not.
// `"a,".split(",")` is two elements and `"".split(",")` is one, both because the text after the
// last separator is emitted even when it is empty; `"".split("")` is ZERO elements, because the
// empty separator stops at the end instead of running once more. A definition that gets the common
// case right and treats those three alike is wrong on all of them, and the difference is one
// integer in the loop bound — replacing `slen - unit` with `slen` changes this file's answer.
//
// `split()` with no argument is `["abc"]` and `split("")` is `["a","b","c"]`. No separator value
// distinguishes them, so they are two definitions chosen by argument count; the file explains why
// passing the count in as an argument does not compile.
//
// Every count is 0..3 and the weights are powers of four, so the total is a base-4 numeral with one
// digit per row: no row can cancel another and the sum stays far inside int32.
export function main(): number {
  let total = 0;

  total = total + "a,b,c".split(",").length;
  total = total + "abc".split("").length * 4;
  total = total + "abc".split("x").length * 16;
  total = total + "a,".split(",").length * 64;
  total = total + ",a".split(",").length * 256;
  total = total + "a,,b".split(",").length * 1024;
  total = total + "abc".split().length * 4096;
  total = total + "".split(",").length * 16384;
  total = total + "".split("").length * 65536;
  total = total + "a::b::c".split("::").length * 262144;
  total = total + "aXbXc".split("XY").length * 1048576;

  return total | 0;
}
