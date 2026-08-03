#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

test -f tests/backend-object-test.coil
coil test tests/backend-object-test.coil
./tools/native-object-gate.sh

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G10.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G10 remains open: multi-function object and metadata proof is incomplete");
    process.exit(1);
  }
'
