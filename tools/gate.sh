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

fails=0
note() { printf '%-34s %s\n' "$1" "$2"; }

# Every section reports its wall time: a slow gate gets fixed by knowing WHERE it is slow.
LAST_SECTION=""
SECTION_T0=$SECONDS
section() {
  if [ -n "$LAST_SECTION" ]; then
    printf '    [%ss] %s\n' "$((SECONDS - SECTION_T0))" "$LAST_SECTION"
  fi
  LAST_SECTION="$1"
  SECTION_T0=$SECONDS
  echo
  echo "=== $1 ==="
}

section "native TypeScript bridge"
if out=$(./tools/build-typescript-go-bridge.sh 2>&1); then
  note "typescript-go bridge" "ready"
else
  note "typescript-go bridge" "FAILED"
  echo "$out" | tail -20
  exit 1
fi

section "status checklist"
# docs/STATUS.md is generated, and this is what stops it going stale the way docs/CONVERSION.md did
# — that file claimed "all of String.prototype except split" for months while twelve methods sat in
# lib/ that no program could name. The check re-derives the recognised operations from the
# frontend's own tables and verifies every definition it names exists in lib/ and is referenced
# from src/, so the checklist cannot claim a conversion that is not wired up.
if out=$(node tools/status.mjs --check 2>&1); then
  note "status.mjs" "$out"
else
  note "status.mjs" "FAILED"; echo "$out" | head -20; fails=$((fails+1))
fi

section "backend module boundaries"
if out=$(node tools/backend-module-gate.mjs 2>&1); then
  note "backend-module-gate.mjs" "$out"
else
  note "backend-module-gate.mjs" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

# THERE IS NO TYPECHECK SECTION, deliberately. It ran `coil check` over all 30 src modules --
# 30 processes, 37.5s of CPU, a third of every coil invocation in this gate -- and proved nothing
# the rest of the run does not prove again, harder, a minute later. `coil check` is compilation
# without an object, and every one of those 30 modules is transitively imported by something this
# gate BUILDS: 29 by the test suites, and frontendnative by the typescript-native-*-smoke tools.
#
# The one thing that could have justified it is DCE hiding a fault in code nothing references,
# which this repo has been bitten by before. That was tested rather than assumed: an ill-typed
# function nothing calls, appended to src/text.coil, is rejected by `coil check` AND by
# text-test AND by an unrelated `coil build`. Typechecking precedes dead-code elimination, so a
# build cannot mask what the check would have caught.
#
# What was lost is failing ~90s sooner on a broken tree, with a per-file label. The suites name
# the file that failed too. If that trade ever stops being worth it, this is why it was made.

section "suites"
# One invocation. `coil test` discovers every (deftest …) under Coil.toml's [test] roots,
# compiles the shared source tree ONCE, and forks each test; --jobs is the runner's own
# parallelism. This replaced a per-file xargs loop that rebuilt the whole compiler 44 times
# and carried a 3-attempt "(signal 9)" retry: the macOS atfork race that caused those
# random child deaths is now absorbed by the runner itself (a stillborn child — one that
# died before writing its first-act pipe byte — is re-forked, up to 5 attempts, with a
# stderr note). "FAILED (child killed before the test started, 5 attempts)" is therefore a
# real signal, not the old flake.
total=0
if out=$(coil test --jobs "$JOBS" 2>&1); then
  total=$(echo "$out" | sed -n 's/.*ok\. \([0-9]*\) passed.*/\1/p' | awk '{s+=$1} END {print s+0}')
  note "coil test --jobs $JOBS" "$(echo "$out" | grep -c '^test result: ok') suites ok, $total tests passed"
else
  note "coil test --jobs $JOBS" "FAILED"
  echo "$out" | grep -E 'FAILED|assertion|MISMATCH|VIOLATED|corruption|error:' | head -40
  fails=$((fails+1))
fi

section "roadmap workflow"
if out=$(node tools/workflow-gate.mjs 2>&1); then
  note "workflow-gate.mjs" "$out"
else
  note "workflow-gate.mjs" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

section "native backend"
if out=$(./tools/native-gate.sh 2>&1); then
  note "native-gate.sh" "$out"
else
  note "native-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

section "TypeScript frontend"
if out=$(./tools/ts-gate.sh 2>&1); then
  note "ts-gate.sh" "$out"
else
  note "ts-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

section "JSL runtime library"
if out=$(./tools/jsl-gate.sh 2>&1); then
  note "jsl-gate.sh" "$(echo "$out" | tail -1)"
else
  note "jsl-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

section "JSL native machine code"
if out=$(./tools/jsl-native-gate.sh 2>&1); then
  note "jsl-native-gate.sh" "$(echo "$out" | tail -1)"
else
  note "jsl-native-gate.sh" "FAILED"; echo "$out" | tail -20; fails=$((fails+1))
fi

section "native source conformance"
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

section "done"
if [ "$fails" -eq 0 ]; then
  echo "GATE GREEN — $total tests passed"
  exit 0
else
  echo "GATE RED — $fails component(s) failed"
  exit 1
fi
