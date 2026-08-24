// OPEN. A function whose returned expression is a numeric CONDITIONAL cannot be called by a
// caller that uses the result as a number. Instruction selection refuses the whole program with
// MSEL-UNSUPPORTED. Nothing to do with the object model; found on 2026-08-20 while probing what
// test262's harness needs, and it is the reason `assert.js` does not compile.
//
// THE SHAPE IS EXACT, and five neighbours place it:
//   function f(x) { return 1; }              + `f(n) * 10`  -- COMPILES (Return : [ctrl,int=1])
//   function f(x) { if (x) return 1; return 0; } + same     -- COMPILES (two Returns, each int)
//   function f(x) { return x; }              + same         -- COMPILES (Return : [ctrl,dyn])
//   function f(x) { return x ? "a" : "b"; }  + `.length`    -- COMPILES (Return : [ctrl,str])
//   function f(x) { return x ? 1 : 0; }      + `f(n) * 10`  -- REFUSED  (Return : [ctrl,num])
//
// So it is the UNION `num` -- `int|flt` out of a Phi -- as a function's return type. One class in
// the lattice, but two machine words, and `be-js-tag-for-type` has no single answer for it. The
// caller's graph is identical to the compiling cases in every other respect: the same
// `Box.0 <- Call`, the same `TypeTest num`, the same guard diamond. Only the callee's Return type
// differs.
//
// Where to start: `be-function-return-kind-fuel` and `be-call-return-kind-fuel` in
// src/backend_select.coil decide a call's result representation from the callee's returns. When
// they cannot agree they answer -1, and `be-js-tag-for-value` then asks `be-call-return-tag`,
// which has no tag to give for `int|flt`. An INDIRECT call already takes the other road -- it
// answers MLK-BOXED on the grounds that "the backend normalizes each selected result to a tagged
// JavaScript value after the call" -- and the question is whether that is true of this case too,
// or whether the callee must be made to return one representation.
//
// The same sentence as four other bugs in this repo: A TYPE IS NOT A REPRESENTATION.
//
// node says 17 for main(7).
function f(x) { return x ? 1 : 0; }
function main(n) { return (n + f(n) * 10) | 0; }
