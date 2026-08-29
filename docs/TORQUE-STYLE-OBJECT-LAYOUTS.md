# Torque-style object layouts for JSL

## Purpose

`MakeBasicObject` cannot be implemented faithfully as an alias for `%NewObject`. ECMA-262 gives it
a specification List of internal-slot names, requires `[[PrivateElements]]` on every allocated
Object, initializes each declared slot, installs the ordinary essential internal methods, and
initializes `[[Extensible]]` when that slot is present. Later exotic constructors override selected
methods without changing the meaning of the common allocation operation.

The current runtime has three ad hoc payload fields (`internal_target`, `internal_index`, and
`internal_kind`). They are sufficient for the few represented wrapper and iterator families, but
they cannot represent the specification's declared slot sets, generic slot access, or traced values
for new object families. Encoding each new family in another integer branch would reproduce the
problem this project is removing from JavaScript semantics.

The target is the useful object-model half of Torque: declarative, statically checked layouts and
generated allocation/access operations. JavaScript policy remains in JSL. The runtime owns only
storage, identity, tracing, and internal-method dispatch capabilities.

## Governing invariants

1. Every represented Object family has exactly one declarative layout identity.
2. A layout names specification internal slots, their storage kinds, and the initial internal-method
   family. Integer encodings are generated implementation details and never appear in handwritten
   JSL algorithms.
3. Specification Lists passed to allocation operations are compile-time values. Constructing a
   layout does not allocate an ECMAScript Array or a hidden JavaScript Object.
4. Every Object created through `MakeBasicObject` has `[[PrivateElements]]`, initialized to an empty
   specification List.
5. Slot presence is independent of slot value: a present slot whose value is `undefined` is not an
   absent slot.
6. Boxed and raw managed slot values participate in write barriers, relocation, heap verification,
   archive layout accounting, and stress-GC tests.
7. Ordinary and exotic internal methods are selected through one generated protocol. The frontend
   never chooses JavaScript-visible method semantics.
8. Allocation and slot storage are representation primitives. The algorithm deciding which slots
   and methods an object receives remains canonical JSL.

## Declarative model

The durable manifest contains records equivalent to:

```text
slot PrivateElements  : SpecList<PrivateElement> traced
slot Prototype        : JSValue traced
slot Extensible       : Boolean unboxed
slot ParameterMap     : JSValue traced
slot StringData       : JSValue traced
slot ProxyHandler     : JSValue traced
slot ProxyTarget      : JSValue traced

layout OrdinaryObject {
  slots: [Prototype, Extensible, PrivateElements]
  methods: OrdinaryObjectMethods
}
```

Layout declarations may share generated slot definitions, but they do not inherit mutable runtime
state. The generator assigns stable fingerprints from ordered slot names, storage kinds, and method
family. Image-local numeric IDs are link products, exactly like cached GC allocation layouts.

The pinned specification currently calls `MakeBasicObject` with four concrete slot sets:

| Caller shape | Explicit slots before the mandatory private slot |
|---|---|
| ordinary/array/bound base | `[[Prototype]], [[Extensible]]` |
| mapped arguments | `[[Prototype]], [[Extensible]], [[ParameterMap]]` |
| String exotic | `[[Prototype]], [[Extensible]], [[StringData]]` |
| Proxy exotic base | `[[ProxyHandler]], [[ProxyTarget]]` |

This inventory is a validation fixture, not the schema. New pinned-spec call shapes must be added to
the manifest and generated output; they must not become handwritten numeric cases.

## JSL surface

JSL needs a compile-away internal-slot List value. It is distinct from dynamic Record Lists: its
members are declarations known while checking the library, it cannot contain ECMAScript values,
and it lowers to no graph slots. The intended surface is equivalent to:

```clojure
(slot-list BasicObjectSlots [Prototype Extensible])

(macro MakeBasicObject
  :spec "...#sec-makebasicobject"
  :spec-name "MakeBasicObject"
  :status complete
  :params [(internalSlotsList (slot-list))]
  :ret dyn
  ...)
```

Macro calls substitute the checked slot-list descriptor. Called builtins may not accept a
compile-away slot list across the machine ABI. Branch and loop joins require identical descriptors;
dynamic layout choice must use control flow around separate allocations.

Generated accessors expose `HasInternalSlot`, internal-slot load, and internal-slot store by name.
Handwritten code never passes slot ordinals. The checker rejects undeclared slots, duplicate slots,
an invalid storage value, a layout missing mandatory `PrivateElements`, and method families
incompatible with the layout.

## Runtime representation

Each object side-table record refers to an immutable generated layout descriptor and owns storage
for that descriptor's value-bearing slots. The descriptor supplies its stable fingerprint,
image-local ID, ordered slots and storage kinds, traced/raw/boxed bitmaps, initial values, and
internal-method family identity.

The GC treats the object owner as weak and its slot edges as strong only after the owner survives,
matching prototype and property side-table ownership. Collection relocates every traced slot,
applies remembered-set rules to old-to-young stores, frees dead variable storage, and verifies every
declared value against its storage kind.

The current `internal_target/index/kind` tuple is migrated into generated layouts for primitive
wrappers, ArrayBuffer, TypedArray, and Array Iterator. It is not retained as a parallel public slot
model. Compatibility reads may exist only during a named migration stage and must be deleted after
all represented families use generated slots.

## `MakeBasicObject` lowering

Once the substrate exists, the canonical JSL operation performs the specification steps directly:

1. extend the checked input descriptor with `PrivateElements`;
2. allocate the object using the generated layout;
3. initialize every declared slot to its specified undefined representation;
4. initialize `PrivateElements` to a new empty specification List;
5. install `OrdinaryObjectMethods`;
6. if `Extensible` is present, store `true`;
7. return the object.

Assertions about callers overriding prototype/extensibility methods are checked against the layout
and the consuming constructor's declared overrides. They are compile-time verifier obligations, not
runtime JavaScript branches.

## Implementation stages and required witnesses

1. **Manifest and checker.** Add slot/layout/method-family schemas, deterministic generation,
   duplicate/unknown/missing-private-slot failures, and pinned-spec call-shape inventory checks.
2. **Compile-away slot lists — implemented.** JSL now has named `(slot-list ...)` declarations and
   macro-only `(slot-list)` parameters. Descriptors survive lexical bindings, nested macro
   substitution, branches, and loops; joins and recurrence require the same identity. Lowering
   carries them as zero-width logical values, so they create no `Parm`, `Phi`, allocation, or call
   argument. Primitive, builtin, callable, and return ABI escapes have named refusals. The object
   layout generator emits the four pinned MakeBasicObject input descriptors directly into
   `lib/generated/object-layouts.jsl`, and both the JSON and JSL artifacts are drift-checked.
3. **Runtime layout storage — implemented.** The manifest generator emits stable layout, slot,
   storage-kind, and internal-method-family identities into `native/gc/generated-object-layouts.h`.
   JSL's named `object-layout-init`, `internal-slot-has`, `internal-slot-load`, and
   `internal-slot-store` forms lower to the generic runtime ABI. Layout storage participates in
   write barriers, fixed-point relocation, remembered-set retention, dead-owner reclamation, and
   heap verification. A focused lowering witness checks the exact ABI operations; an ordinary
   Object source witness executes named `[[Prototype]]` and `[[Extensible]]` reads and writes; and a
   forced 4 KiB collection proves a target reachable only through a generated slot remains live and
   relocated. The capability remains partial until stages 4 and 5 consume the generated method
   family and make `MakeBasicObject` canonical.
4. **Internal-method protocol — in progress.** Method families are first-class generated JSL
   declarations whose stable IDs are part of immutable library identity and the runtime descriptor
   ABI. Named `object-method-family-is` and `object-method-family-set` forms provide checked query
   and transition operations without exposing numeric IDs to handwritten JSL. Runtime objects start
   with their layout's ordinary family and can transition to generated Array, mapped-arguments,
   String, or Proxy families; heap verification checks the installed identity. Prototype and
   extensibility and property entry points now consult the family seam. All eleven essential
   dispatch entry points are active; remaining protocol work is the still-unimplemented exotic
   bodies recorded by the generated matrix, especially Proxy and mapped arguments.

   Array and String wrapper construction now adopt the generated model: both allocate a checked
   layout, initialize named `[[Extensible]]`/`[[Prototype]]` slots, and install their generated
   family; String additionally stores `[[StringData]]` by name. Existing runtime tags and
   `internal_target` remain temporary mirrors for consumers not yet migrated. Dispatch is
   per-method rather than all-or-nothing: Array and String retain ordinary prototype and
   extensibility methods while overriding only their exotic operations, as ECMA-262 specifies.

   The manifest contains the complete eleven-essential-method override matrix and separately names
   `activeDispatchMethods`. Only rows with real JSL callers are emitted as executable
   `UsesOrdinary*` predicates, preserving the no-dead-DSL invariant. All eleven rows are active:
   `GetPrototypeOf`, `SetPrototypeOf`, `IsExtensible`, `PreventExtensions`, `GetOwnProperty`,
   `DefineOwnProperty`, `HasProperty`, `Get`, `Set`, `Delete`, and `OwnPropertyKeys`. No matrix row
   remains metadata-only.

   `OwnPropertyKeys` is now one canonical JSL snapshot boundary. The raw ordinal primitives occur
   only inside `OrdinaryOwnPropertyKeys`; object enumeration, copying, descriptor collection, JSON,
   and Symbol registry consumers operate on its stable result. The runtime substrate exposes Array
   and String virtual-key ordering, including `length`, while JSL selects ordinary versus String
   exotic semantics and explicitly refuses Proxy until its trap algorithm exists.

   Construction-time prototype linking is now explicitly `InitializeObjectPrototype`; it bypasses
   observable mutation policy. The canonical `SetPrototypeOfInternal` dispatches to the complete
   `OrdinarySetPrototypeOf` algorithm, including same-value success, extensibility rejection, cycle
   detection, slot/runtime mirror update, and Boolean result. `Object.setPrototypeOf` is a real JSL
   builtin and retains explicit Proxy/immutable-prototype deviations.

   Essential method names occupy their own JSL namespace, matching the specification distinction
   between `[[IsExtensible]]` and the `IsExtensible` abstract operation. The runtime representation
   is one generated override bitset per family. `object-method-is-ordinary` resolves a checked named
   method to one constant-time bit test; it does not expand a family chain into every call site.
   Unmigrated objects answer ordinary during compatibility migration, while generated layouts must
   have a valid family. Activating `Get` initially expanded the focused witness from 96,311 to
   110,775 frontend nodes; the bitset/single-query model reduced it to 97,056.
5. **Canonical operation.** Implement and claim `MakeBasicObject`, migrate `%NewObject` consumers,
   and add focused ordinary, mapped-arguments, String, and Proxy-layout witnesses.
6. **Downstream tranche.** Implement `ArrayCreate`, regenerate the dependency graph, and run its
   mapped Test262 cohort.
7. **Delete compatibility storage.** Migrate every `internal_kind/target/index` family and remove the
   tuple, its numeric brands, and duplicate slot-presence tables.

Every stage runs its smallest focused tests, `coil test`, and the honest frontier suite. Completion
of `MakeBasicObject` requires all stages through 5; a working ordinary-object subset remains partial.
