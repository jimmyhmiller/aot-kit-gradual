// Passing an object to a function and reading a field of it.
//
// Both halves of this were broken and neither had a test. A `Parm` is a tagged JavaScript value, so
// a callee reading `t.value` through the declared shape emits `Unbox : obj@N` on it — and
// `fng-call-argument` boxed only `FNG-DYNAMIC` and `FNG-NUMBER` actuals, so a freshly allocated
// object arrived as the RAW pointer the allocation produced and `MI-JSUNBOX` trapped on a word
// nothing had tagged. `SIGTRAP` on three lines of ordinary TypeScript.
//
// The second half was quieter and worse. An object literal is built from what is EXPECTED of it:
// with a shape it gets real field slots, with `FNG-DYNAMIC` it gets `SHAPE-ROOT` and a dynamic
// property table. `let o: T = {value: 41}` supplied the shape and an argument position did not, so
// `get({value: 41})` handed a dynamic object to a callee reading `Load#0` off the declared shape
// and answered 0. No trap, no diagnostic, just the wrong number.
//
// `integrated-heap-program.ts` passes objects to functions all day and never caught either, because
// every object it passes is already tagged — an array element or a property — which
// `fng-tagged-dynamic-value?` recognises and leaves alone. A literal written at the call site is
// the case nothing covered, and it is the most ordinary way to write it.
type Point = { x: number; y: number };
type Wrapper = { inner: Point; scale: number };

function readX(p: Point): number { return p.x; }
function sum(p: Point): number { return p.x + p.y; }
function nested(w: Wrapper): number { return w.inner.x * w.scale; }
function make(x: number, y: number): Point { return {x: x, y: y}; }

export function main(): number {
  let total = 0;

  // The literal written AT the call site — the shape both defects hid behind.
  total = total + readX({x: 4, y: 9});
  total = total + sum({x: 4, y: 9}) * 10;

  // Through a typed local, which is the path that already worked.
  let p: Point = {x: 2, y: 3};
  total = total + readX(p) * 1000;
  total = total + sum(p) * 10000;

  // Through a function's return value, so the object is neither a literal at the call site nor a
  // local's initialiser.
  total = total + sum(make(1, 6)) * 1000000;

  // A literal holding another literal, so the nested one is contextually typed too.
  total = total + nested({inner: {x: 3, y: 0}, scale: 5}) * 100000000;

  return total | 0;
}
