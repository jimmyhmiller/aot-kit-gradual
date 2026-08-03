#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-abi-test.coil
coil test tests/backend-call-test.coil

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G5.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G5 remains open: ABI and per-function frame proof is incomplete");
    process.exit(1);
  }
'
