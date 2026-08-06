#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

coil test tests/jsvalue-test.coil >/dev/null
coil test tests/backend-test.coil >/dev/null
coil test tests/backend-native-gc-test.coil >/dev/null

cc -std=c11 -Wall -Wextra -Werror tests/js-value-abi-test.c -o "$tmp/js-value-abi"
"$tmp/js-value-abi"

cc -std=c11 -Wall -Wextra -Werror -DAOT_JS_FALSIFY_OBJECT_TAG \
  tests/js-value-abi-test.c -o "$tmp/js-value-falsified"
set +e
"$tmp/js-value-falsified"
falsified_status=$?
set -e
test "$falsified_status" = 21
echo "falsification object-tag-predicate: detected exact managed-tag drift"

coil build tools/emit-jsvalue-wrong-unbox.coil -o "$tmp/wrong-unbox-emitter" >/dev/null
"$tmp/wrong-unbox-emitter" > "$tmp/wrong-unbox.o"
xcrun clang -arch arm64 -Itools tools/jsvalue-wrong-unbox-harness.c \
  "$tmp/wrong-unbox.o" -o "$tmp/wrong-unbox"
set +e
"$tmp/wrong-unbox"
wrong_unbox_status=$?
set -e
test "$wrong_unbox_status" = 133
echo "negative wrong-unbox: deterministic native trap"

set +e
"$tmp/wrong-unbox" malformed
malformed_unbox_status=$?
set -e
test "$malformed_unbox_status" = 133
echo "negative malformed-payload-unbox: deterministic native trap"

tools/native-gc-gate.sh >/dev/null
echo "B03 gate green"
