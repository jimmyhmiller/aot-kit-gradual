/*---
description: An abrupt global lookup preserves the DSL-initialized ReferenceError object.
---*/

var caught;

try {
  missingLogicalValue && true;
} catch (error) {
  caught = error;
}

assert.sameValue(caught.constructor, ReferenceError);
assert.sameValue(caught instanceof ReferenceError, true);
assert.sameValue(caught.name, "ReferenceError");
assert.sameValue(caught.message, "missingLogicalValue is not defined");
