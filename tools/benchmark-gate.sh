#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/benchmark-gate.mjs "$@"
