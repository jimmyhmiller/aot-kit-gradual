/*---
description: A Script var binding aliases a property of the Realm global object.
---*/

var laterObject = 41;

assert.sameValue(this.laterObject, 41);
