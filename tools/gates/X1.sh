#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

test -f tests/backend-native-gc-test.coil
coil test tests/backend-native-gc-test.coil
coil test tests/backend-allocation-test.coil
coil test tests/backend-object-test.coil
coil test tests/gc-test.coil
./tools/native-gc-gate.sh

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/X1.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("X1 remains open: compiled moving-GC bridge proof is incomplete");
    process.exit(1);
  }
'
