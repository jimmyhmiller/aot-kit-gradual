// substring, substr, toLowerCase and toUpperCase, computed by lib/string/.
//
// CONTENT IS OBSERVED, NOT JUST LENGTH. The distinguishing behaviours here all preserve length:
// substring SWAPS out-of-order arguments, so substring(4,1) and substring(1,4) are both three
// characters and differ only in nothing at all — while a wrong implementation that returned
// slice(4,1) would give the empty string. Reading charCodeAt(0) of each result is what separates
// them; an earlier version of this coverage used .length and passed against a broken substr.
export function main(): number {
  let t = 'abcdefgh';
  let m = 'MiXeD';
  return (t.substring(1, 4).length + t.substring(4, 1).length
    + t.substring(1, 4).charCodeAt(0) + t.substring(4, 1).charCodeAt(0)
    + t.substring(-3, 2).length + t.substring(-3, 2).charCodeAt(0)
    + t.substring(2, 99).length + t.substring(99, 2).charCodeAt(0)
    + t.substr(2, 3).length + t.substr(2, 3).charCodeAt(0)
    + t.substr(-3, 2).length + t.substr(-3, 2).charCodeAt(0)
    + t.substr(2, 0).length + t.substr(2, 99).length
    + t.substr(2, -1).length + t.substr(0, -5).length + t.substr(-2, -1).length
    + t.substr(0, 1).charCodeAt(0)
    + t.substr(5).length + t.substr(5).charCodeAt(0)
    + t.substr(6, undefined).length + t.substr(6, undefined).charCodeAt(0)
    + t.substr(5, null).length
    + m.toLowerCase().charCodeAt(0) + m.toLowerCase().charCodeAt(1)
    + m.toUpperCase().charCodeAt(1) + m.toUpperCase().charCodeAt(3)
    + m.toLowerCase().length + m.toUpperCase().length) | 0;
}
