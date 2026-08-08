#!/usr/bin/env bash
# The JSL gate: the runtime library agrees with Node, and the table that says so can fail.
#
# THREE CLAIMS, and the third is the one that makes the first two mean anything:
#
#   1. Regenerating the conformance table from NODE reproduces the committed
#      tests/jsl-string-oracle.txt. That is the provenance of every expected value in
#      tests/jsl-test.coil, which were otherwise 24 numbers transcribed by hand from a throwaway
#      script and re-derivable by nobody.
#   2. Running the JSL library through the evaluator reproduces the same file. Node and JSL are
#      compared against one committed artefact rather than against each other, so neither can drift
#      into agreement with a stale copy of the other.
#   3. FALSIFICATION, twice, because one injected defect only proves the rows it touches. A `|0`
#      oracle in place of ToIntegerOrInfinity must DIFFER (that is the `String.prototype.indexOf`
#      surface), and so must a `floor(x + 0.5)` oracle in place of Math.round (the Math surface).
#      Both are the mistake a careful person actually makes: the first answers 0 for both
#      infinities, the second rounds a half toward -Infinity so `round(-2.5)` is -3, not -2.
#
# Rule 9 of the roadmap: falsify every milestone gate by injecting the defect it claims to detect.
set -euo pipefail
cd "$(dirname "$0")/.."

golden=tests/jsl-string-oracle.txt
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 1. Node reproduces the committed table.
node tools/jsl-string-oracle.mjs > "$tmp/node.txt"
cmp "$golden" "$tmp/node.txt"

# 2. The JSL library reproduces it too.
coil run tools/jsl-string-oracle.coil > "$tmp/jsl.txt"
cmp "$golden" "$tmp/jsl.txt"

# 3. The table discriminates, on each surface it claims to cover.
falsify() {
  env "$1=1" node tools/jsl-string-oracle.mjs > "$tmp/falsified.txt"
  if cmp -s "$golden" "$tmp/falsified.txt"; then
    echo "FALSIFICATION FAILED: $1 matches the committed table, so those rows prove nothing" >&2
    exit 1
  fi
}
falsify AOT_JSL_TOINT32
falsify AOT_JSL_ROUND_FLOOR

cases=$(wc -l < "$golden" | tr -d ' ')
echo "JSL conformance: $cases library cases agree with Node (String, Math, Number, Array); ToInt32 and round-floor falsifications rejected"
