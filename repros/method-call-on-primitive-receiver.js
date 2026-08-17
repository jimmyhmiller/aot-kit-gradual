// FIXED. Both halves were missing METHODS, not a representation rule: the receiver reached the
// generic call path (VERR-CALL-RECEIVER-TAG) only because nothing recognised `toFixed` on a
// number or `replace` on a string. `String.prototype.replace` is `StringReplaceFirst` in
// lib/string/replace-all.jsl, and `Number.prototype.toFixed` is `NumberToFixed` over the
// `%ToFixed` primitive -- exact fixed-point formatting, ties away from zero, mirrored in
// ev-to-fixed (src/eval.coil) and aot_js_to_fixed_format (native/gc/runtime.c).
//
// node says 11 for main(7).
function main(n) {
  let acc = n | 0;
  { let s = (acc / 4).toFixed(2); acc = (acc + s.length) | 0; }
  return acc | 0;
}
