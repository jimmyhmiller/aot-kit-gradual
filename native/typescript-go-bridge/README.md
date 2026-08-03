# Native TypeScript bridge

This directory defines the aot-kit-owned C ABI over Microsoft's native Go port of
TypeScript. The upstream revision is pinned in `UPSTREAM_COMMIT`; upstream source and
all native products are kept under `.coil/build/` and are not committed.

Build and execute the Coil integration check with:

```sh
tools/typescript-go-bridge-gate.sh
```

`build-typescript-go-bridge.sh` copies `main.go` into the upstream checkout because
the native compiler currently exposes its parser and checker implementation as Go
`internal` packages. It builds a C archive instead of a dynamic library so Coil's
metaprogram compiler does not load the Go runtime and the resulting executable is
self-contained.

The ABI uses `uintptr_t` handles backed by `runtime/cgo.Handle`. No Go pointer crosses
the boundary. Every handle returned by `aot_ts_parse` must be released exactly once
with `aot_ts_parse_delete`.

The first slice exposes native parse diagnostics. AST traversal, program construction,
symbols, and semantic type queries should extend this same handle API instead of
exposing upstream Go structures.
