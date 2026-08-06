#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/ts-gate.mjs
node tests/frontend-ir-test.mjs
node tests/frontend-diagnostic-test.mjs
node tests/frontend-coil-codegen-test.mjs
node --test tests/semantic-trace-comparator-test.mjs
node tests/frontend-exact-graph-test.mjs
node tests/typescript-binarytrees-test.mjs
tools/typescript-go-bridge-gate.sh
