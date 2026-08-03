#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mode="${1:---full}"
case "$mode" in
  --quick|--full|--extended) ;;
  *)
    echo "usage: tools/binarytrees-gate.sh [--quick|--full|--extended]" >&2
    exit 2
    ;;
esac

# This unit is the executable seed of the benchmark: recursive allocation, null leaves,
# recursive traversal, interpreter execution, and complete machine selection. As X2 grows, each
# proof mode is added here before implementationComplete may change in workflow/contracts/X2.json.
coil test tests/binarytrees-test.coil
coil test tests/binarytrees-differential-test.coil
coil test tests/binarytrees-negative-test.coil

check_native_depth() {
  local depth="$1" stress_mode="${2:-normal}" reference normal stressed
  reference=$(node tools/binarytrees-reference.mjs "$depth")
  normal=$(./tools/binarytrees-native-gate.sh --depth "$depth")
  test "${normal%% |*}" = "$reference"
  if [[ "$stress_mode" == "stress" ]]; then
    stressed=$(./tools/binarytrees-native-gate.sh --depth "$depth" --stress --verify-heap)
    test "${stressed%% |*}" = "$reference"
  fi
}

check_native_depth 4 stress
pressure=$(./tools/binarytrees-native-gate.sh --depth 4 --seed 7 --registers 6)
test "${pressure%% |*}" = "$(node tools/binarytrees-reference.mjs 4)"

if [[ "$mode" != "--quick" ]]; then
  check_native_depth 6
  check_native_depth 8
  check_native_depth 10
  ./tools/binarytrees-native-gate.sh --depth 4 --seed 1 --seed-count 20 --registers 6
fi

if [[ "$mode" == "--extended" ]]; then
  test -x tools/binarytrees-native-gate.sh
  ./tools/binarytrees-native-gate.sh --depth 21 --verify-heap
fi
