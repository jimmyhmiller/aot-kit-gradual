# Torque-style lowered values

Status: implemented full-model design; Stages 0 through 7 are complete and the bounded exit gate
is green as of 2026-08-28.

The exit witness includes the immutable whole-library seed, clean-process artifact restoration,
and native execution. Throwing calls capture raw physical results unconditionally at the call and
materialize logical results only on controlled normal projections. The remaining work is ECMA-262
coverage built on this model, not a second representation migration.

The migration target is the full model in this document. In particular, the compiler will not
retain tagged or parity-coded integers as the steady-state representation of JSL values, and it
will not stop at Record-only flattening. The migration may use short-lived compatibility adapters
between commits, but each adapter must have a named deletion stage and must not become a second
public lowering convention.

This document defines the compiler-wide representation model required for specification Records,
multi-value internal calls, and direct transcription of ECMA-262 algorithms into JSL. It replaces
the provisional rule that Record parameters may be flattened by selected JSL paths while Record
returns remain macro-only.

The model follows the useful part of V8 Torque's design: a logical type lowers recursively to an
ordered vector of physical types, and every CFG and ABI boundary uses that one lowering. It does
not import Torque's object model, CodeStubAssembler backend, or JavaScript implementation choices.
This compiler retains its own type lattice, ideal graph, memory SSA, closed-world specialization,
and native backend.

The governing rule is:

> A source value may occupy zero, one, or many physical graph slots. Its lowering is defined once,
> from its logical type, and is never rediscovered from a value, syntax form, or call site.

The accepted target is the full Torque-style model, not a Record-only or descriptor-only subset.
All internal JSL values—including scalars—use the same logical-value and lowered-signature
machinery. Compatibility scalar APIs are checked views at non-JSL boundaries and have a named
deletion path; they are not an alternative representation.

## Why this is required

ECMA-262 uses specification-only values that are not ECMAScript Objects: Completion Records,
Reference Records, Property Descriptors, Iterator Records, witness Records, and Lists containing
them. Treating those values as hidden ordinary Objects is observably and architecturally wrong.
It adds allocation, property lookup, identity, GC traffic, and escape possibilities that the
specification does not grant.

JSL now has typed, nested, compile-away Records. Branches and loops flatten their leaves, and an
initial internal-builtin path flattens Record parameters. That proves the representation, but it is
not the final architecture. The same idea is currently repeated in Record width calculation,
function opening, parameter reconstruction, call argument construction, branch joins, loops, and
Record-list materialization. Meanwhile the ideal graph still declares one return type per function
and a call exposes one value result. Those two models can disagree.

The native Property Descriptor witness exposed that boundary as a machine-selection ownership
failure after graph verification. This design does not assume that flattened Records caused that
specific defect; diagnosis must still identify the failing instruction. It does establish that a
local backend workaround, automatic boxing, or forced macro expansion would be the wrong remedy.

## Goals

The completed model must provide all of the following:

1. One canonical recursive lowering from every logical value type to physical slot types.
2. Compile-away Records in locals, branches, loops, parameters, returns, and internal calls.
3. Multiple physical results from one logical call, including nested Record results.
4. Exact agreement among declarations, calls, indirect-call types, CFG merges, selection, and
   machine calling conventions.
5. Explicit materialization for dynamically indexed or escaping storage, never implicit boxing.
6. Preservation of memory SSA, exceptional exits, safepoints, and GC root kinds per physical leaf.
7. Diagnostics and graph summaries that retain logical names while identifying physical slots.
8. Focused tests at each boundary, so most changes do not require a complete Test262 run.

## Non-goals

- Records do not acquire JavaScript identity, prototypes, properties, or reflection.
- This is not a general C aggregate layout or platform struct-passing ABI.
- JavaScript-callable entry points do not accept or return specification Records.
- Dynamic Lists do not compile away when their length or index is a runtime value.
- The design does not weaken machine ownership, placement, liveness, or graph verification.
- The migration does not require converting scalar code to wrapper Records.

## Logical types and physical slots

Every checked JSL expression has a logical value type. Initially the relevant forms are:

```text
Scalar(T)                 one existing lattice type
Record(schema)            ordered named fields, recursively typed
Void                      no value slots
```

Lists are storage capabilities rather than compile-away values and are discussed separately.
Future tuples or other internal aggregates must use this same model rather than creating another
flattening path.

Define the canonical operation:

```text
LowerType(Scalar(T))      = [T]
LowerType(Void)           = []
LowerType(Record(R))      = concat(LowerType(field.type) for field in R.fields)
```

Field declaration order is physical slot order. A nested field contributes a contiguous range.
Schemas are acyclic: a Record may refer only to a previously declared schema until the checker has
an explicit recursion representation. Empty Records are initially rejected rather than silently
introducing a zero-width value whose equality and control behavior have not been specified.

Each leaf has a stable logical path:

```text
PropertyDescriptor.hasValue
PropertyDescriptor.value
IteratorResult.record.done
```

`LowerType` returns both the physical type vector and these paths. Width-only and leaf-type queries
are projections of that canonical result; they must not recursively walk schemas independently.

## Compiler representation

Introduce a compiler-owned logical value descriptor equivalent to:

```text
LoweredValue {
  logical_type: LogicalType
  slots: SlotRange
}

SlotRange {
  owner: LoweredValueArena
  first: integer
  count: integer
}
```

The slots live in an owned, pinned vector of ideal-node ids. A scalar has one slot. A Record is a
view over a contiguous range and does not allocate an ideal node. Field selection computes a
subrange from the schema layout. Immutable field replacement creates a new slot vector containing
the old leaves and the replacement range.

The current negative-integer side-table handles may exist only behind a temporary migration
adapter. They are not part of the final contract. All expression, binding, branch, loop, argument,
and return APIs operate on `LoweredValue`; a graph node id is obtained only through a checked
one-slot projection. Consequently no caller can confuse an aggregate with a node by parity,
sentinel, or numeric range.

`LoweredValue` is deliberately uniform: a scalar is a one-slot value, not a separate fast-path
representation. Record fields are subrange views into the same owned slot storage. Record Lists
are typed storage capabilities and therefore carry an explicit capability kind and element logical
type; they are not disguised scalar nodes. Divergence belongs to control state, not to a magic
value payload. An unreachable expression returns an empty/absent lowering result that cannot be
projected as a scalar.

Required operations are:

```text
lowered-value-scalar(node, type)
lowered-value-slots(value)
lowered-value-field(value, field)
lowered-value-with-field(value, field, replacement)
lowered-value-from-slots(logical_type, slots)
lowered-value-join(control, left, right)
```

All operations assert that slot count and physical node types agree with `LowerType(logical_type)`.
Pin ownership applies to the complete slot range. Scope exit releases it once.

## Canonical lowered signatures

A source signature is logical:

```text
Signature {
  parameters: [LogicalType]
  result: LogicalType
  effects
  linkage
}
```

It lowers once to:

```text
LoweredSignature {
  parameter_slots: [PhysicalType]
  parameter_ranges: [SlotRange]
  result_slots: [PhysicalType]
  result_ranges: [SlotRange]
  effects
  linkage
  fingerprint
}
```

Hidden environment, receiver, actual-argument-count, and memory inputs are ABI fields with explicit
positions. They are not smuggled into source parameter counts. Memory results remain effect results,
separate from logical value results, even if the current `Return` node stores them together.

The lowered signature is constructed during declaration checking and retained by the declaration.
Function opening, parameter nodes, direct calls, indirect calls, verifier expectations, selector
descriptors, and encoders consume it. None recomputes Record widths.

The signature fingerprint includes:

- linkage and effect flags;
- every logical parameter and result type;
- schema identity and recursively ordered field identities;
- the complete lowered physical vectors;
- rest/list capabilities and hidden ABI fields.

Changing a Record schema must therefore change function identity even when its total width happens
to remain equal.

## Function entry

For each logical parameter, function entry creates one `Parm` per physical slot in its declared
range. It then publishes one compiler `LoweredValue` bound to the source parameter name.

No entry path may inspect the runtime arguments and infer a schema. The callee's retained
`LoweredSignature` is authoritative. The graph verifier checks:

- exact physical parameter count;
- exact type of every `Parm`;
- no missing or duplicate physical index;
- agreement between source parameter ranges and the flattened vector;
- linkage-specific hidden parameters in their declared positions.

Specification Records remain forbidden on JavaScript linkage. Internal builtins and macros may
accept them. A future non-JSL internal frontend can use the same lowered-signature API.

## Calls

A call is built from logical arguments and the callee's lowered signature:

1. Evaluate each source argument exactly once, left to right.
2. Check its logical type against the corresponding parameter.
3. Append its physical slots in declared range order.
4. Apply representation conversions per physical slot, such as boxing only a `dyn` leaf.
5. Append explicit effect inputs according to the ABI descriptor.
6. Construct the call with the exact physical argument vector.

Call construction must be dynamically sized. Fixed stack arrays tied to a guessed maximum physical
width are forbidden. Source arity limits and physical ABI limits are distinct checked limits with
distinct diagnostics.

Direct and indirect calls use the same lowered-signature compatibility test. A function-pointer
type includes its lowered result vector as well as its parameters. Calls through JavaScript values
continue to use JavaScript linkage and therefore cannot carry Records.

### Declaration-authoritative machine argument classes

The lowered signature also owns the machine class of every physical argument. Machine IR retains
that class vector beside the argument-vreg vector. These are intentionally different facts:

- the source vreg class selects how the caller snapshots the producer's bits;
- the declared argument class selects its ABI register sequence or overflow-stack position.

An optimizer may therefore refine a numeric producer into an FPR without moving a declared `dyn`
or integer parameter out of the GPR sequence. The encoder performs a cross-class bit move through
the caller snapshot area when the two classes differ. The verifier requires both vectors to have
the same extent and requires direct calls to agree with the target's retained lowered signature.
Neither allocation nor target-specific encoding may infer argument placement from the source vreg.

Record-leaf conversion follows the same ownership rule. A raw scalar logical leaf entering a
declared `dyn` slot is boxed exactly once. A leaf whose source logical type is already `dyn` is
already tagged and is preserved; destination type alone is not permission to emit `Box(Parm dyn)`.

## Multiple results and returns

The ideal graph must represent a call as one effectful operation with zero or more value
projections. Extend function ABI metadata from one return type to a vector:

```text
n-fun-declare-abi!(fun, parameter_types, result_types)
n-fun-abi-result-count(fun)
n-fun-abi-result-type(fun, index)
```

A call site exposes:

```text
CallSite {
  values: [node]
  end: control
  memory: optional node
  abrupt: existing exceptional protocol
}
```

Physical result `i` is a projection tied to `CallEnd`, so it cannot float before the call. A
one-result scalar call may retain a compatibility helper, but not a distinct representation rule.

An ordinary return carries the exact physical value vector followed by any explicitly designated
effect result. Every normal return of one function must have the same result width and per-slot
types. Exceptional returns retain their existing descriptor and are excluded from normal result
inference by an explicit return kind, never by examining placeholder values.

Returning a logical Record therefore performs no allocation:

```text
MaybePropertyDescriptor -> [present, hasEnumerable, enumerable, ...]
```

The caller reconstructs a compiler `LoweredValue` view over those projections. Nested Records need
no special call logic because their layout is already recursive.

Backend lowering may initially use the project's internal multi-register/stack convention rather
than a host C ABI. The selector must assign every result projection to the owning function and call
block, and parallel-copy handling must cover register and stack results without conflating them
with Phi edge copies.

## Control flow and loops

Branches and loops operate on lowered ranges, not specifically on Records.

For a branch result, `lowered-value-join` verifies identical logical types and emits one Phi per
physical slot that differs. Equal leaves may be reused. The result is a new logical view over the
joined slots.

For a loop binding, the header opens one Phi per physical slot. `recur` checks logical types, then
closes those Phis with the flattened back-edge ranges. Initializers remain left-to-right and the
loop opens only after they finish, preserving the existing control invariant. Memory remains an
additional effect Phi, not a field in the logical value.

This generalization replaces Record-specific branch and loop flattening after parity tests prove
the generated graph is identical.

## Dynamic storage and Record Lists

A runtime-length List of Records cannot be represented solely by a fixed SSA range. It crosses an
explicit materialization boundary:

```text
record-list-new Schema
record-list-store list index value
record-list-load list index
```

The carrier layout is derived from `LowerType(Record(Schema))`. Store writes every physical leaf at
the checked element index; load reconstructs a compiler logical value from the loaded leaf range.
The carrier has no JavaScript-visible identity and cannot cross JavaScript, primitive, callable, or
return boundaries unless a future named internal storage type explicitly permits it.

This remains one reviewed allocation in algorithms such as `DefineProperties`, where ECMA-262
requires normalized descriptors to survive between two dynamic loops. Ordinary local Records still
allocate nothing.

The materialization API must eventually declare:

- element layout and stride;
- GC kind for every stored leaf;
- bounds and overflow behavior;
- initialization state before a load;
- memory aliases and write barriers;
- whether the carrier may cross an internal builtin boundary.

Until those are checked, the carrier remains confined to one lowering scope.

## Effects, GC, and safepoints

Flattening does not erase effects. The signature retains existing `uses-memory`, `transitioning`,
callback, allocation, and throw facts.

Every physical slot retains its lattice type and therefore its GC classification. At a safepoint,
all live reference leaves are roots individually. A Record is never treated as one opaque root.
Liveness and relocation update the physical nodes; the compiler logical view continues to refer to
their current projections.

Memory is not a Record field. Calls that read or write heap state consume and produce the declared
memory dependency through the existing effect protocol. Abrupt completion is likewise control
flow, not a hidden variant of the normal Record result. Completion Records used as specification
data do not replace the compiler's actual exceptional edges.

## Verification

Add named failures rather than assertions or generic malformed-graph results for:

- invalid recursive logical layout;
- stale or inconsistent lowered signature;
- wrong physical parameter count or type;
- wrong call argument count or type;
- wrong normal return count or type;
- result projection outside the declared range;
- aggregate value crossing forbidden linkage;
- materialized carrier schema mismatch or escape;
- machine call descriptor disagreeing with ideal lowered signature;
- result instruction owned by the wrong function or block.

Verification occurs at four boundaries:

1. JSL checker: logical schemas, expressions, and linkage legality.
2. Ideal graph verifier: physical Parm, Call, projection, Return, and effect shapes.
3. Machine selector verifier: ownership, placement, call arguments, and results.
4. Encoder verifier: target-specific register/stack locations satisfy the selected descriptor.

Diagnostics print both views:

```text
logical: PropertyDescriptor.value
physical: result slot 3, dyn, n1234
machine: call m88 result r17, owner function 4, block 19
```

## Implementation sequence

The stages are ordered so every intermediate state is either supported and tested or refused by
name. No stage weakens the gate or converts a frontier assertion into a passing expectation.

### Stage 0: diagnose the current native ownership failure

- Complete the compact machine/ideal diagnostic already added to the native harness.
- Identify the exact failed instruction, membership count, block range, owner, and ideal node.
- Fix it only if the cause is an existing backend invariant independent of this redesign.
- If it is caused by signature disagreement, retain the witness red and address it in the stage
  that establishes the missing contract.

Exit: a written diagnosis and a minimal regression witness; no automatic boxing or forced inlining.

### Stage 1: canonical logical layouts

- Add the logical-type and physical-layout descriptor.
- Compute and cache recursive layouts after all schemas are checked.
- Replace `jsl-record-flat-width` and `jsl-record-flat-field-ty` internals with layout projections.
- Include schema layouts in library identity.
- Reject cycles, zero-width layouts, and width overflow by name.

Exit: existing Record tests produce identical graphs; schema-only identity changes are tested.

Implemented 2026-08-27. Schemas retain one cached recursive physical type vector and per-field
offset/width ranges. Empty and greater-than-256-leaf layouts fail before lowering. Library identity
hashes ordered logical schemas, nested identities, cached physical leaves, and Record-valued
parameters/results. The focused layout/identity witness and bounded gate retain these claims.

### Stage 2: explicit compiler values

- Replace parity-coded Record and Record-list handles with an explicit `LoweredValue`
  representation throughout expression lowering and bindings.
- Make scalar graph-node extraction a checked operation that accepts exactly one scalar slot.
- Represent divergence in lowering control state rather than as `NO-NODE` masquerading as a value.
- Centralize pinning, field ranges, immutable update, flattening, and reconstruction.
- Delete every temporary scalar or aggregate adapter before the stage exits; no second value model
  survives into signatures or call lowering.

Exit: no code distinguishes a node from a Record by numeric value; branch and loop tests remain
allocation-free.

Implemented 2026-08-28. Records and typed Record Lists share one `JslLoweredValue` representation
backed by one physical SSA-slot arena. A descriptor retains its explicit kind, logical schema, and
contiguous slot range. Nested field selection creates a subrange view using the cached schema
layout, flattening copies the physical range directly, and reconstruction creates a range from the
canonical leaf vector. The former Record, Record-field, and Record-list side tables and all
even/odd parity decoding are gone. A focused allocation-free test exercises scalar and nested
field views plus the typed List carrier.

Lexical `JslBind` entries now retain `JslLoweredValue` by value for their entire scope. Scalar
bindings therefore use the same one-slot descriptor shape as aggregates, and
`jl-lowered-scalar-node` is the checked one-slot projection for graph-building boundaries. Binding
pinning, unpinning, collection, and full-table cleanup walk the retained physical slot range.

The descriptor-returning `jl-expr-lowered` path now owns literals, lexical lookup, `let`
initializers/bodies, Record construction, field projection, immutable field update, typed
Record-list store/load, primitive operands, JavaScript call operands, and dynamic `if` arms.
`jl-lowered-value-join` checks logical kinds and schemas, then joins the cached canonical physical
vector directly—one Phi per leaf—rather than recursively rediscovering nested Record structure.
Scalar graph consumers use the checked one-slot projection.

The migration is complete across the lowering frontend. `jl-expr-lowered` is the sole expression
result model; lexical bindings, Records, typed Record Lists, branch joins, loops/recur, macro
arguments/results/`otherwise`, declaration parameters, and internal call arguments carry
`JslLoweredValue` directly. Scalar graph builders receive ids only through checked one-slot
projection. Loop metadata retains Record and Record-list schema identity in both the checker and
lowerer, and recur rejects either kind of schema change. The numeric descriptor arena, negative
handles, parity tests, node-or-aggregate helpers, recursive aggregate keep/collect dispatch, and
all temporary adapter functions are deleted.

The immutable seed-artifact gate is also part of the Stage 2 ownership contract. A macro argument
has a temporary owner while later arguments and the macro body are lowered. After the body result
is protected and the macro bindings are dropped, releasing that final owner must collect the
argument when it has no graph users. This catches ownership bugs that node-shape tests cannot: the
initial full cutover left 2,353 unreachable nodes even though the focused lowering suite was green.
The corrected boundary verifies and serializes all 101 retained library functions.

Focused witnesses retain allocation-free nested Record branches and loops, explicit typed
materialization, loop-carried Record-list capability identity, mismatched Record-list recur
refusal, binding ownership, and scalar projection. Stage 3 may now build canonical lowered
signatures on this single value representation.

### Stage 3: canonical lowered signatures

- Retain logical and lowered signatures on every internal function declaration.
- Make function opening and entry parameter binding consume parameter ranges.
- Make direct and indirect internal calls consume the same descriptor.
- Separate source arity from physical slot count.
- Generalize external `jsl-call-with-memory!` to reject or consume aggregate arguments through the
  descriptor rather than assuming scalar arguments.

Exit: scalar and Record-parameter calls pass graph, selector, and native execution tests.

Implemented 2026-08-28. Checked parameters retain canonical lowered offsets and widths, while
declarations retain logical source arity separately from total physical ABI arity. Function
opening, entry reconstruction, direct internal calls, and immutable-library identity consume that
single metadata. A nested-Record-plus-scalar witness proves `[0,2)` and `[2,3)` parameter ranges,
the exact three-slot Fun ABI, and zero allocation. `jsl-call-lowered-with-memory!` is the shared
logical-value boundary used by direct internal calls and the checked scalar source adapter. It
validates logical arity, schema/range identity, and physical arity before emitting a call. The same
Record-plus-scalar call passes graph verification and selector lowering, while a host-native
`Pair<int,int>` witness executes `(20 + 1) * 2 = 42` through two machine functions with no Record
materialization. The Stage 3 exit condition is therefore complete.

The canonical signature now also physically owns its effect facts: transitioning, coldness, heap
use, callback use, and exceptional capability. They participate in immutable library identity.
JSL function opening copies `canthrow` into ideal Fun ABI metadata, establishing the first retained
input to Stage 7's explicit outcome convention. Retained function-text artifacts and machine call
bundles must carry the same fact before the new outcome path may be considered implemented.

### Stage 4: ideal multi-result calls

- Change function ABI metadata to a result-type vector.
- Add normal Return value ranges and call result projections.
- Preserve explicit memory and abrupt-result channels.
- Update type inference, graph printing, serialization if applicable, and call idealization.
- Reject aggregate results on JavaScript linkage.

Exit: an internal builtin can accept and return a nested Record with zero `New` nodes, and a native
witness consumes fields from the returned value correctly.

In progress 2026-08-28. Fun ABI metadata now retains indexed result ranges rather than one return
type. Scalar declarations construct a one-element result vector. Multi-result Calls compute tuple
types, indexed `Proj` nodes consume their slots, and `n-return-values!` carries a value range plus
an optional trailing memory channel which the verifier checks against the owning Fun signature.
Internal JSL builtins may return nested Records while JavaScript-callable linkage remains forbidden:
opening publishes the cached leaf vector, Return carries those leaves, and an internal caller
reconstructs its `JslLoweredValue` from generic call projections. The focused witness has two exact
`int` results, two `Proj` nodes, zero `New` nodes, and a clean graph. Retained machine-function
records and their call relocations now use flattened `first/count/kinds` result vectors throughout
snapshotting, truncation, cache compaction, versioned artifact save/load, dependency lookup, and
final relocation compatibility. A narrow artifact witness proves `[scalar, boxed]` survives a
save/clear/load cycle without scalar collapse. Focused graph witnesses separately prove that memory
remains outside the logical result vector and that abrupt returns do not publish normal result
slots. Native transport is Stage 5 work; the ideal and retained-metadata requirements of Stage 4
are complete.

### Stage 5: backend multi-result ABI

- Derive machine call descriptors from the lowered ideal signature.
- Select every argument and result slot with exact owner/block metadata.
- Implement register and overflow stack locations for results.
- Update liveness, allocation, parallel copies, GC maps, x86-64 encoding, and Mach-O/ELF publication.
- Add target-independent selector tests before target-specific execution tests.

Exit: scalar, two-result, wide nested-Record, memory-touching, and throwing calls execute natively.

Completed 2026-08-28. The selector emits one call anchor and a complete ordered group of
`MI-CALL-RESULT` captures. AArch64 and x86-64 encode the same compiler-private register ABI for
bounded results, and both encoders accept the two-leaf Record witness. Scheduling treats the call
and its complete, slot-ordered capture vector as an indivisible raw-result interval; the independent
schedule verifier rejects a missing, reordered, detached, or interrupted capture. The allocator
also prevents the current sequential encoder moves from overwriting another still-raw result.

The host-native witness now calls a real JSL builtin returning `Pair<int, int>`, consumes its two
generic call projections, and returns `40 + 2 = 42`. The complete retained JSL library also passes
selection, scheduling, allocation, AArch64 encoding, artifact save/load, and a clean-process native
execution witness. During that validation, an incorrectly placed machine descriptor made ordinary
`MI-ABI-COPY` instructions effectful and created a scheduling cycle; exact descriptor assertions
now pin `MI-ABI-COPY` as pinned/non-effectful and `MI-CALL-RESULT` as effectful/encodable.

That initial bounded transport witness has since been joined by wide overflow, memory-channel, and
throwing native witnesses described below.

The first canonical-location slice is complete. Logical result slots are now assigned register
ordinals within their register class, so `[int, float, bool, float]` maps to `[x0, d0, x1, d1]`.
The same API classifies wide slots as `Register` or `ResultArea`, computes their logical-order byte
offsets, and aligns the total caller-owned area. A 20-leaf mixed witness proves eight registers per
class followed by four overflow slots at offsets 0, 8, 16, and 24.

Retained metadata now preserves the exact register class beside every coarse machine value kind,
for both function ABIs and relocation target ABIs. Artifact format version 5 serializes those
vectors, suffix truncation and stable compaction move them in lockstep, and dependency matching
rejects a class mismatch even when both values have the same `MLK-SCALAR` kind. The clean-process
101-function seed artifact passes with the new format. Location derivation can therefore consume
authoritative retained data rather than guessing whether a scalar belongs in a GPR or FPR.

The result parallel-copy cutover is also complete. After coloring, one target-independent resolver
converts the whole capture or return vector into typed moves among fixed registers, allocated
registers, spill slots, and a class-compatible reserved scratch location. It removes identities,
emits acyclic leaves, and breaks cycles by preserving one source in scratch. Per-instruction move
ranges are independently checked for ownership, class agreement, bounds, and location validity.
AArch64's exact size model and both target encoders consume only this resolved table.

The native `Pair<int, int>` witness now deliberately runs without result-register exclusion masks;
its unrestricted coloring forms a real raw-result cycle, the resolver emits a temporary scratch
move, and native execution still returns 42. The old result-specific allocator masks and both
target-specific slot-copy loops have been deleted. ABI argument ingress still uses its established
sequential-copy path; unifying that path is a cleanup within Stage 5, not a second result ABI.

Caller-owned overflow transport is now implemented on both targets. A caller appends one aligned
result area to its outgoing frame, passes its address in the target's reserved hidden register,
retains that frame through the resolved capture moves, and then releases it. The callee saves the
hidden pointer in a stable frame slot and parallel return moves store every overflow leaf through
it. The area is zero-initialized before the safepoint, so managed leaves are valid roots before the
callee has filled them. A ten-result witness places eight values in result registers and two boxed
values at result-area offsets 0 and 8, captures them, unboxes them, and executes to 42 on the host;
the identical machine program also encodes on x86-64.

Stackmap version 5 gives those managed leaves an explicit indirect location kind. Each record
retains its precise `MLK-RAW-MANAGED` or `MLK-BOXED` kind and a packed pair of caller-frame pointer
slot plus result-area byte offset. Both direct Mach-O publication and retained function-text
linking derive these roots from the canonical result ABI, count them per safepoint, serialize them
contiguously with ordinary live roots, and independently verify their bytes. The runtime follows
the stable pointer slot before relocating the referenced result word. Multi-result internal
functions also carry an explicit invalid JavaScript-dispatch return code; object metadata no
longer asks them for a fictional scalar return type.

Call bundles are now first-class machine records rather than an adjacency convention. Every call
owns its function/block identity, scheduled call instruction, raw-result anchor, complete capture
range, release boundary, logical result count, and result-area size. Selection constructs and
checks the table; scheduling rebuilds it after instruction repacking; a reverse instruction map
proves that every `MI-CALL` and `MI-CALL-RESULT` has exactly one owner. Scheduling chains bundle
members from the descriptor, allocation builds the complete capture parallel copy from it, and
both encoders use its capture and result-area boundaries. Opcode adjacency is no longer the ABI
authority. Seeded function layout likewise rebuilds and verifies the table after it republishes
instruction indices, so no phase can consume a bundle map describing the pre-layout program.

A native memory-channel witness now calls a two-result function which performs a real store through
a caller-supplied object address, returns `[39, 2]` plus the independent memory effect, and requires
the caller's post-call load to observe the stored `1`; the host CPU returns 42. A separate function
with two normal results and one descriptor-104 exceptional Return proves that the throwing target's
normal path executes natively while the abrupt edge remains selected and encoded. The final Stage 5
witness executes both outcomes of one runtime-linked image: on the abrupt path the callee raises a
boxed `40`, returns through descriptor 104, and the caller checks pending state before consuming
normal projections, takes and clears the thrown value, and returns `40 + 2`; re-entering the same
image on its normal path consumes the two ordinary results and also returns 42. This proves the
pending-exception protocol, external runtime relocation, exceptional control, normal-result
non-consumption, and multi-result transport together. Stage 5 is complete.

#### Canonical machine result locations

The full model lowers the logical result vector one more time, from physical value types to an
ordered machine location vector. This is target calling-convention data, constructed once per
`LoweredSignature` and retained with machine-function and call-relocation metadata:

```text
MachineResultLocation =
  Register { class, encoding }
  | ResultArea { byte_offset, size, alignment }

MachineResultABI {
  locations: [MachineResultLocation]
  result_area_size
  result_area_alignment
  result_area_pointer: Optional<HiddenABIField>
  fingerprint
}
```

Slot number is identity and order; it is not a register number. Each target assigns its available
integer and floating-point result registers by class. Once a class is exhausted, that slot receives
an aligned offset in a caller-owned result area. Mixed-class vectors therefore do not waste one
class's registers merely because the other class used an earlier logical slot. Zero-result and
one-result signatures use the same construction, with no special inference in the encoders.

If any slot uses `ResultArea`, the call has one explicit hidden ABI field naming the base of that
area. It is not a source parameter and does not affect JSL arity. The caller reserves the area in
its outgoing call frame, passes its address in the target's declared hidden location, and retains
the frame until the complete result capture finishes. The callee stores overflow results through
that pointer before returning. This avoids relying on either function's incidental frame size and
makes tail-call compatibility and artifact fingerprints exact.

#### Call/result bundles and parallel copies

A multi-result machine call is one scheduled bundle:

```text
CallBundle {
  call
  captures: [slot 0, slot 1, ...]
  release_outgoing_frame
}
```

The scheduler may move the bundle as a unit but cannot interleave an instruction between the call
and the final capture. Liveness sees every fixed register and result-area slot as a definition at
the call boundary. Safepoint metadata describes the result-area roots from the lowered physical
types, even before their captures acquire ordinary virtual-register homes.

Register ingress, call arguments, register results, and returns all feed one target-independent
parallel-copy phase. Its inputs are typed source/destination locations; it deletes identities,
emits acyclic leaves, and breaks a remaining cycle with a class-compatible reserved scratch or a
typed emergency stack slot. Target encoders receive only resolved moves. They must not contain
slot-number loops, overwrite-avoidance policy, or allocator masks that approximate parallel-copy
semantics.

The cutover order is:

1. Retain `MachineResultABI` and compare it exactly in artifacts and relocations.
2. Replace the edge-encoded capture interval with a first-class scheduled bundle and verify it.
3. Introduce the shared parallel-copy representation and resolver; route existing argument and
   scalar return moves through it first.
4. Route bounded multi-result capture/return through the resolver and delete the temporary
   forbidden-register masks and target move loops.
5. Add caller-owned result areas, hidden-pointer transport, GC-map roots, and mixed/wide witnesses.
6. Add native memory-channel and abrupt-edge witnesses, then close Stage 5.

### Stage 6: replace JSL special paths — complete

- Route Record branches, loops, macro parameters, builtin parameters, and returns through generic
  lowered-value APIs.
- Remove duplicate recursive flatten/unflatten code.
- Permit Record returns for internal builtins.
- Keep callable/JavaScript and primitive escape refusals.

Exit: the provisional Record-only ABI code is gone and the JSL documentation names one model.

Completed 2026-08-28. Inline expansion and internal calls now publish logical values directly:
`jsl-inline-lowered!` returns `JslLoweredValue`, while `JslLoweredCall` pairs one such result with
the call's separate control/effect site. Scalar APIs are checked compatibility projections.
Function entry now reconstructs every source parameter through one canonical lowered-range helper,
and function opening, call result capture, declared-result validation, and Return construction all
consume the declaration's indexed lowered-result accessors. Scalar and Record returns follow the
same validation and flattening path.

Control-flow transport now follows the same rule. `jl-lowered-slot-type` is the sole query from a
logical descriptor to a physical Phi type, and `jl-lowered-from-slots-like!` reconstructs a value
of any non-absent lowered kind from a prototype descriptor and a slot range. Branch joins have one
generic slot loop; loop headers and loop binding reconstruction use those same operations. The old
recursive Record join and separate Record/Record-List/scalar reconstruction trees are gone.
Kind-specific code remains intentionally at constructors, checked field projections, and explicit
Record-List materialization boundaries—places where semantics actually differ, rather than places
that merely transport a value.

Every declaration now owns one `JslSignature`. It retains the logical parameter/result identity and
offsets into exact physical parameter/result type vectors; declaration accessors are views over
that object rather than independent facts. Function opening consumes the physical parameter vector
directly. Entry, calls, result capture, returns, artifact identity, and a structural validator all
consume the same signature. The validator recomputes every logical-to-physical range and Record
leaf type and refuses any disagreement; a focused test deliberately corrupts the physical arity
and proves the inconsistency is detected. The remaining scalar public APIs are checked adapters for
the JavaScript frontend and graph tests. They cannot accept or project aggregates and therefore do
not constitute a second value or signature model.

### Stage 7: finish the Property Descriptor vertical slice

- Keep Property Descriptor and MaybePropertyDescriptor as typed Records.
- Compile their large algorithms as internal builtins where code-size boundaries warrant it.
- Keep `DefineProperties` on the explicit typed Record-list carrier.
- Run focused descriptor operations, accessor observations, mutation ordering, and native witnesses.
- Regenerate provenance, ECMA-262 ledger, coverage, and Test262 transition reports.

Exit: the descriptor tranche compiles and executes, with no hidden descriptor Objects and no
macro-expansion workaround.

Implementation complete; exit validation in progress 2026-08-28.
`ValidateAndApplyPropertyDescriptor` is now the first large descriptor
algorithm compiled as an internal builtin. Its 28-slot signature directly exercises flattened
PropertyDescriptor and MaybePropertyDescriptor parameters. The stale 16-slot call-verifier cap was
replaced by the selector's shared 32-slot bound and pinned by a direct wide-call structural test.
The mapped program now completes compilation and linking instead of timing out. Exception targets
carry captured-cell memory from target creation, and phi-edge verification uses the source
terminator rather than a half-open block-end index. Abrupt Returns also obey the complete canonical
multi-result ABI: slot zero is the pending marker and every other physical slot is initialized with
representation-correct poison.

The configurable data-to-accessor failure identified the required Torque-style boundary. This
runtime uses pending-state returns rather than machine unwinding, so raw ABI results are captured
before the pending-state split and logical results are materialized only on the proven-normal edge.
The exceptional edge transports control, memory, and the pending dependency without exposing a
logical result. The allocator and verifier enforce this protocol instead of relying on register
allocation coincidences or witness-specific spilling.

The focused native witness
`configurable_data_property_can_become_an_accessor_after_a_wide_throwing_descriptor_call` now
compiles the 28-slot descriptor operation, emits and links a 190,956-instruction machine program,
executes the data-to-accessor transition, and agrees with Node for `main(7) == 9`. Reaching this
scale also exposed an independent AArch64 sizing bug: polymorphic-call sizing overcounted its fixed
dispatch sequence by two words, and parallel-move sizing counted register no-ops that emission
correctly omitted. The estimator now mirrors emission exactly; the fix is shared by every call and
is not a descriptor-specific path.

#### Explicit throwing-call outcome

The permanent model is a three-layer result protocol:

```text
CallOutcome {
  call: CallEffect
  normal: NormalContinuation
  exceptional: ExceptionalContinuation
  raw_results: InternalResultSnapshot
  memory: Optional<EffectResult>
}

NormalResult(call, normal, slot) -> physical value
PendingDependency(call)         -> ordering token, never a value result
```

`InternalResultSnapshot` is backend-owned state. It captures every declared ABI result
unconditionally and immediately after the machine call, before any subsequent call may clobber a
result register or the outgoing result area may be released. It is not a source value, cannot be
placed in a JSL binding, and cannot be consumed on the exceptional continuation.

`NormalResult` is the only ideal node that exposes a result slot from a throwing call. It has both
the call and the proven-normal continuation as inputs. Selection materializes it from the raw
snapshot in the normal successor block. The exceptional successor transports only its control,
post-call memory, and `PendingDependency`; it has no edge from any `NormalResult`.

For a non-throwing declaration the call has one normal continuation and no exceptional
continuation. It still uses the same outcome shape; idealization may fold its normal continuation
to `CallEnd`, but call construction and verification do not switch representation models.

The machine bundle therefore owns two distinct ranges:

```text
MachineCallBundle {
  call
  raw_captures: [slot 0, slot 1, ...]       // unconditional, adjacent to call
  normal_materializations: [slot -> vreg]   // normal successor only
  release_outgoing_frame
  can_throw
}
```

The raw capture destinations participate in liveness as definitions before the control split.
Normal materializations are ordinary typed parallel copies from those snapshot locations. This
prevents a catch-only live value from sharing a location with a raw capture merely because it is
edge-disjoint from the logical normal result. The allocator and schedule verifier independently
check that raw captures dominate every materialization and that no materialization appears on an
exceptional edge.

The pending runtime query consumes `PendingDependency(call)`, not result slot zero. Abrupt Returns
continue to fill their declared machine ABI with representation-correct poison because the callee
must satisfy its physical return convention, but poison is never promoted into logical values in
the caller. After this cutover, using a result projection as an exception-ordering token is a
verification error.

Focused exit witnesses are deliberately smaller than Test262:

1. an ideal-graph test rejects a normal result without a normal-continuation input;
2. a selector test proves all raw captures are in the call bundle and all logical
   materializations are in the normal successor;
3. an allocator test keeps a catch-only value live across a wide throwing call and proves no raw
   capture aliases it;
4. one native two-result function executes both its normal and caught-abrupt paths;
5. the configurable data-to-accessor descriptor witness compiles and runs without an uncaught
   pending exception;
6. the bounded gate stays green and the independently expected frontier remains exactly red.

### Stage 8: migrate remaining specification Records

Migrate in dependency/unlock order, with one semantic vertical slice at a time:

1. Iterator Records and iterator results.
2. ArrayBuffer and TypedArray witness Records.
3. Completion Records where they are specification data rather than compiler exceptional control.
4. Reference Records.
5. Module, private-element, and remaining collection Records.

Each migration records mapped algorithms and newly reachable Test262 variants rather than counting
declarations as progress.

## Fast test ladder

Every stage must have a bounded witness that stops before the complete Test262 suite.

### Layout tests

- Scalar lowers to one exact type.
- Nested Record lowers in declaration order.
- Field paths map to exact contiguous ranges.
- Schema identity changes when a nested field type or order changes.
- Recursive, empty, excessive-width, and unknown layouts fail by name.

### Graph tests

- Record construction and immutable update produce zero allocations.
- Branches produce one Phi per differing leaf.
- Loops produce one Phi per carried leaf.
- Internal Record parameters produce exact Parm indices and types.
- Internal Record returns produce exact result projections and no `New`.
- Memory is carried separately from value results.
- JavaScript-linkage aggregate parameters and results are rejected.

### Selector tests

- A two-leaf call has exactly one instruction membership per argument and result.
- A wide call crosses the register/stack boundary correctly.
- Nested results retain exact owner and block.
- A memory-touching multi-result call preserves memory anti-dependencies.
- A throwing multi-result call never exposes normal projections on the abrupt edge.

### Native micro-witnesses

Use tiny programs that do not load the complete JavaScript library where possible:

1. Pass `{x: 20, y: 22}` as an internal Record and return `x + y`.
2. Return `{quotient: 6, remainder: 1}` and compute `quotient * 10 + remainder` as `61`.
3. Pass and return a nested three-leaf Record across a non-inlined builtin.
4. Return a Record from a heap-writing builtin and observe both a field and the write.
5. Force enough leaves to use stack arguments/results and compare with a scalar checksum.

### Semantic slice tests

For Property Descriptors, run only the focused declaration checker/lowerer and named native tests:

- data and accessor descriptor classification;
- absent versus present-`undefined` fields;
- completion defaults;
- getter/setter validation;
- non-configurable transition rejection;
- accessor invocation and receiver;
- `DefineProperties` normalization-before-mutation ordering.

Then run the mandatory repository checks:

```sh
coil test
coil test --suite frontier
```

The frontier remains red for its exact open bugs. The exhaustive `coil test --suite full` is for
shared-invariant milestones and release evidence, including completion of Stages 4, 5, and 7.

## Progress evidence

This work is not measured by added syntax or converted declaration count. A stage advances only
when its exit witness is retained. Report:

- logical layouts supported;
- ABI boundaries supporting aggregate values;
- focused graph and native witnesses passing;
- spec algorithms newly unblocked by transitive dependency closure;
- mapped Test262 variants newly reachable, newly passing, and regressed;
- remaining named refusals and their unlock scores;
- allocation count at every compile-away/materialization boundary.

The decisive milestone is not “PropertyDescriptor is written as a Record.” It is:

> A non-inlined internal operation accepts and returns a typed Property Descriptor, the compiler
> emits no descriptor allocation, native code observes the correct semantics, and every layer
> verifies the same lowered signature.

## Removal criteria

The migration is complete only when:

- no parity-coded aggregate handle remains;
- no JSL-specific function-opening or call-flattening loop remains;
- function ABI metadata has parameter and result vectors;
- all internal call forms share lowered-signature validation;
- Record-valued internal builtin returns work through native execution;
- JavaScript boundaries still reject specification Records;
- dynamic Record Lists remain explicit and schema checked;
- the Property Descriptor vertical slice and mandatory gates have the required outcomes;
- `docs/JSL.md` describes the implemented model without provisional exceptions.
