#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-selection-test.coil

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G2.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G2 remains open: general block selection and its falsification audit are incomplete");
    process.exit(1);
  }
'
