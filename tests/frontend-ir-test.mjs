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

console.log("normalized frontend IR: symbols, ranges, control, calls, and diagnostics verified");
