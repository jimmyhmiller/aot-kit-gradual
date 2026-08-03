#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

coil test tests/backend-call-test.coil

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/G4.json", "utf8"));
  if (!contract.implementationComplete) {
    console.error("G4 remains open: conservative direct calls and native fixups are incomplete");
    process.exit(1);
  }
'
