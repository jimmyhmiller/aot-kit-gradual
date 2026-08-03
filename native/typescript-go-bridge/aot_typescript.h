#ifndef AOT_TYPESCRIPT_H
#define AOT_TYPESCRIPT_H

#include <stdint.h>

// Opaque process-local handle. It is never a Go pointer and must be released
// with aot_ts_parse_delete.
typedef uintptr_t AotTsParse;
typedef int32_t AotTsNode;

AotTsParse aot_ts_parse(const char *source, int32_t source_length);
void aot_ts_parse_delete(AotTsParse parse);

// Nodes are immutable preorder indexes owned by the parse handle. Kinds currently
// use the pinned native compiler's ast.Kind values; a stable aot-kit kind mapping
// will replace them before this ABI is declared stable.
AotTsNode aot_ts_root(AotTsParse parse);
int32_t aot_ts_node_count(AotTsParse parse);
int32_t aot_ts_node_kind(AotTsParse parse, AotTsNode node);
int32_t aot_ts_node_start(AotTsParse parse, AotTsNode node);
int32_t aot_ts_node_end(AotTsParse parse, AotTsNode node);
int32_t aot_ts_node_child_count(AotTsParse parse, AotTsNode node);
AotTsNode aot_ts_node_child(AotTsParse parse, AotTsNode node, int32_t index);

int32_t aot_ts_diagnostic_count(AotTsParse parse);
int32_t aot_ts_diagnostic_code(AotTsParse parse, int32_t index);
int32_t aot_ts_diagnostic_start(AotTsParse parse, int32_t index);
int32_t aot_ts_diagnostic_length(AotTsParse parse, int32_t index);

#endif
