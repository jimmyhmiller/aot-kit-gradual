/*---
description: Runtime-negative completion matches the expected constructor name
flags: [noStrict]
negative:
  phase: runtime
  type: TypeError
---*/

throw new TypeError("expected");
