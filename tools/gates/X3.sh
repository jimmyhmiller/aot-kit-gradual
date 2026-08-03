#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

./tools/ts-gate.sh
test -x tools/typescript-binarytrees-gate.sh
./tools/typescript-binarytrees-gate.sh --full

node -e '
  const fs = require("fs");
  const contract = JSON.parse(fs.readFileSync("workflow/contracts/X3.json", "utf8"));
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (contract.parser.package !== "typescript" ||
      pkg.dependencies.typescript !== contract.parser.version ||
      contract.requiredDifferentialDepths.join(",") !== "4,6,8,10") process.exit(2);
  if (!contract.implementationComplete) {
    console.error("X3 remains open: TypeScript has not reached the Coil native pipeline");
    process.exit(1);
  }
'
