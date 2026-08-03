#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

test -x tools/binarytrees-performance-gate.sh
./tools/binarytrees-performance-gate.sh --verify

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/X4.json", "utf8"));
  if (contract.requiredSamples < 9 || contract.requiredDepth !== 21) process.exit(2);
  if (!contract.implementationComplete) {
    console.error("X4 remains open: the reproducible binary-trees performance report is incomplete");
    process.exit(1);
  }
'
