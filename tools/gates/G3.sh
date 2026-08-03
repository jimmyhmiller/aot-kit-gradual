#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-phi-test.coil

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G3.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G3 remains open: general Phi edge lowering and its falsification audit are incomplete");
    process.exit(1);
  }
'
