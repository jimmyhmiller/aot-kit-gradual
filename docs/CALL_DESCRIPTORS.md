# JavaScript call descriptors in JSL

## Why this exists

JSL can invoke statically known callbacks, but it cannot yet express the complete JavaScript
`Call` abstract operation. The remaining counterexample is small:

```ts
function invoke(callback: any, value: number): any {
  return callback?.(value);
}
```

A boxed function contains `JSV-FUNCTION` plus a function **identity** in its payload. The payload
is not an executable address. Closed-world calls know the target symbol. Finite polymorphic calls
compare the payload identity with a target set and branch to the matching symbol. Unboxing an
arbitrary function and issuing an indirect machine call instead jumps to the identity as though it
were an address.

The return side has the dual problem. Internal functions use optimized raw return representations
(`flt`, integer, object pointer, and so on). A call through `any` cannot know which representation
arrives, and selection cannot box the result without knowing the callee convention.

Torque avoids this ambiguity with call descriptors and generated adapters. JSL needs the same
separation: JavaScript calls have one tagged boundary ABI; optimized internal functions retain
specialized ABIs behind generated adapter thunks.

## DSL surface

The intended control/effect form is:

```clojure
(call-js target
  :receiver receiver
  :arguments [a b c]
  :otherwise NotCallable
  :exception Exception)
```

Like a Torque call naming labels, it can transfer to `NotCallable` without entering a callee and
to `Exception` with a tagged thrown value. Its successful result is always `dyn`.

The first implementation may expose its descriptor explicitly:

```clojure
(call-js target
  :descriptor JSCall
  :receiver receiver
  :arguments [a b]
  :otherwise NotCallable
  :exception Exception)

(call-descriptor JSCall
  :target dyn
  :receiver dyn
  :arguments dyn
  :return dyn
  :effects transition
  :throws true)
```

The form is variadic at the JSL level. Lowering may select fixed-arity adapters, but source syntax
must not be baked into the semantic operation.

## Lowering contract

1. Evaluate target, receiver, and arguments from left to right exactly once.
2. Test callability in JSL. Optional-call nullish suppression happens before `call-js`; a
   non-nullish non-callable reaches `NotCallable` and becomes a JavaScript `TypeError`.
3. Resolve a boxed function payload as an identity, never an address.
4. Dispatch to an adapter associated with `(target identity, descriptor)`.
5. The adapter unboxes receiver and arguments for the target's internal ABI, invokes it, and boxes
   its return into `dyn`.
6. Forward the active memory token and convert abrupt completion to the exception edge.
7. Expose one tagged result representation regardless of target.

Finite target sets lower to the existing identity dispatch. An open set uses a runtime table from
function identity to adapter address. The runtime table—not the boxed payload—contains executable
addresses, preserving separate compilation and keeping JavaScript values independent of linkage.

## Adapter generation

Generate adapters lazily for functions that escape into JavaScript-call position:

```text
tagged adapter(tagged receiver, tagged arg0, ..., memory) -> tagged result, memory
    unbox arguments according to the internal signature
    call the internal target
    box the internal result
    return the tagged result
```

Direct closed-world internal calls need no adapter. Adapters are cached by function and descriptor
identity. Closures use the same descriptor while also supplying their environment. Arity mismatch
is handled in the adapter: omitted formals receive tagged `undefined`; extra actuals remain
available for the future `arguments` object; rest parameters receive their DSL-specified array.

## IR and effects

JSL lowering needs `%CallJS`, with explicit control, memory, target, receiver, arguments, tagged
result, not-callable edge, and exception edge. It must not reuse raw `OP-CALL` directly. A practical
split is:

- `OP-JSCALL`: tagged JavaScript boundary call with descriptor identity;
- generated adapters containing ordinary `OP-CALL` to internal targets;
- `OP-JSTHROW`/exception projections for abrupt completion.

Target inference may replace open dispatch with a finite set, but correctness cannot depend on
inference succeeding.

A JavaScript call is transitioning unless its descriptor proves otherwise, paralleling Torque's
`transitioning` builtins:

- all active aliases enter the call;
- success and exception continuations receive the resulting heap;
- argument effects occur before the callability failure edge;
- an optional call performs its nullish branch before argument construction;
- a skipped optional call contributes boxed `undefined` and the pre-call heap.

## Required acceptance evidence

Implementation is incomplete until native conformance agrees with Node for:

- unknown present and nullish optional callables;
- direct functions and closures with mutable captures;
- method calls preserving `this`;
- omitted, extra, default, and rest arguments;
- integer, float, boolean, string, object, array, `null`, and `undefined` returns;
- mixed target sets with different internal return representations;
- argument side effects and nullish suppression;
- non-callable `TypeError`, thrown callbacks, and heap writes on both continuations.

Falsification must replace one adapter return tag and one dispatch identity. Each defect must turn a
native-source case red. The existing optional-call case remains the oracle for the pre-call branch.

