# JavaScript value ABI

B03 defines one 64-bit word representation shared by Coil ideal semantics, generated AArch64,
function calls, object fields, stack maps, and the moving collector. The authoritative constants and
predicates are `src/jsvalue.coil`; `tools/js-value.h` is the byte-for-byte C runtime counterpart.

## Encoding

The low 48 bits are a payload and the high 16 bits select a tagged value. IEEE-754 doubles retain
their bits directly, except that every NaN is canonicalized to `0x7ff8000000000000`.

| Value | High tag | Payload |
| --- | ---: | --- |
| canonical NaN | `0x7ff8` | zero |
| undefined | `0x7ff9` | zero |
| null | `0x7ffa` | zero |
| boolean | `0x7ffb` | zero or one |
| signed integer fast path | `0x7ffc` | signed 48-bit integer |
| object | `0x7ffd` | aligned managed address |
| string | `0x7ffe` | non-moving string identity |
| symbol/bigint reference | `0x7fff` | subtype and non-moving identity |
| array | `0xfff8` | aligned managed address |
| function | `0xfff9` | non-moving function identity |
| closure | `0xfffa` | aligned managed address |
| future RegExp | `0xfffb` | aligned managed address |

Tags `0xfffc` through `0xffff` are reserved and invalid. Managed payloads must be nonzero and
eight-byte aligned. Undefined, null, and canonical NaN reject nonzero payloads; booleans reject
payloads above one. Signed zero is preserved for doubles and `+0 === -0`; canonical NaN is falsey
and is never strictly equal, including to itself.

## Native ABI and storage

A dynamically typed argument, return, Phi input, spill slot, or dynamic object field carries this
word unchanged. `Box` constructs the tag and payload, `Unbox` checks the required tag before
extracting the payload, and `TypeTest` performs a representation test. A wrong native unbox traps
deterministically rather than exposing a payload with the wrong static type.

Stack-map kind `2` means a boxed word. The collector validates it and relocates only object, array,
closure, and RegExp payloads while preserving the tag. Raw managed pointers remain stack-map kind
`1`; non-moving string/function/reference words are kind `3`. Layout records contain disjoint raw
reference and boxed-field bitmaps. Dynamic stores dirty old receivers conservatively, after which
the collector still performs exact tag classification while scanning.
