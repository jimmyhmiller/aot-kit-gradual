#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-motion-test.coil

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G8.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G8 remains open: global code motion and anti-dependency proof is incomplete");
    process.exit(1);
  }
'
