// This file is copied into cmd/aotcapi inside the pinned Microsoft typescript-go
// checkout. It must live there because the upstream compiler currently exposes
// its implementation through Go internal packages.
package main

/*
#include <stdint.h>
*/
import "C"

import (
	"runtime/cgo"

	"github.com/microsoft/typescript-go/internal/ast"
	"github.com/microsoft/typescript-go/internal/core"
	"github.com/microsoft/typescript-go/internal/parser"
	"github.com/microsoft/typescript-go/internal/scanner"
	"github.com/microsoft/typescript-go/internal/tspath"
)

type parseResult struct {
	file     *ast.SourceFile
	source   string
	nodes    []*ast.Node
	children [][]int32
}

//export aot_ts_parse
func aot_ts_parse(source *C.char, sourceLength C.int32_t) C.uintptr_t {
	text := C.GoStringN(source, C.int(sourceLength))
	file := parser.ParseSourceFile(ast.SourceFileParseOptions{
		FileName: "/input.ts",
		Path:     tspath.Path("/input.ts"),
	}, text, core.ScriptKindTS)
	parsed := &parseResult{file: file, source: text}
	parsed.appendNode(file.AsNode())
	return C.uintptr_t(cgo.NewHandle(parsed))
}

func (parsed *parseResult) appendNode(node *ast.Node) int32 {
	id := int32(len(parsed.nodes))
	parsed.nodes = append(parsed.nodes, node)
	parsed.children = append(parsed.children, nil)
	var childNodes []*ast.Node
	node.ForEachChild(func(child *ast.Node) bool {
		childNodes = append(childNodes, child)
		return false
	})
	for _, child := range childNodes {
		parsed.children[id] = append(parsed.children[id], parsed.appendNode(child))
	}
	return id
}

//export aot_ts_parse_delete
func aot_ts_parse_delete(raw C.uintptr_t) {
	cgo.Handle(raw).Delete()
}

func result(raw C.uintptr_t) *parseResult {
	return cgo.Handle(raw).Value().(*parseResult)
}

//export aot_ts_root
func aot_ts_root(raw C.uintptr_t) C.int32_t {
	return 0
}

//export aot_ts_node_count
func aot_ts_node_count(raw C.uintptr_t) C.int32_t {
	return C.int32_t(len(result(raw).nodes))
}

func node(parsed *parseResult, id C.int32_t) *ast.Node {
	if id < 0 || int(id) >= len(parsed.nodes) {
		return nil
	}
	return parsed.nodes[id]
}

//export aot_ts_node_kind
func aot_ts_node_kind(raw C.uintptr_t, id C.int32_t) C.int32_t {
	n := node(result(raw), id)
	if n == nil {
		return -1
	}
	return C.int32_t(n.KindValue())
}

//export aot_ts_node_start
func aot_ts_node_start(raw C.uintptr_t, id C.int32_t) C.int32_t {
	parsed := result(raw)
	n := node(parsed, id)
	if n == nil {
		return -1
	}
	return C.int32_t(scanner.SkipTrivia(parsed.source, n.Pos()))
}

//export aot_ts_node_end
func aot_ts_node_end(raw C.uintptr_t, id C.int32_t) C.int32_t {
	n := node(result(raw), id)
	if n == nil {
		return -1
	}
	return C.int32_t(n.End())
}

//export aot_ts_node_child_count
func aot_ts_node_child_count(raw C.uintptr_t, id C.int32_t) C.int32_t {
	parsed := result(raw)
	if node(parsed, id) == nil {
		return -1
	}
	return C.int32_t(len(parsed.children[id]))
}

//export aot_ts_node_child
func aot_ts_node_child(raw C.uintptr_t, id C.int32_t, index C.int32_t) C.int32_t {
	parsed := result(raw)
	if node(parsed, id) == nil || index < 0 || int(index) >= len(parsed.children[id]) {
		return -1
	}
	return C.int32_t(parsed.children[id][index])
}

//export aot_ts_diagnostic_count
func aot_ts_diagnostic_count(raw C.uintptr_t) C.int32_t {
	return C.int32_t(len(result(raw).file.Diagnostics()))
}

//export aot_ts_diagnostic_code
func aot_ts_diagnostic_code(raw C.uintptr_t, index C.int32_t) C.int32_t {
	diagnostics := result(raw).file.Diagnostics()
	if index < 0 || int(index) >= len(diagnostics) {
		return -1
	}
	return C.int32_t(diagnostics[index].Code())
}

//export aot_ts_diagnostic_start
func aot_ts_diagnostic_start(raw C.uintptr_t, index C.int32_t) C.int32_t {
	diagnostics := result(raw).file.Diagnostics()
	if index < 0 || int(index) >= len(diagnostics) {
		return -1
	}
	return C.int32_t(diagnostics[index].Pos())
}

//export aot_ts_diagnostic_length
func aot_ts_diagnostic_length(raw C.uintptr_t, index C.int32_t) C.int32_t {
	diagnostics := result(raw).file.Diagnostics()
	if index < 0 || int(index) >= len(diagnostics) {
		return -1
	}
	return C.int32_t(diagnostics[index].Len())
}

func main() {}
