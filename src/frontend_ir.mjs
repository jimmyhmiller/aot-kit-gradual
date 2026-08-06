// Independent npm-TypeScript oracle only. Product compilation uses tools/aot-compile.mjs.
import ts from "typescript";

export class FrontendDiagnostic extends Error {
  constructor(code, message, range) {
    super(`${code}: ${message} at ${range.file}:${range.start.line}:${range.start.column}`);
    this.name = "FrontendDiagnostic";
    this.code = code;
    this.range = range;
  }
}

const location = (source, position) => {
  const at = source.getLineAndCharacterOfPosition(position);
  return { offset: position, line: at.line + 1, column: at.character + 1 };
};

const rangeOf = (source, node) => ({
  file: source.fileName,
  start: location(source, node.getStart(source)),
  end: location(source, node.getEnd()),
});

const syntaxName = node => ts.SyntaxKind[node.kind] ?? `syntax kind ${node.kind}`;

export function normalizeTypeScript(sourceText, fileName = "input.ts") {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const parseErrors = source.parseDiagnostics ?? [];
  if (parseErrors.length) {
    const diagnostic = parseErrors[0];
    const start = diagnostic.start ?? 0;
    throw new FrontendDiagnostic(
      "FE_PARSE",
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      { file: fileName, start: location(source, start), end: location(source, start + (diagnostic.length ?? 0)) },
    );
  }

  let nextSymbol = 0;
  const functions = new Map();
  const declarations = source.statements.filter(ts.isFunctionDeclaration);
  for (const declaration of declarations) {
    if (!declaration.name || !declaration.body)
      throw unsupported(source, declaration, "only named function definitions are supported");
    const name = declaration.name.text;
    if (functions.has(name)) throw diagnostic(source, declaration.name, "FE_DUPLICATE", `duplicate function ${name}`);
    functions.set(name, { id: nextSymbol++, name, declaration });
  }
  for (const statement of source.statements) {
    if (!ts.isFunctionDeclaration(statement) && !ts.isInterfaceDeclaration(statement) &&
        !ts.isTypeAliasDeclaration(statement))
      throw unsupported(source, statement, "top level supports only functions and type declarations");
  }
  if (!functions.has("main"))
    throw new FrontendDiagnostic("FE_NO_MAIN", "program must define function main", rangeOf(source, source));

  const lowerType = node => {
    if (!node) return { kind: "dynamic" };
    if (node.kind === ts.SyntaxKind.NumberKeyword) return { kind: "number" };
    if (node.kind === ts.SyntaxKind.BooleanKeyword) return { kind: "boolean" };
    if (node.kind === ts.SyntaxKind.StringKeyword) return { kind: "string" };
    if (node.kind === ts.SyntaxKind.NullKeyword ||
        (ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.NullKeyword))
      return { kind: "null" };
    if (node.kind === ts.SyntaxKind.VoidKeyword) return { kind: "void" };
    if (node.kind === ts.SyntaxKind.AnyKeyword || node.kind === ts.SyntaxKind.UnknownKeyword)
      return { kind: "dynamic" };
    if (ts.isUnionTypeNode(node)) return { kind: "union", members: node.types.map(lowerType) };
    if (ts.isTypeLiteralNode(node)) {
      return {
        kind: "object",
        fields: node.members.map(member => {
          if (!ts.isPropertySignature(member) || !member.type || !member.name ||
              (!ts.isIdentifier(member.name) && !ts.isStringLiteral(member.name)))
            throw unsupported(source, member, "object types support named required fields");
          return { name: member.name.text, type: lowerType(member.type), range: rangeOf(source, member) };
        }),
      };
    }
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName))
      return { kind: "named", name: node.typeName.text };
    throw unsupported(source, node, `unsupported type ${syntaxName(node)}`);
  };

  const types = source.statements.filter(statement =>
    ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)).map(declaration => {
    let type;
    if (ts.isTypeAliasDeclaration(declaration)) type = lowerType(declaration.type);
    else {
      type = {
        kind: "object",
        fields: declaration.members.map(member => {
          if (!ts.isPropertySignature(member) || !member.type || !member.name ||
              (!ts.isIdentifier(member.name) && !ts.isStringLiteral(member.name)))
            throw unsupported(source, member, "interfaces support named required fields");
          return { name: member.name.text, type: lowerType(member.type), range: rangeOf(source, member) };
        }),
      };
    }
    return { name: declaration.name.text, type, range: rangeOf(source, declaration) };
  });
  if (new Set(types.map(type => type.name)).size !== types.length)
    throw new FrontendDiagnostic("FE_DUPLICATE", "duplicate type declaration", rangeOf(source, source));

  const outputFunctions = [];
  for (const entry of functions.values()) {
    const declaration = entry.declaration;
    const scopes = [new Map()];
    const declare = (name, node, role) => {
      const scope = scopes.at(-1);
      if (scope.has(name)) throw diagnostic(source, node, "FE_DUPLICATE", `duplicate ${role} ${name}`);
      const symbol = { id: nextSymbol++, name, role };
      scope.set(name, symbol);
      return symbol;
    };
    const resolve = node => {
      const name = node.text;
      for (let i = scopes.length - 1; i >= 0; --i) if (scopes[i].has(name)) return scopes[i].get(name);
      if (functions.has(name)) return { ...functions.get(name), role: "function" };
      throw diagnostic(source, node, "FE_UNBOUND", `unbound name ${name}`);
    };
    const parameters = declaration.parameters.map(parameter => {
      if (!ts.isIdentifier(parameter.name) || parameter.dotDotDotToken || parameter.questionToken || parameter.initializer)
        throw unsupported(source, parameter, "parameters must be required identifiers");
      const symbol = declare(parameter.name.text, parameter.name, "parameter");
      return { symbol, type: lowerType(parameter.type), range: rangeOf(source, parameter) };
    });

    const expression = node => {
      const range = rangeOf(source, node);
      if (ts.isIdentifier(node)) return { kind: "Name", symbol: resolve(node), range };
      if (ts.isNumericLiteral(node)) return { kind: "Literal", value: Number(node.text), range };
      if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
        return { kind: "Literal", value: node.kind === ts.SyntaxKind.TrueKeyword, range };
      if (node.kind === ts.SyntaxKind.NullKeyword) return { kind: "Literal", value: null, range };
      if (ts.isParenthesizedExpression(node)) return expression(node.expression);
      if (ts.isPrefixUnaryExpression(node)) {
        if (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) {
          const target = expression(node.operand);
          if (!["Name", "Field", "Element"].includes(target.kind))
            throw unsupported(source, node.operand, "update target must be a name, field, or element");
          return { kind: "Update", operator: node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
            prefix: true, target, range };
        }
        const operators = new Map([[ts.SyntaxKind.ExclamationToken, "!"], [ts.SyntaxKind.MinusToken, "-"],
          [ts.SyntaxKind.PlusToken, "+"], [ts.SyntaxKind.TildeToken, "~"]]);
        if (!operators.has(node.operator)) throw unsupported(source, node, "unsupported unary operator");
        return { kind: "Unary", operator: operators.get(node.operator), value: expression(node.operand), range };
      }
      if (ts.isPostfixUnaryExpression(node)) {
        const target = expression(node.operand);
        if (!["Name", "Field", "Element"].includes(target.kind))
          throw unsupported(source, node.operand, "update target must be a name, field, or element");
        return { kind: "Update", operator: node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
          prefix: false, target, range };
      }
      if (ts.isConditionalExpression(node)) return { kind: "Conditional", condition: expression(node.condition),
        then: expression(node.whenTrue), otherwise: expression(node.whenFalse), range };
      if (ts.isBinaryExpression(node)) {
        const operator = node.operatorToken.getText(source);
        const supported = new Set([
          "+", "-", "*", "/", "%", "&", "|", "^", "<<", ">>", ">>>",
          "<", "<=", ">", ">=", "===", "!==", "=",
          "&&", "||", ",",
          "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>=", ">>>=",
        ]);
        if (!supported.has(operator)) throw unsupported(source, node.operatorToken, `unsupported operator ${operator}`);
        const left = expression(node.left);
        if (operator.endsWith("=") && !["===", "!==", "<=", ">="].includes(operator) &&
            left.kind !== "Name" && left.kind !== "Field" && left.kind !== "Element")
          throw unsupported(source, node.left, "assignment target must be a name, field, or element");
        return { kind: "Binary", operator, left, right: expression(node.right), range };
      }
      if (ts.isCallExpression(node)) {
        if (!ts.isIdentifier(node.expression)) throw unsupported(source, node.expression, "only direct calls are supported");
        const callee = resolve(node.expression);
        if (callee.role !== "function") throw diagnostic(source, node.expression, "FE_NOT_CALLABLE", `${callee.name} is not a function`);
        const expected = callee.declaration.parameters.length;
        if (node.arguments.length !== expected)
          throw diagnostic(source, node, "FE_ARITY", `${callee.name} expects ${expected} arguments, got ${node.arguments.length}`);
        return { kind: "Call", callee: { id: callee.id, name: callee.name }, args: node.arguments.map(expression), range };
      }
      if (ts.isNewExpression(node)) {
        if (!ts.isIdentifier(node.expression)) throw unsupported(source, node.expression, "constructor must be a direct name");
        const callee = resolve(node.expression);
        const args = node.arguments ? [...node.arguments] : [];
        if (callee.role !== "function") throw diagnostic(source, node.expression, "FE_NOT_CALLABLE", `${callee.name} is not a constructor function`);
        if (args.length !== callee.declaration.parameters.length)
          throw diagnostic(source, node, "FE_ARITY", `${callee.name} expects ${callee.declaration.parameters.length} arguments, got ${args.length}`);
        return { kind: "Construct", callee: { id: callee.id, name: callee.name }, args: args.map(expression), range };
      }
      if (ts.isPropertyAccessExpression(node))
        return { kind: "Field", object: expression(node.expression), name: node.name.text, range };
      if (ts.isElementAccessExpression(node) && node.argumentExpression)
        return { kind: "Element", object: expression(node.expression), key: expression(node.argumentExpression), range };
      if (ts.isObjectLiteralExpression(node)) {
        const fields = node.properties.map(property => {
          if (!ts.isPropertyAssignment(property) ||
              (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)))
            throw unsupported(source, property, "object literals support explicit named properties");
          return { name: property.name.text, value: expression(property.initializer), range: rangeOf(source, property) };
        });
        return { kind: "Object", fields, range };
      }
      throw unsupported(source, node, `unsupported expression ${syntaxName(node)}`);
    };

    const targets = [];
    const withTarget = (target, build) => { targets.push(target); try { return build(); } finally { targets.pop(); } };
    const resolveTarget = (node, wantsContinue) => {
      const label = node.label?.text ?? null;
      const target = label ? [...targets].reverse().find(entry => entry.label === label)
        : [...targets].reverse().find(entry => wantsContinue ? entry.continue : entry.break);
      if (!target || (wantsContinue && !target.continue))
        throw diagnostic(source, node, "FE_TARGET", `${wantsContinue ? "continue" : "break"} has no legal target${label ? ` ${label}` : ""}`);
      return label;
    };
    const statement = node => {
      const range = rangeOf(source, node);
      if (ts.isBlock(node)) {
        scopes.push(new Map());
        const statements = node.statements.map(statement);
        scopes.pop();
        return { kind: "Block", statements, range };
      }
      if (ts.isVariableStatement(node)) {
        if (node.declarationList.declarations.length !== 1)
          throw unsupported(source, node, "declare one local per statement");
        const local = node.declarationList.declarations[0];
        if (!ts.isIdentifier(local.name) || !local.initializer)
          throw unsupported(source, local, "locals require an identifier and initializer");
        const value = expression(local.initializer);
        const symbol = declare(local.name.text, local.name, "local");
        return { kind: "Let", symbol, mutable: !(node.declarationList.flags & ts.NodeFlags.Const),
          type: lowerType(local.type), value, range };
      }
      if (ts.isExpressionStatement(node)) return { kind: "Expression", value: expression(node.expression), range };
      if (ts.isReturnStatement(node)) {
        if (!node.expression) throw unsupported(source, node, "return requires a value");
        return { kind: "Return", value: expression(node.expression), range };
      }
      if (ts.isIfStatement(node)) return { kind: "If", condition: expression(node.expression),
        then: statement(node.thenStatement), otherwise: node.elseStatement ? statement(node.elseStatement) : null, range };
      if (ts.isWhileStatement(node)) return { kind: "While", condition: expression(node.expression),
        body: withTarget({ label: null, break: true, continue: true }, () => statement(node.statement)), range };
      if (ts.isDoStatement(node)) return { kind: "Do", condition: expression(node.expression),
        body: withTarget({ label: null, break: true, continue: true }, () => statement(node.statement)), range };
      if (ts.isForStatement(node)) {
        if (!node.initializer || !ts.isVariableDeclarationList(node.initializer) ||
            node.initializer.declarations.length !== 1 || !node.condition || !node.incrementor)
          throw unsupported(source, node, "for loops require one local initializer, condition, and increment");
        scopes.push(new Map());
        const synthetic = ts.factory.createVariableStatement(undefined, node.initializer);
        ts.setTextRange(synthetic, node.initializer);
        const initialize = statement(synthetic);
        const result = { kind: "For", initialize, condition: expression(node.condition),
          increment: expression(node.incrementor),
          body: withTarget({ label: null, break: true, continue: true }, () => statement(node.statement)), range };
        scopes.pop();
        return result;
      }
      if (ts.isBreakStatement(node)) return { kind: "Break", label: resolveTarget(node, false), range };
      if (ts.isContinueStatement(node)) return { kind: "Continue", label: resolveTarget(node, true), range };
      if (ts.isLabeledStatement(node)) {
        const label = node.label.text;
        if (targets.some(entry => entry.label === label))
          throw diagnostic(source, node.label, "FE_TARGET", `duplicate active label ${label}`);
        const iteration = ts.isWhileStatement(node.statement) || ts.isDoStatement(node.statement) || ts.isForStatement(node.statement);
        return { kind: "Labeled", label,
          body: withTarget({ label, break: true, continue: iteration }, () => statement(node.statement)), range };
      }
      if (ts.isSwitchStatement(node)) {
        const clauses = withTarget({ label: null, break: true, continue: false }, () =>
          node.caseBlock.clauses.map(clause => ({ kind: ts.isCaseClause(clause) ? "Case" : "Default",
            test: ts.isCaseClause(clause) ? expression(clause.expression) : null,
            statements: clause.statements.map(statement), range: rangeOf(source, clause) })));
        return { kind: "Switch", value: expression(node.expression), clauses, range };
      }
      throw unsupported(source, node, `unsupported statement ${syntaxName(node)}`);
    };

    outputFunctions.push({
      kind: "Function",
      symbol: { id: entry.id, name: entry.name, role: "function" },
      parameters,
      result: lowerType(declaration.type),
      body: statement(declaration.body),
      range: rangeOf(source, declaration),
    });
  }
  return { kind: "Program", file: fileName, entry: functions.get("main").id, types, functions: outputFunctions };
}

export function executeNormalized(program, args) {
  const functions = new Map(program.functions.map(fn => [fn.symbol.id, fn]));
  const returned = Symbol("returned");
  const broken = Symbol("broken"), continued = Symbol("continued");
  const invoke = (functionId, values) => {
    const fn = functions.get(functionId);
    if (!fn || values.length !== fn.parameters.length) throw new Error(`invalid normalized call ${functionId}`);
    const bindings = new Map(fn.parameters.map((parameter, index) => [parameter.symbol.id, values[index]]));
    const evaluate = expression => {
      switch (expression.kind) {
        case "Name": return bindings.get(expression.symbol.id);
        case "Literal": return expression.value;
        case "Unary": {
          const value = evaluate(expression.value);
          if (expression.operator === "!") return !value;
          if (expression.operator === "-") return -value;
          if (expression.operator === "~") return ~value;
          return +value;
        }
        case "Update": {
          const ref = reference(expression.target);
          const old = ref.get();
          const value = expression.operator === "++" ? old + 1 : old - 1;
          ref.set(value);
          return expression.prefix ? value : old;
        }
        case "Conditional": return evaluate(expression.condition) ? evaluate(expression.then) : evaluate(expression.otherwise);
        case "Call": return invoke(expression.callee.id, expression.args.map(evaluate));
        case "Construct": return invoke(expression.callee.id, expression.args.map(evaluate));
        case "Field": return evaluate(expression.object)[expression.name];
        case "Element": return evaluate(expression.object)[evaluate(expression.key)];
        case "Object": return Object.fromEntries(expression.fields.map(field => [field.name, evaluate(field.value)]));
        case "Binary": {
          if (expression.operator === "&&") {
            const left = evaluate(expression.left);
            return left ? evaluate(expression.right) : left;
          }
          if (expression.operator === "||") {
            const left = evaluate(expression.left);
            return left ? left : evaluate(expression.right);
          }
          const compounds = new Map([
            ["+=", (a, b) => a + b], ["-=", (a, b) => a - b],
            ["*=", (a, b) => a * b], ["/=", (a, b) => a / b], ["%=", (a, b) => a % b],
            ["&=", (a, b) => a & b], ["|=", (a, b) => a | b], ["^=", (a, b) => a ^ b],
            ["<<=", (a, b) => a << b], [">>=", (a, b) => a >> b], [">>>=", (a, b) => a >>> b],
          ]);
          if (expression.operator === "=" || compounds.has(expression.operator)) {
            const ref = reference(expression.left);
            const current = expression.operator === "=" ? undefined : ref.get();
            const right = evaluate(expression.right);
            const value = expression.operator === "=" ? right : compounds.get(expression.operator)(current, right);
            ref.set(value);
            return value;
          }
          const left = evaluate(expression.left), right = evaluate(expression.right);
          if (expression.operator === ",") return right;
          return ({
            "+": () => left + right, "-": () => left - right, "*": () => left * right,
            "/": () => left / right, "%": () => left % right,
            "&": () => left & right, "|": () => left | right, "^": () => left ^ right,
            "<<": () => left << right, ">>": () => left >> right, ">>>": () => left >>> right,
            "<": () => left < right, "<=": () => left <= right,
            ">": () => left > right, ">=": () => left >= right, "===": () => left === right,
            "!==": () => left !== right,
          })[expression.operator]();
        }
        default: throw new Error(`unhandled normalized expression ${expression.kind}`);
      }
    };
    const reference = target => {
      if (target.kind === "Name") return {
        get: () => bindings.get(target.symbol.id),
        set: value => bindings.set(target.symbol.id, value),
      };
      if (target.kind === "Field") {
        const object = evaluate(target.object);
        return { get: () => object[target.name], set: value => { object[target.name] = value; } };
      }
      if (target.kind === "Element") {
        const object = evaluate(target.object), key = evaluate(target.key);
        return { get: () => object[key], set: value => { object[key] = value; } };
      }
      throw new Error(`invalid assignment target ${target.kind}`);
    };
    const execute = (statement, attachedLabel = null) => {
      switch (statement.kind) {
        case "Block":
          for (const child of statement.statements) { const result = execute(child); if (result) return result; }
          return null;
        case "Let": bindings.set(statement.symbol.id, evaluate(statement.value)); return null;
        case "Expression": evaluate(statement.value); return null;
        case "Return": return { tag: returned, value: evaluate(statement.value) };
        case "If": return evaluate(statement.condition) ? execute(statement.then) : statement.otherwise ? execute(statement.otherwise) : null;
        case "Break": return { tag: broken, label: statement.label };
        case "Continue": return { tag: continued, label: statement.label };
        case "Labeled": {
          const result = execute(statement.body, statement.label);
          return result?.tag === broken && result.label === statement.label ? null : result;
        }
        case "While": {
          while (evaluate(statement.condition)) {
            const result = execute(statement.body);
            if (result?.tag === broken && (result.label === null || result.label === attachedLabel)) break;
            if (result?.tag === continued && (result.label === null || result.label === attachedLabel)) continue;
            if (result) return result;
          }
          return null;
        }
        case "Do": {
          do {
            const result = execute(statement.body);
            if (result?.tag === broken && (result.label === null || result.label === attachedLabel)) break;
            if (result && !(result.tag === continued && (result.label === null || result.label === attachedLabel))) return result;
          } while (evaluate(statement.condition));
          return null;
        }
        case "For": {
          let result = execute(statement.initialize);
          if (result) return result;
          while (evaluate(statement.condition)) {
            result = execute(statement.body);
            if (result?.tag === broken && (result.label === null || result.label === attachedLabel)) break;
            if (result && !(result.tag === continued && (result.label === null || result.label === attachedLabel))) return result;
            evaluate(statement.increment);
          }
          return null;
        }
        case "Switch": {
          const selected = evaluate(statement.value);
          let start = -1, fallback = -1;
          for (let index = 0; index < statement.clauses.length; index++) {
            const clause = statement.clauses[index];
            if (clause.test === null) fallback = index;
            else if (start < 0 && selected === evaluate(clause.test)) start = index;
          }
          if (start < 0) start = fallback;
          for (let index = start; index >= 0 && index < statement.clauses.length; index++) {
            for (const child of statement.clauses[index].statements) {
              const result = execute(child);
              if (result?.tag === broken && (result.label === null || result.label === attachedLabel)) return null;
              if (result) return result;
            }
          }
          return null;
        }
        default: throw new Error(`unhandled normalized statement ${statement.kind}`);
      }
    };
    const result = execute(fn.body);
    if (!result || result.tag !== returned) throw new Error(`function ${fn.symbol.name} did not return`);
    return result.value;
  };
  return invoke(program.entry, args);
}

function diagnostic(source, node, code, message) {
  return new FrontendDiagnostic(code, message, rangeOf(source, node));
}

function unsupported(source, node, message) {
  return diagnostic(source, node, "FE_UNSUPPORTED", message);
}
