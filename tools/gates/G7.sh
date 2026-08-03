#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-allocation-test.coil

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G7.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G7 remains open: CFG-constrained allocation proof is incomplete");
    process.exit(1);
  }
'
