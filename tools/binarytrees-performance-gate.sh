#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mode=${1:---verify}
case "$mode" in
  --update)
    ./tools/binarytrees-gate.sh --quick
    ./tools/typescript-binarytrees-gate.sh --quick
    node tools/binarytrees-performance.mjs --update
    ;;
  --verify)
    before=$(git status --porcelain=v1 --untracked-files=all)
    ./tools/binarytrees-gate.sh --quick
    ./tools/typescript-binarytrees-gate.sh --quick
    node tools/binarytrees-performance.mjs --verify
    after=$(git status --porcelain=v1 --untracked-files=all)
    if [[ "$before" != "$after" ]]; then
      echo "verification dirtied the worktree" >&2
      diff -u <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true
      exit 1
    fi
    ;;
  *) echo "usage: tools/binarytrees-performance-gate.sh [--verify|--update]" >&2; exit 2 ;;
esac
