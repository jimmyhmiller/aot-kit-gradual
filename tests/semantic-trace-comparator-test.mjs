import assert from "node:assert/strict";
import test from "node:test";
import {compareTraces, semanticEvent} from "../tools/compare-semantic-traces.mjs";

const event = {sequence: 0, step: 4, depth: 1, kind: "load", node: 20, op: "PropLoad", context: 7, object: 3, name: 9, valueTag: 5, valuePayload: 3};

test("incidental schedule and graph identities are normalized", () => {
  const changed = {...event, sequence: 99, step: 400, node: 200, context: 70};
  assert.deepEqual(semanticEvent(event), semanticEvent(changed));
  assert.equal(compareTraces([event], [changed]).equal, true);
});

test("the first semantic mismatch is reported", () => {
  const changed = {...event, valueTag: 4};
  assert.deepEqual(compareTraces([event], [changed]), {equal: false, index: 0, reason: "event", left: event, right: changed});
});

test("a truncated trace is a length divergence", () => {
  assert.equal(compareTraces([event], []).reason, "length");
});
