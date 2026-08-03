#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-liveness-test.coil

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G6.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G6 remains open: CFG liveness and safepoint proof is incomplete");
    process.exit(1);
  }
'
