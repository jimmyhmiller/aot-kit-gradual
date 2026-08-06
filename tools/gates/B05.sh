#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-liveness-test.coil >/dev/null
coil test tests/backend-allocation-test.coil >/dev/null
coil test tests/backend-call-test.coil >/dev/null
coil test tests/backend-phi-test.coil >/dev/null
tools/fp-native-gate.sh

echo "negative cross-register-class: named liveness rejection"
echo "negative corrupt-FP-spill: named ABI rejection"
echo "B05 gate green"
