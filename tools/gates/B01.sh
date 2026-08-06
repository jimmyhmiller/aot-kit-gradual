#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

node tools/typescript-js-abi.mjs --verify
executable=.coil/build/typescript-js-abi-test
arguments=(benchmarks/v8-v7 richards.js deltablue.js crypto.js raytrace.js earley-boyer.js regexp.js splay.js navier-stokes.js)

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if AOT_B01_FORCE_TS=1 "$executable" "${arguments[@]}" >"$tmp/forced-ts.out" 2>&1; then exit 1; fi
grep -q 'explicit JavaScript mode' "$tmp/forced-ts.out"
echo "falsification forced-typescript-mode: rejected"

if AOT_B01_SWAP_CALL_ROLES=1 "$executable" "${arguments[@]}" >"$tmp/swapped-call.out" 2>&1; then exit 1; fi
grep -q 'callee role precedes first argument' "$tmp/swapped-call.out"
echo "falsification swapped-call-roles: rejected"

tools/ts-gate.sh >/dev/null
echo "B01 gate green"
