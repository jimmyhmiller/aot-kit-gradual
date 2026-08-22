// Copyright (C) 2017 Ecma International.  All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.
//
// Bootstrap slice of Test262's assertion harness. The callable `assert`, SameValue relation, and
// sameValue/notSameValue behavior are preserved. Diagnostic formatting is deliberately minimal.

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

assert.throws = function (expectedErrorConstructor, func, message) {
  if (typeof func !== "function") {
    throw new Test262Error("assert.throws requires an error constructor and a function");
  }
  try {
    func();
  } catch (thrown) {
    if (typeof thrown !== "object" || thrown === null) {
      throw new Test262Error(message === undefined ? "Thrown value was not an object" : message);
    }
    if (thrown.constructor !== expectedErrorConstructor) {
      throw new Test262Error(message === undefined ? "Wrong error constructor" : message);
    }
    return;
  }
  throw new Test262Error(message === undefined ? "Expected an exception" : message);
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
