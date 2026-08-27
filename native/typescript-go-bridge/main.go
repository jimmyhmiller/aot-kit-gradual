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
	"unicode"
	"unicode/utf8"
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
	nodeOffsets map[*ast.Node]int32
	nodeScripts map[*ast.Node]int32
	scriptRoots []int32
	scriptStrict []bool
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
	scriptKindJSModule = 3
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
	forceModule := false
	switch requestedKind {
	case scriptKindJS:
		kind = core.ScriptKindJS
	case scriptKindJSModule:
		kind = core.ScriptKindJS
		forceModule = true
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
		ExternalModuleIndicatorOptions: ast.ExternalModuleIndicatorOptions{Force: forceModule},
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

//export aot_ts_parse_scripts
func aot_ts_parse_scripts(source *C.char, sourceLength C.int32_t, rawLengths *C.int32_t, scriptCount C.int32_t, requestedKind C.int32_t) C.uintptr_t {
	if source == nil || sourceLength < 0 || rawLengths == nil || scriptCount <= 0 { return 0 }
	lengths := unsafe.Slice(rawLengths, int(scriptCount))
	total := int32(0)
	for _, length := range lengths {
		if length < 0 || total > int32(sourceLength)-int32(length) { return 0 }
		total += int32(length)
	}
	if total != int32(sourceLength) { return 0 }

	combined := &parseResult{
		source: C.GoStringN(source, C.int(sourceLength)),
		nodeIDs: make(map[*ast.Node]int32),
		nodeOffsets: make(map[*ast.Node]int32),
		nodeScripts: make(map[*ast.Node]int32),
		scriptKind: int32(requestedKind),
	}
	var statements []int32
	byteOffset := int32(0)
	for scriptIndex, length := range lengths {
		part := (*C.char)(unsafe.Add(unsafe.Pointer(source), uintptr(byteOffset)))
		name := []byte("/script-" + strconv.Itoa(scriptIndex) + ".js")
		handle := aot_ts_parse_ex(part, length, (*C.char)(unsafe.Pointer(&name[0])), C.int32_t(len(name)), requestedKind)
		parsed := result(handle)
		if parsed == nil {
			for _, root := range combined.scriptRoots { _ = root }
			return 0
		}
		nodeBase := int32(len(combined.nodes))
		if scriptIndex == 0 { combined.file = parsed.file }
		for index, n := range parsed.nodes {
			combined.nodes = append(combined.nodes, n)
			combined.nodeIDs[n] = nodeBase + int32(index)
			combined.nodeOffsets[n] = byteOffset
			combined.nodeScripts[n] = int32(scriptIndex)
			children := make([]int32, len(parsed.children[index]))
			for childIndex, child := range parsed.children[index] { children[childIndex] = nodeBase + child }
			combined.children = append(combined.children, children)
		}
		combined.scriptRoots = append(combined.scriptRoots, nodeBase)
		combined.scriptStrict = append(combined.scriptStrict,
			statementsHaveUseStrict(parsed.file.Statements.Nodes))
		for _, statement := range parsed.file.Statements.Nodes {
			if !parsed.isJSDocMetadata(statement) {
				statements = append(statements, combined.nodeIDs[statement])
			}
		}
		for index, code := range parsed.diagnosticCodes {
			combined.diagnosticCodes = append(combined.diagnosticCodes, code)
			combined.diagnosticStarts = append(combined.diagnosticStarts, byteOffset+parsed.diagnosticStarts[index])
			combined.diagnosticLengths = append(combined.diagnosticLengths, parsed.diagnosticLengths[index])
		}
		aot_ts_parse_delete(handle)
		byteOffset += int32(length)
	}
	// The first SourceFile is the virtual compilation-unit root. Its children are the statements
	// from each independently parsed Script in evaluation order, never nested SourceFile nodes.
	combined.children[0] = statements
	parses.Lock()
	handle := parses.next
	parses.next++
	parses.items[handle] = combined
	parses.Unlock()
	return C.uintptr_t(handle)
}

//export aot_ts_script_is_strict
func aot_ts_script_is_strict(raw C.uintptr_t) C.int32_t {
	parsed := result(raw)
	if parsed == nil || parsed.file == nil { return -1 }
	if len(parsed.scriptStrict) > 0 && parsed.scriptStrict[0] { return 1 }
	if statementsHaveUseStrict(parsed.file.Statements.Nodes) { return 1 }
	return 0
}

//export aot_ts_script_is_strict_at
func aot_ts_script_is_strict_at(raw C.uintptr_t, scriptIndex C.int32_t) C.int32_t {
	parsed := result(raw); if parsed == nil || scriptIndex < 0 { return -1 }
	if len(parsed.scriptStrict) == 0 {
		if scriptIndex != 0 { return -1 }
		if statementsHaveUseStrict(parsed.file.Statements.Nodes) { return 1 }
		return 0
	}
	if int(scriptIndex) >= len(parsed.scriptStrict) { return -1 }
	if parsed.scriptStrict[scriptIndex] { return 1 }
	return 0
}

//export aot_ts_script_count
func aot_ts_script_count(raw C.uintptr_t) C.int32_t {
	parsed := result(raw); if parsed == nil { return -1 }
	if len(parsed.scriptRoots) == 0 { return 1 }
	return C.int32_t(len(parsed.scriptRoots))
}

//export aot_ts_script_root
func aot_ts_script_root(raw C.uintptr_t, scriptIndex C.int32_t) C.int32_t {
	parsed := result(raw); if parsed == nil || scriptIndex < 0 { return -1 }
	if len(parsed.scriptRoots) == 0 {
		if scriptIndex == 0 { return 0 }
		return -1
	}
	if int(scriptIndex) >= len(parsed.scriptRoots) { return -1 }
	return C.int32_t(parsed.scriptRoots[scriptIndex])
}

//export aot_ts_node_script
func aot_ts_node_script(raw C.uintptr_t, id C.int32_t) C.int32_t {
	parsed := result(raw); n := node(parsed, id); if n == nil { return -1 }
	if len(parsed.nodeScripts) == 0 { return 0 }
	return C.int32_t(parsed.nodeScripts[n])
}

//export aot_ts_node_binding_class
func aot_ts_node_binding_class(raw C.uintptr_t, id C.int32_t) C.int32_t {
	n := node(result(raw), id); if n == nil { return 0 }
	switch n.Kind {
	case ast.KindFunctionDeclaration:
		return 1
	case ast.KindClassDeclaration:
		return 2
	}
	for current := n; current != nil && current.Kind != ast.KindSourceFile; current = current.Parent {
		if current.Kind == ast.KindVariableDeclarationList {
			if current.Flags&ast.NodeFlagsBlockScoped != 0 { return 2 }
			return 1
		}
	}
	return 0
}

func (parsed *parseResult) addJavaScriptModeDiagnostics() {
	if len(parsed.diagnosticCodes) == 0 { parsed.addRestrictedLineTerminatorErrors() }
	parsed.addModuleTableEarlyErrors()
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
		parsed.addScriptGoalEarlyErrors(n)
		parsed.addModuleGoalEarlyErrors(n)
		parsed.addRestrictedGrammarEarlyErrors(n)
		parsed.addAssignmentTargetEarlyErrors(n)
		parsed.addBindingRestEarlyErrors(n)
		parsed.addPrivateDeleteEarlyErrors(n)
		parsed.addBlockRedeclarationEarlyErrors(n)
		parsed.addLoopLexicalEarlyErrors(n)
		parsed.addCatchClauseEarlyErrors(n)
		parsed.addEmbeddedStatementEarlyErrors(n)
		parsed.addRegExpFlagEarlyErrors(n)
		parsed.addRegExpPropertyEarlyErrors(n)
		parsed.addRegExpNamedGroupEarlyErrors(n)
		parsed.addRegExpIdentityEscapeEarlyErrors(n)
		parsed.addRegExpGrammarEarlyErrors(n)
		parsed.addRegExpUnicodeSetEarlyErrors(n)
		parsed.addFormalParameterEarlyErrors(n)
		parsed.addClassElementEarlyErrors(n)
		parsed.addPrivateNameEarlyErrors(n)
		parsed.addObjectMethodEarlyErrors(n)
		parsed.addObjectLiteralEarlyErrors(n)
		parsed.addFunctionExpressionEarlyErrors(n)
		parsed.addAsyncArrowEarlyErrors(n)
		parsed.addLexicalDeclarationEarlyErrors(n)
		parsed.addStrictBindingEarlyErrors(n)
		parsed.addStrictStatementEarlyErrors(n)
		parsed.addOptionalTaggedTemplateEarlyErrors(n)
		parsed.addCoalesceEarlyErrors(n)
		parsed.addExecutionContextEarlyErrors(n)
		parsed.addControlContextEarlyErrors(n)
		parsed.addDestructuringEarlyErrors(n)
	}
}

func (parsed *parseResult) addJavaScriptDiagnosticRange(start, length int, code int32) {
	parsed.diagnosticCodes = append(parsed.diagnosticCodes, code)
	parsed.diagnosticStarts = append(parsed.diagnosticStarts, int32(start))
	parsed.diagnosticLengths = append(parsed.diagnosticLengths, int32(length))
}

func (parsed *parseResult) addRestrictedLineTerminatorErrors() {
	scan := scanner.NewScanner()
	scan.SetText(parsed.source)
	previous := ast.KindUnknown
	previousEnd := 0
	pendingAsyncStart := -1
	pendingAsyncLength := 0
	for {
		kind := scan.Scan()
		start := scan.TokenStart()
		if pendingAsyncStart >= 0 {
			if kind != ast.KindOpenParenToken && kind != ast.KindEqualsGreaterThanToken {
				parsed.addJavaScriptDiagnosticRange(pendingAsyncStart, pendingAsyncLength, 90099)
			}
			pendingAsyncStart = -1
		}
		separated := previous != ast.KindUnknown && previousEnd <= start &&
			strings.ContainsAny(parsed.source[previousEnd:start], "\r\n\u2028\u2029")
		if separated && (previous == ast.KindThrowKeyword || kind == ast.KindEqualsGreaterThanToken) {
			parsed.addJavaScriptDiagnosticRange(start, scan.TokenEnd()-start, 90095)
		}
		if previous == ast.KindAsyncKeyword && kind == ast.KindAsyncKeyword {
			pendingAsyncStart = start
			pendingAsyncLength = scan.TokenEnd()-start
		}
		if kind == ast.KindEndOfFile { return }
		previous = kind
		previousEnd = scan.TokenEnd()
	}
}

var ecmaBinaryProperties = map[string]bool{
	"ASCII": true, "ASCII_Hex_Digit": true, "Alphabetic": true, "Any": true,
	"Assigned": true, "Bidi_Control": true, "Bidi_Mirrored": true,
	"Case_Ignorable": true, "Cased": true, "Changes_When_Casefolded": true,
	"Changes_When_Casemapped": true, "Changes_When_Lowercased": true,
	"Changes_When_NFKC_Casefolded": true, "Changes_When_Titlecased": true,
	"Changes_When_Uppercased": true, "Dash": true, "Default_Ignorable_Code_Point": true,
	"Deprecated": true, "Diacritic": true, "Emoji": true, "Emoji_Component": true,
	"Emoji_Modifier": true, "Emoji_Modifier_Base": true, "Emoji_Presentation": true,
	"Extended_Pictographic": true, "Extender": true, "Grapheme_Base": true,
	"Grapheme_Extend": true, "Hex_Digit": true, "ID_Continue": true, "ID_Start": true,
	"IDS_Binary_Operator": true, "IDS_Trinary_Operator": true, "Ideographic": true,
	"Join_Control": true, "Logical_Order_Exception": true, "Lowercase": true, "Math": true,
	"Noncharacter_Code_Point": true, "Pattern_Syntax": true, "Pattern_White_Space": true,
	"Quotation_Mark": true, "Radical": true, "Regional_Indicator": true,
	"Sentence_Terminal": true, "Soft_Dotted": true, "Terminal_Punctuation": true,
	"Unified_Ideograph": true, "Uppercase": true, "Variation_Selector": true,
	"White_Space": true, "XID_Continue": true, "XID_Start": true,
}

var ecmaGeneralCategories = map[string]bool{
	"C": true, "Other": true, "Cc": true, "Control": true, "Cf": true, "Format": true,
	"Cn": true, "Unassigned": true, "Co": true, "Private_Use": true, "Cs": true,
	"Surrogate": true, "L": true, "Letter": true, "LC": true, "Cased_Letter": true,
	"Ll": true, "Lowercase_Letter": true, "Lm": true, "Modifier_Letter": true,
	"Lo": true, "Other_Letter": true, "Lt": true, "Titlecase_Letter": true,
	"Lu": true, "Uppercase_Letter": true, "M": true, "Mark": true,
	"Combining_Mark": true, "Mc": true, "Spacing_Mark": true, "Me": true,
	"Enclosing_Mark": true, "Mn": true, "Nonspacing_Mark": true, "N": true,
	"Number": true, "Nd": true, "Decimal_Number": true, "digit": true, "Nl": true,
	"Letter_Number": true, "No": true, "Other_Number": true, "P": true,
	"Punctuation": true, "punct": true, "Pc": true, "Connector_Punctuation": true,
	"Pd": true, "Dash_Punctuation": true, "Pe": true, "Close_Punctuation": true,
	"Pf": true, "Final_Punctuation": true, "Pi": true, "Initial_Punctuation": true,
	"Po": true, "Other_Punctuation": true, "Ps": true, "Open_Punctuation": true,
	"S": true, "Symbol": true, "Sc": true, "Currency_Symbol": true, "Sk": true,
	"Modifier_Symbol": true, "Sm": true, "Math_Symbol": true, "So": true,
	"Other_Symbol": true, "Z": true, "Separator": true, "Zl": true,
	"Line_Separator": true, "Zp": true, "Paragraph_Separator": true, "Zs": true,
	"Space_Separator": true,
}

var ecmaStringProperties = map[string]bool{
	"Basic_Emoji": true, "Emoji_Keycap_Sequence": true, "RGI_Emoji": true,
	"RGI_Emoji_Flag_Sequence": true, "RGI_Emoji_Modifier_Sequence": true,
	"RGI_Emoji_Tag_Sequence": true, "RGI_Emoji_ZWJ_Sequence": true,
}

func validUnicodeProperty(expression string, vMode bool, negated bool, complementedClass bool) bool {
	if expression == "" { return false }
	if ecmaStringProperties[expression] {
		return vMode && !negated && !complementedClass
	}
	parts := strings.Split(expression, "=")
	if len(parts) == 1 { return ecmaBinaryProperties[expression] || ecmaGeneralCategories[expression] }
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" { return false }
	switch parts[0] {
	case "General_Category", "gc":
		return ecmaGeneralCategories[parts[1]]
	case "Script", "sc", "Script_Extensions", "scx":
		return ecmaScriptValues[parts[1]] || unicode.Scripts[parts[1]] != nil
	default:
		return false
	}
}

func invalidRegExpPropertyEscape(pattern, flags string) bool {
	unicodeMode := strings.Contains(flags, "u") || strings.Contains(flags, "v")
	vMode := strings.Contains(flags, "v")
	inClass, complementedClass, escaped := false, false, false
	for index := 0; index < len(pattern); index++ {
		character := pattern[index]
		if escaped { escaped = false; continue }
		if character == '[' {
			inClass = true
			complementedClass = index+1 < len(pattern) && pattern[index+1] == '^'
			continue
		}
		if character == ']' { inClass = false; complementedClass = false; continue }
		if character != '\\' { continue }
		if index+1 >= len(pattern) { break }
		next := pattern[index+1]
		if unicodeMode && next == '\\' && index+3 < len(pattern) &&
			(pattern[index+2] == 'p' || pattern[index+2] == 'P') && pattern[index+3] == '{' {
			close := strings.IndexByte(pattern[index+4:], '}')
			if close < 0 { return true }
			quantifier := pattern[index+4:index+4+close]
			for _, character := range quantifier {
				if character < '0' || character > '9' { return true }
			}
		}
		if next != 'p' && next != 'P' { escaped = true; continue }
		if !unicodeMode { index++; continue }
		if index+2 >= len(pattern) || pattern[index+2] != '{' { return true }
		close := strings.IndexByte(pattern[index+3:], '}')
		if close < 0 { return true }
		close += index + 3
		expression := pattern[index+3:close]
		if !validUnicodeProperty(expression, vMode, next == 'P', complementedClass) { return true }
		if inClass && ((index > 0 && pattern[index-1] == '-') ||
			(close+1 < len(pattern) && pattern[close+1] == '-' &&
				(close+2 >= len(pattern) || pattern[close+2] != ']'))) { return true }
		index = close
	}
	return false
}

func (parsed *parseResult) addRegExpPropertyEarlyErrors(node *ast.Node) {
	pattern, flags, ok := regexpParts(parsed, node)
	if ok && invalidRegExpPropertyEscape(pattern, flags) {
		parsed.addJavaScriptDiagnostic(node, 90024)
	}
}

func regexpIdentifierEscape(text string, at int) (rune, int, bool) {
	if at+2 > len(text) || text[at] != '\\' || text[at+1] != 'u' { return 0, at, false }
	start, digits := at+2, 4
	if start < len(text) && text[start] == '{' {
		start++
		close := strings.IndexByte(text[start:], '}')
		if close < 1 { return 0, at, false }
		digits = close
	}
	end := start + digits
	if end > len(text) { return 0, at, false }
	value, error := strconv.ParseUint(text[start:end], 16, 32)
	if error != nil || value > unicode.MaxRune { return 0, at, false }
	if at+2 < len(text) && text[at+2] == '{' { end++ }
	return rune(value), end, true
}

func regexpIdentifierStart(character rune) bool {
	return character == '$' || character == '_' || unicode.IsLetter(character) ||
		unicode.In(character, unicode.Nl)
}

func regexpIdentifierContinue(character rune) bool {
	return regexpIdentifierStart(character) || character == 0x200c || character == 0x200d ||
		unicode.In(character, unicode.Mn, unicode.Mc, unicode.Nd, unicode.Pc)
}

func validRegExpIdentifierName(raw string) (string, bool) {
	if raw == "" { return "", false }
	runes := make([]rune, 0, len(raw))
	for index := 0; index < len(raw); {
		var character rune
		if raw[index] == '\\' {
			decoded, end, ok := regexpIdentifierEscape(raw, index)
			if !ok { return "", false }
			character, index = decoded, end
		} else {
			decoded, width := utf8.DecodeRuneInString(raw[index:])
			if decoded == utf8.RuneError && width == 1 { return "", false }
			character, index = decoded, index+width
		}
		if len(runes) == 0 && !regexpIdentifierStart(character) { return "", false }
		if len(runes) != 0 && !regexpIdentifierContinue(character) { return "", false }
		runes = append(runes, character)
	}
	return string(runes), true
}

func invalidRegExpNamedGroups(pattern, flags string) bool {
	unicodeMode := strings.Contains(flags, "u") || strings.Contains(flags, "v")
	hasNamedGroup := strings.Contains(pattern, "(?<")
	groups := make(map[string]int)
	var references []string
	inClass, escaped := false, false
	for index := 0; index < len(pattern); index++ {
		if escaped { escaped = false; continue }
		if pattern[index] == '[' { inClass = true; continue }
		if pattern[index] == ']' && inClass { inClass = false; continue }
		if inClass { if pattern[index] == '\\' { escaped = true }; continue }
		if pattern[index] == '\\' {
			if index+1 >= len(pattern) { continue }
			if pattern[index+1] != 'k' { escaped = true; continue }
			if index+2 >= len(pattern) || pattern[index+2] != '<' {
				if unicodeMode || hasNamedGroup { return true }
				index++
				continue
			}
			close := strings.IndexByte(pattern[index+3:], '>')
			if close < 0 { return true }
			close += index + 3
			name, ok := validRegExpIdentifierName(pattern[index+3:close])
			if !ok { return true }
			references = append(references, name)
			index = close
			continue
		}
		if index+2 >= len(pattern) || pattern[index] != '(' || pattern[index+1] != '?' ||
			pattern[index+2] != '<' { continue }
		if index+3 < len(pattern) && (pattern[index+3] == '=' || pattern[index+3] == '!') { continue }
		close := strings.IndexByte(pattern[index+3:], '>')
		if close < 0 { return true }
		close += index + 3
		name, ok := validRegExpIdentifierName(pattern[index+3:close])
		if !ok { return true }
		if previous, exists := groups[name]; exists && !strings.Contains(pattern[previous:index], "|") {
			return true
		}
		groups[name] = index
		index = close
	}
	for _, reference := range references { if _, ok := groups[reference]; !ok { return true } }
	return false
}

func (parsed *parseResult) addRegExpNamedGroupEarlyErrors(node *ast.Node) {
	pattern, flags, ok := regexpParts(parsed, node)
	if ok && invalidRegExpNamedGroups(pattern, flags) {
		parsed.addJavaScriptDiagnostic(node, 90025)
	}
}

func invalidRegExpIdentityEscape(pattern, flags string) bool {
	if !strings.Contains(flags, "u") && !strings.Contains(flags, "v") { return false }
	vMode, inClass := strings.Contains(flags, "v"), false
	for index := 0; index < len(pattern); index++ {
		if pattern[index] == '[' { inClass = true; continue }
		if pattern[index] == ']' && inClass { inClass = false; continue }
		if pattern[index] != '\\' || index+1 >= len(pattern) { continue }
		next := pattern[index+1]
		if next == '\\' { index++; continue }
		if next >= 'A' && next <= 'Z' || next >= 'a' && next <= 'z' {
			if strings.ContainsRune("bBdfnrsStvwWcuxpPk", rune(next)) ||
				(vMode && inClass && next == 'q') { index++; continue }
			return true
		}
		index++
	}
	return false
}

func (parsed *parseResult) addRegExpIdentityEscapeEarlyErrors(node *ast.Node) {
	pattern, flags, ok := regexpParts(parsed, node)
	if ok && invalidRegExpIdentityEscape(pattern, flags) {
		parsed.addJavaScriptDiagnostic(node, 90026)
	}
}

func regexpBracedQuantifier(pattern string, at int) (int, bool) {
	if at >= len(pattern) || pattern[at] != '{' { return at, false }
	close := strings.IndexByte(pattern[at+1:], '}')
	if close < 0 { return at, false }
	close += at + 1
	content := pattern[at+1:close]
	parts := strings.Split(content, ",")
	if len(parts) > 2 || parts[0] == "" { return at, false }
	for index, part := range parts {
		if index == 1 && part == "" { continue }
		if part == "" { return at, false }
		for _, character := range part { if character < '0' || character > '9' { return at, false } }
	}
	return close, true
}

func invalidRegExpGrammar(pattern, flags string) bool {
	unicodeMode := strings.Contains(flags, "u") || strings.Contains(flags, "v")
	inClass, escaped, canQuantify := false, false, false
	captures := 0
	var assertionStack []bool
	for index := 0; index < len(pattern); index++ {
		character := pattern[index]
		if character == 0xE2 && index+2 < len(pattern) && pattern[index+1] == 0x80 &&
			(pattern[index+2] == 0xA8 || pattern[index+2] == 0xA9) { return true }
		if escaped { escaped = false; canQuantify = true; continue }
		if character == '\\' {
			if index+1 >= len(pattern) { return true }
			next := pattern[index+1]
			if unicodeMode && next == 'c' && (index+2 >= len(pattern) ||
				!((pattern[index+2] >= 'A' && pattern[index+2] <= 'Z') ||
					(pattern[index+2] >= 'a' && pattern[index+2] <= 'z'))) { return true }
			if unicodeMode && next >= '1' && next <= '9' {
				value, end := 0, index+1
				for end < len(pattern) && pattern[end] >= '0' && pattern[end] <= '9' {
					value = value*10 + int(pattern[end]-'0'); end++
				}
				if value > captures { return true }
			}
			if unicodeMode && next == '0' && index+2 < len(pattern) &&
				pattern[index+2] >= '0' && pattern[index+2] <= '9' { return true }
			if unicodeMode && next == 'u' && index+2 < len(pattern) && pattern[index+2] == '{' {
				close := strings.IndexByte(pattern[index+3:], '}')
				if close < 0 { return true }
				close += index + 3
				value, error := strconv.ParseUint(pattern[index+3:close], 16, 32)
				if error != nil || value > unicode.MaxRune { return true }
			}
			if inClass && strings.ContainsRune("dDsSwWpP", rune(next)) &&
				((index > 0 && pattern[index-1] == '-') ||
					(index+2 < len(pattern) && pattern[index+2] == '-')) { return true }
			escaped = true
			continue
		}
		if inClass {
			if character == ']' { inClass = false; canQuantify = true }
			continue
		}
		if character == '[' { inClass = true; canQuantify = false; continue }
		if character == '(' {
			assertion := index+2 < len(pattern) && pattern[index+1] == '?' &&
				(pattern[index+2] == '=' || pattern[index+2] == '!' ||
					(index+3 < len(pattern) && pattern[index+2] == '<' &&
						(pattern[index+3] == '=' || pattern[index+3] == '!')))
			assertionStack = append(assertionStack, assertion)
			if index+1 >= len(pattern) || pattern[index+1] != '?' ||
				(index+3 < len(pattern) && pattern[index+2] == '<' &&
					pattern[index+3] != '=' && pattern[index+3] != '!') { captures++ }
			canQuantify = false
			continue
		}
		if character == ')' {
			assertion := false
			if len(assertionStack) != 0 {
				assertion = assertionStack[len(assertionStack)-1]
				assertionStack = assertionStack[:len(assertionStack)-1]
			}
			if assertion && index+1 < len(pattern) {
				next := pattern[index+1]
				_, braced := regexpBracedQuantifier(pattern, index+1)
				lookbehind := index > 2 && strings.Contains(pattern[:index], "(?<")
				if next == '*' || next == '+' || next == '?' || braced {
					if unicodeMode || lookbehind { return true }
				}
			}
			canQuantify = true
			continue
		}
		if character == '|' { canQuantify = false; continue }
		if character == '*' || character == '+' || character == '?' {
			if !canQuantify { return true }
			continue
		}
		if character == '{' {
			close, quantifier := regexpBracedQuantifier(pattern, index)
			if quantifier {
				if !canQuantify { return true }
				index = close
				continue
			}
			if unicodeMode { return true }
		}
		if character == '}' && unicodeMode { return true }
		canQuantify = character != '^' && character != '$'
	}
	return inClass || len(assertionStack) != 0
}

func (parsed *parseResult) addRegExpGrammarEarlyErrors(node *ast.Node) {
	pattern, flags, ok := regexpParts(parsed, node)
	if ok && invalidRegExpGrammar(pattern, flags) {
		parsed.addJavaScriptDiagnostic(node, 90027)
	}
}

func invalidRegExpUnicodeSetSyntax(pattern, flags string) bool {
	if !strings.Contains(flags, "v") { return false }
	depth, escaped := 0, false
	for index := 0; index < len(pattern); index++ {
		character := pattern[index]
		if escaped { escaped = false; continue }
		if character == '\\' { escaped = true; continue }
		if character == '[' { depth++; continue }
		if character == ']' {
			if depth > 0 { depth-- }
			continue
		}
		if depth == 0 { continue }
		if strings.ContainsRune("(){}/|-", rune(character)) { return true }
		if index+1 < len(pattern) && pattern[index+1] == character &&
			strings.ContainsRune("!#$%&*+,.::;<=>?@^`~", rune(character)) { return true }
	}
	return depth != 0
}

func (parsed *parseResult) addRegExpUnicodeSetEarlyErrors(node *ast.Node) {
	pattern, flags, ok := regexpParts(parsed, node)
	if ok && invalidRegExpUnicodeSetSyntax(pattern, flags) {
		parsed.addJavaScriptDiagnostic(node, 90028)
	}
}

func classElementStaticName(node *ast.Node) (string, bool) {
	name := ast.GetNameOfDeclaration(node)
	if name == nil { return "", false }
	if name.Kind == ast.KindComputedPropertyName {
		name = name.AsComputedPropertyName().Expression
	}
	switch name.Kind {
	case ast.KindIdentifier, ast.KindPrivateIdentifier, ast.KindStringLiteral, ast.KindNumericLiteral:
		return name.Text(), true
	default:
		return "", false
	}
}

func classElementContains(node *ast.Node, argumentsName bool, superCall bool, superPrivate bool) bool {
	if node == nil { return false }
	if argumentsName && node.Kind == ast.KindIdentifier && node.Text() == "arguments" { return true }
	if superCall && node.Kind == ast.KindCallExpression &&
		node.AsCallExpression().Expression.Kind == ast.KindSuperKeyword { return true }
	if superPrivate && node.Kind == ast.KindPropertyAccessExpression {
		access := node.AsPropertyAccessExpression()
		if access.Expression.Kind == ast.KindSuperKeyword && access.Name().Kind == ast.KindPrivateIdentifier {
			return true
		}
	}
	// Arrow functions inherit arguments and super from their surrounding class-field or method
	// context. Ordinary functions and nested classes establish a new static-semantics boundary.
	if node.Kind == ast.KindFunctionDeclaration || node.Kind == ast.KindFunctionExpression ||
		node.Kind == ast.KindClassDeclaration || node.Kind == ast.KindClassExpression { return false }
	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if classElementContains(child, argumentsName, superCall, superPrivate) {
			found = true
			return true
		}
		return false
	})
	return found
}

func staticBlockContainsArguments(node *ast.Node) bool {
	if node == nil { return false }
	if node.Kind == ast.KindIdentifier && node.Text() == "arguments" && identifierIsReference(node) {
		return true
	}
	if node.Kind == ast.KindFunctionDeclaration || node.Kind == ast.KindFunctionExpression { return false }
	if node.Kind == ast.KindClassDeclaration || node.Kind == ast.KindClassExpression {
		data := node.ClassLikeData()
		if data.HeritageClauses != nil {
			for _, heritage := range data.HeritageClauses.Nodes {
				if staticBlockContainsArguments(heritage) { return true }
			}
		}
		for _, member := range data.Members.Nodes {
			name := ast.GetNameOfDeclaration(member)
			if name != nil && name.Kind == ast.KindComputedPropertyName &&
				staticBlockContainsArguments(name.AsComputedPropertyName().Expression) { return true }
		}
		return false
	}
	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if staticBlockContainsArguments(child) { found = true; return true }
		return false
	})
	return found
}

func containsReservedBinding(node *ast.Node, target string, stopAtOrdinaryFunction bool) bool {
	if node == nil { return false }
	switch node.Kind {
	case ast.KindVariableDeclaration, ast.KindParameter, ast.KindBindingElement,
		ast.KindFunctionDeclaration, ast.KindFunctionExpression,
		ast.KindClassDeclaration, ast.KindClassExpression:
		for _, name := range appendBoundNames(node.Name(), nil) {
			if name.text == target { return true }
		}
	}
	if stopAtOrdinaryFunction && (node.Kind == ast.KindFunctionDeclaration ||
		node.Kind == ast.KindFunctionExpression) &&
		node.ModifierFlags()&ast.ModifierFlagsAsync == 0 { return false }
	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if containsReservedBinding(child, target, stopAtOrdinaryFunction) {
			found = true
			return true
		}
		return false
	})
	return found
}

func containsYieldExpression(node *ast.Node) bool {
	if node == nil { return false }
	if node.Kind == ast.KindYieldExpression { return true }
	if node.Kind == ast.KindFunctionDeclaration || node.Kind == ast.KindFunctionExpression ||
		node.Kind == ast.KindArrowFunction || node.Kind == ast.KindClassDeclaration ||
		node.Kind == ast.KindClassExpression { return false }
	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if containsYieldExpression(child) { found = true; return true }
		return false
	})
	return found
}

func generatorFunction(node *ast.Node) bool {
	if node == nil { return false }
	switch node.Kind {
	case ast.KindFunctionDeclaration:
		return node.AsFunctionDeclaration().AsteriskToken != nil
	case ast.KindFunctionExpression:
		return node.AsFunctionExpression().AsteriskToken != nil
	case ast.KindMethodDeclaration:
		return node.AsMethodDeclaration().AsteriskToken != nil
	}
	return false
}

func inGeneratorContext(node *ast.Node) bool {
	for current := node.Parent; current != nil; current = current.Parent {
		if current.Kind == ast.KindArrowFunction { continue }
		if ast.IsFunctionLike(current) { return generatorFunction(current) }
		if current.Kind == ast.KindClassStaticBlockDeclaration { return false }
	}
	return false
}

func containsAwaitExpression(node *ast.Node) bool {
	if node == nil { return false }
	if node.Kind == ast.KindAwaitExpression { return true }
	if node.Kind == ast.KindFunctionDeclaration || node.Kind == ast.KindFunctionExpression ||
		node.Kind == ast.KindArrowFunction || node.Kind == ast.KindClassDeclaration ||
		node.Kind == ast.KindClassExpression { return false }
	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if containsAwaitExpression(child) { found = true; return true }
		return false
	})
	return found
}

func identifierIsReference(node *ast.Node) bool {
	if node == nil || node.Kind != ast.KindIdentifier || node.Parent == nil { return false }
	parent := node.Parent
	if ast.GetNameOfDeclaration(parent) == node { return false }
	switch parent.Kind {
	case ast.KindPropertyAccessExpression:
		return parent.AsPropertyAccessExpression().Expression == node
	case ast.KindLabeledStatement:
		return parent.AsLabeledStatement().Label != node
	case ast.KindBreakStatement:
		return parent.AsBreakStatement().Label != node
	case ast.KindContinueStatement:
		return parent.AsContinueStatement().Label != node
	}
	return true
}

func containsIdentifierReference(node *ast.Node, target string) bool {
	if node == nil { return false }
	if node.Kind == ast.KindIdentifier && node.Text() == target && identifierIsReference(node) { return true }
	if node.Kind == ast.KindFunctionDeclaration || node.Kind == ast.KindFunctionExpression ||
		node.Kind == ast.KindClassDeclaration || node.Kind == ast.KindClassExpression { return false }
	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if containsIdentifierReference(child, target) { found = true; return true }
		return false
	})
	return found
}

func containsSuperReference(node *ast.Node) bool {
	if node == nil { return false }
	if node.Kind == ast.KindCallExpression && node.AsCallExpression().Expression.Kind == ast.KindSuperKeyword {
		return true
	}
	if node.Kind == ast.KindPropertyAccessExpression && node.AsPropertyAccessExpression().Expression.Kind == ast.KindSuperKeyword {
		return true
	}
	if node.Kind == ast.KindElementAccessExpression && node.AsElementAccessExpression().Expression.Kind == ast.KindSuperKeyword {
		return true
	}
	if node.Kind == ast.KindFunctionDeclaration || node.Kind == ast.KindFunctionExpression ||
		node.Kind == ast.KindClassDeclaration || node.Kind == ast.KindClassExpression { return false }
	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if containsSuperReference(child) { found = true; return true }
		return false
	})
	return found
}

func (parsed *parseResult) addFunctionExpressionEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindFunctionExpression && node.Kind != ast.KindFunctionDeclaration { return }
	generator := false
	if node.Kind == ast.KindFunctionExpression {
		generator = node.AsFunctionExpression().AsteriskToken != nil
	} else {
		generator = node.AsFunctionDeclaration().AsteriskToken != nil
	}
	async := node.ModifierFlags()&ast.ModifierFlagsAsync != 0
	if node.Name() != nil {
		name := node.Name().Text()
		if generator && name == "yield" { parsed.addJavaScriptDiagnostic(node.Name(), 90045) }
		if async && name == "await" { parsed.addJavaScriptDiagnostic(node.Name(), 90046) }
		if parsed.isStrictScript() && (name == "eval" || name == "arguments") {
			parsed.addJavaScriptDiagnostic(node.Name(), 90047)
		}
	}
	parameterNames := make(map[string]bool)
	for _, parameter := range node.Parameters() {
		for _, name := range appendBoundNames(parameter.Name(), nil) { parameterNames[name.text] = true }
		if containsSuperReference(parameter) { parsed.addJavaScriptDiagnostic(parameter, 90048) }
		if generator && (containsReservedBinding(parameter, "yield", false) || containsYieldExpression(parameter)) {
			parsed.addJavaScriptDiagnostic(parameter, 90049)
		}
		if async && (containsReservedBinding(parameter, "await", true) || containsAwaitExpression(parameter)) {
			parsed.addJavaScriptDiagnostic(parameter, 90050)
		}
	}
	body := node.Body()
	if containsSuperReference(body) { parsed.addJavaScriptDiagnostic(body, 90051) }
	if generator && containsReservedBinding(body, "yield", false) {
		parsed.addJavaScriptDiagnostic(body, 90052)
	}
	if async && containsReservedBinding(body, "await", true) {
		parsed.addJavaScriptDiagnostic(body, 90053)
	}
	if body != nil && body.Kind == ast.KindBlock {
		for _, lexical := range directLexicalNames(body.AsBlock().Statements.Nodes) {
			if parameterNames[lexical.text] { parsed.addJavaScriptDiagnostic(lexical.node, 90054) }
		}
	}
}

func (parsed *parseResult) addAsyncArrowEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindArrowFunction || node.ModifierFlags()&ast.ModifierFlagsAsync == 0 { return }
	parameterNames := make(map[string]bool)
	for _, parameter := range node.Parameters() {
		for _, name := range appendBoundNames(parameter.Name(), nil) { parameterNames[name.text] = true }
		if containsSuperReference(parameter) { parsed.addJavaScriptDiagnostic(parameter, 90057) }
		if containsReservedBinding(parameter, "await", true) || containsAwaitExpression(parameter) {
			parsed.addJavaScriptDiagnostic(parameter, 90058)
		}
	}
	body := node.Body()
	if containsSuperReference(body) { parsed.addJavaScriptDiagnostic(body, 90059) }
	if containsReservedBinding(body, "await", true) || containsIdentifierReference(body, "await") {
		parsed.addJavaScriptDiagnostic(body, 90060)
	}
	if body != nil && body.Kind == ast.KindBlock {
		for _, lexical := range directLexicalNames(body.AsBlock().Statements.Nodes) {
			if parameterNames[lexical.text] { parsed.addJavaScriptDiagnostic(lexical.node, 90061) }
		}
	}
}

func (parsed *parseResult) addObjectMethodEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindMethodDeclaration { return }
	method := node.AsMethodDeclaration()
	generator := method.AsteriskToken != nil
	async := node.ModifierFlags()&ast.ModifierFlagsAsync != 0
	parameterNames := make(map[string]bool)
	for _, parameter := range node.Parameters() {
		for _, name := range appendBoundNames(parameter.Name(), nil) { parameterNames[name.text] = true }
		if classElementContains(parameter, false, true, false) {
			parsed.addJavaScriptDiagnostic(parameter, 90029)
		}
		if generator && (containsReservedBinding(parameter, "yield", false) ||
			containsYieldExpression(parameter)) {
			parsed.addJavaScriptDiagnostic(parameter, 90030)
		}
		if async && containsReservedBinding(parameter, "await", true) {
			parsed.addJavaScriptDiagnostic(parameter, 90031)
		}
	}
	if classElementContains(method.Body, false, true, false) {
		parsed.addJavaScriptDiagnostic(method.Body, 90032)
	}
	if generator && containsReservedBinding(method.Body, "yield", false) {
		parsed.addJavaScriptDiagnostic(method.Body, 90033)
	}
	if async && containsReservedBinding(method.Body, "await", true) {
		parsed.addJavaScriptDiagnostic(method.Body, 90034)
	}
	if method.Body != nil && method.Body.Kind == ast.KindBlock {
		for _, lexical := range directLexicalNames(method.Body.AsBlock().Statements.Nodes) {
			if parameterNames[lexical.text] { parsed.addJavaScriptDiagnostic(lexical.node, 90035) }
		}
	}
}

func (parsed *parseResult) addObjectLiteralEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindObjectLiteralExpression || len(parsed.diagnosticCodes) != 0 { return }
	protoSeen := false
	for _, property := range node.AsObjectLiteralExpression().Properties.Nodes {
		if property.Kind == ast.KindShorthandPropertyAssignment &&
			property.Name().Kind == ast.KindIdentifier &&
			property.AsShorthandPropertyAssignment().ObjectAssignmentInitializer != nil {
			parsed.addJavaScriptDiagnostic(property, 90087)
		}
		if property.Kind != ast.KindPropertyAssignment { continue }
		name := ast.GetNameOfDeclaration(property)
		if name == nil || name.Text() != "__proto__" { continue }
		if protoSeen { parsed.addJavaScriptDiagnostic(name, 90088) }
		protoSeen = true
	}
}

func strictReservedIdentifier(name string) bool {
	switch name {
	case "eval", "arguments", "yield", "implements", "interface", "let", "package",
		"private", "protected", "public", "static":
		return true
	default:
		return false
	}
}

func strictIdentifierReferenceReserved(name string) bool {
	return name != "eval" && name != "arguments" && strictReservedIdentifier(name)
}

func (parsed *parseResult) addStrictBindingEarlyErrors(node *ast.Node) {
	if !parsed.strictAt(node) { return }
	switch node.Kind {
	case ast.KindVariableDeclaration, ast.KindParameter, ast.KindBindingElement,
		ast.KindFunctionDeclaration, ast.KindFunctionExpression,
		ast.KindClassDeclaration, ast.KindClassExpression:
		for _, name := range appendBoundNames(node.Name(), nil) {
			if strictReservedIdentifier(name.text) {
				parsed.addJavaScriptDiagnostic(name.node, 90062)
			}
		}
	case ast.KindCatchClause:
		binding := node.AsCatchClause().VariableDeclaration
		if binding != nil {
			for _, name := range appendBoundNames(binding.Name(), nil) {
				if strictReservedIdentifier(name.text) {
					parsed.addJavaScriptDiagnostic(name.node, 90062)
				}
			}
		}
	case ast.KindShorthandPropertyAssignment:
		name := node.AsShorthandPropertyAssignment().Name()
		if name != nil && strictIdentifierReferenceReserved(name.Text()) {
			parsed.addJavaScriptDiagnostic(name, 90070)
		}
	}
}

func iterationStatement(node *ast.Node) bool {
	if node == nil { return false }
	switch node.Kind {
	case ast.KindDoStatement, ast.KindWhileStatement, ast.KindForStatement,
		ast.KindForInStatement, ast.KindForOfStatement:
		return true
	}
	return false
}

func labelTargetsIteration(node *ast.Node) bool {
	if node == nil || node.Kind != ast.KindLabeledStatement { return false }
	target := node.AsLabeledStatement().Statement
	for target != nil && target.Kind == ast.KindLabeledStatement {
		target = target.AsLabeledStatement().Statement
	}
	return iterationStatement(target)
}

func controlBoundary(node *ast.Node) bool {
	return node != nil && (ast.IsFunctionLike(node) || node.Kind == ast.KindClassStaticBlockDeclaration)
}

func (parsed *parseResult) addControlContextEarlyErrors(node *ast.Node) {
	if node.Kind == ast.KindReturnStatement {
		valid := false
		for current := node.Parent; current != nil; current = current.Parent {
			if ast.IsFunctionLike(current) { valid = true; break }
			if current.Kind == ast.KindClassStaticBlockDeclaration { break }
		}
		if !valid { parsed.addJavaScriptDiagnostic(node, 90063) }
		return
	}
	if node.Kind == ast.KindLabeledStatement {
		label := node.AsLabeledStatement().Label.Text()
		for current := node.Parent; current != nil && !controlBoundary(current); current = current.Parent {
			if current.Kind == ast.KindLabeledStatement && current.AsLabeledStatement().Label.Text() == label {
				parsed.addJavaScriptDiagnostic(node, 90064)
				break
			}
		}
		return
	}
	if node.Kind != ast.KindBreakStatement && node.Kind != ast.KindContinueStatement { return }
	continuing := node.Kind == ast.KindContinueStatement
	var label *ast.Node
	if continuing { label = node.AsContinueStatement().Label } else { label = node.AsBreakStatement().Label }
	valid := false
	for current := node.Parent; current != nil && !controlBoundary(current); current = current.Parent {
		if label != nil {
			if current.Kind == ast.KindLabeledStatement && current.AsLabeledStatement().Label.Text() == label.Text() {
				valid = !continuing || labelTargetsIteration(current)
				break
			}
		} else if iterationStatement(current) || !continuing && current.Kind == ast.KindSwitchStatement {
			valid = true
			break
		}
	}
	if !valid { parsed.addJavaScriptDiagnostic(node, 90065) }
}

func invalidStrictReference(node *ast.Node) bool {
	if node == nil { return false }
	if node.Kind == ast.KindIdentifier { return strictReservedIdentifier(node.Text()) }
	if node.Kind == ast.KindParenthesizedExpression {
		return invalidStrictReference(node.AsParenthesizedExpression().Expression)
	}
	return node.Kind == ast.KindYieldExpression
}

func invalidStrictTargetReference(node *ast.Node) bool {
	if node == nil { return false }
	if node.Kind == ast.KindIdentifier { return strictReservedIdentifier(node.Text()) }
	switch node.Kind {
	case ast.KindParenthesizedExpression:
		return invalidStrictTargetReference(node.AsParenthesizedExpression().Expression)
	case ast.KindPropertyAccessExpression:
		return invalidStrictTargetReference(node.AsPropertyAccessExpression().Expression)
	case ast.KindElementAccessExpression:
		access := node.AsElementAccessExpression()
		return invalidStrictTargetReference(access.Expression) || invalidStrictReference(access.ArgumentExpression)
	default:
		return node.Kind == ast.KindYieldExpression
	}
}

func validAssignmentElement(node *ast.Node, strict bool) bool {
	if node == nil { return true }
	if strict && invalidStrictTargetReference(node) { return false }
	if node.Kind == ast.KindBinaryExpression &&
		node.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken {
		binary := node.AsBinaryExpression()
		return validAssignmentElement(binary.Left, strict) && (!strict || !invalidStrictReference(binary.Right))
	}
	if node.Kind == ast.KindArrayLiteralExpression || node.Kind == ast.KindObjectLiteralExpression {
		return validAssignmentPattern(node, strict)
	}
	return isSimpleAssignmentTarget(node, strict)
}

func validAssignmentPattern(node *ast.Node, strict bool) bool {
	if node == nil { return false }
	if node.Kind == ast.KindArrayLiteralExpression {
		list := node.AsArrayLiteralExpression().Elements
		elements := list.Nodes
		for index, element := range elements {
			if element.Kind == ast.KindOmittedExpression { continue }
			if element.Kind == ast.KindSpreadElement {
				target := element.AsSpreadElement().Expression
				if index != len(elements)-1 || list.HasTrailingComma() ||
					!isSimpleAssignmentTarget(target, strict) || strict && invalidStrictTargetReference(target) { return false }
				continue
			}
			if !validAssignmentElement(element, strict) { return false }
		}
		return true
	}
	if node.Kind == ast.KindObjectLiteralExpression {
		properties := node.AsObjectLiteralExpression().Properties.Nodes
		for index, property := range properties {
			switch property.Kind {
			case ast.KindSpreadAssignment:
				target := property.AsSpreadAssignment().Expression
				if index != len(properties)-1 || !isSimpleAssignmentTarget(target, strict) ||
					strict && invalidStrictTargetReference(target) { return false }
			case ast.KindShorthandPropertyAssignment:
				data := property.AsShorthandPropertyAssignment()
				if data.Name() == nil || data.Name().Kind != ast.KindIdentifier ||
					strict && strictReservedIdentifier(data.Name().Text()) ||
					strict && invalidStrictReference(data.ObjectAssignmentInitializer) { return false }
			case ast.KindPropertyAssignment:
				if !validAssignmentElement(property.AsPropertyAssignment().Initializer, strict) { return false }
			default:
				return false
			}
		}
		return true
	}
	return false
}

func (parsed *parseResult) addDestructuringEarlyErrors(node *ast.Node) {
	strict := parsed.strictAt(node)
	if node.Kind == ast.KindBinaryExpression {
		binary := node.AsBinaryExpression()
		if binary.OperatorToken.Kind == ast.KindEqualsToken && isAssignmentPattern(binary.Left) &&
			!validAssignmentPattern(binary.Left, strict) {
			parsed.addJavaScriptDiagnostic(binary.Left, 90036)
		}
		return
	}
	if node.Kind != ast.KindForInStatement && node.Kind != ast.KindForOfStatement { return }
	initializer := node.AsForInOrOfStatement().Initializer
	if initializer == nil { return }
	if initializer.Kind == ast.KindArrayLiteralExpression || initializer.Kind == ast.KindObjectLiteralExpression {
		if !validAssignmentPattern(initializer, strict) { parsed.addJavaScriptDiagnostic(initializer, 90036) }
		return
	}
	if initializer.Kind != ast.KindVariableDeclarationList { return }
	for _, declaration := range initializer.AsVariableDeclarationList().Declarations.Nodes {
		if declaration.AsVariableDeclaration().Initializer != nil {
			parsed.addJavaScriptDiagnostic(declaration, 90037)
		}
	}
}

func (parsed *parseResult) addLexicalDeclarationEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindVariableDeclarationList || node.Flags&ast.NodeFlagsBlockScoped == 0 { return }
	parent := node.Parent
	loopHead := parent != nil && (parent.Kind == ast.KindForInStatement || parent.Kind == ast.KindForOfStatement)
	for _, declaration := range node.AsVariableDeclarationList().Declarations.Nodes {
		data := declaration.AsVariableDeclaration()
		if node.Flags&ast.NodeFlagsConst != 0 && data.Initializer == nil && !loopHead {
			parsed.addJavaScriptDiagnostic(declaration, 90055)
		}
		for _, name := range appendBoundNames(data.Name(), nil) {
			if name.text == "let" { parsed.addJavaScriptDiagnostic(name.node, 90056) }
		}
	}
}

func copyPrivateEnvironment(outer map[string]bool) map[string]bool {
	result := make(map[string]bool, len(outer))
	for name := range outer { result[name] = true }
	return result
}

func invalidPrivateName(node *ast.Node, environment map[string]bool) *ast.Node {
	if node == nil { return nil }
	if node.Kind == ast.KindPrivateIdentifier {
		if !environment[node.Text()] { return node }
		return nil
	}
	if node.Kind == ast.KindBindingElement {
		property := node.AsBindingElement().PropertyName
		if property != nil && property.Kind == ast.KindPrivateIdentifier { return property }
	}
	if node.Kind == ast.KindClassDeclaration || node.Kind == ast.KindClassExpression {
		data := node.ClassLikeData()
		// Class heritage is evaluated before the class's private environment exists.
		if data.HeritageClauses != nil {
			for _, clause := range data.HeritageClauses.Nodes {
				if invalid := invalidPrivateName(clause, environment); invalid != nil { return invalid }
			}
		}
		classEnvironment := copyPrivateEnvironment(environment)
		for _, member := range data.Members.Nodes {
			name := ast.GetNameOfDeclaration(member)
			if name != nil && name.Kind == ast.KindPrivateIdentifier { classEnvironment[name.Text()] = true }
		}
		for _, member := range data.Members.Nodes {
			declarationName := ast.GetNameOfDeclaration(member)
			var invalid *ast.Node
			member.ForEachChild(func(child *ast.Node) bool {
				if child == declarationName && child.Kind == ast.KindPrivateIdentifier { return false }
				invalid = invalidPrivateName(child, classEnvironment)
				return invalid != nil
			})
			if invalid != nil { return invalid }
		}
		return nil
	}
	var invalid *ast.Node
	node.ForEachChild(func(child *ast.Node) bool {
		invalid = invalidPrivateName(child, environment)
		return invalid != nil
	})
	return invalid
}

func (parsed *parseResult) addPrivateNameEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindSourceFile { return }
	if invalid := invalidPrivateName(node, make(map[string]bool)); invalid != nil {
		parsed.addJavaScriptDiagnostic(invalid, 90023)
	}
}

// JavaScript class early errors are static semantics over a complete class body.
// Keep them here rather than in individual member checks so duplicate-name rules
// have one source-order view of the declaration set.
func (parsed *parseResult) addClassElementEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindClassDeclaration && node.Kind != ast.KindClassExpression { return }
	constructors := 0
	privateKinds := make(map[string]uint8)
	privateSeen := make(map[string]bool)
	privateStatic := make(map[string]bool)
	hasHeritage := node.ClassLikeData().HeritageClauses != nil &&
		len(node.ClassLikeData().HeritageClauses.Nodes) != 0
	for _, member := range node.ClassLikeData().Members.Nodes {
		if member.Kind == ast.KindClassStaticBlockDeclaration {
			body := member.AsClassStaticBlockDeclaration().Body
			if staticBlockContainsArguments(body) { parsed.addJavaScriptDiagnostic(body, 90075) }
			if containsAwaitExpression(body) || containsIdentifierReference(body, "await") {
				parsed.addJavaScriptDiagnostic(body, 90076)
			}
			if containsYieldExpression(body) || containsIdentifierReference(body, "yield") {
				parsed.addJavaScriptDiagnostic(body, 90077)
			}
			if classElementContains(body, false, true, false) { parsed.addJavaScriptDiagnostic(body, 90078) }
			if containsReservedBinding(body, "await", true) { parsed.addJavaScriptDiagnostic(body, 90079) }
		}
		if member.Kind == ast.KindConstructor {
			constructors++
			if constructors > 1 { parsed.addJavaScriptDiagnostic(member, 90010) }
			if member.ModifierFlags()&ast.ModifierFlagsAsync != 0 {
				parsed.addJavaScriptDiagnostic(member, 90020)
			}
			if !hasHeritage && classElementContains(member.AsConstructorDeclaration().Body, false, true, false) {
				parsed.addJavaScriptDiagnostic(member, 90014)
			}
		}
		if member.Kind == ast.KindPropertyDeclaration {
			initializer := member.AsPropertyDeclaration().Initializer
			if classElementContains(initializer, true, false, false) {
				parsed.addJavaScriptDiagnostic(initializer, 90015)
			}
			if classElementContains(initializer, false, true, false) {
				parsed.addJavaScriptDiagnostic(initializer, 90016)
			}
		}
		if member.Kind == ast.KindMethodDeclaration || member.Kind == ast.KindGetAccessor ||
			member.Kind == ast.KindSetAccessor {
			if classElementContains(member.Body(), false, true, false) {
				parsed.addJavaScriptDiagnostic(member, 90017)
			}
			if containsReservedBinding(member.Body(), "yield", false) {
				parsed.addJavaScriptDiagnostic(member, 90021)
			}
			if member.ModifierFlags()&ast.ModifierFlagsAsync != 0 &&
				containsReservedBinding(member.Body(), "await", true) {
				parsed.addJavaScriptDiagnostic(member, 90022)
			}
		}
		if classElementContains(member, false, false, true) {
			parsed.addJavaScriptDiagnostic(member, 90018)
		}

		name, named := classElementStaticName(member)
		if !named { continue }
		isStatic := ast.HasStaticModifier(member)
		isMethod := member.Kind == ast.KindMethodDeclaration || member.Kind == ast.KindGetAccessor ||
			member.Kind == ast.KindSetAccessor
		if isStatic && isMethod && name == "prototype" {
			parsed.addJavaScriptDiagnostic(member, 90019)
		}
		if !isStatic && name == "constructor" && isMethod {
			special := member.Kind == ast.KindGetAccessor || member.Kind == ast.KindSetAccessor
			if member.Kind == ast.KindMethodDeclaration {
				special = member.AsMethodDeclaration().AsteriskToken != nil ||
					member.ModifierFlags()&ast.ModifierFlagsAsync != 0
			}
			if special { parsed.addJavaScriptDiagnostic(member, 90020) }
		}
		if member.Kind == ast.KindPropertyDeclaration {
			if name == "constructor" || isStatic && name == "prototype" {
				parsed.addJavaScriptDiagnostic(member, 90011)
			}
		}

		declarationName := ast.GetNameOfDeclaration(member)
		if declarationName == nil || declarationName.Kind != ast.KindPrivateIdentifier { continue }
		if name == "#constructor" || name == "constructor" {
			parsed.addJavaScriptDiagnostic(member, 90012)
		}
		var kind uint8 = 4
		if member.Kind == ast.KindGetAccessor { kind = 1 }
		if member.Kind == ast.KindSetAccessor { kind = 2 }
		previous := privateKinds[name]
		if privateSeen[name] && privateStatic[name] != isStatic {
			parsed.addJavaScriptDiagnostic(member, 90080)
		} else if previous != 0 && previous|kind != 3 {
			parsed.addJavaScriptDiagnostic(member, 90013)
		} else {
			privateKinds[name] = previous | kind
		}
		if !privateSeen[name] {
			privateSeen[name] = true
			privateStatic[name] = isStatic
		}
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

func isNewTarget(node *ast.Node) bool {
	return node != nil && node.Kind == ast.KindMetaProperty &&
		node.AsMetaProperty().KeywordToken == ast.KindNewKeyword
}

func withinNode(node, ancestor *ast.Node) bool {
	for current := node; current != nil; current = current.Parent {
		if current == ancestor { return true }
	}
	return false
}

func newTargetContext(node *ast.Node) bool {
	for current := node.Parent; current != nil; current = current.Parent {
		if current.Kind == ast.KindClassStaticBlockDeclaration { return false }
		if current.Kind == ast.KindArrowFunction { continue }
		if ast.IsFunctionLike(current) { return true }
	}
	return false
}

func superPropertyContext(node *ast.Node) bool {
	for current := node.Parent; current != nil; current = current.Parent {
		if current.Kind == ast.KindArrowFunction { continue }
		switch current.Kind {
		case ast.KindClassStaticBlockDeclaration:
			return true
		case ast.KindPropertyDeclaration, ast.KindMethodDeclaration, ast.KindGetAccessor,
			ast.KindSetAccessor, ast.KindConstructor:
			name := ast.GetNameOfDeclaration(current)
			return name == nil || !withinNode(node, name)
		}
		if ast.IsFunctionLike(current) { return false }
	}
	return false
}

func derivedConstructorContext(node *ast.Node) bool {
	for current := node.Parent; current != nil; current = current.Parent {
		if current.Kind == ast.KindArrowFunction { continue }
		if current.Kind == ast.KindConstructor {
			body := current.AsConstructorDeclaration().Body
			if body == nil || !withinNode(node, body) { return false }
			owner := current.Parent
			return owner != nil && (owner.Kind == ast.KindClassDeclaration || owner.Kind == ast.KindClassExpression) &&
				owner.ClassLikeData().HeritageClauses != nil &&
				len(owner.ClassLikeData().HeritageClauses.Nodes) != 0
		}
		if ast.IsFunctionLike(current) || current.Kind == ast.KindClassStaticBlockDeclaration { return false }
	}
	return false
}

func (parsed *parseResult) addExecutionContextEarlyErrors(node *ast.Node) {
	if isNewTarget(node) {
		meta := node.AsMetaProperty()
		start := scanner.SkipTrivia(parsed.source, meta.Name().Pos())
		rawName := ""
		if start >= 0 && start <= meta.Name().End() && meta.Name().End() <= len(parsed.source) {
			rawName = parsed.source[start:meta.Name().End()]
		}
		if meta.Name().Text() != "target" || rawName != "target" || !newTargetContext(node) {
			parsed.addJavaScriptDiagnostic(node, 90083)
		}
		return
	}
	if node.Kind == ast.KindCallExpression && node.AsCallExpression().Expression.Kind == ast.KindSuperKeyword {
		if !derivedConstructorContext(node) { parsed.addJavaScriptDiagnostic(node, 90084) }
		return
	}
	if node.Kind == ast.KindPropertyAccessExpression &&
		node.AsPropertyAccessExpression().Expression.Kind == ast.KindSuperKeyword ||
		node.Kind == ast.KindElementAccessExpression &&
			node.AsElementAccessExpression().Expression.Kind == ast.KindSuperKeyword {
		if !superPropertyContext(node) { parsed.addJavaScriptDiagnostic(node, 90085) }
	}
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

func statementsHaveUseStrict(statements []*ast.Node) bool {
	for _, statement := range statements {
		if statement.Kind != ast.KindExpressionStatement { return false }
		expression := statement.AsExpressionStatement().Expression
		if expression.Kind != ast.KindStringLiteral { return false }
		if expression.Text() == "use strict" { return true }
	}
	return false
}

func (parsed *parseResult) isStrictScript() bool {
	return parsed.scriptKind == scriptKindJSModule || parsed.file != nil && parsed.file.Statements != nil &&
		statementsHaveUseStrict(parsed.file.Statements.Nodes)
}

func (parsed *parseResult) isModuleGoal() bool {
	return parsed.scriptKind == scriptKindJSModule
}

func hexDigit(byteValue byte) (int, bool) {
	switch {
	case byteValue >= '0' && byteValue <= '9': return int(byteValue - '0'), true
	case byteValue >= 'a' && byteValue <= 'f': return int(byteValue-'a') + 10, true
	case byteValue >= 'A' && byteValue <= 'F': return int(byteValue-'A') + 10, true
	default: return 0, false
	}
}

func unicodeEscapeAt(text string, at int) (int, int, bool) {
	if at+6 > len(text) || text[at] != '\\' || text[at+1] != 'u' || text[at+2] == '{' {
		return 0, at, false
	}
	value := 0
	for index := at + 2; index < at+6; index++ {
		digit, ok := hexDigit(text[index]); if !ok { return 0, at, false }
		value = value*16 + digit
	}
	return value, at + 6, true
}

func hasUnpairedSurrogateEscape(text string) bool {
	for index := 0; index < len(text); index++ {
		value, next, ok := unicodeEscapeAt(text, index); if !ok { continue }
		if value >= 0xD800 && value <= 0xDBFF {
			low, afterLow, paired := unicodeEscapeAt(text, next)
			if !paired || low < 0xDC00 || low > 0xDFFF { return true }
			index = afterLow - 1
			continue
		}
		if value >= 0xDC00 && value <= 0xDFFF { return true }
		index = next - 1
	}
	return false
}

func (parsed *parseResult) rawNode(node *ast.Node) string {
	if node == nil { return "" }
	start := scanner.SkipTrivia(parsed.source, node.Pos())
	if start < 0 || start > node.End() || node.End() > len(parsed.source) { return "" }
	return parsed.source[start:node.End()]
}

func (parsed *parseResult) checkModuleExportName(node *ast.Node) {
	if node != nil && node.Kind == ast.KindStringLiteral &&
		hasUnpairedSurrogateEscape(parsed.rawNode(node)) {
		parsed.addJavaScriptDiagnostic(node, 90114)
	}
}

func (parsed *parseResult) addModuleTableEarlyErrors() {
	if !parsed.isModuleGoal() || parsed.file == nil || parsed.file.Statements == nil { return }
	locals := make(map[string]bool)
	imports := make(map[string]bool)
	exports := make(map[string]bool)
	var localExports []declaredName
	addLocal := func(name declaredName) { locals[name.text] = true }
	addImport := func(name *ast.Node) {
		if name == nil { return }
		text := name.Text()
		if imports[text] { parsed.addJavaScriptDiagnostic(name, 90107) }
		imports[text] = true
		locals[text] = true
		if text == "eval" || text == "arguments" || text == "await" {
			parsed.addJavaScriptDiagnostic(name, 90108)
		}
	}
	addExport := func(name *ast.Node) {
		if name == nil { return }
		text := name.Text()
		if exports[text] { parsed.addJavaScriptDiagnostic(name, 90109) }
		exports[text] = true
	}
	for _, statement := range parsed.file.Statements.Nodes {
		switch statement.Kind {
		case ast.KindVariableStatement:
			for _, declaration := range statement.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
				for _, name := range appendBoundNames(declaration.Name(), nil) { addLocal(name) }
			}
		case ast.KindFunctionDeclaration, ast.KindClassDeclaration:
			for _, name := range appendBoundNames(statement.Name(), nil) { addLocal(name) }
		case ast.KindImportDeclaration:
			clauseNode := statement.AsImportDeclaration().ImportClause
			if clauseNode == nil { continue }
			clause := clauseNode.AsImportClause()
			addImport(clauseNode.Name())
			bindings := clause.NamedBindings
			if bindings == nil { continue }
			if bindings.Kind == ast.KindNamespaceImport {
				addImport(bindings.Name())
			} else if bindings.Kind == ast.KindNamedImports {
				for _, specifier := range bindings.AsNamedImports().Elements.Nodes {
					addImport(specifier.Name())
				}
			}
		}
	}
	for _, statement := range parsed.file.Statements.Nodes {
		if statement.Kind == ast.KindExportAssignment {
			if exports["default"] { parsed.addJavaScriptDiagnostic(statement, 90109) }
			exports["default"] = true
			assignment := statement.AsExportAssignment()
			if assignment.Expression != nil && assignment.Expression.Kind == ast.KindBinaryExpression &&
				assignment.Expression.AsBinaryExpression().OperatorToken.Kind == ast.KindCommaToken {
				parsed.addJavaScriptDiagnostic(assignment.Expression, 90111)
			}
			start := scanner.SkipTrivia(parsed.source, statement.Pos())
			expressionStart := len(parsed.source)
			if assignment.Expression != nil { expressionStart = assignment.Expression.Pos() }
			if start >= 0 && start <= expressionStart && expressionStart <= len(parsed.source) &&
				strings.Contains(parsed.source[start:expressionStart], "\\") {
				parsed.addJavaScriptDiagnostic(statement, 90112)
			}
			continue
		}
		if statement.Kind == ast.KindExportDeclaration {
			declaration := statement.AsExportDeclaration()
			clause := declaration.ExportClause
			if clause == nil { continue }
			if clause.Kind == ast.KindNamedExports {
				for _, specifier := range clause.AsNamedExports().Elements.Nodes {
				exportSpecifier := specifier.AsExportSpecifier()
				parsed.checkModuleExportName(exportSpecifier.PropertyName)
				parsed.checkModuleExportName(specifier.Name())
					addExport(specifier.Name())
					if declaration.ModuleSpecifier == nil {
						local := exportSpecifier.PropertyName
						if local == nil { local = specifier.Name() }
						if local.Kind == ast.KindStringLiteral {
							parsed.addJavaScriptDiagnostic(local, 90115)
						}
						localExports = append(localExports, declaredName{text: local.Text(), node: local})
					}
				}
			} else if clause.Kind == ast.KindNamespaceExport {
				addExport(clause.Name())
			}
			continue
		}
		if statement.ModifierFlags()&ast.ModifierFlagsExport == 0 { continue }
		if statement.ModifierFlags()&ast.ModifierFlagsDefault != 0 {
			if statement.Kind == ast.KindVariableStatement {
				parsed.addJavaScriptDiagnostic(statement, 90113)
			}
			if exports["default"] { parsed.addJavaScriptDiagnostic(statement, 90109) }
			exports["default"] = true
		} else {
			switch statement.Kind {
			case ast.KindVariableStatement:
				for _, declaration := range statement.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
					for _, name := range appendBoundNames(declaration.Name(), nil) { addExport(name.node) }
				}
			case ast.KindFunctionDeclaration, ast.KindClassDeclaration:
				addExport(statement.Name())
			}
		}
	}
	for _, binding := range localExports {
		if !locals[binding.text] { parsed.addJavaScriptDiagnostic(binding.node, 90110) }
	}
}

// Await grammar parameters do not propagate into an ordinary function or a class field
// initializer. Stop at nested function/class boundaries: those establish their own parameters and
// are checked when the outer node walk reaches them.
func containsModuleAwaitUse(node *ast.Node) bool {
	if node == nil { return false }
	if node.Kind == ast.KindAwaitExpression ||
		node.Kind == ast.KindIdentifier && node.Text() == "await" && identifierIsReference(node) {
		return true
	}
	if ast.IsFunctionLike(node) || node.Kind == ast.KindClassDeclaration ||
		node.Kind == ast.KindClassExpression { return false }
	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if containsModuleAwaitUse(child) { found = true; return true }
		return false
	})
	return found
}

func hasFunctionAncestor(node *ast.Node) bool {
	for current := node.Parent; current != nil && current.Kind != ast.KindSourceFile; current = current.Parent {
		if ast.IsFunctionLike(current) { return true }
	}
	return false
}

func (parsed *parseResult) addModuleGoalEarlyErrors(node *ast.Node) {
	if !parsed.isModuleGoal() { return }
	if isImportMeta(node) {
		meta := node.AsMetaProperty()
		start := scanner.SkipTrivia(parsed.source, meta.Name().Pos())
		rawName := ""
		if start >= 0 && start <= meta.Name().End() && meta.Name().End() <= len(parsed.source) {
			rawName = parsed.source[start:meta.Name().End()]
		}
		if rawName != "meta" { parsed.addJavaScriptDiagnostic(node, 90116) }
	}
	if node.Kind == ast.KindImportSpecifier {
		parsed.checkModuleExportName(node.AsImportSpecifier().PropertyName)
	}
	if node.Kind == ast.KindImportAttributes {
		seen := make(map[string]bool)
		for _, attribute := range node.AsImportAttributes().Attributes.Nodes {
			name := attribute.Name()
			key := name.Text()
			if seen[key] { parsed.addJavaScriptDiagnostic(name, 90117) }
			seen[key] = true
		}
	}
	topLevelModuleDeclaration := node.Kind == ast.KindImportDeclaration ||
		node.Kind == ast.KindExportDeclaration || node.Kind == ast.KindExportAssignment ||
		(node.ModifierFlags()&ast.ModifierFlagsExport != 0 &&
			(node.Kind == ast.KindVariableStatement || node.Kind == ast.KindFunctionDeclaration ||
				node.Kind == ast.KindClassDeclaration))
	if topLevelModuleDeclaration && (node.Parent == nil || node.Parent.Kind != ast.KindSourceFile) {
		parsed.addJavaScriptDiagnostic(node, 90106)
	}
	switch node.Kind {
	case ast.KindVariableDeclaration, ast.KindParameter, ast.KindBindingElement,
		ast.KindFunctionDeclaration, ast.KindFunctionExpression,
		ast.KindClassDeclaration, ast.KindClassExpression:
		for _, name := range appendBoundNames(node.Name(), nil) {
			if name.text == "await" { parsed.addJavaScriptDiagnostic(name.node, 90100) }
		}
	}
	if ast.IsFunctionLike(node) && node.ModifierFlags()&ast.ModifierFlagsAsync == 0 {
		for _, parameter := range node.Parameters() {
			if containsModuleAwaitUse(parameter) {
				parsed.addJavaScriptDiagnostic(parameter, 90101)
			}
		}
		if containsModuleAwaitUse(node.Body()) { parsed.addJavaScriptDiagnostic(node.Body(), 90102) }
	}
	if node.Kind == ast.KindPropertyDeclaration {
		initializer := node.AsPropertyDeclaration().Initializer
		if containsModuleAwaitUse(initializer) { parsed.addJavaScriptDiagnostic(initializer, 90103) }
	}
	if node.Kind == ast.KindIdentifier && node.Text() == "yield" &&
		identifierIsReference(node) && !hasFunctionAncestor(node) {
		parsed.addJavaScriptDiagnostic(node, 90104)
	}
	if node.Kind == ast.KindVariableStatement &&
		node.ModifierFlags()&ast.ModifierFlagsExport != 0 {
		seen := make(map[string]bool)
		for _, declaration := range node.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
			for _, name := range appendBoundNames(declaration.Name(), nil) {
				if seen[name.text] { parsed.addJavaScriptDiagnostic(name.node, 90105) }
				seen[name.text] = true
			}
		}
	}
}

func isSimpleAssignmentTarget(node *ast.Node, strict bool) bool {
	if node == nil { return false }
	switch node.Kind {
	case ast.KindParenthesizedExpression:
		return isSimpleAssignmentTarget(node.AsParenthesizedExpression().Expression, strict)
	case ast.KindIdentifier:
		name := node.Text()
		return !strict || !strictReservedIdentifier(name)
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
	strict := parsed.strictAt(node)
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
	if node.Kind == ast.KindSourceFile { return node.AsSourceFile().Statements.Nodes }
	if node.Kind != ast.KindCaseBlock { return nil }
	var statements []*ast.Node
	for _, clause := range node.AsCaseBlock().Clauses.Nodes {
		statements = append(statements, clause.AsCaseOrDefaultClause().Statements.Nodes...)
	}
	return statements
}

func (parsed *parseResult) addBlockRedeclarationEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindBlock && node.Kind != ast.KindCaseBlock && node.Kind != ast.KindSourceFile { return }
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

func (parsed *parseResult) addLoopLexicalEarlyErrors(node *ast.Node) {
	var initializer, statement *ast.Node
	switch node.Kind {
	case ast.KindForStatement:
		loop := node.AsForStatement()
		initializer, statement = loop.Initializer, loop.Statement
	case ast.KindForInStatement, ast.KindForOfStatement:
		loop := node.AsForInOrOfStatement()
		initializer, statement = loop.Initializer, loop.Statement
	default:
		return
	}
	if initializer == nil || initializer.Kind != ast.KindVariableDeclarationList ||
		initializer.Flags&ast.NodeFlagsBlockScoped == 0 { return }
	if (node.Kind == ast.KindForInStatement || node.Kind == ast.KindForOfStatement) &&
		len(initializer.AsVariableDeclarationList().Declarations.Nodes) != 1 {
		parsed.addJavaScriptDiagnostic(initializer, 90089)
	}
	var bound []declaredName
	for _, declaration := range initializer.AsVariableDeclarationList().Declarations.Nodes {
		bound = appendDeclarationNames(declaration, bound)
	}
	seen := make(map[string]bool)
	for _, name := range bound {
		if seen[name.text] { parsed.addJavaScriptDiagnostic(name.node, 90071) }
		seen[name.text] = true
	}
	for _, name := range appendVarDeclaredNames(statement, nil) {
		if seen[name.text] { parsed.addJavaScriptDiagnostic(name.node, 90072) }
	}
}

func (parsed *parseResult) addCatchClauseEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindCatchClause { return }
	clause := node.AsCatchClause()
	if clause.VariableDeclaration == nil { return }
	bound := appendBoundNames(clause.VariableDeclaration.Name(), nil)
	seen := make(map[string]bool)
	for _, name := range bound {
		if seen[name.text] { parsed.addJavaScriptDiagnostic(name.node, 90073) }
		seen[name.text] = true
	}
	if clause.Block == nil { return }
	for _, name := range directLexicalNames(clause.Block.AsBlock().Statements.Nodes) {
		if seen[name.text] { parsed.addJavaScriptDiagnostic(name.node, 90074) }
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
	if node.Kind == ast.KindLabeledStatement {
		if invalid := invalidEmbeddedStatement(node.AsLabeledStatement().Statement, strict, false); invalid != nil {
			parsed.addJavaScriptDiagnostic(invalid, 90007)
		}
		return
	}
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
	return statementsHaveUseStrict(body.AsBlock().Statements.Nodes)
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

func (parsed *parseResult) addStrictStatementEarlyErrors(node *ast.Node) {
	if !parsed.strictAt(node) { return }
	if node.Kind == ast.KindIdentifier && node.Text() == "yield" && identifierIsReference(node) {
		parsed.addJavaScriptDiagnostic(node, 90092)
	}
	if node.Kind == ast.KindLabeledStatement && node.AsLabeledStatement().Label.Text() == "yield" {
		parsed.addJavaScriptDiagnostic(node.AsLabeledStatement().Label, 90092)
	}
	if node.Kind == ast.KindWithStatement {
		parsed.addJavaScriptDiagnostic(node, 90066)
	}
	if node.Kind == ast.KindDeleteExpression &&
		isParenthesizedIdentifierReference(node.AsDeleteExpression().Expression) {
		parsed.addJavaScriptDiagnostic(node, 90067)
	}
}

func isParenthesizedIdentifierReference(node *ast.Node) bool {
	for node != nil && node.Kind == ast.KindParenthesizedExpression {
		node = node.AsParenthesizedExpression().Expression
	}
	return node != nil && node.Kind == ast.KindIdentifier
}

func (parsed *parseResult) addOptionalTaggedTemplateEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindTaggedTemplateExpression { return }
	tagged := node.AsTaggedTemplateExpression()
	if tagged.QuestionDotToken != nil || ast.IsOptionalChain(tagged.Tag) {
		parsed.addJavaScriptDiagnostic(node, 90068)
	}
}

func logicalAndOr(node *ast.Node) bool {
	if node == nil || node.Kind != ast.KindBinaryExpression { return false }
	operator := node.AsBinaryExpression().OperatorToken.Kind
	return operator == ast.KindAmpersandAmpersandToken || operator == ast.KindBarBarToken
}

func coalesceExpression(node *ast.Node) bool {
	return node != nil && node.Kind == ast.KindBinaryExpression &&
		node.AsBinaryExpression().OperatorToken.Kind == ast.KindQuestionQuestionToken
}

func (parsed *parseResult) addCoalesceEarlyErrors(node *ast.Node) {
	if node.Kind != ast.KindBinaryExpression { return }
	binary := node.AsBinaryExpression()
	operator := binary.OperatorToken.Kind
	invalid := operator == ast.KindQuestionQuestionToken &&
		(logicalAndOr(binary.Left) || logicalAndOr(binary.Right))
	invalid = invalid ||
		(operator == ast.KindAmpersandAmpersandToken || operator == ast.KindBarBarToken) &&
		(coalesceExpression(binary.Left) || coalesceExpression(binary.Right))
	if invalid {
		parsed.addJavaScriptDiagnostic(node, 90069)
	}
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
	if node.Kind == ast.KindGetAccessor && len(parameters) != 0 {
		parsed.addJavaScriptDiagnostic(node, 90081)
	}
	if !simple && functionHasUseStrict(node) {
		parsed.addJavaScriptDiagnostic(node, 90009)
	}
	seen := make(map[string]*ast.Node)
	for i, parameter := range parameters {
		data := parameter.AsParameterDeclaration()
		if containsYieldExpression(parameter) || strict && containsIdentifierReference(parameter, "yield") {
			parsed.addJavaScriptDiagnostic(parameter, 90082)
		}
		if node.Kind == ast.KindArrowFunction && inGeneratorContext(node) &&
			containsIdentifierReference(parameter, "yield") {
			parsed.addJavaScriptDiagnostic(parameter, 90096)
		}
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

func (parsed *parseResult) addScriptGoalEarlyErrors(node *ast.Node) {
	if parsed.isModuleGoal() { return }
	if node.Kind == ast.KindImportDeclaration || node.Kind == ast.KindExportAssignment ||
		node.Kind == ast.KindExportDeclaration || isImportMeta(node) {
		parsed.addJavaScriptDiagnostic(node, 90086)
	}
}

func (parsed *parseResult) addRestrictedGrammarEarlyErrors(node *ast.Node) {
	switch node.Kind {
	case ast.KindYieldExpression:
		if !inGeneratorContext(node) { parsed.addJavaScriptDiagnostic(node, 90097) }
	case ast.KindBinaryExpression:
		binary := node.AsBinaryExpression()
		if binary.OperatorToken.Kind == ast.KindInKeyword &&
			binary.Left.Kind == ast.KindBinaryExpression {
			left := binary.Left.AsBinaryExpression()
			if left.OperatorToken.Kind == ast.KindInKeyword && left.Left.Kind == ast.KindPrivateIdentifier {
				parsed.addJavaScriptDiagnostic(node, 90098)
			}
		}
	case ast.KindSwitchStatement:
		defaults := 0
		for _, clause := range node.AsSwitchStatement().CaseBlock.AsCaseBlock().Clauses.Nodes {
			if clause.Kind == ast.KindDefaultClause {
				defaults++
				if defaults > 1 { parsed.addJavaScriptDiagnostic(clause, 90093) }
			}
		}
	case ast.KindForOfStatement:
		initializer := node.AsForInOrOfStatement().Initializer
		if initializer != nil && initializer.Kind == ast.KindIdentifier && initializer.Text() == "async" {
			parsed.addJavaScriptDiagnostic(initializer, 90094)
		}
	}
}

func (parsed *parseResult) isJSDocMetadata(node *ast.Node) bool {
	if ast.IsJSDocNode(node) || node.Flags&ast.NodeFlagsJSDoc != 0 ||
		node.Kind == ast.KindJSTypeAliasDeclaration {
		return true
	}
	if int(node.Kind) == 0 {
		start, end := node.Pos(), node.End()
		if start >= 0 && end >= start && end <= len(parsed.source) {
			span := strings.TrimSpace(parsed.source[start:end])
			if strings.HasPrefix(span, "/**") || strings.HasPrefix(span, "@") {
				return true
			}
		}
	}
	position := node.Pos()
	if position < 0 || position > len(parsed.source) { return false }
	prefix := parsed.source[:position]
	return strings.LastIndex(prefix, "/**") > strings.LastIndex(prefix, "*/")
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
		childID := parsed.appendNode(child)
		// JSDoc is parser metadata, not JavaScript/TypeScript program syntax. Keep every node in
		// the identity registry because upstream role links may still target it, but detach raw
		// JSDoc and JavaScript's synthetic JSDoc type aliases from the executable child tree.
		if !parsed.isJSDocMetadata(child) {
			parsed.children[id] = append(parsed.children[id], childID)
		}
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
	case ast.KindSpreadElement: return 317
	case ast.KindSpreadAssignment: return 318
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
	offset := int32(0)
	if parsed.nodeOffsets != nil { offset = parsed.nodeOffsets[n] }
	text := parsed.source
	if offset > 0 || len(parsed.scriptRoots) > 0 {
		end := len(text)
		if script := parsed.nodeScripts[n]; int(script)+1 < len(parsed.scriptRoots) {
			next := node(parsed, C.int32_t(parsed.scriptRoots[script+1]))
			end = int(parsed.nodeOffsets[next])
		}
		text = text[int(offset):end]
	}
	return C.int32_t(offset) + C.int32_t(scanner.SkipTrivia(text, n.Pos()))
}

//export aot_ts_node_end
func aot_ts_node_end(raw C.uintptr_t, id C.int32_t) C.int32_t {
	parsed := result(raw); n := node(parsed, id)
	if n == nil {
		return -1
	}
	offset := int32(0); if parsed.nodeOffsets != nil { offset = parsed.nodeOffsets[n] }
	return C.int32_t(offset) + C.int32_t(n.End())
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

//export aot_ts_node_name_text
func aot_ts_node_name_text(raw C.uintptr_t, id C.int32_t, destination *C.char, capacity C.int32_t) C.int32_t {
	n := node(result(raw), id)
	if n == nil || (n.Kind != ast.KindIdentifier && n.Kind != ast.KindPrivateIdentifier) { return -1 }
	// Node.Text is the parser's canonical IdentifierName, unlike the source range: escapes such as
	// `bre\u0061k` have already been decoded to the property key JavaScript observes.
	return copyString(n.Text(), destination, capacity)
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
	offset := int32(0); if parsed.nodeOffsets != nil { offset = parsed.nodeOffsets[n] }
	end := len(parsed.source)
	if script := parsed.nodeScripts[n]; int(script)+1 < len(parsed.scriptRoots) {
		next := node(parsed, C.int32_t(parsed.scriptRoots[script+1]))
		end = int(parsed.nodeOffsets[next])
	}
	local := parsed.source[int(offset):end]
	raw := local[scanner.SkipTrivia(local, n.Pos()):n.End()]
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
		case ast.KindBindingElement: return n.AsBindingElement().Initializer
		case ast.KindPropertyAssignment: return n.AsPropertyAssignment().Initializer
		case ast.KindPropertyDeclaration: return n.AsPropertyDeclaration().Initializer
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
	case 28: // classic for-loop incrementor
		if n.Kind == ast.KindForStatement && index == 0 { return n.AsForStatement().Incrementor }
	case 29: // static class element marker
		if index == 0 && ast.HasStaticModifier(n) { return n }
	}
	return nil
}

//export aot_ts_node_role
func aot_ts_node_role(raw C.uintptr_t, id C.int32_t, role C.int32_t, index C.int32_t) C.int32_t {
	parsed := result(raw); n := node(parsed, id); if n == nil || role < 1 || role > 29 { return -1 }
	target := roleNode(n, int32(role), int32(index)); if target == nil { return -1 }
	targetID, ok := parsed.nodeIDs[target]; if !ok { return -1 }
	return C.int32_t(targetID)
}

func main() {}
