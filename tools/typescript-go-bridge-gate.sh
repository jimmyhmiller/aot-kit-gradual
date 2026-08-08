#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
archive=$($root/tools/build-typescript-go-bridge.sh)
output="$root/.coil/build/typescript-go-bridge-smoke"
frontend_output="$root/.coil/build/typescript-native-frontend-smoke"
graph_output="$root/.coil/build/typescript-native-graph-smoke"
call_graph_output="$root/.coil/build/typescript-native-call-graph-smoke"
control_graph_output="$root/.coil/build/typescript-native-control-graph-smoke"
object_graph_output="$root/.coil/build/typescript-native-object-graph-smoke"
exact_graph_output="$root/.coil/build/typescript-native-exact-graph-smoke"
bitwise_graph_output="$root/.coil/build/typescript-native-bitwise-graph-smoke"

coil build "$root/tools/typescript-go-bridge-smoke.coil" \
  -o "$output"

"$output"

coil build "$root/tools/typescript-native-frontend-smoke.coil" \
  -o "$frontend_output"

"$frontend_output"

coil build "$root/tools/typescript-native-graph-smoke.coil" \
  -o "$graph_output"

"$graph_output" > "$root/.coil/build/typescript-native-graph.txt"
node "$root/tests/frontend-native-exact-graph-test.mjs" "$root/.coil/build/typescript-native-graph.txt"

coil build "$root/tools/typescript-native-call-graph-smoke.coil" \
  -o "$call_graph_output"

"$call_graph_output" > "$root/.coil/build/typescript-native-call-graph.txt"
node "$root/tests/frontend-native-call-exact-graph-test.mjs" "$root/.coil/build/typescript-native-call-graph.txt"

coil build "$root/tools/typescript-native-control-graph-smoke.coil" \
  -o "$control_graph_output"

"$control_graph_output" > "$root/.coil/build/typescript-native-control-graph.txt"
node "$root/tests/frontend-native-control-exact-graph-test.mjs" "$root/.coil/build/typescript-native-control-graph.txt"

coil build "$root/tools/typescript-native-object-graph-smoke.coil" \
  -o "$object_graph_output"

"$object_graph_output" > "$root/.coil/build/typescript-native-object-graph.txt"
node "$root/tests/frontend-native-object-exact-graph-test.mjs" "$root/.coil/build/typescript-native-object-graph.txt"

coil build "$root/tools/typescript-native-exact-graph-smoke.coil" \
  -o "$exact_graph_output"

"$exact_graph_output" > "$root/.coil/build/typescript-native-exact-graph.txt"
node "$root/tests/frontend-native-migration-oracle-test.mjs" "$root/.coil/build/typescript-native-exact-graph.txt"

node "$root/tests/frontend-native-binarytrees-exact-graph-test.mjs" "$archive"

coil build "$root/tools/typescript-native-bitwise-graph-smoke.coil" \
  -o "$bitwise_graph_output"

"$bitwise_graph_output" > "$root/.coil/build/typescript-native-bitwise-graph.txt"
node "$root/tests/frontend-native-bitwise-exact-graph-test.mjs" \
  "$root/.coil/build/typescript-native-bitwise-graph.txt"
