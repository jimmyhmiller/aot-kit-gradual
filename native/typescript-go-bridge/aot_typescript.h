#ifndef AOT_TYPESCRIPT_H
#define AOT_TYPESCRIPT_H

#include <stdint.h>

// Opaque process-local handle. It is never a Go pointer and must be released
// with aot_ts_parse_delete.
typedef uintptr_t AotTsParse;
typedef int32_t AotTsNode;

enum AotTsScriptKind { AOT_TS_SCRIPT_AUTO = 0, AOT_TS_SCRIPT_JS = 1,
  AOT_TS_SCRIPT_TS = 2, AOT_TS_SCRIPT_JS_MODULE = 3 };
enum AotTsLiteralKind { AOT_TS_LITERAL_NONE = 0, AOT_TS_LITERAL_NUMBER = 1,
  AOT_TS_LITERAL_STRING = 2, AOT_TS_LITERAL_BOOLEAN = 3, AOT_TS_LITERAL_NULL = 4,
  AOT_TS_LITERAL_REGEXP = 5 };
enum AotTsRole { AOT_TS_ROLE_NAME = 1, AOT_TS_ROLE_BODY = 2, AOT_TS_ROLE_TYPE = 3,
  AOT_TS_ROLE_INITIALIZER = 4, AOT_TS_ROLE_EXPRESSION = 5, AOT_TS_ROLE_LEFT = 6,
  AOT_TS_ROLE_OPERATOR = 7, AOT_TS_ROLE_RIGHT = 8, AOT_TS_ROLE_CONDITION = 9,
  AOT_TS_ROLE_THEN = 10, AOT_TS_ROLE_ELSE = 11, AOT_TS_ROLE_STATEMENT = 12,
  AOT_TS_ROLE_CALLEE = 13, AOT_TS_ROLE_ARGUMENT = 14, AOT_TS_ROLE_PARAMETER = 15,
  AOT_TS_ROLE_OBJECT = 16, AOT_TS_ROLE_PROPERTY = 17, AOT_TS_ROLE_ELEMENT = 18,
  AOT_TS_ROLE_MEMBER = 19, AOT_TS_ROLE_WHEN_TRUE = 20, AOT_TS_ROLE_WHEN_FALSE = 21,
  AOT_TS_ROLE_LABEL = 22, AOT_TS_ROLE_CLAUSE = 23 };

AotTsParse aot_ts_parse(const char *source, int32_t source_length);
AotTsParse aot_ts_parse_ex(const char *source, int32_t source_length,
                           const char *filename, int32_t filename_length, int32_t script_kind);
// Parse independent Script records from adjacent source bytes. `lengths` contains `script_count`
// source lengths whose sum is `source_length`; no record can affect another record's grammar or
// directive prologue. The returned handle has one global node-id space and an ordered virtual root.
AotTsParse aot_ts_parse_scripts(const char *source, int32_t source_length,
                                const int32_t *lengths, int32_t script_count,
                                int32_t script_kind);
void aot_ts_parse_delete(AotTsParse parse);
int32_t aot_ts_script_kind(AotTsParse parse);
// Whether this SourceFile's own directive prologue contains "use strict".  This is deliberately
// a property of one parsed Script record, not of a concatenated compilation buffer.
int32_t aot_ts_script_is_strict(AotTsParse parse);
int32_t aot_ts_script_is_strict_at(AotTsParse parse, int32_t script_index);
int32_t aot_ts_script_count(AotTsParse parse);
AotTsNode aot_ts_script_root(AotTsParse parse, int32_t script_index);
int32_t aot_ts_node_script(AotTsParse parse, AotTsNode node);
// 0 is not a binding declaration, 1 is an object-environment (`var`/function) binding, and 2 is
// a declarative-environment (`let`/`const`/class) binding.
int32_t aot_ts_node_binding_class(AotTsParse parse, AotTsNode node);

// Nodes are immutable preorder indexes owned by the parse handle. Kind codes are
// an explicit aot-kit mapping and do not change if upstream ast.Kind is reordered.
AotTsNode aot_ts_root(AotTsParse parse);
int32_t aot_ts_node_count(AotTsParse parse);
int32_t aot_ts_node_kind(AotTsParse parse, AotTsNode node);
int32_t aot_ts_node_start(AotTsParse parse, AotTsNode node);
int32_t aot_ts_node_end(AotTsParse parse, AotTsNode node);
int32_t aot_ts_node_child_count(AotTsParse parse, AotTsNode node);
AotTsNode aot_ts_node_child(AotTsParse parse, AotTsNode node, int32_t index);
AotTsNode aot_ts_node_role(AotTsParse parse, AotTsNode node, int32_t role, int32_t index);

// String queries return the required byte length (excluding NUL), write at most
// capacity-1 bytes, and always NUL-terminate a non-empty destination. -1 means invalid input.
int32_t aot_ts_node_kind_name(AotTsParse parse, AotTsNode node, char *destination, int32_t capacity);
int32_t aot_ts_node_operator_name(AotTsParse parse, AotTsNode node, char *destination, int32_t capacity);
int32_t aot_ts_node_literal_kind(AotTsParse parse, AotTsNode node);
int32_t aot_ts_node_literal_text(AotTsParse parse, AotTsNode node, char *destination, int32_t capacity);
int32_t aot_ts_node_name_text(AotTsParse parse, AotTsNode node, char *destination, int32_t capacity);
uint64_t aot_ts_node_numeric_bits(AotTsParse parse, AotTsNode node);
int32_t aot_ts_node_regexp_pattern(AotTsParse parse, AotTsNode node, char *destination, int32_t capacity);
int32_t aot_ts_node_regexp_flags(AotTsParse parse, AotTsNode node, char *destination, int32_t capacity);

int32_t aot_ts_diagnostic_count(AotTsParse parse);
int32_t aot_ts_diagnostic_code(AotTsParse parse, int32_t index);
int32_t aot_ts_diagnostic_start(AotTsParse parse, int32_t index);
int32_t aot_ts_diagnostic_length(AotTsParse parse, int32_t index);

#endif
