// charAt, charCodeAt and slice, computed by lib/string/ rather than by hand-written IR nodes.
// Every case is IN RANGE where the library does real work: an out-of-range charAt returns the empty
// string from a guard before it ever indexes, so a program that only tested `charAt(99)` would pass
// against a library whose indexing was wrong.
export function main(): number {
  let text = 'co' + 'il';
  let hay = 'hello world';
  return (text.charAt(0).charCodeAt(0) + text.charAt(1).charCodeAt(0)
    + text.charAt(3).charCodeAt(0) + text.charAt(9).length + text.charAt(-1).length
    + text.charAt(0).length + text.charAt(1).length + text.charAt(3).length
    + hay.charAt(4).length + hay.charAt(10).length
    + text.charCodeAt(0) + text.charCodeAt(3) + hay.charCodeAt(6)
    + text.slice(1, 3).length + text.slice(-3, -1).length + text.slice(0).length
    + text.slice(2).length + text.slice(3, 1).length + hay.slice(6).length
    + text.slice(1, 3).charCodeAt(0) + hay.slice(-5).charCodeAt(0)) | 0;
}
