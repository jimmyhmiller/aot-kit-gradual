/*---
description: An earlier Script function sees a later Script lexical binding when called afterward.
includes: [global-environment-probe.js]
---*/

let laterLexical = 42;

assert.sameValue(readLaterLexical(), 42);
