# Native Test262 runner

The repository can run the currently supported synchronous Test262 subset through its own native
compiler, x86-64 encoder, ELF linker, runtime, and GC trampoline:

```sh
npm run test262 -- --test262 /path/to/test262 test262/test/language/expressions/division
```

The runner reads Test262 YAML frontmatter, expands requested harness includes, selects default and
strict variants from `flags`, and reports each variant as `PASS`, `FAIL`, `REFUSED`, or `SKIP`.
`REFUSED` is not counted as a pass and makes the command fail. Parse- and early-phase SyntaxError
negatives pass only when the native parser/static-semantics bridge rejects before execution. This
includes module parse/early negatives, which force the parser's external-module goal but do not
claim module linking or evaluation support. Module diagnostics use Module grammar and static
semantics; static `import`, `export`, and `import.meta` are not rejected merely for being
Script-goal-only forms.
Runtime negatives, including harness-defined `Test262Error`, pass only when Script evaluation
throws and the thrown value's constructor name
matches the expected Test262 error type; normal completion and a different constructor both fail.
For positive tests, the native executable, not Node, decides pass/fail; a successful test must
compile, link, execute, and return normally.

The same runner can make an incremental, parallel attempt over the complete checkout:

```sh
node tools/run-test262.mjs --no-build --jobs 8 \
  --test262 /path/to/test262 /path/to/test262/test
node tools/run-test262.mjs --no-build --jobs 8 --resume --results test262-full.jsonl \
  --test262 /path/to/test262 /path/to/test262/test
```

Every run saves results by default to a unique timestamped `test262-results-*.jsonl` file in the
working directory and prints its absolute path at startup and completion. Each completed variant
is appended before the next one starts, and final category totals are written beside it as
`*.jsonl.summary.json`. Use `--results FILE` to choose a stable path, which is required with
`--resume`. Use `--quick` only when intentionally opting out of persistence; it cannot be combined
with `--results` or `--resume`. `--start` and `--limit` select a file range. `--timeout-ms` defaults
to 30 seconds per variant. On Linux, `--memory-mb` defaults to 2048 MiB and is enforced with
`prlimit`, so a broken generated program is recorded as a failure instead of exhausting the host.
Neither limit turns a test green.

The runner defaults to at most eight compiler workers, bounded by the host's reported parallelism;
`--jobs N` overrides that policy. The design for recovering cross-test compilation reuse without
function wrappers or shared Realm state is in `docs/TEST262-INDEPENDENT-BATCHING.md`.

Default terminal output is one concise line per variant while complete classifications and timing
fields remain in JSONL. `--verbose` additionally streams raw native diagnostics; use it for focused
debugging rather than full-corpus runs. `--quiet` suppresses successful per-variant lines but still
reports failures.

## Current boundary

This is not yet the full Test262 protocol. Harness files and the test body are parsed as distinct
Script records and evaluated by the compiler's structural Script entry; independent tests are not
turned into generated JavaScript wrapper functions. Module execution, async variants, negative
resolution phases, and `$262` are reported as unsupported rather than approximated. The compiler
worker persists for throughput, but each variant executes in a fresh native child process and
therefore receives fresh runtime/Realm state. On ARM64 the worker forks after compilation and the
child executes the encoded code in memory; this avoids object-loader process startup without
sharing JavaScript-visible state. x86-64 retains the linked-object child path.
Parse and early SyntaxError negatives use the same
required pre-execution rejection protocol; runtime negatives use native abrupt-completion transport
without wrapping the test Script. Unsupported expected error types remain explicit.
The local assertion bootstrap implements
ordinary assertion, SameValue, array comparison, and constructor-checked `assert.throws` over the
supported built-in and ordinary function constructors. Diagnostic formatting remains deliberately
smaller than upstream's harness.

The eight cases under `tests/test262/cases/` are byte-for-byte copies of these upstream files at
Test262 revision `3655e7464de3d52643ecddd4b5f9f4f3e7f62398`:

* `test/language/expressions/division/line-terminator.js`
* `test/language/expressions/modulus/line-terminator.js`
* `test/language/expressions/multiplication/line-terminator.js`
* `test/harness/compare-array-empty.js`
* `test/harness/assert-throws-native.js`
* `test/harness/assert-throws-custom.js`
* `test/harness/assert-throws-incorrect-ctor.js`
* `test/harness/assert-throws-null-fn.js`

They run in both default and strict variants, giving sixteen actual Test262 executions in the
focused runner check.

## Semantic ownership

The runner owns only test policy: metadata, includes, variants, and process status. It adds no
JavaScript operation. JavaScript syntax continues to lower into the operations in `lib/**/*.jsl`;
`tests/dsl-ownership-test.coil` rejects frontend arithmetic, comparison, or bitwise semantics that
bypass the DSL. Exception control will require runtime/compiler structure, but the meaning of
throwing and every value operation remains in the DSL.
