#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
bridge="$root/native/typescript-go-bridge"
build="$root/.coil/build/native/typescript-go-bridge"
checkout="$build/typescript-go"
commit=$(tr -d '[:space:]' < "$bridge/UPSTREAM_COMMIT")

"$root/tools/build-typescript-go-bridge.sh" >/dev/null
mkdir -p "$checkout/cmd/aotprobe"
cp "$bridge/probe.go" "$checkout/cmd/aotprobe/main.go"
(
  cd "$checkout"
  GOTOOLCHAIN=auto go build -trimpath -o "$build/aot-ts-probe" ./cmd/aotprobe
)
printf '%s\n' "$build/aot-ts-probe"
