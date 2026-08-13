#!/usr/bin/env bash
# The ONE emitter, built at most once per gate run.
#
# Each gate script used to `coil build` its own emitter into its own tmpdir, which is how thirty-five
# drivers turned into thirty-five full compiles of a 41,500-line tree. Sourcing this instead gives
# every script the same binary: gate.sh builds it once and exports EMIT_OBJECT, and a script run on
# its own builds a copy into a cache keyed by the emitter's inputs.
#
# Sets EMIT_OBJECT to an executable path. Callers pass --source/--regs/--falsify and an ENTRY.
emit_object_path() {
  if [ -n "${EMIT_OBJECT:-}" ] && [ -x "${EMIT_OBJECT}" ]; then
    printf '%s' "$EMIT_OBJECT"; return 0
  fi
  local root cache key dir
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  # Keyed by the emitter source, every src/ module it links, and the toolchain itself: a stale
  # emitter that silently answers for an older compiler is the failure this must not have.
  key=$( { coil --version; cat "$root/tools/emit-object.coil" "$root"/src/*.coil; } | shasum -a 256 | cut -c1-16 )
  cache="$root/.coil/cache/emit-object"
  dir="$cache/$key"
  if [ ! -x "$dir/emit-object" ]; then
    mkdir -p "$dir"
    ( cd "$root" && coil build tools/emit-object.coil -o "$dir/emit-object" >/dev/null )
  fi
  EMIT_OBJECT="$dir/emit-object"
  printf '%s' "$EMIT_OBJECT"
}
