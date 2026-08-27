/*---
description: Runner protocol witness whose constructor must not match
flags: [noStrict]
negative:
  phase: runtime
  type: TypeError
---*/

throw new RangeError("wrong constructor");
