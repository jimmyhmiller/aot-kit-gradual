#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

task_dir=$(mktemp -d)
trap 'rm -rf "$task_dir"' EXIT

for benchmark in richards deltablue; do
  AOT_B15_NODE_RUN=1 node tools/b15-adapt.mjs "$benchmark" "benchmarks/v8-v7/$benchmark.js" \
    > "$task_dir/$benchmark-node.js"
  node tools/b15-adapt.mjs "$benchmark" "benchmarks/v8-v7/$benchmark.js" \
    > "$task_dir/$benchmark.js"
  node "$task_dir/$benchmark-node.js"
  printf '%s=ok\n' "$benchmark"
done > "$task_dir/node.txt"
cmp tests/b15-node-oracle.txt "$task_dir/node.txt"

for mutation in richards-queue deltablue-projection; do
  benchmark=${mutation%%-*}
  AOT_B15_NODE_RUN=1 AOT_B15_MUTATION="$mutation" node tools/b15-adapt.mjs \
    "$benchmark" "benchmarks/v8-v7/$benchmark.js" > "$task_dir/$mutation-node.js"
  if node "$task_dir/$mutation-node.js" >/dev/null 2>&1; then
    echo "$mutation did not falsify the original Node check" >&2
    exit 1
  fi
done

tools/build-typescript-go-bridge.sh >/dev/null
archive="$PWD/.coil/build/native/typescript-go-bridge/libaot_typescript.a"
link_flags=(--link-flag "-Wl,-force_load,$archive" --link-flag -framework \
  --link-flag CoreFoundation --link-flag -framework --link-flag Security)
coil build tools/typescript-native-b15-function-call-smoke.coil \
  -o "$task_dir/function-call-smoke" "${link_flags[@]}" >/dev/null
"$task_dir/function-call-smoke"
coil build tools/typescript-native-b15-dynamic-equality-smoke.coil \
  -o "$task_dir/dynamic-equality-smoke" "${link_flags[@]}" >/dev/null
"$task_dir/dynamic-equality-smoke"

for benchmark in richards deltablue; do
  node tools/generate-b15-ideal-runner.mjs "$task_dir/$benchmark.js" \
    "$task_dir/$benchmark-ideal.coil"
  coil build "$task_dir/$benchmark-ideal.coil" -o "$task_dir/$benchmark-ideal" \
    "${link_flags[@]}" >/dev/null
  "$task_dir/$benchmark-ideal"

  node tools/generate-typescript-aot-benchmark.mjs "$task_dir/$benchmark.js" \
    "$task_dir/$benchmark.coil"
  coil build "$task_dir/$benchmark.coil" -o "$task_dir/$benchmark-emitter" \
    "${link_flags[@]}" >/dev/null
  for seed in 0 1 7301; do
    for registers in 10 1; do
      object="$task_dir/$benchmark-$seed-$registers.o"
      binary="$task_dir/$benchmark-$seed-$registers"
      "$task_dir/$benchmark-emitter" "$seed" "$registers" > "$object"
      xcrun clang -arch arm64 -O1 tools/native-gc-runtime.c tools/native-gc-trampoline.S \
        tools/v8-native-harness.c "$object" -o "$binary"
      "$binary" | grep -q '^result=0 '
    done
  done
  "$task_dir/$benchmark-0-10" 67108864 1 | grep -Eq '^result=0 collections=[1-9][0-9]* '
done

# Prove Richards' native result is earned by the original queue/hold check rather than a vacuous
# zero return from the adapter or kernel. The corrupted expectation must reach the native throw.
AOT_B15_MUTATION=richards-queue node tools/b15-adapt.mjs \
  richards benchmarks/v8-v7/richards.js > "$task_dir/richards-queue.js"
node tools/generate-typescript-aot-benchmark.mjs "$task_dir/richards-queue.js" \
  "$task_dir/richards-queue.coil"
coil build "$task_dir/richards-queue.coil" -o "$task_dir/richards-queue-emitter" \
  "${link_flags[@]}" >/dev/null
"$task_dir/richards-queue-emitter" 0 10 > "$task_dir/richards-queue.o"
xcrun clang -arch arm64 -O1 tools/native-gc-runtime.c tools/native-gc-trampoline.S \
  tools/v8-native-harness.c "$task_dir/richards-queue.o" -o "$task_dir/richards-queue"
set +e
"$task_dir/richards-queue" >/dev/null 2>&1
richards_mutation_status=$?
set -e
if [[ "$richards_mutation_status" -eq 0 ]]; then
  echo "Richards native queue/hold mutation did not falsify the original check" >&2
  exit 1
fi

# DeltaBlue native falsification and the project-level predecessor matrix remain required before
# this latch may turn green.
node -e 'const c=require("./workflow/contracts/B15.json"); process.exit(c.implementationComplete ? 0 : 1)'

echo "B15 gate green"
