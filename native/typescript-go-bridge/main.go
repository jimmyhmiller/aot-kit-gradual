// This file is copied into cmd/aotcapi inside the pinned Microsoft typescript-go
// checkout. It must live there because the upstream compiler currently exposes
// its implementation through Go internal packages.
package main

/*
#include <stdint.h>
*/
import "C"

import (
	"math"
	"strconv"
	"strings"
	"sync"
	"unsafe"

	"github.com/microsoft/typescript-go/internal/ast"
	"github.com/microsoft/typescript-go/internal/core"
	"github.com/microsoft/typescript-go/internal/parser"
	"github.com/microsoft/typescript-go/internal/scanner"
	"github.com/microsoft/typescript-go/internal/tspath"
)

//export aot_ts_force_link
func aot_ts_force_link() {}

type parseResult struct {
	file     *ast.SourceFile
	source   string
	nodes    []*ast.Node
	children [][]int32
	nodeIDs  map[*ast.Node]int32
	scriptKind int32
	diagnosticCodes []int32
	diagnosticStarts []int32
	diagnosticLengths []int32
}

var parses = struct {
	sync.RWMutex
	next uintptr
	items map[uintptr]*parseResult
}{next: 1, items: make(map[uintptr]*parseResult)}

const (
	scriptKindAuto = 0
	scriptKindJS = 1
	scriptKindTS = 2
)

//export aot_ts_parse
func aot_ts_parse(source *C.char, sourceLength C.int32_t) C.uintptr_t {
	return aot_ts_parse_ex(source, sourceLength, nil, 0, scriptKindTS)
}

//export aot_ts_parse_ex
func aot_ts_parse_ex(source *C.char, sourceLength C.int32_t, filename *C.char, filenameLength C.int32_t, requestedKind C.int32_t) C.uintptr_t {
	if source == nil || sourceLength < 0 || filenameLength < 0 {
		return 0
	}
	text := C.GoStringN(source, C.int(sourceLength))
	name := "/input.ts"
	if filename != nil && filenameLength > 0 {
		name = C.GoStringN(filename, C.int(filenameLength))
	}
	name = tspath.GetNormalizedAbsolutePath(name, "/")
	kind := core.ScriptKindUnknown
	switch requestedKind {
	case scriptKindJS:
		kind = core.ScriptKindJS
	case scriptKindTS:
		kind = core.ScriptKindTS
	case scriptKindAuto:
		kind = core.GetScriptKindFromFileName(name)
	default:
		return 0
	}
	file := parser.ParseSourceFile(ast.SourceFileParseOptions{
		FileName: name,
		Path:     tspath.Path(name),
	}, text, kind)
	parsed := &parseResult{file: file, source: text, nodeIDs: make(map[*ast.Node]int32), scriptKind:int32(requestedKind)}
	if requestedKind == scriptKindAuto {
		if kind == core.ScriptKindJS { parsed.scriptKind = scriptKindJS } else if kind == core.ScriptKindTS { parsed.scriptKind = scriptKindTS }
	}
	parsed.appendNode(file.AsNode())
	for _, diagnostic := range file.Diagnostics() {
		parsed.diagnosticCodes = append(parsed.diagnosticCodes, int32(diagnostic.Code()))
		parsed.diagnosticStarts = append(parsed.diagnosticStarts, int32(diagnostic.Pos()))
		parsed.diagnosticLengths = append(parsed.diagnosticLengths, int32(diagnostic.Len()))
	}
	if kind == core.ScriptKindJS { parsed.addJavaScriptModeDiagnostics() }
	parses.Lock()
	handle := parses.next
	parses.next++
	parses.items[handle] = parsed
	parses.Unlock()
	return C.uintptr_t(handle)
}

func (parsed *parseResult) addJavaScriptModeDiagnostics() {
	for _, n := range parsed.nodes {
		var forbidden *ast.Node
		switch n.Kind {
		case ast.KindInterfaceDeclaration, ast.KindTypeAliasDeclaration, ast.KindEnumDeclaration, ast.KindModuleDeclaration:
			forbidden = n
		case ast.KindVariableDeclaration, ast.KindParameter, ast.KindPropertyDeclaration,
			ast.KindFunctionDeclaration, ast.KindFunctionExpression, ast.KindArrowFunction:
			candidate := n.Type()
			if candidate != nil {
				start := scanner.SkipTrivia(parsed.source, candidate.Pos())
				before := start - 1
				for before >= 0 && (parsed.source[before] == ' ' || parsed.source[before] == '\t' || parsed.source[before] == '\r' || parsed.source[before] == '\n') { before-- }
				if before >= 0 && parsed.source[before] == ':' { forbidden = candidate }
			}
		}
		if forbidden != nil {
			parsed.addJavaScriptDiagnostic(forbidden, 90001)
		}
		parsed.addDynamicImportEarlyErrors(n)
		parsed.addAssignmentTargetEarlyErrors(n)
		parsed.addBindingRestEarlyErrors(n)
		parsed.addPrivateDeleteEarlyErrors(n)
		parsed.addBlockRedeclarationEarlyErrors(n)
		parsed.addEmbeddedStatementEarlyErrors(n)
		parsed.addRegExpFlagEarlyErrors(n)
		parsed.addFormalParameterEarlyErrors(n)
	}
}

func (parsed *parseResult) addJavaScriptDiagnostic(node *ast.Node, code int32) {
	start := scanner.SkipTrivia(parsed.source, node.Pos())
	parsed.diagnosticCodes = append(parsed.diagnosticCodes, code)
	parsed.diagnosticStarts = append(parsed.diagnosticStarts, int32(start))
	parsed.diagnosticLengths = append(parsed.diagnosticLengths, int32(node.End()-start))
}

func isImportMeta(node *ast.Node) bool {
	return node != nil && node.Kind == ast.KindMetaProperty &&
		node.AsMetaProperty().KeywordToken == ast.KindImportKeyword
}

func importMetaName(node *ast.Node) string {
	if !isImportMeta(node) { return "" }
	return node.AsMetaProperty().Name().Text()
}

func isAnyImportCall(node *ast.Node) bool {
	if node == nil || node.Kind != ast.KindCallExpression { return false }
	expression := node.AsCallExpression().Expression
	return expression.Kind == ast.KindImportKeyword || isImportMeta(expression)
}

func containsImportCall(node *ast.Node) bool {
	if node == nil { return false }
	if isAnyImportCall(node) { return true }
	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if containsImportCall(child) { found = true; return true }
		return false
	})
	return found
}

func (parsed *parseResult) isStrictScript() bool {
	start := scanner.SkipTrivia(parsed.source, 0)
	rest := parsed.source[start:]
	return strings.HasPrefix(rest, "\"use strict\"") || strings.HasPrefix(rest, "'use strict'")
}

func isSimpleAssignmentTarget(node *ast.Node, strict bool) bool {
	if node == nil { return false }
	switch node.Kind {
	case ast.KindParenthesizedExpression:
		return isSimpleAssignmentTarget(node.AsParenthesizedExpression().Expression, strict)
	case ast.KindIdentifier:
		name := node.Text()
		return !strict || name != "eval" && name != "arguments"
	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
		return !ast.IsOptionalChain(node)
	default:
		return false
	}
}

func isCallAssignmentTarget(node *ast.Node) bool {
	if node == nil { return false }
	if node.Kind == ast.KindParenthesizedExpression {
		return isCallAssignmentTarget(node.AsParenthesizedExpression().Expression)
	}
	return node.Kind == ast.KindCallExpression && !ast.IsOptionalChain(node)
}

func isAssignmentPattern(node *ast.Node) bool {
	return node != nil && (node.Kind == ast.KindArrayLiteralExpression ||
		node.Kind == ast.KindObjectLiteralExpression)
}

func (parsed *parseResult) addAssignmentTargetEarlyErrors(node *ast.Node) {
	strict := parsed.isStrictScript()
	if node.Kind == ast.KindBinaryExpression {
		binary := node.AsBinaryExpression()
		operator := binary.OperatorToken.Kind
		if ast.IsAssignmentOperator(operator) {
			left := binary.Left
			valid := isSimpleAssignmentTarget(left, strict) ||
				operator == ast.KindEqualsToken && isAssignmentPattern(left) ||
				!strict && !ast.IsLogicalOrCoalescingAssignmentOperator(operator) &&
					isCallAssignmentTarget(left)
			if !valid { parsed.addJavaScriptDiagnostic(left, 90003) }
		}
	}
	if node.Kind == ast.KindPostfixUnaryExpression {
		postfix := node.AsPostfixUnaryExpression()
		if !isSimpleAssignmentTarget(postfix.Operand, strict) {
			parsed.addJavaScriptDiagnostic(postfix.Operand, 90003)
		}
	}
	if node.Kind == ast.KindPrefixUnaryExpression {
		prefix := node.AsPrefixUnaryExpression()
		if (prefix.Operator == ast.KindPlusPlusToken || prefix.Operator == ast.KindMinusMinusToken) &&
			!isSimpleAssignmentTarget(prefix.Operand, strict) {
			parsed.addJavaScriptDiagnostic(prefix.Operand, 90003)
		}
	}
	if node.Kind == ast.KindForInStatement || node.Kind == ast.KindForOfStatement {
		initializer := node.Initializer()
		if initializer != nil && initializer.Kind != ast.KindVariableDeclarationList &&
			!isSimpleAssignmentTarget(initializer, strict) && !isAssignmentPattern(initializer) &&
			!(!strict && isCallAssignmentTarget(initializer)) {
			parsed.addJavaScriptDiagnostic(initializer, 90003)
		}
	}
}

func (parsed *parseResult) addBindingRestEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindBindingElement { return }
	element := node.AsBindingElement()
	if element.DotDotDotToken == nil { return }
	if element.Initializer != nil {
		parsed.addJavaScriptDiagnostic(element.Initializer, 90004)
	}
	parent := node.Parent
	if parent == nil ||
		(parent.Kind != ast.KindArrayBindingPattern && parent.Kind != ast.KindObjectBindingPattern) {
		return
	}
	elements := parent.AsBindingPattern().Elements.Nodes
	if len(elements) > 0 && elements[len(elements)-1] != node {
		parsed.addJavaScriptDiagnostic(node, 90004)
	}
}

func unwrapParenthesized(node *ast.Node) *ast.Node {
	for node != nil && node.Kind == ast.KindParenthesizedExpression {
		node = node.AsParenthesizedExpression().Expression
	}
	return node
}

func (parsed *parseResult) addPrivateDeleteEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindDeleteExpression { return }
	target := unwrapParenthesized(node.AsDeleteExpression().Expression)
	if target != nil && target.Kind == ast.KindPropertyAccessExpression &&
		target.Name() != nil && target.Name().Kind == ast.KindPrivateIdentifier {
		parsed.addJavaScriptDiagnostic(target, 90005)
	}
}

type declaredName struct {
	text string
	node *ast.Node
}

func appendBoundNames(node *ast.Node, names []declaredName) []declaredName {
	if node == nil { return names }
	switch node.Kind {
	case ast.KindIdentifier:
		return append(names, declaredName{text: node.Text(), node: node})
	case ast.KindBindingElement:
		return appendBoundNames(node.Name(), names)
	case ast.KindArrayBindingPattern, ast.KindObjectBindingPattern:
		for _, element := range node.AsBindingPattern().Elements.Nodes {
			names = appendBoundNames(element, names)
		}
	}
	return names
}

func appendDeclarationNames(node *ast.Node, names []declaredName) []declaredName {
	if node != nil && node.Name() != nil {
		return appendBoundNames(node.Name(), names)
	}
	return names
}

func directLexicalNames(statements []*ast.Node) []declaredName {
	var names []declaredName
	for _, statement := range statements {
		switch statement.Kind {
		case ast.KindVariableStatement:
			list := statement.AsVariableStatement().DeclarationList
			if list.Flags&ast.NodeFlagsBlockScoped != 0 {
				for _, declaration := range list.AsVariableDeclarationList().Declarations.Nodes {
					names = appendDeclarationNames(declaration, names)
				}
			}
		case ast.KindFunctionDeclaration, ast.KindClassDeclaration:
			names = appendDeclarationNames(statement, names)
		}
	}
	return names
}

func appendVarDeclaredNames(node *ast.Node, names []declaredName) []declaredName {
	if node == nil { return names }
	switch node.Kind {
	case ast.KindFunctionDeclaration, ast.KindFunctionExpression, ast.KindArrowFunction,
		ast.KindClassDeclaration, ast.KindClassExpression:
		return names
	case ast.KindVariableDeclarationList:
		if node.Flags&ast.NodeFlagsBlockScoped == 0 {
			for _, declaration := range node.AsVariableDeclarationList().Declarations.Nodes {
				names = appendDeclarationNames(declaration, names)
			}
		}
		return names
	}
	node.ForEachChild(func(child *ast.Node) bool {
		names = appendVarDeclaredNames(child, names)
		return false
	})
	return names
}

func blockScopeStatements(node *ast.Node) []*ast.Node {
	if node.Kind == ast.KindBlock { return node.AsBlock().Statements.Nodes }
	if node.Kind != ast.KindCaseBlock { return nil }
	var statements []*ast.Node
	for _, clause := range node.AsCaseBlock().Clauses.Nodes {
		statements = append(statements, clause.AsCaseOrDefaultClause().Statements.Nodes...)
	}
	return statements
}

func (parsed *parseResult) addBlockRedeclarationEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindBlock && node.Kind != ast.KindCaseBlock { return }
	statements := blockScopeStatements(node)
	lexical := directLexicalNames(statements)
	var vars []declaredName
	for _, statement := range statements {
		vars = appendVarDeclaredNames(statement, vars)
	}
	seen := make(map[string]*ast.Node)
	for _, name := range lexical {
		if seen[name.text] != nil {
			parsed.addJavaScriptDiagnostic(name.node, 90006)
		} else {
			seen[name.text] = name.node
		}
	}
	for _, name := range vars {
		if seen[name.text] != nil {
			parsed.addJavaScriptDiagnostic(name.node, 90006)
		}
	}
}

func labelledFunction(statement *ast.Node) *ast.Node {
	labelled := false
	for statement != nil && statement.Kind == ast.KindLabeledStatement {
		labelled = true
		statement = statement.AsLabeledStatement().Statement
	}
	if labelled && statement != nil && statement.Kind == ast.KindFunctionDeclaration {
		return statement
	}
	return nil
}

func invalidEmbeddedStatement(statement *ast.Node, strict bool, annexIf bool) *ast.Node {
	if statement == nil { return nil }
	if function := labelledFunction(statement); function != nil { return function }
	switch statement.Kind {
	case ast.KindClassDeclaration:
		return statement
	case ast.KindVariableStatement:
		if statement.AsVariableStatement().DeclarationList.Flags&ast.NodeFlagsBlockScoped != 0 {
			return statement
		}
	case ast.KindFunctionDeclaration:
		function := statement.AsFunctionDeclaration()
		ordinary := function.AsteriskToken == nil &&
			!ast.HasSyntacticModifier(statement, ast.ModifierFlagsAsync)
		if !ordinary || strict || !annexIf { return statement }
	}
	return nil
}

func (parsed *parseResult) addEmbeddedStatementEarlyErrors(node *ast.Node) {
	strict := parsed.isStrictScript()
	if node.Kind == ast.KindIfStatement {
		statement := node.AsIfStatement()
		if invalid := invalidEmbeddedStatement(statement.ThenStatement, strict, true); invalid != nil {
			parsed.addJavaScriptDiagnostic(invalid, 90007)
		}
		if invalid := invalidEmbeddedStatement(statement.ElseStatement, strict, true); invalid != nil {
			parsed.addJavaScriptDiagnostic(invalid, 90007)
		}
		return
	}
	switch node.Kind {
	case ast.KindDoStatement, ast.KindWhileStatement, ast.KindForStatement,
		ast.KindForInStatement, ast.KindForOfStatement, ast.KindWithStatement:
		if invalid := invalidEmbeddedStatement(node.Statement(), strict, false); invalid != nil {
			parsed.addJavaScriptDiagnostic(invalid, 90007)
		}
	}
}

func validRegExpLiteralFlags(flags string) bool {
	seen := make(map[byte]bool)
	for i := 0; i < len(flags); i++ {
		flag := flags[i]
		if !strings.ContainsRune("dgimsuvy", rune(flag)) || seen[flag] { return false }
		seen[flag] = true
	}
	return !(seen['u'] && seen['v'])
}

func validRegExpModifierFlags(header string) bool {
	minus := strings.IndexByte(header, '-')
	if minus != strings.LastIndexByte(header, '-') { return false }
	add, remove := header, ""
	if minus >= 0 { add, remove = header[:minus], header[minus+1:] }
	if add == "" && remove == "" { return false }
	seenAdd, seenRemove := make(map[byte]bool), make(map[byte]bool)
	for i := 0; i < len(add); i++ {
		flag := add[i]
		if !strings.ContainsRune("ims", rune(flag)) || seenAdd[flag] { return false }
		seenAdd[flag] = true
	}
	for i := 0; i < len(remove); i++ {
		flag := remove[i]
		if !strings.ContainsRune("ims", rune(flag)) || seenRemove[flag] || seenAdd[flag] { return false }
		seenRemove[flag] = true
	}
	return true
}

func invalidRegExpModifier(pattern string) bool {
	inClass, escaped := false, false
	for i := 0; i+2 < len(pattern); i++ {
		if escaped { escaped = false; continue }
		if pattern[i] == '\\' { escaped = true; continue }
		if pattern[i] == '[' { inClass = true; continue }
		if pattern[i] == ']' { inClass = false; continue }
		if inClass || pattern[i] != '(' || pattern[i+1] != '?' { continue }
		next := pattern[i+2]
		if next == ':' || next == '=' || next == '!' || next == '<' { continue }
		colon := strings.IndexByte(pattern[i+2:], ':')
		if colon < 0 { continue }
		colon += i + 2
		if close := strings.IndexByte(pattern[i+2:], ')'); close >= 0 && i+2+close < colon { continue }
		if !validRegExpModifierFlags(pattern[i+2:colon]) { return true }
	}
	return false
}

func (parsed *parseResult) addRegExpFlagEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindRegularExpressionLiteral { return }
	literal := node.Text()
	delimiter := strings.LastIndexByte(literal, '/')
	if delimiter <= 0 { return }
	if !validRegExpLiteralFlags(literal[delimiter+1:]) ||
		invalidRegExpModifier(literal[1:delimiter]) {
		parsed.addJavaScriptDiagnostic(node, 90008)
	}
}

func functionHasUseStrict(node *ast.Node) bool {
	if node == nil || !ast.IsFunctionLike(node) { return false }
	body := node.Body()
	if body == nil || body.Kind != ast.KindBlock { return false }
	for _, statement := range body.AsBlock().Statements.Nodes {
		if statement.Kind != ast.KindExpressionStatement { return false }
		expression := statement.AsExpressionStatement().Expression
		if expression.Kind != ast.KindStringLiteral { return false }
		if expression.Text() == "use strict" { return true }
	}
	return false
}

func (parsed *parseResult) strictAt(node *ast.Node) bool {
	if parsed.isStrictScript() { return true }
	for current := node; current != nil; current = current.Parent {
		if current.Kind == ast.KindClassDeclaration || current.Kind == ast.KindClassExpression {
			return true
		}
		if ast.IsFunctionLike(current) && functionHasUseStrict(current) { return true }
	}
	return false
}

func simpleParameterList(node *ast.Node) bool {
	for _, parameter := range node.Parameters() {
		data := parameter.AsParameterDeclaration()
		if data.Name().Kind != ast.KindIdentifier || data.Initializer != nil || data.DotDotDotToken != nil {
			return false
		}
	}
	return true
}

func parameterDuplicatesAlwaysForbidden(node *ast.Node) bool {
	switch node.Kind {
	case ast.KindArrowFunction, ast.KindMethodDeclaration, ast.KindGetAccessor,
		ast.KindSetAccessor, ast.KindConstructor:
		return true
	}
	return false
}

func (parsed *parseResult) addFormalParameterEarlyErrors(node *ast.Node) {
	if !ast.IsFunctionLike(node) || node.ParameterList() == nil { return }
	parameters := node.Parameters()
	strict := parsed.strictAt(node)
	simple := simpleParameterList(node)
	if !simple && functionHasUseStrict(node) {
		parsed.addJavaScriptDiagnostic(node, 90009)
	}
	seen := make(map[string]*ast.Node)
	for i, parameter := range parameters {
		data := parameter.AsParameterDeclaration()
		if data.DotDotDotToken != nil {
			if data.Initializer != nil || i != len(parameters)-1 ||
				i == len(parameters)-1 && node.ParameterList().HasTrailingComma() {
				parsed.addJavaScriptDiagnostic(parameter, 90009)
			}
		}
		for _, name := range appendBoundNames(data.Name(), nil) {
			if strict && (name.text == "eval" || name.text == "arguments") {
				parsed.addJavaScriptDiagnostic(name.node, 90009)
			}
			if seen[name.text] != nil && (strict || !simple || parameterDuplicatesAlwaysForbidden(node)) {
				parsed.addJavaScriptDiagnostic(name.node, 90009)
			} else {
				seen[name.text] = name.node
			}
		}
	}
}

func (parsed *parseResult) addDynamicImportEarlyErrors(node *ast.Node) {
	if node.Kind == ast.KindImportKeyword {
		parent := node.Parent
		valid := parent != nil &&
			(parent.Kind == ast.KindCallExpression && parent.AsCallExpression().Expression == node ||
				isImportMeta(parent))
		if !valid { parsed.addJavaScriptDiagnostic(node, 90002) }
	}
	if isImportMeta(node) {
		parent := node.Parent
		name := importMetaName(node)
		callName := name == "defer" || name == "source"
		valid := name == "meta" || callName && parent != nil &&
			parent.Kind == ast.KindCallExpression && parent.AsCallExpression().Expression == node
		if !valid {
			parsed.addJavaScriptDiagnostic(node, 90002)
		}
	}
	if isAnyImportCall(node) {
		arguments := node.AsCallExpression().Arguments.Nodes
		invalid := len(arguments) < 1 || len(arguments) > 2
		for _, argument := range arguments {
			if argument.Kind == ast.KindSpreadElement { invalid = true }
		}
		if invalid { parsed.addJavaScriptDiagnostic(node, 90002) }
	}
	if node.Kind == ast.KindNewExpression && containsImportCall(node.AsNewExpression().Expression) {
		parsed.addJavaScriptDiagnostic(node, 90002)
	}
	if node.Kind == ast.KindBinaryExpression {
		binary := node.AsBinaryExpression()
		if ast.IsAssignmentOperator(binary.OperatorToken.Kind) && containsImportCall(binary.Left) {
			parsed.addJavaScriptDiagnostic(binary.Left, 90002)
		}
	}
	if node.Kind == ast.KindPostfixUnaryExpression &&
		containsImportCall(node.AsPostfixUnaryExpression().Operand) {
		parsed.addJavaScriptDiagnostic(node, 90002)
	}
	if node.Kind == ast.KindPrefixUnaryExpression {
		prefix := node.AsPrefixUnaryExpression()
		if (prefix.Operator == ast.KindPlusPlusToken || prefix.Operator == ast.KindMinusMinusToken) &&
			containsImportCall(prefix.Operand) {
			parsed.addJavaScriptDiagnostic(node, 90002)
		}
	}
}

func (parsed *parseResult) appendNode(node *ast.Node) int32 {
	id := int32(len(parsed.nodes))
	parsed.nodes = append(parsed.nodes, node)
	parsed.nodeIDs[node] = id
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
	parses.Lock()
	delete(parses.items, uintptr(raw))
	parses.Unlock()
}

func result(raw C.uintptr_t) *parseResult {
	parses.RLock()
	parsed := parses.items[uintptr(raw)]
	parses.RUnlock()
	return parsed
}

//export aot_ts_root
func aot_ts_root(raw C.uintptr_t) C.int32_t {
	if result(raw) == nil { return -1 }
	return 0
}

//export aot_ts_node_count
func aot_ts_node_count(raw C.uintptr_t) C.int32_t {
	parsed := result(raw); if parsed == nil { return -1 }
	return C.int32_t(len(parsed.nodes))
}

func node(parsed *parseResult, id C.int32_t) *ast.Node {
	if parsed == nil || id < 0 || int(id) >= len(parsed.nodes) {
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
	// `for await (const x of xs)` is a DIFFERENT iteration protocol, not a decoration on this
	// one, so it gets its own code rather than sharing KindForOfStatement's.
	//
	// IT USED TO RETURN 0, the bridge's "no code for this", and that was worse in two ways. Kind 0
	// is also what every syntax nobody has taught this function returns, so the diagnostic said
	// "bridge kind 0" instead of naming the construct; and the frontend's catch-all for kind 0 is
	// an ABORT, which no test can observe without forking -- and forking here deadlocks on the Go
	// runtime (see tests/native-capability-test.coil). With a real code the refusal happens at
	// INDEXING, recoverably, and `tests/native-frontier-test.coil` can assert it on every gate.
	if n.Kind == ast.KindForOfStatement && n.AsForInOrOfStatement().AwaitModifier != nil {
		return 260
	}
	return C.int32_t(stableKindCode(n.Kind))
}

// Stable aot-kit kind codes. Values retain the bridge's original ABI where possible,
// but the mapping is explicit so an upstream ast.Kind reorder cannot change them.
func stableKindCode(kind ast.Kind) int32 {
	switch kind {
	case ast.KindEndOfFile: return 1
	case ast.KindNumericLiteral: return 8
	case ast.KindStringLiteral, ast.KindNoSubstitutionTemplateLiteral: return 11
	case ast.KindRegularExpressionLiteral: return 14
	case ast.KindTemplateHead: return 15
	case ast.KindTemplateMiddle: return 16
	case ast.KindTemplateTail: return 17
	case ast.KindIdentifier: return 79
	case ast.KindFalseKeyword: return 96
	case ast.KindNewKeyword: return 104
	case ast.KindNullKeyword: return 105
	case ast.KindThisKeyword: return 110
	case ast.KindTrueKeyword: return 111
	case ast.KindVoidKeyword: return 115
	case ast.KindAnyKeyword: return 132
	case ast.KindBooleanKeyword: return 135
	case ast.KindNumberKeyword: return 150
	case ast.KindStringKeyword: return 154
	case ast.KindUnknownKeyword: return 159
	case ast.KindComputedPropertyName: return 168
	case ast.KindBindingElement: return 308
	case ast.KindObjectBindingPattern: return 309
	case ast.KindArrayBindingPattern: return 310
	case ast.KindParameter: return 170
	case ast.KindPropertySignature: return 172
	case ast.KindTypeReference: return 184
	case ast.KindTypeLiteral: return 188
	case ast.KindArrayType: return 189
	case ast.KindUnionType: return 193
	case ast.KindLiteralType: return 202
	case ast.KindArrayLiteralExpression: return 210
	case ast.KindObjectLiteralExpression: return 211
	case ast.KindPropertyAccessExpression: return 212
	case ast.KindElementAccessExpression: return 213
	case ast.KindCallExpression: return 214
	case ast.KindNewExpression: return 215
	case ast.KindParenthesizedExpression: return 218
	case ast.KindFunctionExpression: return 219
	case ast.KindArrowFunction: return 220
	case ast.KindConditionalExpression: return 224
	case ast.KindTemplateExpression: return 231
	case ast.KindTemplateSpan: return 232
	case ast.KindPrefixUnaryExpression: return 225
	case ast.KindPostfixUnaryExpression: return 226
	case ast.KindBinaryExpression: return 227
	case ast.KindTypeOfExpression: return 228
	case ast.KindDeleteExpression: return 229
	case ast.KindVoidExpression: return 230
	case ast.KindBlock: return 242
	case ast.KindEmptyStatement: return 243
	case ast.KindVariableStatement: return 244
	case ast.KindExpressionStatement: return 245
	case ast.KindIfStatement: return 246
	case ast.KindDoStatement: return 247
	case ast.KindWhileStatement: return 248
	case ast.KindForStatement: return 249
	case ast.KindForOfStatement: return 250
	case ast.KindForInStatement: return 259
	case ast.KindLabeledStatement: return 251
	case ast.KindContinueStatement: return 252
	case ast.KindBreakStatement: return 253
	case ast.KindReturnStatement: return 254
	case ast.KindWithStatement: return 255
	case ast.KindSwitchStatement: return 256
	case ast.KindThrowStatement: return 257
	case ast.KindTryStatement: return 258
	case ast.KindCatchClause: return 300
	case ast.KindVariableDeclaration: return 261
	case ast.KindVariableDeclarationList: return 262
	case ast.KindFunctionDeclaration: return 263
	case ast.KindInterfaceDeclaration: return 265
	case ast.KindTypeAliasDeclaration: return 266
	case ast.KindCaseBlock: return 284
	case ast.KindCaseClause: return 285
	case ast.KindDefaultClause: return 286
	case ast.KindPropertyAssignment: return 303
	case ast.KindMethodDeclaration: return 304
	case ast.KindShorthandPropertyAssignment: return 305
	case ast.KindGetAccessor: return 311
	case ast.KindSetAccessor: return 312
	case ast.KindClassDeclaration: return 313
	case ast.KindClassExpression: return 314
	case ast.KindConstructor: return 315
	case ast.KindPropertyDeclaration: return 316
	case ast.KindSourceFile: return 307
	default: return 0
	}
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
	parsed := result(raw); if parsed == nil { return -1 }
	return C.int32_t(len(parsed.diagnosticCodes))
}

//export aot_ts_diagnostic_code
func aot_ts_diagnostic_code(raw C.uintptr_t, index C.int32_t) C.int32_t {
	parsed := result(raw); if parsed == nil { return -1 }
	if index < 0 || int(index) >= len(parsed.diagnosticCodes) {
		return -1
	}
	return C.int32_t(parsed.diagnosticCodes[index])
}

//export aot_ts_diagnostic_start
func aot_ts_diagnostic_start(raw C.uintptr_t, index C.int32_t) C.int32_t {
	parsed := result(raw); if parsed == nil { return -1 }
	if index < 0 || int(index) >= len(parsed.diagnosticStarts) {
		return -1
	}
	return C.int32_t(parsed.diagnosticStarts[index])
}

//export aot_ts_diagnostic_length
func aot_ts_diagnostic_length(raw C.uintptr_t, index C.int32_t) C.int32_t {
	parsed := result(raw); if parsed == nil { return -1 }
	if index < 0 || int(index) >= len(parsed.diagnosticLengths) {
		return -1
	}
	return C.int32_t(parsed.diagnosticLengths[index])
}

func copyString(value string, destination *C.char, capacity C.int32_t) C.int32_t {
	required := len(value)
	if destination == nil || capacity <= 0 { return C.int32_t(required) }
	available := int(capacity) - 1
	if available < 0 { available = 0 }
	if available > required { available = required }
	bytes := unsafe.Slice((*byte)(unsafe.Pointer(destination)), int(capacity))
	copy(bytes[:available], value)
	bytes[available] = 0
	return C.int32_t(required)
}

func stableKindName(kind ast.Kind) string { return strings.TrimPrefix(kind.String(), "Kind") }
func stableOperatorName(kind ast.Kind) string { return strings.TrimSuffix(stableKindName(kind), "Token") }

//export aot_ts_script_kind
func aot_ts_script_kind(raw C.uintptr_t) C.int32_t {
	parsed := result(raw); if parsed == nil { return -1 }; return C.int32_t(parsed.scriptKind)
}

//export aot_ts_node_kind_name
func aot_ts_node_kind_name(raw C.uintptr_t, id C.int32_t, destination *C.char, capacity C.int32_t) C.int32_t {
	n := node(result(raw), id); if n == nil { return -1 }
	return copyString(stableKindName(n.Kind), destination, capacity)
}

//export aot_ts_node_operator_name
func aot_ts_node_operator_name(raw C.uintptr_t, id C.int32_t, destination *C.char, capacity C.int32_t) C.int32_t {
	n := node(result(raw), id); if n == nil { return -1 }
	var operator ast.Kind
	switch n.Kind {
	case ast.KindBinaryExpression: operator = n.AsBinaryExpression().OperatorToken.Kind
	case ast.KindPrefixUnaryExpression: operator = n.AsPrefixUnaryExpression().Operator
	case ast.KindPostfixUnaryExpression: operator = n.AsPostfixUnaryExpression().Operator
	case ast.KindTypeOfExpression: operator = ast.KindTypeOfKeyword
	case ast.KindDeleteExpression: operator = ast.KindDeleteKeyword
	case ast.KindVoidExpression: operator = ast.KindVoidKeyword
	default: return -1
	}
	return copyString(stableOperatorName(operator), destination, capacity)
}

// Stable literal categories, independent of upstream ast.Kind numbering.
//export aot_ts_node_literal_kind
func aot_ts_node_literal_kind(raw C.uintptr_t, id C.int32_t) C.int32_t {
	n := node(result(raw), id); if n == nil { return -1 }
	switch n.Kind {
	case ast.KindNumericLiteral: return 1
	case ast.KindStringLiteral, ast.KindNoSubstitutionTemplateLiteral,
		ast.KindTemplateHead, ast.KindTemplateMiddle, ast.KindTemplateTail: return 2
	case ast.KindTrueKeyword, ast.KindFalseKeyword: return 3
	case ast.KindNullKeyword: return 4
	case ast.KindRegularExpressionLiteral: return 5
	default: return 0
	}
}

//export aot_ts_node_literal_text
func aot_ts_node_literal_text(raw C.uintptr_t, id C.int32_t, destination *C.char, capacity C.int32_t) C.int32_t {
	parsed := result(raw); n := node(parsed, id)
	if n == nil || aot_ts_node_literal_kind(raw, id) <= 0 { return -1 }
	if n.Kind == ast.KindTrueKeyword { return copyString("true", destination, capacity) }
	if n.Kind == ast.KindFalseKeyword { return copyString("false", destination, capacity) }
	if n.Kind == ast.KindNullKeyword { return copyString("null", destination, capacity) }
	return copyString(n.LiteralLikeData().Text, destination, capacity)
}

//export aot_ts_node_numeric_bits
func aot_ts_node_numeric_bits(raw C.uintptr_t, id C.int32_t) C.uint64_t {
	n := node(result(raw), id)
	if n == nil || n.Kind != ast.KindNumericLiteral { return 0 }
	value, err := strconv.ParseFloat(n.LiteralLikeData().Text, 64)
	if err != nil { return 0 }
	return C.uint64_t(math.Float64bits(value))
}

func regexpParts(parsed *parseResult, n *ast.Node) (string, string, bool) {
	if parsed == nil || n == nil || n.Kind != ast.KindRegularExpressionLiteral { return "", "", false }
	raw := parsed.source[scanner.SkipTrivia(parsed.source, n.Pos()):n.End()]
	if len(raw) < 2 || raw[0] != '/' { return "", "", false }
	inClass, escaped, closing := false, false, -1
	for index := 1; index < len(raw); index++ {
		character := raw[index]
		if escaped { escaped = false; continue }
		if character == '\\' { escaped = true; continue }
		if character == '[' { inClass = true; continue }
		if character == ']' { inClass = false; continue }
		if character == '/' && !inClass { closing = index; break }
	}
	if closing < 0 { return "", "", false }
	return raw[1:closing], raw[closing+1:], true
}

//export aot_ts_node_regexp_pattern
func aot_ts_node_regexp_pattern(raw C.uintptr_t, id C.int32_t, destination *C.char, capacity C.int32_t) C.int32_t {
	parsed := result(raw); pattern, _, ok := regexpParts(parsed, node(parsed, id)); if !ok { return -1 }
	return copyString(pattern, destination, capacity)
}

//export aot_ts_node_regexp_flags
func aot_ts_node_regexp_flags(raw C.uintptr_t, id C.int32_t, destination *C.char, capacity C.int32_t) C.int32_t {
	parsed := result(raw); _, flags, ok := regexpParts(parsed, node(parsed, id)); if !ok { return -1 }
	return copyString(flags, destination, capacity)
}

func roleNode(n *ast.Node, role int32, index int32) *ast.Node {
	if index < 0 { return nil }
	switch role {
	case 1: // name
		if index == 0 {
			if n.Kind == ast.KindFunctionExpression { return n.AsFunctionExpression().Name() }
			return ast.GetNameOfDeclaration(n)
		}
	case 2: // body
		if index == 0 {
			if n.Kind == ast.KindCatchClause { return n.AsCatchClause().Block }
			if n.Kind == ast.KindClassDeclaration || n.Kind == ast.KindClassExpression {
				for _, member := range n.ClassLikeData().Members.Nodes {
					if member.Kind == ast.KindConstructor { return member.AsConstructorDeclaration().Body }
				}
				// The class node itself is an empty structural body for a synthesized default
				// constructor. The Coil statement dispatcher treats the declaration as a no-op,
				// then emits the ordinary undefined fallthrough return.
				return n
			}
			return n.Body()
		}
	case 3: // type
		if index == 0 { return n.Type() }
	case 4: // initializer
		if index != 0 { return nil }
		switch n.Kind {
		case ast.KindVariableDeclaration: return n.AsVariableDeclaration().Initializer
		case ast.KindParameter: return n.AsParameterDeclaration().Initializer
		case ast.KindPropertyAssignment: return n.AsPropertyAssignment().Initializer
		case ast.KindForStatement: return n.AsForStatement().Initializer
		case ast.KindForInStatement, ast.KindForOfStatement: return n.AsForInOrOfStatement().Initializer
		}
	case 5: // expression / operand
		if index != 0 { return nil }
		switch n.Kind {
		case ast.KindComputedPropertyName: return n.AsComputedPropertyName().Expression
		case ast.KindParenthesizedExpression: return n.AsParenthesizedExpression().Expression
		case ast.KindExpressionStatement: return n.AsExpressionStatement().Expression
		case ast.KindReturnStatement: return n.AsReturnStatement().Expression
		case ast.KindCallExpression: return n.AsCallExpression().Expression
		case ast.KindNewExpression: return n.AsNewExpression().Expression
		case ast.KindTypeOfExpression: return n.AsTypeOfExpression().Expression
		case ast.KindDeleteExpression: return n.AsDeleteExpression().Expression
		case ast.KindVoidExpression: return n.AsVoidExpression().Expression
		case ast.KindPrefixUnaryExpression: return n.AsPrefixUnaryExpression().Operand
		case ast.KindPostfixUnaryExpression: return n.AsPostfixUnaryExpression().Operand
		case ast.KindSwitchStatement: return n.AsSwitchStatement().Expression
		case ast.KindCaseClause: return n.AsCaseOrDefaultClause().Expression
		case ast.KindForInStatement, ast.KindForOfStatement: return n.AsForInOrOfStatement().Expression
		}
	case 6: // left
		if n.Kind == ast.KindBinaryExpression && index == 0 { return n.AsBinaryExpression().Left }
	case 7: // operator token (binary operators have concrete token nodes)
		if n.Kind == ast.KindBinaryExpression && index == 0 { return n.AsBinaryExpression().OperatorToken }
		if n.Kind == ast.KindPropertyAccessExpression && index == 0 { return n.AsPropertyAccessExpression().QuestionDotToken }
		if n.Kind == ast.KindElementAccessExpression && index == 0 { return n.AsElementAccessExpression().QuestionDotToken }
		if n.Kind == ast.KindCallExpression && index == 0 { return n.AsCallExpression().QuestionDotToken }
	case 8: // right
		if n.Kind == ast.KindBinaryExpression && index == 0 { return n.AsBinaryExpression().Right }
	case 9: // condition
		if index != 0 { return nil }
		switch n.Kind {
		case ast.KindIfStatement: return n.AsIfStatement().Expression
		case ast.KindDoStatement: return n.AsDoStatement().Expression
		case ast.KindWhileStatement: return n.AsWhileStatement().Expression
		case ast.KindForStatement: return n.AsForStatement().Condition
		case ast.KindConditionalExpression: return n.AsConditionalExpression().Condition
		}
	case 10: // then
		if n.Kind == ast.KindIfStatement && index == 0 { return n.AsIfStatement().ThenStatement }
	case 11: // else
		if n.Kind == ast.KindIfStatement && index == 0 { return n.AsIfStatement().ElseStatement }
	case 12: // statement / loop body
		if index != 0 { return nil }
		switch n.Kind {
		case ast.KindDoStatement: return n.AsDoStatement().Statement
		case ast.KindWhileStatement: return n.AsWhileStatement().Statement
		case ast.KindForStatement: return n.AsForStatement().Statement
		case ast.KindForInStatement, ast.KindForOfStatement: return n.AsForInOrOfStatement().Statement
		case ast.KindLabeledStatement: return n.AsLabeledStatement().Statement
		}
	case 13: // callee / constructor expression
		if index != 0 { return nil }
		if n.Kind == ast.KindCallExpression { return n.AsCallExpression().Expression }
		if n.Kind == ast.KindNewExpression { return n.AsNewExpression().Expression }
	case 14: // argument
		var arguments []*ast.Node
		if n.Kind == ast.KindCallExpression { arguments = n.AsCallExpression().Arguments.Nodes }
		if n.Kind == ast.KindNewExpression && n.AsNewExpression().Arguments != nil { arguments = n.AsNewExpression().Arguments.Nodes }
		if int(index) < len(arguments) { return arguments[index] }
	case 15: // parameter
		if n.Kind == ast.KindClassDeclaration || n.Kind == ast.KindClassExpression {
			for _, member := range n.ClassLikeData().Members.Nodes {
				if member.Kind == ast.KindConstructor {
					parameters := member.Parameters()
					if int(index) < len(parameters) { return parameters[index] }
				}
			}
			return nil
		}
		if ast.IsFunctionLike(n) { parameters := n.Parameters(); if int(index) < len(parameters) { return parameters[index] } }
	case 16: // object / receiver
		if index != 0 { return nil }
		if n.Kind == ast.KindPropertyAccessExpression { return n.AsPropertyAccessExpression().Expression }
		if n.Kind == ast.KindElementAccessExpression { return n.AsElementAccessExpression().Expression }
	case 17: // property name
		if n.Kind == ast.KindPropertyAccessExpression && index == 0 { return n.AsPropertyAccessExpression().Name() }
		if n.Kind == ast.KindBindingElement && index == 0 { return n.AsBindingElement().PropertyName }
	case 18: // element/index expression
		if n.Kind == ast.KindElementAccessExpression && index == 0 { return n.AsElementAccessExpression().ArgumentExpression }
	case 19: // array/object element
		var elements []*ast.Node
		if n.Kind == ast.KindArrayLiteralExpression { elements = n.AsArrayLiteralExpression().Elements.Nodes }
		if n.Kind == ast.KindObjectLiteralExpression { elements = n.AsObjectLiteralExpression().Properties.Nodes }
		if n.Kind == ast.KindClassDeclaration || n.Kind == ast.KindClassExpression {
			elements = n.ClassLikeData().Members.Nodes
		}
		if int(index) < len(elements) { return elements[index] }
	case 20: // true expression
		if n.Kind == ast.KindConditionalExpression && index == 0 { return n.AsConditionalExpression().WhenTrue }
	case 21: // false expression
		if n.Kind == ast.KindConditionalExpression && index == 0 { return n.AsConditionalExpression().WhenFalse }
	case 22: // label identifier
		if index != 0 { return nil }
		switch n.Kind {
		case ast.KindLabeledStatement: return n.AsLabeledStatement().Label
		case ast.KindBreakStatement: return n.AsBreakStatement().Label
		case ast.KindContinueStatement: return n.AsContinueStatement().Label
		}
	case 23: // switch case block / clause
		if n.Kind == ast.KindSwitchStatement && index == 0 { return n.AsSwitchStatement().CaseBlock }
		if n.Kind == ast.KindCaseBlock && int(index) < len(n.AsCaseBlock().Clauses.Nodes) {
			return n.AsCaseBlock().Clauses.Nodes[index]
		}
	case 24: // try block
		if n.Kind == ast.KindTryStatement && index == 0 { return n.AsTryStatement().TryBlock }
	case 25: // catch clause
		if n.Kind == ast.KindTryStatement && index == 0 { return n.AsTryStatement().CatchClause }
	case 26: // finally block
		if n.Kind == ast.KindTryStatement && index == 0 { return n.AsTryStatement().FinallyBlock }
	case 27: // catch binding declaration
		if n.Kind == ast.KindCatchClause && index == 0 { return n.AsCatchClause().VariableDeclaration }
	}
	return nil
}

//export aot_ts_node_role
func aot_ts_node_role(raw C.uintptr_t, id C.int32_t, role C.int32_t, index C.int32_t) C.int32_t {
	parsed := result(raw); n := node(parsed, id); if n == nil || role < 1 || role > 27 { return -1 }
	target := roleNode(n, int32(role), int32(index)); if target == nil { return -1 }
	targetID, ok := parsed.nodeIDs[target]; if !ok { return -1 }
	return C.int32_t(targetID)
}

func main() {}
