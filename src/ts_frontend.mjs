// M12 TypeScript subset parser and lowering to the kit's typed core vocabulary.
import fs from "node:fs";

export function tokenize(source) {
  const out = [];
  const re = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|(?:===|!==|=>|<=|>=)|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[{}()[\].,:;<>+\-*\/|=]/gy;
  let at = 0;
  while (at < source.length) {
    re.lastIndex = at;
    const m = re.exec(source);
    if (!m) throw new SyntaxError(`unexpected token at ${at}: ${source.slice(at, at + 16)}`);
    at = re.lastIndex;
    if (!/^\s|^\/\//.test(m[0]) && !m[0].startsWith("/*")) out.push(m[0]);
  }
  out.push("<eof>");
  return out;
}

class Parser {
  constructor(source) { this.t = tokenize(source); this.i = 0; this.typeParams = new Set(); }
  peek(x) { return this.t[this.i] === x; }
  take(x) { const got = this.t[this.i++]; if (x && got !== x) throw new SyntaxError(`expected ${x}, got ${got}`); return got; }
  ident() { const x = this.take(); if (!/^[A-Za-z_$]/.test(x)) throw new SyntaxError(`expected identifier, got ${x}`); return x; }
  program() {
    const functions = [];
    while (!this.peek("<eof>")) functions.push(this.functionDecl());
    const main = functions.find(f => f.name === "main");
    if (!main) throw new SyntaxError("program must export or declare function main");
    return { kind: "Program", functions, main };
  }
  functionDecl() {
    if (this.peek("export")) this.take();
    this.take("function"); const name = this.ident(); this.typeParams = new Set();
    if (this.peek("<")) { this.take(); while (!this.peek(">")) { this.typeParams.add(this.ident()); if (!this.peek(",")) break; this.take(); } this.take(">"); }
    this.take("("); const params = [];
    while (!this.peek(")")) {
      const pname = this.ident(); let type = { kind: "dynamic" };
      if (this.peek(":")) { this.take(); type = this.type(); }
      params.push({ name: pname, type, annotated: type.kind !== "dynamic" });
      if (!this.peek(",")) break; this.take();
    }
    this.take(")"); let result = { kind: "dynamic" };
    if (this.peek(":")) { this.take(); result = this.type(); }
    this.take("{");
    while (this.peek("const") || this.peek("let")) throw new SyntaxError("local declarations are not yet in the M12 subset");
    this.take("return"); const body = this.expr(); if (this.peek(";")) this.take(); this.take("}");
    return { kind: "Function", name, params, result, body, typeParams: [...this.typeParams] };
  }
  type() {
    let left = this.atomicType(); const members = [left];
    while (this.peek("|")) { this.take(); members.push(this.atomicType()); }
    return members.length === 1 ? left : { kind: "union", members };
  }
  atomicType() {
    if (this.peek("{")) {
      this.take(); const fields = {};
      while (!this.peek("}")) { const n = this.ident(); this.take(":"); fields[n] = this.type(); if (!this.peek(",") && !this.peek(";")) break; this.take(); }
      this.take("}"); return { kind: "object", fields };
    }
    const n = this.ident();
    if (this.typeParams.has(n) || n === "any" || n === "unknown") return { kind: "dynamic" };
    if (["number", "boolean", "string", "null", "undefined"].includes(n)) return { kind: n };
    return { kind: "structural", name: n };
  }
  expr(min = 0) {
    let x = this.primary();
    const prec = { "===": 1, "!==": 1, "<": 2, ">": 2, "<=": 2, ">=": 2, "+": 3, "-": 3, "*": 4, "/": 4 };
    while ((prec[this.t[this.i]] ?? -1) >= min) { const op = this.take(); x = { kind: "Binary", op, left: x, right: this.expr(prec[op] + 1) }; }
    return x;
  }
  primary() {
    let x;
    if (this.peek("(")) { this.take(); x = this.expr(); this.take(")"); }
    else if (this.peek("{")) {
      this.take(); const fields = {};
      while (!this.peek("}")) { const n = this.ident(); this.take(":"); fields[n] = this.expr(); if (!this.peek(",")) break; this.take(); }
      this.take("}"); x = { kind: "Object", fields };
    } else {
      const t = this.take();
      if (/^\d/.test(t)) x = { kind: "Literal", value: Number(t) };
      else if (t === "true" || t === "false") x = { kind: "Literal", value: t === "true" };
      else if (t === "null") x = { kind: "Literal", value: null };
      else if (/^["']/.test(t)) x = { kind: "Literal", value: JSON.parse(t.replace(/^'/, '"').replace(/'$/, '"')) };
      else x = { kind: "Name", name: t };
    }
    while (this.peek(".")) { this.take(); x = { kind: "Property", object: x, name: this.ident() }; }
    return x;
  }
}

export function parseTypeScript(source) { return new Parser(source).program(); }
const dyn = { kind: "dynamic" };
const typeOfLiteral = v => v === null ? { kind: "null" } : { kind: typeof v === "number" ? "number" : typeof v };
const sameType = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function lower(program) {
  const fn = program.main, env = new Map(); let id = 0;
  const node = (op, type, inputs = [], extra = {}) => ({ id: id++, op, type, inputs, ...extra });
  const parms = fn.params.map((p, index) => {
    const raw = node("Parm", dyn, [], { index, name: p.name });
    const value = p.annotated ? node("Cast", p.type, [raw], { boundary: true }) : raw;
    env.set(p.name, value); return value;
  });
  const emit = e => {
    if (e.kind === "Name") { if (!env.has(e.name)) throw new ReferenceError(e.name); return env.get(e.name); }
    if (e.kind === "Literal") return node("Const", typeOfLiteral(e.value), [], { value: e.value });
    if (e.kind === "Object") {
      const fields = Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, emit(v)]));
      return node("New", { kind: "object", fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.type])) }, Object.values(fields), { fields });
    }
    if (e.kind === "Property") {
      const o = emit(e.object), t = o.type.kind === "object" ? o.type.fields[e.name] ?? dyn : dyn;
      return node("Load", t, [o], { name: e.name });
    }
    if (e.kind === "Binary") {
      const a = emit(e.left), b = emit(e.right);
      if (e.op === "+" && a.type.kind === "number" && b.type.kind === "number") return node("Add", { kind: "number" }, [a, b]);
      if (e.op === "+") {
        const ga = node("TypeTest", { kind: "boolean" }, [a], { target: { kind: "number" } });
        const gb = node("TypeTest", { kind: "boolean" }, [b], { target: { kind: "number" } });
        const fast = node("Add", { kind: "number" }, [node("Unbox", { kind: "number" }, [a]), node("Unbox", { kind: "number" }, [b])]);
        const slow = node("GenericAdd", dyn, [a, b]);
        return node("Guard", dyn, [ga, gb, fast, slow]);
      }
      const type = ["<", ">", "<=", ">=", "===", "!=="].includes(e.op) ? { kind: "boolean" } : { kind: "number" };
      return node({ "-": "Sub", "*": "Mul", "/": "Div" }[e.op] ?? "Compare", type, [a, b], { operator: e.op });
    }
    throw new Error(`unlowered ${e.kind}`);
  };
  const value = emit(fn.body), ret = node("Return", fn.result, [value]);
  return { kind: "CoreGraph", name: fn.name, params: parms, return: ret, nodes: collect(ret) };
}

function collect(root) { const seen = new Map(); const visit = n => { if (seen.has(n.id)) return; n.inputs.forEach(visit); seen.set(n.id, n); }; visit(root); return [...seen.values()].sort((a,b)=>a.id-b.id); }
function accepts(t, v) {
  if (t.kind === "dynamic") return true;
  if (t.kind === "union") return t.members.some(m => accepts(m, v));
  if (t.kind === "number" || t.kind === "boolean" || t.kind === "string") return typeof v === t.kind;
  if (t.kind === "null") return v === null;
  if (t.kind === "undefined") return v === undefined;
  if (t.kind === "object") return v && typeof v === "object" && Object.entries(t.fields).every(([k, ft]) => k in v && accepts(ft, v[k]));
  return v && typeof v === "object";
}
export function execute(graph, args) {
  const memo = new Map();
  const ev = n => { if (memo.has(n.id)) return memo.get(n.id); const xs = n.inputs.map(ev); let v;
    switch (n.op) {
      case "Parm": v = args[n.index]; break; case "Const": v = n.value; break;
      case "Cast": if (!accepts(n.type, xs[0])) throw new TypeError(`boundary cast failed`); v = xs[0]; break;
      case "Add": v = xs[0] + xs[1]; break; case "Sub": v = xs[0] - xs[1]; break; case "Mul": v = xs[0] * xs[1]; break; case "Div": v = xs[0] / xs[1]; break;
      case "TypeTest": v = accepts(n.target, xs[0]); break; case "Unbox": v = xs[0]; break;
      case "GenericAdd": v = xs[0] + xs[1]; break; case "Guard": v = xs[0] && xs[1] ? xs[2] : xs[3]; break;
      case "New": v = Object.fromEntries(Object.entries(n.fields).map(([k, x]) => [k, ev(x)])); break;
      case "Load": v = xs[0][n.name]; break;
      case "Compare": v = ({"<":xs[0]<xs[1], ">":xs[0]>xs[1], "<=":xs[0]<=xs[1], ">=":xs[0]>=xs[1], "===":xs[0]===xs[1], "!==":xs[0]!==xs[1]})[n.operator]; break;
      case "Return": v = xs[0]; break; default: throw new Error(n.op);
    } memo.set(n.id, v); return v; };
  return ev(graph.return);
}
export const guardCount = graph => graph.nodes.filter(n => n.op === "TypeTest").length;
export function compileTypeScript(source) { const ast = parseTypeScript(source); const graph = lower(ast); return { ast, graph }; }
export function compileFile(path) { return compileTypeScript(fs.readFileSync(path, "utf8")); }
