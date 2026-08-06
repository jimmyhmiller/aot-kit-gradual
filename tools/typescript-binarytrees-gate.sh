#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mode="${1:---full}"
case "$mode" in
  --quick|--full|--depth21) ;;
  *) echo "usage: tools/typescript-binarytrees-gate.sh [--quick|--full|--depth21]" >&2; exit 2 ;;
esac

node tests/frontend-ir-test.mjs
node tests/typescript-binarytrees-test.mjs

task_tmp=$(mktemp -d)
trap 'rm -rf "$task_tmp"' EXIT
maximum_depth=6
if [[ "$mode" != "--quick" ]]; then maximum_depth=10; fi
node tools/generate-typescript-binarytrees.mjs --interpreter-test \
  "$task_tmp/typescript-binarytrees-test.coil" "$maximum_depth"
archive=$(tools/build-typescript-go-bridge.sh)
coil build "$task_tmp/typescript-binarytrees-test.coil" -o "$task_tmp/typescript-binarytrees-test" \
  --link-flag "-Wl,-force_load,$archive" \
  --link-flag -framework --link-flag CoreFoundation \
  --link-flag -framework --link-flag Security
"$task_tmp/typescript-binarytrees-test"

check_native() {
  local depth="$1" output reference
  output=$(./tools/binarytrees-native-gate.sh --typescript --depth "$depth")
  reference=$(node tools/binarytrees-reference.mjs "$depth")
  test "${output%% |*}" = "$reference"
}

check_native 4
stress=$(./tools/binarytrees-native-gate.sh --typescript --depth 4 --stress --verify-heap)
test "${stress%% |*}" = "$(node tools/binarytrees-reference.mjs 4)"
pressure=$(./tools/binarytrees-native-gate.sh --typescript --depth 4 --seed 7 --registers 6)
test "${pressure%% |*}" = "$(node tools/binarytrees-reference.mjs 4)"

if [[ "$mode" == "--full" ]]; then
  check_native 6
  check_native 8
  check_native 10
  ./tools/binarytrees-native-gate.sh --typescript --depth 4 --seed 1 --seed-count 20 --registers 6
fi

if [[ "$mode" == "--depth21" ]]; then
  check_native 21
  verified=$(./tools/binarytrees-native-gate.sh --typescript --depth 21 --verify-heap)
  test "${verified%% |*}" = "$(node tools/binarytrees-reference.mjs 21)"
  pressured=$(./tools/binarytrees-native-gate.sh --typescript --depth 21 --registers 6 --seed 7)
  test "${pressured%% |*}" = "$(node tools/binarytrees-reference.mjs 21)"
  ./tools/binarytrees-native-gate.sh --typescript --depth 21 \
    --registers 6 --seed 11 --seed-count 4
fi
