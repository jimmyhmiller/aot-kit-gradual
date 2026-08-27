/*---
description: Runtime-negative completion matches the harness-defined Test262Error constructor name
flags: [noStrict]
negative:
  phase: runtime
  type: Test262Error
---*/

throw new Test262Error("expected harness error");
