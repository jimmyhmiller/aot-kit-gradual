/*---
description: A Script lexical binding is not a property of the Realm global object.
---*/

let laterLexical = 42;

assert.sameValue(Object.prototype.hasOwnProperty.call(this, "laterLexical"), false);
