// Generate a Coil metaprogram that constructs ideal IR from normalized frontend IR.
// The output uses only the public node/shape APIs; it contains no fixture-name dispatch.

const q = value => JSON.stringify(value);
const isDynamic = type => !type || type.kind === "dynamic";

export function generateCoilBuilder(program, { moduleName = "generatedfrontend" } = {}) {
  const functions = new Map(program.functions.map(fn => [fn.symbol.id, fn]));
  const types = new Map(program.types.map(type => [type.name, type.type]));
  const objectTypes = program.types.filter(type => resolve(type.type)?.kind === "object");
  const shapeVar = name => `shape_${safe(name)}`;
  const aliasVar = (name, field) => `alias_${safe(name)}_${safe(field)}`;
  const functionVar = id => `fun_${id}`;
  const symbolVar = id => `sym_${id}`;
  let temporary = 0;
  const temp = prefix => `${prefix}_${temporary++}`;

  function resolve(type, seen = new Set()) {
    if (!type || type.kind !== "named") return type;
    if (seen.has(type.name) || !types.has(type.name)) return type;
    seen.add(type.name);
    return resolve(types.get(type.name), seen);
  }

  function coilType(type) {
    const resolved = resolve(type);
    if (resolved?.kind === "number") return "(t-int)";
    if (resolved?.kind === "boolean") return "(t-bool)";
    if (resolved?.kind === "null") return "(t-null)";
    if (resolved?.kind === "named" && types.has(resolved.name)) return `(t-obj-shape ${shapeVar(resolved.name)})`;
    if (type?.kind === "named" && types.has(type.name)) return `(t-obj-shape ${shapeVar(type.name)})`;
    if (resolved?.kind === "object" || resolved?.kind === "union") return "(t-obj)";
    return "(t-int)";
  }

  function namedObject(type) {
    if (type?.kind === "named" && resolve(type)?.kind === "object") return type.name;
    return null;
  }

  function fieldType(owner, field) {
    const object = resolve({ kind: "named", name: owner });
    return object.fields.find(candidate => candidate.name === field)?.type;
  }

  const allAliases = objectTypes.flatMap(declaration => {
    const layout = resolve(declaration.type);
    return layout.fields.map(field => ({ owner: declaration.name, field: field.name,
      variable: aliasVar(declaration.name, field.name) }));
  });

  function memorySnapshot(ctrl, memory, aliases) {
    if (!aliases.length) return "0";
    const array = temp("call_memory"), merge = temp("call_merge");
    const fills = aliases.map((alias, index) =>
      `(store! (index ${array} ${index}) (fe-memory (load ${ctrl}) ${alias.variable}))`).join(" ");
    return `(let [${array} (stack (array i64 ${aliases.length}))] (do ${fills} (let [${merge} (fe-merge! (cast (ptr i64) ${array}) ${aliases.length})] (do (store! ${memory} ${merge}) ${merge}))))`;
  }

  const effects = new Map(program.functions.map(fn => [fn.symbol.id, new Set()]));
  const calls = new Map(program.functions.map(fn => [fn.symbol.id, new Set()]));
  const scanEffects = (node, fn) => {
    if (!node || typeof node !== "object") return;
    if (node.kind === "Object") {
      const owner = namedObject(fn.result);
      if (owner) effects.get(fn.symbol.id).add(owner);
    }
    if (node.kind === "Call" || node.kind === "Construct") calls.get(fn.symbol.id).add(node.callee.id);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const child of value) scanEffects(child, fn);
      else if (value && typeof value === "object" && value.kind) scanEffects(value, fn);
    }
  };
  for (const fn of program.functions) scanEffects(fn.body, fn);
  let effectsChanged = true;
  while (effectsChanged) {
    effectsChanged = false;
    for (const fn of program.functions) for (const callee of calls.get(fn.symbol.id))
      for (const owner of effects.get(callee)) if (!effects.get(fn.symbol.id).has(owner)) {
        effects.get(fn.symbol.id).add(owner); effectsChanged = true;
      }
  }

  function infer(expression, env, expected = null) {
    if (expected && !isDynamic(expected)) return expected;
    switch (expression.kind) {
      case "Literal": return expression.value === null ? { kind: "null" } : { kind: typeof expression.value === "number" ? "number" : typeof expression.value };
      case "Name": return env.get(expression.symbol.id) ?? { kind: "dynamic" };
      case "Call": case "Construct": return functions.get(expression.callee.id).result;
      case "Object": return expected ?? { kind: "dynamic" };
      case "Field": {
        const owner = namedObject(infer(expression.object, env));
        return owner ? fieldType(owner, expression.name) : { kind: "dynamic" };
      }
      case "Unary": return expression.operator === "!" ? { kind: "boolean" } : { kind: "number" };
      case "Binary":
        if (["<", "<=", ">", ">=", "===", "!=="].includes(expression.operator)) return { kind: "boolean" };
        return infer(expression.left, env);
      default: return { kind: "dynamic" };
    }
  }

  function assigned(statement, into = new Set()) {
    const expression = value => {
      if (value.kind === "Binary" && ["=", "+=", "-="].includes(value.operator) && value.left.kind === "Name")
        into.add(value.left.symbol.id);
      for (const key of ["left", "right", "value", "object", "condition", "increment"])
        if (value[key]?.kind) expression(value[key]);
      for (const item of value.args ?? []) expression(item);
      for (const field of value.fields ?? []) expression(field.value);
    };
    if (statement.value) expression(statement.value);
    if (statement.condition) expression(statement.condition);
    if (statement.increment) expression(statement.increment);
    for (const child of statement.statements ?? []) assigned(child, into);
    if (statement.then) assigned(statement.then, into);
    if (statement.otherwise) assigned(statement.otherwise, into);
    if (statement.body) assigned(statement.body, into);
    return into;
  }

  function compileFunction(fn, topLevel) {
    const activeAliases = allAliases.filter(alias => effects.get(fn.symbol.id).has(alias.owner));
    const env = new Map(fn.parameters.map(parameter => [parameter.symbol.id, parameter.type]));
    const locals = [];
    const visitLocals = statement => {
      if (statement.kind === "Let") locals.push(statement);
      for (const child of statement.statements ?? []) visitLocals(child);
      if (statement.then) visitLocals(statement.then);
      if (statement.otherwise) visitLocals(statement.otherwise);
      if (statement.body) visitLocals(statement.body);
      if (statement.initialize) visitLocals(statement.initialize);
    };
    visitLocals(fn.body);
    for (const local of locals) env.set(local.symbol.id, local.type);
    const ctrl = temp("ctrl"), memory = temp("memory"), firstReturn = temp("first_return");
    const fun = topLevel ? null : functionVar(fn.symbol.id);

    const expression = (node, expected = null) => {
      switch (node.kind) {
        case "Name": return { code: `(load ${symbolVar(node.symbol.id)})`, type: infer(node, env, expected) };
        case "Literal": return { code: node.value === null ? "(fe-null)" : `(fe-const ${Number(node.value)})`, type: infer(node, env, expected) };
        case "Unary": {
          const value = expression(node.value);
          if (node.operator === "+") return value;
          const code = node.operator === "!" ? `(fe-bin OP-EQ ${value.code} (fe-const 0))`
            : node.operator === "~" ? `(n-new2 OP-BITNOT 0 NO-NODE ${value.code})`
            : `(fe-bin OP-SUB (fe-const 0) ${value.code})`;
          return { code, type: infer(node, env, expected) };
        }
        case "Binary": {
          if (["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>=", ">>>="].includes(node.operator)) {
            if (node.left.kind !== "Name") throw new Error(`frontend Coil lowering only assigns locals at ${node.range.file}:${node.range.start.line}`);
            const right = expression(node.right, env.get(node.left.symbol.id));
            const compound = ({ "+=": "OP-ADD", "-=": "OP-SUB", "*=": "OP-MUL", "/=": "OP-DIV",
              "%=": "OP-MOD", "&=": "OP-BITAND", "|=": "OP-BITOR", "^=": "OP-BITXOR",
              "<<=": "OP-SHL", ">>=": "OP-SHR", ">>>=": "OP-USHR" })[node.operator];
            const value = node.operator === "=" ? right.code : `(fe-bin ${compound} (load ${symbolVar(node.left.symbol.id)}) ${right.code})`;
            return { code: `(let [assigned ${value}] (do (store! ${symbolVar(node.left.symbol.id)} assigned) assigned))`, type: env.get(node.left.symbol.id) };
          }
          const left = expression(node.left), right = expression(node.right);
          if (node.operator === ">") return { code: `(fe-bin OP-LT ${right.code} ${left.code})`, type: infer(node, env, expected) };
          if (node.operator === ">=") return { code: `(fe-bin OP-LE ${right.code} ${left.code})`, type: infer(node, env, expected) };
          if (node.operator === "!==") return { code: `(fe-bin OP-EQ (fe-bin OP-EQ ${left.code} ${right.code}) (fe-const 0))`, type: infer(node, env, expected) };
          const op = ({ "+": "OP-ADD", "-": "OP-SUB", "*": "OP-MUL", "/": "OP-DIV", "%": "OP-MOD",
            "&": "OP-BITAND", "|": "OP-BITOR", "^": "OP-BITXOR", "<<": "OP-SHL",
            ">>": "OP-SHR", ">>>": "OP-USHR",
            "<": "OP-LT", "<=": "OP-LE", "===": "OP-EQ" })[node.operator];
          if (!op) throw new Error(`no Coil operator for ${node.operator}`);
          return { code: `(fe-bin ${op} ${left.code} ${right.code})`, type: infer(node, env, expected) };
        }
        case "Call": case "Construct": {
          const args = node.args.map(argument => expression(argument));
          const bindings = args.map((argument, index) => `arg_${index} ${argument.code}`).join(" ");
          const call = temp("call");
          const callExpression = node.args.length === 0
            ? `(n-call0! (load ${ctrl}) ${functionVar(node.callee.id)})`
            : `(n-call${node.args.length}! (load ${ctrl}) ${functionVar(node.callee.id)} ${args.map((_, index) => `arg_${index}`).join(" ")})`;
          return { code: `(let [${bindings}${bindings ? " " : ""}${call} ${callExpression}] (do (store! ${ctrl} (call-end ${call})) (call-value ${call})))`, type: functions.get(node.callee.id).result };
        }
        case "Field": {
          const object = expression(node.object);
          const owner = namedObject(object.type);
          if (!owner) throw new Error(`field ${node.name} has no resolved object layout at ${node.range.file}:${node.range.start.line}`);
          const alias = aliasVar(owner, node.name), cast = temp("cast"), obj = temp("object");
          return { code: `(let [${obj} ${object.code} ${cast} (n-new2 OP-CAST (t-obj-shape ${shapeVar(owner)}) (load ${ctrl}) ${obj})] (n-load! (fe-memory (load ${ctrl}) ${alias}) ${cast} ${alias}))`, type: fieldType(owner, node.name) };
        }
        case "Object": {
          const owner = namedObject(expected);
          if (!owner) throw new Error(`object literal lacks a named expected layout at ${node.range.file}:${node.range.start.line}`);
          const layout = resolve({ kind: "named", name: owner });
          if (layout.fields.length !== node.fields.length || layout.fields.some((field, index) => field.name !== node.fields[index].name))
            throw new Error(`object literal does not match ${owner} field order at ${node.range.file}:${node.range.start.line}`);
          const values = node.fields.map((field, index) => expression(field.value, layout.fields[index].type));
          const valueBindings = values.map((value, index) => `field_${index} ${value.code}`).join(" ");
          const incoming = temp("incoming"), stores = temp("stores"), nw = temp("new"), obj = temp("object"), merge = temp("merge");
          const initialize = layout.fields.map((field, index) => `(store! (index ${incoming} ${index}) (fe-memory (load ${ctrl}) ${aliasVar(owner, field.name)}))`).join(" ");
          const ownIndex = new Map(layout.fields.map((field, index) => [field.name, index]));
          const storeFields = activeAliases.map((alias, index) => alias.owner === owner
            ? `(store! (index ${stores} ${index}) (n-store! (n-obj-mem ${nw} ${ownIndex.get(alias.field)}) ${obj} field_${ownIndex.get(alias.field)} ${alias.variable}))`
            : `(store! (index ${stores} ${index}) (fe-memory (load ${ctrl}) ${alias.variable}))`).join(" ");
          return { code: `(let [${valueBindings} ${incoming} (stack (array i64 ${layout.fields.length})) ${stores} (stack (array i64 ${activeAliases.length}))] (do ${initialize} (let [${nw} (n-new-obj! (load ${ctrl}) ${shapeVar(owner)} (slice-new [i64] (cast (ptr i64) ${incoming}) ${layout.fields.length})) ${obj} (n-obj-ptr ${nw})] (do ${storeFields} (let [${merge} (fe-merge! (cast (ptr i64) ${stores}) ${activeAliases.length})] (do (store! ${memory} ${merge}) ${obj}))))))`, type: expected };
        }
        default: throw new Error(`unhandled Coil expression ${node.kind}`);
      }
    };

    const statement = node => {
      switch (node.kind) {
        case "Block": {
          const chunks = [];
          let continues = true;
          for (const child of node.statements) {
            if (!continues) break;
            const compiled = statement(child); chunks.push(compiled.code); continues = compiled.continues;
          }
          return { code: `(do ${chunks.join(" ")} 0)`, continues };
        }
        case "Let": {
          const declared = isDynamic(node.type) ? null : node.type;
          const value = expression(node.value, declared);
          env.set(node.symbol.id, declared ?? value.type);
          return { code: `(store! ${symbolVar(node.symbol.id)} ${value.code})`, continues: true };
        }
        case "Expression": return { code: `(do ${expression(node.value).code} 0)`, continues: true };
        case "Return": {
          const value = expression(node.value, fn.result);
          const local = temp("return_value");
          const emit = topLevel
            ? `(let [ret (if (= (load ${memory}) NO-NODE) (n-new2 OP-RETURN 0 (load ${ctrl}) ${local}) (n-new3 OP-RETURN 0 (load ${ctrl}) ${local} (load ${memory})))] (do (n-add-def! (g-stop) ret) ret))`
            : `(fe-add-return! ${fun} ${firstReturn} (load ${ctrl}) ${local} (load ${memory}))`;
          return { code: `(let [${local} ${value.code}] (do (if (= (load ${memory}) NO-NODE) ${memorySnapshot(ctrl, memory, activeAliases)} 0) ${emit}))`, continues: false };
        }
        case "If": {
          const condition = expression(node.condition), arms = temp("arms"), savedCtrl = temp("if_ctrl"), savedMemory = temp("if_memory");
          const changed = [...new Set([...assigned(node.then), ...(node.otherwise ? assigned(node.otherwise) : [])])]
            .filter(id => env.has(id));
          const saved = changed.map(id => ({ id, name: temp(`if_saved_${id}`) }));
          const thenCompiled = statement(node.then);
          const otherwiseCompiled = node.otherwise ? statement(node.otherwise) : { code: "0", continues: true };
          const thenCtrl = temp("then_ctrl"), elseCtrl = temp("else_ctrl");
          const thenValues = changed.map(id => ({ id, name: temp(`then_${id}`) }));
          const restoreSaved = saved.map(value => `(store! ${symbolVar(value.id)} ${value.name})`).join(" ");
          const captureThen = thenValues.map(value => `${value.name} (load ${symbolVar(value.id)})`).join(" ");
          const prefix = `(let [${savedCtrl} (load ${ctrl}) ${savedMemory} (load ${memory}) ${saved.map(value => `${value.name} (load ${symbolVar(value.id)})`).join(" ")} ${arms} (n-if-arms! (fe-peep (n-new2 OP-IF 0 ${savedCtrl} ${condition.code})))] (do (store! ${ctrl} (arms-t ${arms})) ${thenCompiled.code}`;
          if (!thenCompiled.continues && !otherwiseCompiled.continues)
            return { code: `${prefix} (store! ${memory} ${savedMemory}) (store! ${ctrl} (arms-f ${arms})) ${restoreSaved} ${otherwiseCompiled.code} 0))`, continues: false };
          if (!thenCompiled.continues)
            return { code: `${prefix} (store! ${memory} ${savedMemory}) (store! ${ctrl} (arms-f ${arms})) ${restoreSaved} ${otherwiseCompiled.code} 0))`, continues: true };
          if (!otherwiseCompiled.continues)
            return { code: `${prefix} (let [${thenCtrl} (load ${ctrl}) ${captureThen}] (do (store! ${memory} ${savedMemory}) (store! ${ctrl} (arms-f ${arms})) ${restoreSaved} ${otherwiseCompiled.code} (store! ${ctrl} ${thenCtrl}) ${thenValues.map(value => `(store! ${symbolVar(value.id)} ${value.name})`).join(" ")} 0)) 0))`, continues: true };
          const region = temp("if_region");
          const valuePhis = changed.map(id => ({ id, name: temp(`if_phi_${id}`) }));
          const memoryPhis = activeAliases.map(alias => ({ alias, name: temp("if_mem_phi"), left: temp("if_left_mem"), right: temp("if_right_mem") }));
          const phiBindings = [
            ...valuePhis.map(phi => `${phi.name} (n-new OP-PHI ${coilType(env.get(phi.id))})`),
            ...memoryPhis.flatMap(phi => [`${phi.left} (fe-memory ${thenCtrl} ${phi.alias.variable})`, `${phi.right} (fe-memory ${elseCtrl} ${phi.alias.variable})`, `${phi.name} (n-new OP-PHI (t-mem-alias ${phi.alias.variable} (t-undef)))`]),
          ].join(" ");
          const fillPhis = [
            ...valuePhis.map((phi, index) => `(n-add-def! ${phi.name} ${region}) (n-add-def! ${phi.name} ${thenValues[index].name}) (n-add-def! ${phi.name} (load ${symbolVar(phi.id)})) (store! ${symbolVar(phi.id)} ${phi.name})`),
            ...memoryPhis.map(phi => `(n-add-def! ${phi.name} ${region}) (n-add-def! ${phi.name} ${phi.left}) (n-add-def! ${phi.name} ${phi.right})`),
          ].join(" ");
          const publishMemory = memoryPhis.length
            ? `(let [merged (stack (array i64 ${memoryPhis.length}))] (do ${memoryPhis.map((phi, index) => `(store! (index merged ${index}) ${phi.name})`).join(" ")} (store! ${memory} (fe-merge! (cast (ptr i64) merged) ${memoryPhis.length}))))`
            : `(store! ${memory} ${savedMemory})`;
          return { code: `${prefix} (let [${thenCtrl} (load ${ctrl}) ${captureThen}] (do (store! ${memory} ${savedMemory}) (store! ${ctrl} (arms-f ${arms})) ${restoreSaved} ${otherwiseCompiled.code} (let [${elseCtrl} (load ${ctrl}) ${region} (n-new OP-REGION 0)] (do (n-add-def! ${region} NO-NODE) (n-add-def! ${region} ${thenCtrl}) (n-add-def! ${region} ${elseCtrl}) (let [${phiBindings}] (do ${fillPhis} ${publishMemory} (store! ${ctrl} ${region}) 0)))))) 0))`, continues: true };
        }
        case "While": {
          const carried = [...assigned(node.body)].filter(id => env.has(id));
          const loop = temp("loop"), arms = temp("loop_arms");
          const phis = carried.map(id => ({ id, name: temp(`phi_${id}`) }));
          const setup = phis.map(phi => `(n-add-def! ${phi.name} ${loop}) (n-add-def! ${phi.name} (load ${symbolVar(phi.id)})) (n-add-def! ${phi.name} NO-NODE) (store! ${symbolVar(phi.id)} ${phi.name})`).join(" ");
          const condition = expression(node.condition);
          const body = statement(node.body);
          if (!body.continues) throw new Error(`loop body return is not yet lowered at ${node.range.file}:${node.range.start.line}`);
          const back = phis.map(phi => `(n-set-def! ${phi.name} 2 (load ${symbolVar(phi.id)}))`).join(" ");
          const restore = phis.map(phi => `(store! ${symbolVar(phi.id)} ${phi.name})`).join(" ");
          return { code: `(let [${loop} (n-new OP-LOOP 0)] (do (n-add-def! ${loop} NO-NODE) (n-add-def! ${loop} (load ${ctrl})) (n-add-def! ${loop} NO-NODE) (let [${phis.map(phi => `${phi.name} (n-new OP-PHI (t-int))`).join(" ")}] (do ${setup} (store! ${ctrl} ${loop}) (let [${arms} (n-if-arms! (fe-peep (n-new2 OP-IF 0 ${loop} ${condition.code})))] (do (store! ${ctrl} (arms-t ${arms})) ${body.code} ${back} (n-set-def! ${loop} 2 (load ${ctrl})) ${restore} (store! ${ctrl} (arms-f ${arms})) 0))))))`, continues: true };
        }
        case "For": {
          const initialized = statement(node.initialize);
          const loopBody = { kind: "Block", statements: [
            ...(node.body.kind === "Block" ? node.body.statements : [node.body]),
            { kind: "Expression", value: node.increment, range: node.increment.range },
          ], range: node.body.range };
          const loop = statement({ kind: "While", condition: node.condition, body: loopBody, range: node.range });
          return { code: `(do ${initialized.code} ${loop.code} 0)`, continues: initialized.continues && loop.continues };
        }
        default: throw new Error(`unhandled Coil statement ${node.kind}`);
      }
    };

    const localBindings = locals.map(local => `(mut ${symbolVar(local.symbol.id)}) NO-NODE`).join(" ");
    const paramBindings = topLevel ? "" : fn.parameters.map((parameter, index) => `(mut ${symbolVar(parameter.symbol.id)}) (n-parm! ${fun} ${index})`).join(" ");
    const body = statement(fn.body);
    if (body.continues) throw new Error(`function ${fn.symbol.name} can fall through`);
    return `(let [(mut ${ctrl}) ${topLevel ? "(g-start)" : `(n-fun-entry ${fun})`} (mut ${memory}) NO-NODE (mut ${firstReturn}) NO-NODE ${paramBindings} ${localBindings}] ${body.code})`;
  }

  const nonMain = program.functions.filter(fn => fn.symbol.id !== program.entry);
  const main = functions.get(program.entry);
  const shapeBindings = [];
  for (const declaration of objectTypes) {
    const layout = resolve(declaration.type);
    let prior = "SHAPE-ROOT";
    layout.fields.forEach((field, index) => {
      const step = `${shapeVar(declaration.name)}_${index}`;
      shapeBindings.push(`${step} (shape-transition ${prior} ${q(field.name)} ${coilType(field.type)})`);
      prior = step;
    });
    shapeBindings.push(`${shapeVar(declaration.name)} ${prior}`);
    layout.fields.forEach((field, index) => shapeBindings.push(`${aliasVar(declaration.name, field.name)} (shape-field-alias ${shapeVar(declaration.name)} ${index})`));
  }
  const functionBindings = [
    ...nonMain.map(fn => `${functionVar(fn.symbol.id)} (n-fun-open! ${fn.symbol.id})`),
    ...main.parameters.map(parameter => `(mut ${symbolVar(parameter.symbol.id)}) (n-new1 OP-ARG ${coilType(parameter.type)} (g-start))`),
  ].join(" ");
  const bodies = nonMain.map(fn => compileFunction(fn, false)).join(" ");
  const mainBody = compileFunction(main, true);
  return `;; Generated from normalized frontend IR. Do not hand edit.\n(module ${safe(moduleName)})\n\n(import "ty" :use *)\n(import "node" :use *)\n(import "shape" :use *)\n(import "verify" :use *)\n(import "coil.alloc" :use *)\n(import "coil.slice" :use *)\n\n(defn fe-optimize-ptr [] (-> (ptr bool)) (let [enabled (static bool)] enabled))\n(defn fe-peep [(node i64)] (-> i64) (if (load (fe-optimize-ptr)) (n-peephole node) node))\n(defn fe-const [(value i64)] (-> i64) (n-new1 OP-CONST (t-int-con value) (g-start)))\n(defn fe-null [] (-> i64) (n-new1 OP-CONST (t-null) (g-start)))\n(defn fe-bin [(op i64) (left i64) (right i64)] (-> i64) (fe-peep (n-new3 op 0 NO-NODE left right)))\n(defn fe-memory [(ctrl i64) (alias i64)] (-> i64) (n-new1 OP-ARG (t-mem-alias alias (t-undef)) ctrl))\n(defn fe-merge! [(memories (ptr i64)) (count i64)] (-> i64)\n  (let [merge (n-new OP-MEMMERGE 0) (mut index) 0]\n    (n-add-def! merge NO-NODE)\n    (loop (if (>= (load index) count) (break) (do (n-add-def! merge (load (index memories (load index)))) (store! index (+ (load index) 1)) 0)))\n    (fe-peep merge)))\n(defn fe-add-return! [(fun i64) (first (ptr i64)) (ctrl i64) (value i64) (memory i64)] (-> i64)\n  (let [ret (if (= memory NO-NODE) (n-new2 OP-RETURN 0 ctrl value) (n-new3 OP-RETURN 0 ctrl value memory))]\n    (if (= (load first) NO-NODE) (do (n-fun-close! fun ret) (store! first ret)) (n-fun-add-return! fun ret)) ret))\n\n(defn frontend-build! [(seed i64) (optimize bool)] (-> i64)\n  (graph-reset! seed) (shape-reset!) (store! (fe-optimize-ptr) optimize)\n  (let [${shapeBindings.join(" ")} ${functionBindings}]\n    ${bodies}\n    ${mainBody}\n    (g-analyze!)\n    ${symbolVar(main.parameters[0].symbol.id)}))\n`;
}

function safe(name) {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}
// Independent normalized-IR oracle only. Product compilation is Coil-owned via tools/aot-compile.mjs.
