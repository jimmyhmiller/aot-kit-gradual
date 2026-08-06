import assert from "node:assert/strict";
import { executeNormalized, FrontendDiagnostic, normalizeTypeScript } from "../src/frontend_ir.mjs";

const source = `
function make(left: unknown, right: unknown): { left: unknown; right: unknown } {
  return { left: left, right: right };
}
function check(tree: { left: unknown; right: unknown } | null): number {
  if (tree === null) { return 0; }
  return 1 + check(tree.left) + check(tree.right);
}
export function main(depth: number): number {
  let i: number = 0;
  let tree = make(null, null);
  while (i < depth) {
    tree = make(tree, tree);
    i += 1;
  }
  return check(tree);
}`;

const program = normalizeTypeScript(source, "tree.ts");
assert.equal(program.kind, "Program");
assert.equal(program.functions.length, 3);
assert.equal(program.functions.find(fn => fn.symbol.name === "main").body.statements[2].kind, "While");
assert.equal(new Set(program.functions.map(fn => fn.symbol.id)).size, 3);
for (const fn of program.functions) {
  assert.ok(fn.range.start.line > 0);
assert.ok(fn.parameters.every(parameter => parameter.symbol.id >= 3));
}

const constructed = normalizeTypeScript(`
  function Box(value: number): { value: number } { return { value: value }; }
  function main(): number { return new Box(7).value; }
`, "constructor.ts");
assert.equal(constructed.functions[1].body.statements[0].value.object.kind, "Construct");
assert.equal(executeNormalized(constructed, []), 7);

const bitwise = normalizeTypeScript(`
  function Box(value: number, count: number): { value: number; count: number } {
    return { value: value, count: count };
  }
  function touch(box: { value: number; count: number }): { value: number; count: number } {
    box.count += 1;
    return box;
  }
  function main(a: number, b: number): number {
    let box = new Box(a, 0);
    touch(box).value <<= 33;
    box.value ^= b;
    box.value >>>= 1;
    box.value %= 97;
    return (~box.value) + box.count;
  }
`, "bitwise.ts");
assert.equal(executeNormalized(bitwise, [3.9, -1]), -62,
  "bitwise compounds use JavaScript coercion and evaluate their lvalue object once");

const evaluationOrder = normalizeTypeScript(`
  function receiver(state: any, values: any): any { state.receivers += 1; return values; }
  function rhs(state: any): number { state.calls += 1; return 5; }
  function main(values: any, state: any, flag: any): number {
    let i = 0;
    let assigned = receiver(state, values)[i++] += rhs(state);
    let selected = flag ? i++ : ++i;
    let andValue = flag && (state.andCalls += 1);
    let orValue = flag || (state.orCalls += 1);
    return (state.commas += 1, assigned * 100000 + i * 10000 + selected * 1000 +
      state.receivers * 100 + state.calls * 10 + state.andCalls + state.orCalls);
  }
`, "evaluation-order.ts");
for (const [flag, want, andCalls, orCalls] of [
  [false, 1222111, 0, 1],
  [true, 1221111, 1, 0],
]) {
  const values = [7];
  const state = { receivers: 0, calls: 0, andCalls: 0, orCalls: 0, commas: 0 };
  assert.equal(executeNormalized(evaluationOrder, [values, state, flag]), want);
  assert.deepEqual(values, [12], "compound element assignment stores through the cached reference");
  assert.deepEqual(state, { receivers: 1, calls: 1, andCalls, orCalls, commas: 1 });
}

const structuredTargets = normalizeTypeScript(`
  function main(n: number): number {
    let x = 0;
    let hits = 0;
    outer: do {
      x += 1;
      switch (x) {
        case 1: hits += 10; break;
        case 2: hits += 20;
        default: hits += 1;
      }
      if (x === 2) continue outer;
      let j = 0;
      inner: while (j < 3) {
        j += 1;
        if (j === 1) continue inner;
        if (j === 2) break inner;
        hits += 1000;
      }
      if (x === 3) break outer;
    } while (x < n);
    return x * 100 + hits;
  }
`, "structured-targets.ts");
assert.equal(executeNormalized(structuredTargets, [0]), 110, "do/while executes its body once");
assert.equal(executeNormalized(structuredTargets, [3]), 332,
  "switch fallthrough and nested labeled exits resolve to their lexical targets");

const targetedControl = normalizeTypeScript(`
  function main(limit: number): number {
    let i = 0;
    let out = 0;
    outer: do {
      i++;
      switch (i) {
        default: out = out * 10 + 8;
        case 3: out = out * 10 + 3; break;
        case 1: out = out * 10 + 1; continue outer;
        case 2: out = out * 10 + 2;
      }
      out = out * 10 + 9;
      if (i >= limit) break outer;
    } while (i < 5);
    return out * 10 + i;
  }
`, "targeted-control.ts");
assert.equal(executeNormalized(targetedControl, [2]), 1292,
  "continue in a do/switch reaches the do condition and case 2 falls through to the switch exit");
assert.equal(executeNormalized(targetedControl, [3]), 129393,
  "default placement does not preempt a later matching case and labeled break exits the loop");

function rejects(fragment, code) {
  assert.throws(() => normalizeTypeScript(fragment, "bad.ts"), error => {
    assert.ok(error instanceof FrontendDiagnostic);
    assert.equal(error.code, code);
    assert.equal(error.range.file, "bad.ts");
    assert.ok(error.range.start.line >= 1 && error.range.start.column >= 1);
    return true;
  });
}

rejects("function main(: number { return 1; }", "FE_PARSE");
rejects("function main(): number { return missing; }", "FE_UNBOUND");
rejects("function f(x: number): number { return x; } function main(): number { return f(); }", "FE_ARITY");
rejects("function main(): number { return (() => 1)(); }", "FE_UNSUPPORTED");
rejects("function main(): number { 1 += 2; return 0; }", "FE_UNSUPPORTED");
rejects("function main(): number { return ++1; }", "FE_UNSUPPORTED");
rejects("function main(): number { 1++; return 0; }", "FE_UNSUPPORTED");
rejects("function main(): number { break missing; return 0; }", "FE_TARGET");
rejects("function main(): number { continue; return 0; }", "FE_TARGET");
rejects("function main(): number { label: { continue label; } return 0; }", "FE_TARGET");
rejects("function main(): number { break; return 0; }", "FE_TARGET");
rejects("function main(): number { while (1) { break missing; } return 0; }", "FE_TARGET");
rejects("function main(): number { label: { continue label; } return 0; }", "FE_TARGET");
rejects("function main(): number { x: { x: { break x; } } return 0; }", "FE_TARGET");

console.log("normalized frontend IR: symbols, ranges, control, calls, and diagnostics verified");
