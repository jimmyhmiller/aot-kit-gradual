#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-cfg-test.coil

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G1.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G1 remains open: machine-unit CFG construction and its falsification audit are incomplete");
    process.exit(1);
  }
'
