#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

coil test tests/eval-test.coil >/dev/null
coil test tests/node-test.coil >/dev/null

node tools/js-number-oracle.mjs > "$tmp/node.txt"
cmp tests/js-number-oracle.txt "$tmp/node.txt"

coil build tools/js-number-matrix.coil -o "$tmp/coil-matrix" >/dev/null
"$tmp/coil-matrix" > "$tmp/coil.txt"
cmp tests/js-number-oracle.txt "$tmp/coil.txt"
echo "differential numeric-matrix: Coil agrees with Node on exact IEEE bits"

check_falsification() {
  local variable=$1
  local name=$2
  env "$variable=1" node tools/js-number-oracle.mjs > "$tmp/falsified.txt"
  if cmp -s tests/js-number-oracle.txt "$tmp/falsified.txt"; then
    echo "falsification $name was not detected" >&2
    exit 1
  fi
  echo "falsification $name: detected"
}

check_falsification AOT_B04_INTEGER_DIVISION integer-division-substitution
check_falsification AOT_B04_WRAP_OVERFLOW wrapped-integer-overflow
check_falsification AOT_B04_NAN_REFLEXIVE nan-reflexivity
check_falsification AOT_B04_DROP_NEGATIVE_ZERO negative-zero-sign-loss

echo "B04 gate green"
