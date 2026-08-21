// Copyright (C) 2017 Ecma International.  All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.
//
// Bootstrap slice of Test262's assertion harness. The callable `assert`, SameValue relation, and
// sameValue/notSameValue behavior are preserved. Diagnostic formatting is deliberately minimal;
// the upstream formatter and assert.throws depend on unsupported try/catch exception transport.

function assert(mustBeTrue, message) {
  if (mustBeTrue === true) return;
  if (message === undefined) message = "Expected true";
  throw new Test262Error(message);
}

assert._isSameValue = function (a, b) {
  if (a === b) return a !== 0 || 1 / a === 1 / b;
  return a !== a && b !== b;
};

assert.sameValue = function (actual, expected, message) {
  if (assert._isSameValue(actual, expected)) return;
  throw new Test262Error(message === undefined ? "Expected SameValue" : message);
};

assert.notSameValue = function (actual, unexpected, message) {
  if (!assert._isSameValue(actual, unexpected)) return;
  throw new Test262Error(message === undefined ? "Expected different values" : message);
};

function compareArray(actual, expected) {
  if (actual.length !== expected.length) return false;
  for (var i = 0; i < actual.length; i++) {
    if (!assert._isSameValue(actual[i], expected[i])) return false;
  }
  return true;
}

assert.compareArray = function (actual, expected, message) {
  if (compareArray(actual, expected)) return;
  throw new Test262Error(message === undefined ? "Expected equal arrays" : message);
};
