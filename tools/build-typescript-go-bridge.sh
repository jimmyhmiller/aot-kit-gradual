#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
bridge="$root/native/typescript-go-bridge"
build="$root/.coil/build/native/typescript-go-bridge"
checkout="$build/typescript-go"
commit=$(tr -d '[:space:]' < "$bridge/UPSTREAM_COMMIT")

mkdir -p "$build"
if [[ ! -d "$checkout/.git" ]]; then
  git clone --filter=blob:none --no-checkout https://github.com/microsoft/typescript-go.git "$checkout"
fi

if [[ ! -f "$checkout/go.mod" ||
      $(git -C "$checkout" rev-parse HEAD 2>/dev/null || true) != "$commit" ]]; then
  git -C "$checkout" fetch --depth 1 origin "$commit"
  git -C "$checkout" checkout --detach "$commit"
fi

mkdir -p "$checkout/cmd/aotcapi"
cp "$bridge/main.go" "$bridge/unicode_properties.go" "$checkout/cmd/aotcapi/"

(
  cd "$checkout"
  GOTOOLCHAIN=auto go build -buildmode=c-archive -trimpath -o "$build/libaot_typescript.a" ./cmd/aotcapi
)
cp "$bridge/aot_typescript.h" "$build/aot_typescript.h"

printf '%s\n' "$build/libaot_typescript.a"
