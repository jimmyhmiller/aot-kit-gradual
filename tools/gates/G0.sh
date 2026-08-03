#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
coil test tests/backend-parity-test.coil
coil test tests/backend-test.coil
node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G0.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G0 remains open: the complete 11-fixture parity ladder and exit audit are not finished");
    process.exit(1);
  }
'
