#include "aot_typescript.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void fail(const char *message) { fprintf(stderr, "B01 ABI failure: %s\n", message); exit(1); }
static void require(int condition, const char *message) { if (!condition) fail(message); }

static char *read_file(const char *name, int32_t *length) {
  FILE *file = fopen(name, "rb"); if (!file) fail("cannot open corpus file");
  fseek(file, 0, SEEK_END); long size = ftell(file); rewind(file);
  char *bytes = malloc((size_t)size + 1); if (!bytes) fail("allocation");
  require(fread(bytes, 1, (size_t)size, file) == (size_t)size, "short corpus read");
  fclose(file); bytes[size] = 0; *length = (int32_t)size; return bytes;
}

static void name(AotTsParse parse, AotTsNode node, char *buffer, int32_t capacity) {
  require(aot_ts_node_kind_name(parse, node, buffer, capacity) >= 0, "kind name query");
}

static AotTsNode find_kind(AotTsParse parse, const char *wanted, int require_argument) {
  char kind[96];
  int32_t count = aot_ts_node_count(parse);
  for (int32_t node = 0; node < count; node++) {
    name(parse, node, kind, sizeof(kind));
    if (!strcmp(kind, wanted) && (!require_argument || aot_ts_node_role(parse, node, AOT_TS_ROLE_ARGUMENT, 0) >= 0)) return node;
  }
  return -1;
}

static AotTsNode find_kind_with_role(AotTsParse parse, const char *wanted, int role) {
  char kind[96]; int32_t count = aot_ts_node_count(parse);
  for (int32_t node = 0; node < count; node++) {
    name(parse, node, kind, sizeof(kind));
    if (!strcmp(kind, wanted) && aot_ts_node_role(parse, node, role, 0) >= 0) return node;
  }
  return -1;
}

static AotTsNode find_operator(AotTsParse parse, const char *wanted) {
  char operator_name[64]; int32_t count = aot_ts_node_count(parse);
  for (int32_t node = 0; node < count; node++) {
    if (aot_ts_node_operator_name(parse, node, operator_name, sizeof(operator_name)) >= 0 && !strcmp(operator_name, wanted)) return node;
  }
  return -1;
}

int main(int argc, char **argv) {
  require(argc == 10, "expected corpus directory and eight files");
  int corpus_mode = getenv("AOT_B01_FORCE_TS") ? AOT_TS_SCRIPT_TS : AOT_TS_SCRIPT_JS;
  int callee_role = getenv("AOT_B01_SWAP_CALL_ROLES") ? AOT_TS_ROLE_ARGUMENT : AOT_TS_ROLE_CALLEE;
  int argument_role = getenv("AOT_B01_SWAP_CALL_ROLES") ? AOT_TS_ROLE_CALLEE : AOT_TS_ROLE_ARGUMENT;
  printf("{\"schemaVersion\":1,\"benchmarks\":[");
  for (int file_index = 2; file_index < argc; file_index++) {
    char filename[1024]; snprintf(filename, sizeof(filename), "%s/%s", argv[1], argv[file_index]);
    int32_t length; char *source = read_file(filename, &length);
    AotTsParse parse = aot_ts_parse_ex(source, length, filename, (int32_t)strlen(filename), corpus_mode);
    require(parse != 0 && aot_ts_script_kind(parse) == AOT_TS_SCRIPT_JS, "explicit JavaScript mode");
    require(aot_ts_root(parse) == 0 && aot_ts_node_count(parse) > 100, "root and node count");

    char tiny[4] = {'x','x','x','x'}; int32_t required = aot_ts_node_kind_name(parse, 0, tiny, sizeof(tiny));
    require(required == 10 && tiny[3] == 0 && !memcmp(tiny, "Sou", 3), "bounded kind-name buffer");
    AotTsNode binary = find_kind(parse, "BinaryExpression", 0);
    require(binary >= 0, "binary representative");
    require(aot_ts_node_role(parse, binary, AOT_TS_ROLE_LEFT, 0) >= 0, "binary left role");
    require(aot_ts_node_role(parse, binary, AOT_TS_ROLE_OPERATOR, 0) >= 0, "binary operator role");
    require(aot_ts_node_role(parse, binary, AOT_TS_ROLE_RIGHT, 0) >= 0, "binary right role");
    char operator_name[64]; require(aot_ts_node_operator_name(parse, binary, operator_name, sizeof(operator_name)) > 0, "operator name");

    AotTsNode call = find_kind(parse, "CallExpression", 1);
    require(call >= 0, "call representative with argument");
    AotTsNode callee = aot_ts_node_role(parse, call, callee_role, 0);
    AotTsNode argument = aot_ts_node_role(parse, call, argument_role, 0);
    require(callee >= 0 && argument >= 0 && callee != argument, "named call roles");
    require(aot_ts_node_start(parse, callee) < aot_ts_node_start(parse, argument), "callee role precedes first argument");
    require(aot_ts_node_role(parse, call, AOT_TS_ROLE_ARGUMENT, 1000000) == -1, "bounded list role");
    require(aot_ts_node_role(parse, call, 999, 0) == -1, "invalid role");

    AotTsNode function = find_kind_with_role(parse, "FunctionDeclaration", AOT_TS_ROLE_PARAMETER);
    if (function < 0) function = find_kind_with_role(parse, "FunctionExpression", AOT_TS_ROLE_PARAMETER);
    require(function >= 0 && aot_ts_node_role(parse, function, AOT_TS_ROLE_BODY, 0) >= 0, "function body and parameter roles");
    AotTsNode declaration = find_kind_with_role(parse, "VariableDeclaration", AOT_TS_ROLE_INITIALIZER);
    require(declaration >= 0 && aot_ts_node_role(parse, declaration, AOT_TS_ROLE_NAME, 0) >= 0, "declaration name and initializer roles");
    AotTsNode property = find_kind(parse, "PropertyAccessExpression", 0);
    require(property >= 0 && aot_ts_node_role(parse, property, AOT_TS_ROLE_OBJECT, 0) >= 0 &&
      aot_ts_node_role(parse, property, AOT_TS_ROLE_PROPERTY, 0) >= 0, "member object and property roles");

    AotTsNode string = find_kind(parse, "StringLiteral", 0);
    AotTsNode number = find_kind(parse, "NumericLiteral", 0);
    require(string >= 0 && aot_ts_node_literal_kind(parse, string) == AOT_TS_LITERAL_STRING, "string literal category");
    require(number >= 0 && aot_ts_node_literal_kind(parse, number) == AOT_TS_LITERAL_NUMBER, "number literal category");
    char literal[128]; require(aot_ts_node_literal_text(parse, string, literal, sizeof(literal)) >= 0, "literal text");

    int diagnostics = aot_ts_diagnostic_count(parse);
    printf("%s{\"file\":\"%s\",\"nodes\":%d,\"diagnostics\":%d,\"operator\":\"%s\"}",
      file_index == 2 ? "" : ",", argv[file_index], aot_ts_node_count(parse), diagnostics, operator_name);
    aot_ts_parse_delete(parse); free(source);
  }
  printf("]}\n");

  const char *typed = "const typed: number = 1;";
  AotTsParse js = aot_ts_parse_ex(typed, (int32_t)strlen(typed), "mode.js", 7, AOT_TS_SCRIPT_JS);
  AotTsParse ts = aot_ts_parse_ex(typed, (int32_t)strlen(typed), "mode.ts", 7, AOT_TS_SCRIPT_TS);
  require(aot_ts_diagnostic_count(js) > 0 && aot_ts_diagnostic_count(ts) == 0, "TS-only syntax rejected in JS mode");
  require(aot_ts_script_kind(js) == AOT_TS_SCRIPT_JS && aot_ts_script_kind(ts) == AOT_TS_SCRIPT_TS, "mode retained");
  aot_ts_parse_delete(js); aot_ts_parse_delete(ts);

  const char *strict_early_errors = "\"use strict\"; with ({}) {} delete ((identifier));";
  AotTsParse strict_parse = aot_ts_parse_ex(strict_early_errors,
    (int32_t)strlen(strict_early_errors), "strict.js", 9, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(strict_parse) >= 2,
    "strict with and parenthesized identifier delete rejected");
  aot_ts_parse_delete(strict_parse);

  const char *optional_tag = "const a = {}; a?.fn`hello`;";
  AotTsParse optional_tag_parse = aot_ts_parse_ex(optional_tag,
    (int32_t)strlen(optional_tag), "optional-tag.js", 15, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(optional_tag_parse) > 0,
    "optional chain cannot be a tagged-template tag");
  aot_ts_parse_delete(optional_tag_parse);

  const char *mixed_coalesce = "0 ?? 0 || true;";
  AotTsParse mixed_coalesce_parse = aot_ts_parse_ex(mixed_coalesce,
    (int32_t)strlen(mixed_coalesce), "coalesce.js", 11, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(mixed_coalesce_parse) > 0,
    "unparenthesized coalesce and logical operators rejected");
  aot_ts_parse_delete(mixed_coalesce_parse);
  const char *grouped_coalesce = "(0 ?? 0) || true;";
  AotTsParse grouped_coalesce_parse = aot_ts_parse_ex(grouped_coalesce,
    (int32_t)strlen(grouped_coalesce), "grouped.js", 10, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(grouped_coalesce_parse) == 0,
    "parenthesized coalesce and logical operators accepted");
  aot_ts_parse_delete(grouped_coalesce_parse);

  const char *strict_shorthand = "var interface = 1; function f() { \"use strict\"; ({interface}); }";
  AotTsParse strict_shorthand_parse = aot_ts_parse_ex(strict_shorthand,
    (int32_t)strlen(strict_shorthand), "shorthand.js", 12, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(strict_shorthand_parse) > 0,
    "strict reserved shorthand identifier rejected");
  aot_ts_parse_delete(strict_shorthand_parse);
  const char *strict_shorthand_valid = "var eval = 1; function f() { \"use strict\"; ({eval}); }";
  AotTsParse strict_shorthand_valid_parse = aot_ts_parse_ex(strict_shorthand_valid,
    (int32_t)strlen(strict_shorthand_valid), "shorthand-valid.js", 18, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(strict_shorthand_valid_parse) == 0,
    "strict eval shorthand identifier accepted");
  aot_ts_parse_delete(strict_shorthand_valid_parse);

  const char *loop_early_errors = "for (let [x, x] of []) {} for (const y in {}) { var y; }";
  AotTsParse loop_early_parse = aot_ts_parse_ex(loop_early_errors,
    (int32_t)strlen(loop_early_errors), "loop-errors.js", 14, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(loop_early_parse) >= 2,
    "loop duplicate bindings and body var collisions rejected");
  aot_ts_parse_delete(loop_early_parse);
  const char *loop_shadow_valid = "for (let x = 0; x < 1; x++) { function f() { var x; } }";
  AotTsParse loop_shadow_parse = aot_ts_parse_ex(loop_shadow_valid,
    (int32_t)strlen(loop_shadow_valid), "loop-valid.js", 13, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(loop_shadow_parse) == 0,
    "loop binding may be shadowed inside nested function");
  aot_ts_parse_delete(loop_shadow_parse);

  const char *catch_early_errors = "try {} catch ([x, x]) {} try {} catch (y) { let y; }";
  AotTsParse catch_early_parse = aot_ts_parse_ex(catch_early_errors,
    (int32_t)strlen(catch_early_errors), "catch-errors.js", 15, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(catch_early_parse) >= 2,
    "catch duplicate bindings and lexical collisions rejected");
  aot_ts_parse_delete(catch_early_parse);
  const char *catch_var_valid = "try {} catch (x) { var x; }";
  AotTsParse catch_var_parse = aot_ts_parse_ex(catch_var_valid,
    (int32_t)strlen(catch_var_valid), "catch-valid.js", 14, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(catch_var_parse) == 0,
    "catch parameter may be redeclared by var");
  aot_ts_parse_delete(catch_var_parse);

  const char *static_block_errors = "class C { static { let await; super(); yield; "
    "(class { [arguments]() {} }); } }";
  AotTsParse static_block_parse = aot_ts_parse_ex(static_block_errors,
    (int32_t)strlen(static_block_errors), "static-block.js", 15, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(static_block_parse) >= 4,
    "class static block context early errors rejected");
  aot_ts_parse_delete(static_block_parse);
  const char *static_block_valid = "class C { static { function f() { return arguments; } "
    "async function g() { await 0; } class D { m() { return arguments; } } } }";
  AotTsParse static_block_valid_parse = aot_ts_parse_ex(static_block_valid,
    (int32_t)strlen(static_block_valid), "static-block-valid.js", 21, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(static_block_valid_parse) == 0,
    "class static block context stops at nested function bodies");
  aot_ts_parse_delete(static_block_valid_parse);

  const char *private_accessor_mismatch = "class C { get #x() {} static set #x(v) {} }";
  AotTsParse private_accessor_mismatch_parse = aot_ts_parse_ex(private_accessor_mismatch,
    (int32_t)strlen(private_accessor_mismatch), "private-mismatch.js", 19, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(private_accessor_mismatch_parse) > 0,
    "private getter and setter staticness must match");
  aot_ts_parse_delete(private_accessor_mismatch_parse);
  const char *private_accessor_valid = "class C { static get #x() {} static set #x(v) {} }";
  AotTsParse private_accessor_valid_parse = aot_ts_parse_ex(private_accessor_valid,
    (int32_t)strlen(private_accessor_valid), "private-valid.js", 16, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(private_accessor_valid_parse) == 0,
    "matching private getter and setter pair accepted");
  aot_ts_parse_delete(private_accessor_valid_parse);

  const char *strict_directive_assignment = "\"first\"; \"use strict\"; eval = 1;";
  AotTsParse strict_directive_parse = aot_ts_parse_ex(strict_directive_assignment,
    (int32_t)strlen(strict_directive_assignment), "strict-directive.js", 19, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(strict_directive_parse) > 0,
    "strict script directive prologue governs assignment targets");
  aot_ts_parse_delete(strict_directive_parse);
  const char *nested_strict_assignment = "function f() { \"use strict\"; eval = 1; }";
  AotTsParse nested_strict_parse = aot_ts_parse_ex(nested_strict_assignment,
    (int32_t)strlen(nested_strict_assignment), "nested-strict.js", 16, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(nested_strict_parse) > 0,
    "nested strict directive governs assignment targets");
  aot_ts_parse_delete(nested_strict_parse);
  const char *sloppy_eval_assignment = "eval = 1;";
  AotTsParse sloppy_eval_parse = aot_ts_parse_ex(sloppy_eval_assignment,
    (int32_t)strlen(sloppy_eval_assignment), "sloppy.js", 9, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(sloppy_eval_parse) == 0,
    "sloppy eval assignment remains accepted");
  aot_ts_parse_delete(sloppy_eval_parse);

  const char *formal_early_errors = "class C { get x(value = 1) {} m(value = yield) {} }";
  AotTsParse formal_early_parse = aot_ts_parse_ex(formal_early_errors,
    (int32_t)strlen(formal_early_errors), "formal-errors.js", 16, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(formal_early_parse) >= 2,
    "getter arity and strict yield parameter references rejected");
  aot_ts_parse_delete(formal_early_parse);
  const char *sloppy_yield_parameter = "var yield = 1; function f(value = yield) {}";
  AotTsParse sloppy_yield_parameter_parse = aot_ts_parse_ex(sloppy_yield_parameter,
    (int32_t)strlen(sloppy_yield_parameter), "sloppy-yield.js", 15, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(sloppy_yield_parameter_parse) == 0,
    "sloppy yield parameter reference remains accepted");
  aot_ts_parse_delete(sloppy_yield_parameter_parse);

  const char *invalid_execution_context = "new.target; super(); super.x;";
  AotTsParse invalid_execution_parse = aot_ts_parse_ex(invalid_execution_context,
    (int32_t)strlen(invalid_execution_context), "execution-errors.js", 19, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(invalid_execution_parse) >= 3,
    "global new.target and super forms rejected");
  aot_ts_parse_delete(invalid_execution_parse);
  const char *valid_execution_context = "function f() { return new.target; } class B {} "
    "class C extends B { constructor() { super(); return super.x; } }";
  AotTsParse valid_execution_parse = aot_ts_parse_ex(valid_execution_context,
    (int32_t)strlen(valid_execution_context), "execution-valid.js", 18, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(valid_execution_parse) == 0,
    "function new.target and derived-constructor super forms accepted");
  aot_ts_parse_delete(valid_execution_parse);

  const char *script_goal_errors = "import x from './x.js'; export default x; import.meta;";
  AotTsParse script_goal_parse = aot_ts_parse_ex(script_goal_errors,
    (int32_t)strlen(script_goal_errors), "script-goal.js", 14, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(script_goal_parse) >= 3,
    "module-only forms rejected under Script goal");
  aot_ts_parse_delete(script_goal_parse);
  const char *dynamic_import_valid = "import('./x.js');";
  AotTsParse dynamic_import_parse = aot_ts_parse_ex(dynamic_import_valid,
    (int32_t)strlen(dynamic_import_valid), "dynamic-import.js", 17, AOT_TS_SCRIPT_JS);
  require(aot_ts_diagnostic_count(dynamic_import_parse) == 0,
    "dynamic import remains valid under Script goal");
  aot_ts_parse_delete(dynamic_import_parse);

  const char *operators = "var x=1,o={}; x += 2; ++x; x--; typeof x; delete o.x; void (x += 3); o?.x; o?.[x]; x?.(); `plain`; `a${x}b`; (a) => { return a; }; true; null;";
  AotTsParse operator_parse = aot_ts_parse_ex(operators, (int32_t)strlen(operators), "operators.js", 12, AOT_TS_SCRIPT_JS);
  require(find_operator(operator_parse, "PlusEquals") >= 0, "assignment operator API");
  require(find_operator(operator_parse, "PlusPlus") >= 0, "prefix update operator API");
  require(find_operator(operator_parse, "MinusMinus") >= 0, "postfix update operator API");
  require(find_operator(operator_parse, "TypeOfKeyword") >= 0, "dynamic unary operator API");
  require(find_operator(operator_parse, "DeleteKeyword") >= 0, "delete operator API");
  AotTsNode void_expression = find_operator(operator_parse, "VoidKeyword");
  require(void_expression >= 0 && aot_ts_node_role(operator_parse, void_expression, AOT_TS_ROLE_EXPRESSION, 0) >= 0,
    "void operator and operand role API");
  AotTsNode optional_property = find_kind_with_role(operator_parse, "PropertyAccessExpression", AOT_TS_ROLE_OPERATOR);
  AotTsNode optional_element = find_kind_with_role(operator_parse, "ElementAccessExpression", AOT_TS_ROLE_OPERATOR);
  AotTsNode optional_call = find_kind_with_role(operator_parse, "CallExpression", AOT_TS_ROLE_OPERATOR);
  require(optional_property >= 0 && optional_element >= 0 && optional_call >= 0,
    "optional access and call question-dot role API");
  AotTsNode template_literal = find_kind(operator_parse, "NoSubstitutionTemplateLiteral", 0);
  require(template_literal >= 0 && aot_ts_node_literal_kind(operator_parse, template_literal) == AOT_TS_LITERAL_STRING,
    "no-substitution template literal category");
  AotTsNode template_expression = find_kind(operator_parse, "TemplateExpression", 0);
  AotTsNode template_head = find_kind(operator_parse, "TemplateHead", 0);
  AotTsNode template_span = find_kind(operator_parse, "TemplateSpan", 0);
  AotTsNode template_tail = find_kind(operator_parse, "TemplateTail", 0);
  require(template_expression >= 0 && aot_ts_node_kind(operator_parse, template_expression) == 231 &&
          template_span >= 0 && aot_ts_node_kind(operator_parse, template_span) == 232,
    "stable interpolated-template structure");
  require(template_head >= 0 && template_tail >= 0 &&
          aot_ts_node_literal_kind(operator_parse, template_head) == AOT_TS_LITERAL_STRING &&
          aot_ts_node_literal_kind(operator_parse, template_tail) == AOT_TS_LITERAL_STRING,
    "interpolated template cooked literal categories");
  AotTsNode arrow = find_kind_with_role(operator_parse, "ArrowFunction", AOT_TS_ROLE_BODY);
  require(arrow >= 0 && aot_ts_node_kind(operator_parse, arrow) == 220 &&
          aot_ts_node_role(operator_parse, arrow, AOT_TS_ROLE_PARAMETER, 0) >= 0,
    "arrow function has a distinct stable kind and parameter ABI");
  AotTsNode boolean = find_kind(operator_parse, "TrueKeyword", 0);
  AotTsNode null_value = find_kind(operator_parse, "NullKeyword", 0);
  require(boolean >= 0 && aot_ts_node_literal_kind(operator_parse, boolean) == AOT_TS_LITERAL_BOOLEAN, "boolean literal category");
  require(null_value >= 0 && aot_ts_node_literal_kind(operator_parse, null_value) == AOT_TS_LITERAL_NULL, "null literal category");
  aot_ts_parse_delete(operator_parse);

  const char *control_source =
    "outer: do { switch (x) { case 0: x++; continue outer; default: break; } } while (x < 3);";
  AotTsParse control = aot_ts_parse_ex(control_source, (int32_t)strlen(control_source),
    "control.js", 10, AOT_TS_SCRIPT_JS);
  AotTsNode labeled = find_kind(control, "LabeledStatement", 0);
  AotTsNode do_statement = find_kind(control, "DoStatement", 0);
  AotTsNode switch_statement = find_kind(control, "SwitchStatement", 0);
  AotTsNode case_block = find_kind(control, "CaseBlock", 0);
  AotTsNode case_clause = find_kind(control, "CaseClause", 0);
  AotTsNode default_clause = find_kind(control, "DefaultClause", 0);
  AotTsNode continue_statement = find_kind(control, "ContinueStatement", 0);
  AotTsNode break_statement = find_kind(control, "BreakStatement", 0);
  require(labeled >= 0 && aot_ts_node_kind(control, labeled) == 251, "stable labeled-statement kind");
  require(do_statement >= 0 && aot_ts_node_kind(control, do_statement) == 247, "stable do-statement kind");
  require(switch_statement >= 0 && aot_ts_node_kind(control, switch_statement) == 256, "stable switch kind");
  require(case_block >= 0 && aot_ts_node_kind(control, case_block) == 284, "stable case-block kind");
  require(case_clause >= 0 && aot_ts_node_kind(control, case_clause) == 285, "stable case-clause kind");
  require(default_clause >= 0 && aot_ts_node_kind(control, default_clause) == 286, "stable default-clause kind");
  require(continue_statement >= 0 && break_statement >= 0, "stable targeted-exit kinds");
  require(aot_ts_node_role(control, labeled, AOT_TS_ROLE_LABEL, 0) >= 0 &&
    aot_ts_node_role(control, labeled, AOT_TS_ROLE_STATEMENT, 0) == do_statement,
    "labeled statement roles");
  require(aot_ts_node_role(control, do_statement, AOT_TS_ROLE_CONDITION, 0) >= 0 &&
    aot_ts_node_role(control, do_statement, AOT_TS_ROLE_STATEMENT, 0) >= 0,
    "do condition and body roles");
  require(aot_ts_node_role(control, switch_statement, AOT_TS_ROLE_EXPRESSION, 0) >= 0 &&
    aot_ts_node_role(control, switch_statement, AOT_TS_ROLE_CLAUSE, 0) == case_block,
    "switch expression and case-block roles");
  require(aot_ts_node_role(control, case_block, AOT_TS_ROLE_CLAUSE, 0) == case_clause &&
    aot_ts_node_role(control, case_block, AOT_TS_ROLE_CLAUSE, 1) == default_clause,
    "ordered switch-clause roles");
  require(aot_ts_node_role(control, case_clause, AOT_TS_ROLE_EXPRESSION, 0) >= 0,
    "case expression role");
  require(aot_ts_node_role(control, continue_statement, AOT_TS_ROLE_LABEL, 0) >= 0 &&
    aot_ts_node_role(control, break_statement, AOT_TS_ROLE_LABEL, 0) == -1,
    "optional exit label roles");
  aot_ts_parse_delete(control);

  const char *closure_source =
    "function main(){let x=1;const a=function(n){return x+n;};"
    "const f=function self(n){return n?self(n-1):1;};return a(f(2));}";
  AotTsParse closures = aot_ts_parse_ex(closure_source, (int32_t)strlen(closure_source),
    "closures.js", 11, AOT_TS_SCRIPT_JS);
  int expression_count = 0, anonymous_count = 0, named_count = 0;
  char closure_kind[64];
  for (int32_t node = 0; node < aot_ts_node_count(closures); node++) {
    name(closures, node, closure_kind, sizeof(closure_kind));
    if (!strcmp(closure_kind, "FunctionExpression")) {
      expression_count++;
      AotTsNode closure_name = aot_ts_node_role(closures, node, AOT_TS_ROLE_NAME, 0);
      if (closure_name < 0) anonymous_count++; else named_count++;
      require(aot_ts_node_kind(closures, node) == 219, "stable function-expression kind");
      require(aot_ts_node_role(closures, node, AOT_TS_ROLE_PARAMETER, 0) >= 0,
        "function-expression parameter role");
      require(aot_ts_node_role(closures, node, AOT_TS_ROLE_BODY, 0) >= 0,
        "function-expression body role");
    }
  }
  require(expression_count == 2 && anonymous_count == 1 && named_count == 1,
    "anonymous and named function-expression roles");
  aot_ts_parse_delete(closures);

  const char *receiver_source =
    "function C(n){this.n=n;} function main(o){return o.m(this.n)+new C(2).n;}";
  AotTsParse receivers = aot_ts_parse_ex(receiver_source, (int32_t)strlen(receiver_source),
    "receivers.js", 12, AOT_TS_SCRIPT_JS);
  AotTsNode this_node = find_kind(receivers, "ThisKeyword", 0);
  AotTsNode new_node = find_kind(receivers, "NewExpression", 1);
  AotTsNode receiver_member = find_kind_with_role(receivers, "PropertyAccessExpression", AOT_TS_ROLE_OBJECT);
  require(this_node >= 0 && aot_ts_node_kind(receivers, this_node) == 110,
    "stable this-keyword kind");
  require(new_node >= 0 && aot_ts_node_kind(receivers, new_node) == 215 &&
    aot_ts_node_role(receivers, new_node, AOT_TS_ROLE_CALLEE, 0) >= 0 &&
    aot_ts_node_role(receivers, new_node, AOT_TS_ROLE_ARGUMENT, 0) >= 0,
    "new constructor and argument roles");
  require(receiver_member >= 0 &&
    aot_ts_node_role(receivers, receiver_member, AOT_TS_ROLE_OBJECT, 0) >= 0 &&
    aot_ts_node_role(receivers, receiver_member, AOT_TS_ROLE_PROPERTY, 0) >= 0,
    "receiver member roles");
  aot_ts_parse_delete(receivers);

  const char *regex_source = "var r = /a\\/[b-d]+/gi;";
  AotTsParse regex = aot_ts_parse_ex(regex_source, (int32_t)strlen(regex_source), "regex.js", 8, AOT_TS_SCRIPT_AUTO);
  require(aot_ts_script_kind(regex) == AOT_TS_SCRIPT_JS, "filename auto mode");
  AotTsNode regex_node = find_kind(regex, "RegularExpressionLiteral", 0);
  char pattern[64], flags[16];
  require(regex_node >= 0 && aot_ts_node_literal_kind(regex, regex_node) == AOT_TS_LITERAL_REGEXP, "regexp literal category");
  require(aot_ts_node_regexp_pattern(regex, regex_node, pattern, sizeof(pattern)) >= 0 && !strcmp(pattern, "a\\/[b-d]+"), "regexp pattern");
  require(aot_ts_node_regexp_flags(regex, regex_node, flags, sizeof(flags)) == 2 && !strcmp(flags, "gi"), "regexp flags");
  aot_ts_parse_delete(regex);

  require(aot_ts_root((AotTsParse)99999999) == -1, "invalid handle root");
  require(aot_ts_node_count((AotTsParse)99999999) == -1, "invalid handle count");
  require(aot_ts_node_role((AotTsParse)99999999, 0, AOT_TS_ROLE_NAME, 0) == -1, "invalid handle role");
  require(aot_ts_node_kind_name((AotTsParse)99999999, 0, NULL, 0) == -1, "invalid handle string query");
  require(aot_ts_diagnostic_code((AotTsParse)99999999, 0) == -1, "invalid handle diagnostic");
  aot_ts_parse_delete((AotTsParse)99999999);
  return 0;
}
