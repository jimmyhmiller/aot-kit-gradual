# Test262 runner architecture

## Contract

The runner follows `test262/INTERPRETING.md`. A non-module test variant is not one generated
JavaScript program. It is an ordered evaluation of distinct Script records in one fresh Realm:

1. `harness/assert.js`
2. `harness/sta.js`
3. `harness/doneprintHandle.js` when the async flag requires it
4. each requested include, in metadata order
5. the test source

For a strict variant, `"use strict";\n` is prepended to the test source before that Script is
parsed. It is not prepended to any harness Script. A raw test is evaluated unmodified and without
harness Scripts. Module tests use Module evaluation and are not represented as Scripts.

Every test variant receives a fresh Realm. Compiler processes, parsed immutable DSL metadata,
machine-code templates, and other state with no JavaScript-visible identity may be reused. The
global object, global environment, heap, intrinsics, pending jobs, exceptions, and `$262` host
state may not be reused between variants.

## Forbidden shortcuts

- Do not wrap a test or harness source in a generated function.
- Do not invoke generated wrappers with `.call`, `.apply`, or a synthetic receiver.
- Do not concatenate Script sources and treat the result as one Script.
- Do not prune, rewrite, or replace the official harness based on observed test usage.
- Do not turn top-level bindings into compiler locals spanning all records.
- Do not share JavaScript Realm state to amortize setup.
- Do not change Test262 assertions or expected outcomes.

These shortcuts change directive prologues, declaration instantiation, top-level `this`, lexical
scope, early errors, source locations, or observable Realm identity.

## Compiler boundary

A native compilation unit owns an ordered list of immutable Script records. Each record carries:

- its own parsed `SourceFile` handle;
- its filename and source text;
- its own diagnostics and directive prologue;
- its position in the evaluation order.

The unit owns one Realm/global-environment description. Indexing and lowering happen in Script
order. Before lowering a record's statements, the compiler performs that record's global
declaration instantiation against the shared global environment. It then evaluates that record's
statements. A later record's declarations therefore do not exist while an earlier record runs.

Top-level `var` and function declarations use object-environment bindings backed by the Realm's
global object. Top-level `let`, `const`, and class declarations use declarative global bindings.
Unqualified name lookup checks the current Script/function lexical environment and then the Realm
global environment. This is compiler structure; JavaScript operation semantics remain in `lib/`.

The native unit exposes a source-free host entry that creates one fresh Realm, evaluates every
record in order, and reports the final completion or uncaught exception through the existing host
ABI. The host entry is not a JavaScript function and is not visible to the program.

## Efficiency model

The persistent compiler worker may retain the native compiler process, immutable JSL metadata,
the official harness parse trees, and compiled code that is independent of a Realm. A test request
supplies record identities plus the transformed test record. Execution allocates fresh
JavaScript-visible state and runs the ordered records.

Harness caching must not cache a live global object or the effects of evaluating a harness. If
harness machine code is reused, relocations and global-binding accesses must target the fresh
Realm supplied to the host entry.

## Required witnesses

- A sloppy harness function remains sloppy when the test variant is strict.
- A strict test has strict top-level syntax and behavior without making harness Scripts strict.
- A harness global declaration is visible to includes and the test.
- A test declaration is not visible while an earlier harness Script executes.
- A lexical declaration in one Script participates in later global name resolution.
- Conflicting global declarations fail at the correct record's declaration-instantiation step.
- Top-level Script `this` is the fresh Realm's global object in sloppy and strict Script code.
- Ordinary strict and sloppy function receiver behavior is unchanged.
- Two variants cannot observe each other's properties, bindings, intrinsics, or queued jobs.
- Raw source is byte-for-byte unchanged and receives no harness.
- Official harness files and include order match Test262 metadata.
- Persistent and one-shot compiler modes produce the same result and exception phase.

## Completion evidence

The implementation is complete only when the bounded gate is green, the frontier reports only
the recorded open bugs, all witnesses above pass through the production runner, and a
representative official Test262 cohort has identical classifications in persistent and one-shot
compiler modes. Performance is reported separately for parse/index/lower/select/publish/execute;
semantic shortcuts are not accepted as optimizations.
