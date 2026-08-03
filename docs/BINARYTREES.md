# Binary-trees integration specification

Binary-trees is the integration proof for the completed compiler substrate. It is not permission to
add benchmark-specific compiler paths.

The reference workload is the Benchmarks Game Node.js #7 binary-trees program. Command-line parsing
is outside the kernel. Output formatting is performed by the host harness and is not timed.

## Why this program

It combines the missing capabilities in a compact workload:

- several functions;
- direct recursion in construction and traversal;
- loops with multiple loop-carried values;
- fixed-shape objects with two managed-reference fields;
- `null` leaf sentinels;
- heavy short-lived allocation;
- one long-lived tree across many collections;
- enough arithmetic and branching to exercise placement, scheduling, and allocation.

## Canonical computational contract

The checked-in kernel must preserve these operations:

1. Build one stretch tree at `maxDepth + 1` and compute its check.
2. Build one long-lived tree at `maxDepth`.
3. For every even depth from 4 through `maxDepth`, build the specified number of trees and sum
   their checks.
4. Compute the long-lived tree check after all temporary-tree work.
5. Return structured observables sufficient to identify each failed phase/depth.

The native ABI may expose a result buffer supplied by the harness rather than return a language
object. That is an ABI design choice, not a semantic shortcut. A single aggregate checksum is not
sufficient for correctness because compensating errors can cancel.

Command-line handling is replaced by either:

- a `maxDepth` kernel parameter for correctness/stress tests; or
- a fixed depth in a dedicated benchmark wrapper.

The general compiled program must not be specialized by function name or fixed depth.

## Source levels

### Level A: hand-built ideal IR

Construct ordinary `Fun`, `Parm`, `Call`, `CallEnd`, Loop, Region, Phi, New, Store, Load, comparison,
and Return nodes using the supported construction APIs. This is the first executable target because
it isolates the backend from frontend work.

### Level B: normalized frontend IR

Represent the same program with resolved symbols, blocks, locals, calls, loops, objects, and source
locations. Compare its lowered ideal behavior to Level A.

### Level C: TypeScript source

Parse and lower a readable TypeScript version structurally equivalent to the reference. The initial
supported source may call `TreeNode(left, right)` directly instead of using JavaScript constructor
semantics only if this difference is explicit in the fixture header. Supporting `new TreeNode`
requires implementing its return-object semantics generally, not treating `new` as a spelling of
call.

## Observable results

For a depth `d`, retain:

- stretch depth and check;
- each work depth;
- iterations for that depth;
- accumulated check for that depth;
- long-lived depth and final check;
- optionally total allocations as a separately validated runtime metric.

The interpreter, unoptimized native code, optimized native code, and Node reference must agree on
the semantic fields. Runtime counters are compared only where their exact meaning is specified.

## Test ladder

### Parser-independent unit fixtures

Before the whole program:

1. `TreeNode(null, null)` has two readable null fields.
2. A parent retains two distinct child references.
3. `itemCheck` returns 1 for a leaf.
4. `itemCheck` returns the expected value for depths 1 through a small bound.
5. `bottomUpTree` creates the expected shape and allocation count.
6. A loop carrying both index and check works.

### Small-depth differential matrix

For a bounded range such as 4 through 10:

- interpret raw ideal IR;
- interpret optimized ideal IR;
- execute native code at normal pressure;
- execute native code at restricted register budgets;
- compare against the Node/reference implementation;
- repeat across the configured seed matrix.

Every mode compares the full structured observables.

### GC stress matrix

At reduced depths chosen to keep the normal gate bounded:

- run normal allocation;
- run collect-before-every-allocation;
- force collections during recursive construction;
- force collections while the long-lived tree is live but not currently traversed;
- force the long-lived root into a spill slot;
- verify the heap after every collection;
- require identical semantic observables in all modes.

### Full-depth extended gate

Run the intended benchmark depth, initially 21, outside the quick gate but as a required X2 release
gate. It must complete without artificial interpreter limits, fixed heap capacities, or benchmark-
specific compiler behavior.

The extended gate records:

- all semantic observables;
- allocation count;
- collection count;
- bytes allocated, copied, and promoted;
- peak live heap;
- maximum native stack depth or frame count if available;
- generated code size.

## Negative and falsification cases

The suite must prove it catches at least:

- left/right field offset exchange;
- wrong null comparison;
- dropped recursive result;
- swapped loop-carried Phi inputs;
- one missing caller-saved preservation;
- one stale pre-collection root use;
- incorrect object reference bitmap;
- long-lived tree collected as dead;
- one incorrect work-loop iteration count.

Each defect should make a focused gate fail before relying on the full-depth benchmark.

## Performance protocol

Correctness and stress are completed first. The timed benchmark then reports:

- source parse and frontend lowering;
- optimization and backend phases;
- object emission and linking;
- execution time;
- allocation throughput;
- time in GC and collection count;
- peak live heap;
- code size;
- Node/V8 execution under the same depth and host conditions.

Use multiple raw samples and publish medians and ratios. Do not include collect-every-allocation in
the normal V8 comparison. Do not hide compilation/link time inside runtime or vice versa.

## Completion criteria

Binary-trees support is complete only when:

1. Level A passes the small, stress, and full-depth gates.
2. No backend branch refers to the fixture or its function names.
3. Calls remain real calls unless a general inliner independently chooses otherwise.
4. Native allocation enters the real collector and resumes with relocated roots.
5. The long-lived tree survives collections caused by temporary trees.
6. Level C lowers through the same Coil ideal and native pipeline.
7. Node, interpreter, and native structured outputs agree.
8. Performance results and losses are published with raw samples.
