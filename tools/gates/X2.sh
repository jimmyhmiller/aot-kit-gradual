#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

test -f tests/binarytrees-test.coil
coil test tests/binarytrees-test.coil

test -x tools/binarytrees-gate.sh
./tools/binarytrees-gate.sh --extended

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/X2.json", "utf8"));
  const requiredModes = new Set([
    "raw-interpreter", "optimized-interpreter", "native-normal",
    "native-pressure", "native-gc-stress", "node-reference"
  ]);
  if (contract.requiredExtendedDepth !== 21 || contract.minimumDifferentialDepth < 10 ||
      contract.requiredScheduleSeeds < 20 ||
      ![...requiredModes].every(mode => contract.requiredModes.includes(mode))) {
    console.error("X2 contract no longer encodes the required proof matrix");
    process.exit(1);
  }
  if (!contract.implementationComplete) {
    console.error("X2 remains open: canonical binary-trees proof matrix is incomplete");
    process.exit(1);
  }
'
