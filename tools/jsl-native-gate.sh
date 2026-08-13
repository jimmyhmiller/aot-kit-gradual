#!/usr/bin/env bash
# The JSL NATIVE gate: every covered definition is compiled to machine code, linked, run, and
# judged by the same committed Node golden the interpreter is judged by.
#
# WHY IT IS SEPARATE FROM tools/jsl-gate.sh. That gate runs `eval.coil`, the IR interpreter, whose
# RtVal is uniformly tagged — so boxing is invisible there and a definition can be right under it
# and wrong as machine code. `MathAbs` on a boxed -5 returned -5, verified clean, and ran to
# completion. Native is the mode that ships; the interpreter is the cross-check.
#
# COVERAGE IS EXPLICIT AND PARTIAL. Only the entries listed below are representation-correct today.
# Every conversion adds a line here, and a definition that is not listed is not claimed. The count
# is printed so the gate cannot quietly cover less than it did.
set -euo pipefail
cd "$(dirname "$0")/.."

golden=tests/jsl-string-oracle.txt
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# ONE emitter, built at most once per gate run and shared by every script that needs it.
. tools/emit-object-path.sh
emit_bin=$(emit_object_path)


# entry:arity:label:table — label and table must match the Node script's naming exactly.
COVERED=(
  "MathAbs:1:abs:nums"
  "MathSign:1:sign:nums"
  "MathTrunc:1:trunc:nums"
  "MathFloor:1:floor:nums"
  "MathCeil:1:ceil:nums"
  "MathRound:1:round:nums"
  "MathMax2:2:max:pairs"
  "MathMin2:2:min:pairs"
  "NumberIsNaN:1:isnan:vals"
  "NumberIsFinite:1:isfin:vals"
  "NumberIsInteger:1:isint:vals"
  "NumberIsSafeInteger:1:issafe:vals"
  "ProbeStrEq:1:streq:idx:15"
  "ProbeStrNum:1:strnum:idx:15"
)

# EVERY builtin must reach machine code, not just the value-checked ones. Coverage above is about
# whether a definition computes the right ANSWER; this is about whether it compiles at all, and the
# two come apart: a definition can be correct under the interpreter and still have no selection arm.
# It matters now because the frontend pulls the whole library into a program, so one definition that
# cannot be selected breaks every compile, not just its own test.
#
# The arity is read out of the source rather than listed, so a new builtin is covered the moment it
# is written and this cannot silently check fewer than exist.
compiled=0
while read -r name arity; do
  if ! "$emit_bin" --source tools/jsl-native-probes.jsl "$name" "$arity" > "$tmp/all.o" 2>"$tmp/all.err"; then
    echo "JSL native: $name/$arity did not emit (the library is loaded per entry, so a load-time failure is reported against the first name tried): $(tr '\n' ' ' < "$tmp/all.err")" >&2
    exit 1
  fi
  compiled=$((compiled + 1))
done < <(
  python3 - <<'PY'
import re, glob
for f in sorted(glob.glob('lib/*/*.jsl')):
    for m in re.finditer(r'\(builtin\s+(\S+)(.*?):params\s+\[(.*?)\]', open(f).read(), re.S):
        print(m.group(1), len(re.findall(r'\(\s*\S+\s+\S+?\s*\)', m.group(3))))
PY
)
if [ "$compiled" -eq 0 ]; then echo "JSL native: found no builtins to compile" >&2; exit 1; fi

covered=0
for spec in "${COVERED[@]}"; do
  IFS=: read -r entry arity label table count <<<"$spec"
  "$emit_bin" --source tools/jsl-native-probes.jsl "$entry" "$arity" > "$tmp/$entry.o"
  xcrun clang -O2 -arch arm64 -I tools -o "$tmp/$entry" \
    tools/jsl-native-harness.c "$tmp/$entry.o" tools/native-gc-runtime.c
  "$tmp/$entry" "$label" "$table" ${count:-} >> "$tmp/native.txt"
  covered=$((covered + 1))
done

# Compare only the lines the native side produced. Every one must appear in the golden verbatim.
missing=0
while IFS= read -r line; do
  if ! grep -qxF "$line" "$golden"; then
    key=${line%%=*}
    want=$(grep -m1 "^$key=" "$golden" || echo "<absent from golden>")
    echo "NATIVE MISMATCH: got '$line', golden has '$want'" >&2
    missing=$((missing + 1))
  fi
done < "$tmp/native.txt"

if [ "$missing" -ne 0 ]; then
  echo "JSL native: $missing of $(wc -l < "$tmp/native.txt" | tr -d ' ') results disagree with Node" >&2
  exit 1
fi

echo "JSL native: $(wc -l < "$tmp/native.txt" | tr -d ' ') results from $covered value-checked definition(s) agree with Node; all $compiled builtin(s) compile"
