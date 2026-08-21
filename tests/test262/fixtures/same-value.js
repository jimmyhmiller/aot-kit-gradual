/*---
description: Core synchronous Test262 assertion bootstrap
flags: [noStrict]
---*/

assert(true);
assert.sameValue(42, 42);
assert.sameValue(0 / 0, 0 / 0);
assert.sameValue(-0, -0);
assert.notSameValue(0, -0);
assert(compareArray([1, 2], [1, 2]));
assert.compareArray([1, 2, 3], [1, 2, 3]);
