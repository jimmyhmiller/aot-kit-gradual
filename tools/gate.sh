#!/usr/bin/env bash
# The gate. One command, one answer: exit 0 means every milestone's gate is still green.
#
#   tools/gate.sh            # typecheck everything, run every suite, check the diagram pipeline
#   tools/gate.sh --quick    # skip the diagram pipeline
#   tools/gate.sh --bench    # also run the benchmark gate (see below)
#
# Nothing is allowed to be marked done, and nothing is allowed to be committed, while this is
# red. That is the whole contract the project runs on, so it lives in one script rather than in
# a habit.
#
# THE BENCHMARK GATE IS OPT-IN, and that is a deliberate trade rather than an oversight. It took
# 242 seconds of a 700-second gate — more than a third of the wall clock — to produce numbers that
# nothing here fails on: it prints a table and exits 0 whatever the timings say. A correctness gate
# that takes four extra minutes to report an opinion gets run less often, which costs more than the
# opinion is worth. `tools/benchmark-gate.sh` still exists and `--bench` still runs it.
#
# THE SUITES AND THE TYPECHECKS RUN IN PARALLEL. They are independent processes over separate files
# and the machine has more than one core; running 31 of them one after another was 164 seconds of
# a mostly idle CPU. Output is captured per file and replayed in a fixed order afterwards, so the
# report reads the same as it always did no matter what order they finish in.
set -uo pipefail
cd "$(dirname "$0")/.."

QUICK=0
BENCH=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --bench) BENCH=1 ;;
    *) echo "gate.sh: unknown argument $arg" >&2; exit 2 ;;
  esac
done

JOBS=$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

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
mkdir -p "$WORK/check"
for f in src/*.coil; do
  [ "$f" = "src/frontend_native_graph.coil" ] && continue
  [ "$f" = "src/typescript_native.coil" ] && continue
  printf '%s\n' "$f"
done | xargs -P "$JOBS" -I{} sh -c \
  'out=$(coil check "$1" 2>&1); rc=$?; b=$(basename "$1"); printf "%s" "$out" > "$2/$b.out"; echo "$rc" > "$2/$b.rc"' \
  _ {} "$WORK/check"
for f in src/*.coil; do
  b=$(basename "$f")
  if [ "$f" = "src/frontend_native_graph.coil" ] || [ "$f" = "src/typescript_native.coil" ]; then
    note "$f" "native bridge gate"
  elif [ "$(cat "$WORK/check/$b.rc" 2>/dev/null || echo 1)" = "0" ]; then
    note "$f" "ok"
  else
    note "$f" "FAILED"; head -20 "$WORK/check/$b.out" 2>/dev/null; fails=$((fails+1))
  fi
done

echo
echo "=== suites ==="
# A suite that reports SIGNAL 9 has reported nothing, and this re-runs it before believing it.
# That is the documented policy in HANDOFF.md, applied here instead of left to whoever reads the
# output: `coil test`'s fork-and-exec of a freshly written child dies at random, a different suite
# each time, each passing in isolation. Running the suites in parallel makes the machine busier and
# turned "about one per full sweep" into five, so the retry stops being advice and becomes part of
# the gate.
#
# THE DETECTION IS ON THE OUTPUT, NOT THE EXIT CODE. `coil test` survives its own child: it prints
# `FAILED (signal 9)` and exits 1, exactly like a real assertion failure, so a `[ "$rc" = 137 ]`
# check never fires. Three attempts, and a suite that reports it three times in a row is reported as
# a failure like any other — at that point it is evidence rather than noise.
mkdir -p "$WORK/suite"
printf '%s\n' tests/*-test.coil | xargs -P "$JOBS" -I{} sh -c '
  attempt=0
  while : ; do
    out=$(coil test "$1" 2>&1); rc=$?
    attempt=$((attempt + 1))
    case "$out" in
      *"(signal 9)"*) [ "$attempt" -lt 3 ] && continue ;;
    esac
    break
  done
  b=$(basename "$1"); printf "%s" "$out" > "$2/$b.out"; echo "$rc" > "$2/$b.rc"' \
  _ {} "$WORK/suite"
total=0
for f in tests/*-test.coil; do
  b=$(basename "$f")
  if [ "$(cat "$WORK/suite/$b.rc" 2>/dev/null || echo 1)" = "0" ]; then
    line=$(grep -E '^test result' "$WORK/suite/$b.out" | tail -1)
    n=$(echo "$line" | sed -n 's/.*ok\. \([0-9]*\) passed.*/\1/p')
    total=$((total + ${n:-0}))
    note "$f" "${line:-ok}"
  else
    note "$f" "FAILED"
    grep -E 'FAILED|assertion|MISMATCH|VIOLATED|corruption|error:' "$WORK/suite/$b.out" 2>/dev/null | head -20
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
echo "=== JSL runtime library ==="
if out=$(./tools/jsl-gate.sh 2>&1); then
  note "jsl-gate.sh" "$(echo "$out" | tail -1)"
else
  note "jsl-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

echo
echo "=== JSL native machine code ==="
if out=$(./tools/jsl-native-gate.sh 2>&1); then
  note "jsl-native-gate.sh" "$(echo "$out" | tail -1)"
else
  note "jsl-native-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

echo
echo "=== native source conformance ==="
if out=$(./tools/native-source-conformance.sh 2>&1); then
  note "native-source-conformance.sh" "$(echo "$out" | tail -1)"
else
  note "native-source-conformance.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

if [ "$BENCH" = 1 ]; then
  echo
  echo "=== performance ==="
  if out=$(./tools/benchmark-gate.sh 2>&1); then
    note "benchmark-gate.sh" "$(echo "$out" | tail -1)"
  else
    note "benchmark-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
  fi
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
