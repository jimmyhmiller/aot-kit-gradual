// The program whose answer used to change between runs of the same binary.
//
// This is the defect HANDOFF.md called "the one thing to chase first", reduced from a differential
// sweep: a single sum mixing boxed array elements with unboxed lengths, answering 45681302,
// 54348438, 50039446 … on consecutive runs of one unmodified executable, where Node answers 389.
//
// It is one instance of the depth defect `deep-arithmetic.ts` covers head-on — the sum is eleven
// terms deep and the first is a boxed element — and it is kept SEPARATE because the symptom is
// what makes it worth a file. A wrong constant is a bug; an answer that is not a function of the
// program is a different kind of report, and this is the shape that produces one. The instability
// is the tell: the arithmetic read a general-purpose register that no instruction wrote, so the
// answer was whatever the run happened to leave there.
//
// The mutating calls are ORDERED WITH the reads, not separated from them, because that is what put
// several values in flight at once. Rewriting this to accumulate into a local — which is how
// `array-mutation.ts` was first written, to get around exactly this — makes it pass while broken.
export function main(): number {
  let a0: number[] = [66, 90];
  let a1: number[] = [];
  let a2: number[] = [69, 90];
  a1.push(-2, 15);
  return (a0.shift() + a0.shift() * 3 + a1[0] * 19 + a2.slice(-3).length * 41
    + a1.length + a2.push(-1) + a2.slice(2).length + a2.slice(3).length * 7
    + a0.length + a2.slice(-1).length * 3) | 0;
}
