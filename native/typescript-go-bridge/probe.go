// This file is copied into cmd/aotprobe inside the pinned typescript-go checkout.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"

	"github.com/microsoft/typescript-go/internal/ast"
	"github.com/microsoft/typescript-go/internal/core"
	"github.com/microsoft/typescript-go/internal/parser"
	"github.com/microsoft/typescript-go/internal/scanner"
	"github.com/microsoft/typescript-go/internal/tspath"
)

type diagnostic struct { Code int `json:"code"`; Start int `json:"start"`; Length int `json:"length"` }
type gap struct { Code string `json:"code"`; Kind string `json:"kind"`; Start int `json:"start"`; End int `json:"end"` }
type output struct { SchemaVersion int `json:"schemaVersion"`; File string `json:"file"`; ScriptKind string `json:"scriptKind"`; NodeCount int `json:"nodeCount"`; Kinds map[string]int `json:"kinds"`; Diagnostics []diagnostic `json:"diagnostics"`; FirstUnsupported *gap `json:"firstUnsupported"` }

var supported = map[ast.Kind]bool{
	ast.KindSourceFile:true, ast.KindEndOfFile:true, ast.KindIdentifier:true,
	ast.KindNumericLiteral:true, ast.KindTrueKeyword:true, ast.KindFalseKeyword:true, ast.KindNullKeyword:true,
	ast.KindBlock:true, ast.KindVariableStatement:true, ast.KindVariableDeclarationList:true,
	ast.KindVariableDeclaration:true, ast.KindExpressionStatement:true, ast.KindIfStatement:true,
	ast.KindWhileStatement:true, ast.KindForStatement:true, ast.KindReturnStatement:true,
	ast.KindFunctionDeclaration:true, ast.KindParameter:true, ast.KindParenthesizedExpression:true,
	ast.KindPrefixUnaryExpression:true, ast.KindBinaryExpression:true, ast.KindCallExpression:true,
	ast.KindNewExpression:true, ast.KindPropertyAccessExpression:true, ast.KindObjectLiteralExpression:true,
	ast.KindPropertyAssignment:true,
}

func capability(kind ast.Kind) string {
	switch kind {
	case ast.KindStringLiteral: return "JS_STRING_LITERAL"
	case ast.KindRegularExpressionLiteral: return "JS_REGEXP_LITERAL"
	case ast.KindArrayLiteralExpression, ast.KindElementAccessExpression: return "JS_ARRAY_INDEXED_ACCESS"
	case ast.KindFunctionExpression, ast.KindArrowFunction: return "JS_FUNCTION_EXPRESSION"
	case ast.KindConditionalExpression: return "JS_CONDITIONAL_EXPRESSION"
	case ast.KindPostfixUnaryExpression: return "JS_UPDATE_EXPRESSION"
	case ast.KindDoStatement, ast.KindSwitchStatement, ast.KindCaseBlock, ast.KindCaseClause, ast.KindDefaultClause: return "JS_STRUCTURED_CONTROL"
	case ast.KindBreakStatement, ast.KindContinueStatement, ast.KindLabeledStatement: return "JS_TARGETED_EXIT"
	case ast.KindThrowStatement, ast.KindTryStatement, ast.KindCatchClause: return "JS_EXCEPTION_CONTROL"
	case ast.KindThisKeyword: return "JS_THIS"
	case ast.KindDeleteExpression, ast.KindTypeOfExpression: return "JS_DYNAMIC_UNARY_OPERATOR"
	default: return "JS_UNSUPPORTED_SYNTAX"
	}
}

func main() {
	if len(os.Args) != 2 { fmt.Fprintln(os.Stderr, "usage: aot-ts-probe FILE.js"); os.Exit(2) }
	name := os.Args[1]
	bytes, err := os.ReadFile(name); if err != nil { panic(err) }
	text := string(bytes)
	file := parser.ParseSourceFile(ast.SourceFileParseOptions{FileName:name, Path:tspath.Path(name)}, text, core.ScriptKindJS)
	out := output{SchemaVersion:1, File:name, ScriptKind:"JS", Kinds:map[string]int{}, Diagnostics:[]diagnostic{}}
	for _, d := range file.Diagnostics() { out.Diagnostics = append(out.Diagnostics, diagnostic{int(d.Code()), d.Pos(), d.Len()}) }
	var visit func(*ast.Node)
	visit = func(n *ast.Node) {
		out.NodeCount++
		out.Kinds[n.KindString()]++
		start := scanner.SkipTrivia(text, n.Pos())
		if !supported[n.Kind] && (out.FirstUnsupported == nil || start < out.FirstUnsupported.Start) {
			out.FirstUnsupported = &gap{capability(n.Kind), n.KindString(), start, n.End()}
		}
		n.ForEachChild(func(child *ast.Node) bool { visit(child); return false })
	}
	visit(file.AsNode())
	// Force deterministic JSON even if Go's map encoder changes its ordering implementation.
	keys := make([]string, 0, len(out.Kinds)); for key := range out.Kinds { keys = append(keys, key) }; sort.Strings(keys)
	ordered := map[string]int{}; for _, key := range keys { ordered[key] = out.Kinds[key] }; out.Kinds = ordered
	encoder := json.NewEncoder(os.Stdout); encoder.SetEscapeHTML(false); encoder.SetIndent("", "  "); if err := encoder.Encode(out); err != nil { panic(err) }
}
