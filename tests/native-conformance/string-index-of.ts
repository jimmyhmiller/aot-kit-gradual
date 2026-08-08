// String.prototype.indexOf, computed by the JSL runtime library (lib/string/index-of.jsl) rather
// than by a hand-written IR node. Every case here goes through StringIndexOfFrom.
export function main(): number {
  let text = 'co' + 'il';
  let hay = 'hello world';
  return (text.indexOf('il') + text.indexOf('z') + text.indexOf('i', 2) + text.indexOf('c', 0)
    + text.indexOf('') + text.indexOf('l', 99) + text.indexOf('o', -5)
    + hay.indexOf('o') + hay.indexOf('o', 5) + hay.indexOf('world') + hay.indexOf('World')
    + hay.indexOf('hello') + hay.indexOf('d', 10) + hay.indexOf(' ')) | 0;
}
