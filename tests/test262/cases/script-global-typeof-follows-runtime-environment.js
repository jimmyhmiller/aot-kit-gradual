/*---
description: typeof in an earlier function observes a later lexical binding when called afterward.
includes: [global-typeof-probe.js]
---*/

let laterLexical = 42;

assert.sameValue(typeOfLaterLexical(), "number");
