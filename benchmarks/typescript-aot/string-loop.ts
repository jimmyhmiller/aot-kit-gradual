// The string operations lib/string/ computes, in a loop that does NOT allocate.
//
// indexOf and charCodeAt answer with numbers; slice and charAt would allocate a fresh string every
// iteration and turn this into a measurement of the allocator and the collector instead of the
// operations under test. The scan work is real either way: indexOf walks the haystack.
export function main(n: number): number {
  let text = 'the quick brown fox jumps over the lazy dog';
  let i = 0;
  let acc = 0;
  while (i < n) {
    acc = acc + text.indexOf('fox') + text.indexOf('zebra') + text.charCodeAt(i & 31);
    i = i + 1;
  }
  return acc | 0;
}
