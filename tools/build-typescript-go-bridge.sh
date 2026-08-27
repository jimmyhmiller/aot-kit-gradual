#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
bridge="$root/native/typescript-go-bridge"
build="$root/.coil/build/native/typescript-go-bridge"
checkout="$build/typescript-go"
commit=$(tr -d '[:space:]' < "$bridge/UPSTREAM_COMMIT")
archive="$build/libaot_typescript.a"
header="$build/aot_typescript.h"
stamp="$build/input.sha256"

mkdir -p "$build"
fingerprint=$(
  {
    cat "$bridge/main.go" "$bridge/unicode_properties.go" "$bridge/aot_typescript.h"
    printf '%s\n' "$commit"
    GOTOOLCHAIN=auto go version
  } | shasum -a 256 | awk '{print $1}'
)
if [[ -f "$archive" && -f "$header" && -f "$stamp" &&
      $(cat "$stamp") == "$fingerprint" ]]; then
  printf '%s\n' "$archive"
  exit 0
fi

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
  GOTOOLCHAIN=auto go build -buildmode=c-archive -trimpath -o "$archive" ./cmd/aotcapi
)
cp "$bridge/aot_typescript.h" "$header"
printf '%s\n' "$fingerprint" > "$stamp"

printf '%s\n' "$archive"
