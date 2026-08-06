#!/usr/bin/env bash
# The gate. One command, one answer: exit 0 means every milestone's gate is still green.
#
#   tools/gate.sh            # typecheck everything, run every suite, check the diagram pipeline
#   tools/gate.sh --quick    # skip the diagram pipeline
#
# Nothing is allowed to be marked done, and nothing is allowed to be committed, while this is
# red. That is the whole contract the project runs on, so it lives in one script rather than in
# a habit.
set -uo pipefail
cd "$(dirname "$0")/.."

QUICK=0
[ "${1:-}" = "--quick" ] && QUICK=1

fails=0
note() { printf '%-34s %s\n' "$1" "$2"; }

echo "=== native TypeScript bridge ==="
if out=$(./tools/build-typescript-go-bridge.sh 2>&1); then
  note "typescript-go bridge" "ready"
else
  note "typescript-go bridge" "FAILED"
  echo "$out" | tail -20
  exit 1
fi

echo
echo "=== backend module boundaries ==="
if out=$(node tools/backend-module-gate.mjs 2>&1); then
  note "backend-module-gate.mjs" "$out"
else
  note "backend-module-gate.mjs" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

echo
echo "=== typecheck ==="
for f in src/*.coil; do
  if [ "$f" = "src/frontend_native_graph.coil" ] || [ "$f" = "src/typescript_native.coil" ]; then
    note "$f" "native bridge gate"
  elif out=$(coil check "$f" 2>&1); then
    note "$f" "ok"
  else
    note "$f" "FAILED"; echo "$out" | head -20; fails=$((fails+1))
  fi
done

echo
echo "=== suites ==="
total=0
for f in tests/*-test.coil; do
  if out=$(coil test "$f" 2>&1); then
    line=$(echo "$out" | grep -E '^test result' | tail -1)
    n=$(echo "$line" | sed -n 's/.*ok\. \([0-9]*\) passed.*/\1/p')
    total=$((total + ${n:-0}))
    note "$f" "${line:-ok}"
  else
    note "$f" "FAILED"
    echo "$out" | grep -E 'FAILED|assertion|MISMATCH|VIOLATED|corruption|error:' | head -20
    fails=$((fails+1))
  fi
done

echo
echo "=== roadmap workflow ==="
if out=$(node tools/workflow-gate.mjs 2>&1); then
  note "workflow-gate.mjs" "$out"
else
  note "workflow-gate.mjs" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

echo
echo "=== native backend ==="
if out=$(./tools/native-gate.sh 2>&1); then
  note "native-gate.sh" "$out"
else
  note "native-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

echo
echo "=== TypeScript frontend ==="
if out=$(./tools/ts-gate.sh 2>&1); then
  note "ts-gate.sh" "$out"
else
  note "ts-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

echo
echo "=== performance ==="
if out=$(./tools/benchmark-gate.sh 2>&1); then
  note "benchmark-gate.sh" "$(echo "$out" | tail -1)"
else
  note "benchmark-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

if [ "$QUICK" = 0 ]; then
  echo
  echo "=== diagram pipeline ==="
  # A broken printer is a broken debugging tool, which is how a real bug goes unnoticed later.
  if out=$(./tools/render-dot.sh 2>&1); then
    note "render-dot.sh" "$(echo "$out" | wc -l | tr -d ' ') fixtures rendered"
  else
    note "render-dot.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
  fi
  if out=$(python3 tools/build-page.py 2>&1); then
    note "build-page.py" "$out"
  else
    note "build-page.py" "FAILED"; echo "$out" | tail -10; fails=$((fails+1))
  fi
fi

echo
if [ "$fails" -eq 0 ]; then
  echo "GATE GREEN — $total tests passed"
  exit 0
else
  echo "GATE RED — $fails component(s) failed"
  exit 1
fi
