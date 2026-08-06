#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

node tools/v8-fetch.mjs --verify
node tools/v8-node-oracle.mjs --quick > "$tmp/oracle-1.json"
node tools/v8-node-oracle.mjs --quick > "$tmp/oracle-2.json"
cmp "$tmp/oracle-1.json" "$tmp/oracle-2.json" >/dev/null
jq -e '.status == "pass" and (.results | length) == 8 and ([.results[].checks[]] | length) == 10' "$tmp/oracle-1.json" >/dev/null

node tools/v8-native-probe.mjs > "$tmp/probe.json"
jq -e '.status == "measured-gap" and (.results | length) == 8 and all(.results[]; .firstUnsupported.code and .firstUnsupported.kind and (.firstUnsupported.start >= 0) and (.firstUnsupported.end > .firstUnsupported.start))' "$tmp/probe.json" >/dev/null
jq -e --slurpfile baseline benchmarks/v8-v7/capabilities.json '
  [ .results[] | {benchmark, diagnostics:.diagnostics} ] ==
  [ $baseline[0].results[] | {benchmark, diagnostics:.nativeDiagnostics} ]
' "$tmp/probe.json" >/dev/null
node tools/v8-inventory.mjs --verify
test "$(find tests/v8-witnesses -name '*.js' | wc -l | tr -d ' ')" -ge 10

cp -R benchmarks/v8-v7 "$tmp/corrupt"
printf 'x' >> "$tmp/corrupt/base.js"
if AOT_V8_CORPUS="$tmp/corrupt" node tools/v8-fetch.mjs --verify >"$tmp/corrupt.out" 2>&1; then exit 1; fi
grep -q 'base.js: hash' "$tmp/corrupt.out"
echo "falsification corrupt-byte: detected hash mismatch"

cp -R benchmarks/v8-v7 "$tmp/no-license"
rm "$tmp/no-license/LICENSE"
if AOT_V8_CORPUS="$tmp/no-license" node tools/v8-fetch.mjs --verify >"$tmp/license.out" 2>&1; then exit 1; fi
grep -q 'LICENSE: missing' "$tmp/license.out"
echo "falsification omitted-license: detected missing license"

cp -R benchmarks/v8-v7 "$tmp/skipped"
node -e 'const fs=require("fs"); const p=process.argv[1]; const m=JSON.parse(fs.readFileSync(p)); m.benchmarks.pop(); fs.writeFileSync(p, JSON.stringify(m));' "$tmp/skipped/manifest.json"
if AOT_V8_CORPUS="$tmp/skipped" node tools/v8-node-oracle.mjs --quick >"$tmp/skipped.out" 2>&1; then exit 1; fi
grep -q 'all eight canonical benchmarks' "$tmp/skipped.out"
echo "falsification skipped-benchmark: detected incomplete oracle matrix"

cp -R benchmarks/v8-v7 "$tmp/syntax"
printf '\nfunction (\n' >> "$tmp/syntax/richards.js"
AOT_V8_CORPUS="$tmp/syntax" node tools/v8-native-probe.mjs > "$tmp/syntax.json"
if jq -e --slurpfile baseline benchmarks/v8-v7/capabilities.json '
  [ .results[] | {benchmark, diagnostics:.diagnostics} ] ==
  [ $baseline[0].results[] | {benchmark, diagnostics:.nativeDiagnostics} ]
' "$tmp/syntax.json" >/dev/null; then exit 1; fi
echo "falsification syntax-failure: detected diagnostic drift"

echo "B00 gate green"
