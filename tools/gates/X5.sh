#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

./tools/typescript-binarytrees-gate.sh --depth21

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/X5.json", "utf8"));
  if (contract.requiredDepth !== 21 || !contract.implementationComplete) {
    console.error("X5 remains open: TypeScript depth-21 moving-GC closure is incomplete");
    process.exit(1);
  }
'
