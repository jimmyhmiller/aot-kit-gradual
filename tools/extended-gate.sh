#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Expensive or broad matrices live here. Each milestone appends a bounded, named command; its
# milestone gate remains the focused witness used during development.
coil test tests/backend-parity-test.coil
coil test tests/backend-cfg-test.coil
coil test tests/backend-selection-test.coil
coil test tests/backend-phi-test.coil
coil test tests/backend-call-test.coil
coil test tests/backend-abi-test.coil
coil test tests/backend-motion-test.coil
coil test tests/backend-schedule-test.coil
coil test tests/backend-liveness-test.coil
coil test tests/backend-object-test.coil
coil test tests/extended/backend-parity-test.coil
