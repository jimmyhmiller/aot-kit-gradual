#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-schedule-test.coil

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G9.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G9 remains open: local dependency scheduling proof is incomplete");
    process.exit(1);
  }
'
