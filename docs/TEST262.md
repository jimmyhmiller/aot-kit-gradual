# Native Test262 runner

The repository can run the currently supported synchronous Test262 subset through its own native
compiler, x86-64 encoder, ELF linker, runtime, and GC trampoline:

```sh
npm run test262 -- --test262 /path/to/test262 test262/test/language/expressions/division
```

The runner reads Test262 YAML frontmatter, expands requested harness includes, selects default and
strict variants from `flags`, and reports each variant as `PASS`, `FAIL`, `REFUSED`, or `SKIP`.
`REFUSED` is not counted as a pass and makes the command fail. The native executable, not Node,
decides pass/fail; a successful test must compile, link, execute, and return normally.

## Current boundary

This is not yet the full Test262 protocol. Tests execute inside the compiler's current
`function main(n)` entry ABI, so tests requiring exact top-level Script semantics are outside the
claim. Module and async variants, negative parse/runtime phases, fresh realms, and `$262` are
reported as unsupported rather than approximated. The local assertion bootstrap implements
ordinary assertion, SameValue, and array comparison; native catchable exception transport is
still required before upstream `assert.throws` can be implemented honestly.

The three cases under `tests/test262/cases/` are byte-for-byte copies of these upstream files at
Test262 revision `3655e7464de3d52643ecddd4b5f9f4f3e7f62398`:

* `test/language/expressions/division/line-terminator.js`
* `test/language/expressions/modulus/line-terminator.js`
* `test/language/expressions/multiplication/line-terminator.js`
* `test/harness/compare-array-empty.js`

They run in both default and strict variants, giving eight actual Test262 executions in the focused
runner check.

## Semantic ownership

The runner owns only test policy: metadata, includes, variants, and process status. It adds no
JavaScript operation. JavaScript syntax continues to lower into the operations in `lib/**/*.jsl`;
`tests/dsl-ownership-test.coil` rejects frontend arithmetic, comparison, or bitwise semantics that
bypass the DSL. Exception control will require runtime/compiler structure, but the meaning of
throwing and every value operation remains in the DSL.
