// The string OPERATORS: ===, !==, the four relational comparisons, and +.
//
// The operands are built by concatenation rather than written as literals, so the values are
// runtime strings and the comparisons are real work rather than something folded at compile time.
// === on strings is CONTENT equality, so two separately built strings with the same code units are
// equal — an identity comparison would answer false for every row here.
export function main(): number {
  let a = 'a' + 'bc';
  let b = 'ab' + 'c';
  let c = 'a' + 'bd';
  return ((a === b ? 1 : 0) + (a === c ? 2 : 0) + (a !== c ? 4 : 0) + (a !== b ? 8 : 0)
    + (a < c ? 16 : 0) + (c < a ? 32 : 0)
    + (a <= b ? 64 : 0) + (c <= a ? 128 : 0)
    + (c > a ? 256 : 0) + (a > c ? 512 : 0)
    + (a >= b ? 1024 : 0) + (a >= c ? 2048 : 0)
    + (a + c).length + ((a + c) === 'abcabd' ? 4096 : 0)
    + ('' + a).length + (a + '').length) | 0;
}
