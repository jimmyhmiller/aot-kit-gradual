/* ONE NODE PROCESS FOR THE WHOLE RUN, INSTEAD OF ONE PER CASE.
 *
 * `node-run-source` in tests/js-source-prop.coil reaches the oracle with popen(), which forks and
 * execs a fresh node for every program. Measured on this machine: 63 ms of process startup per
 * call, against a linear 49.5 ms/case for the whole property -- so essentially ALL of the fuzzer's
 * per-case cost was spawning node, none of it the compiler under test. A -n 600 campaign took
 * forty minutes and the compiler was idle for thirty-nine of them.
 *
 * This keeps one node alive and talks to it over a pipe. Measured at 0.076 ms/case, ~650x.
 *
 * POSIX_SPAWN, NOT FORK, AND THAT IS NOT A STYLE CHOICE. The process that links this also links
 * the TypeScript-Go bridge, and a Go runtime does not survive fork() in a multithreaded process --
 * it is the same hazard that made the test runner move off fork, and the reason the frontend
 * property could not run under the forking property runner at all.
 *
 * PROTOCOL. Parent writes "<byte-length> <arg>\n" followed by exactly that many bytes of source.
 * Child replies with one line: the answer, or "ERR <message>". A length prefix rather than a
 * delimiter because the programs contain newlines and, being generated, may contain anything else
 * a delimiter would have to be distinct from.
 *
 * The child strips TypeScript types with node:module's stripTypeScriptTypes and evaluates through
 * `new Function`, which gives each program a fresh scope -- `main` from one case cannot leak into
 * the next -- without the cost of building a vm context per case.
 */
#include <errno.h>
#include <signal.h>
#include <spawn.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;

static const char *ORACLE_JS =
    "const fs = require('fs');\n"
    "const { stripTypeScriptTypes } = require('node:module');\n"
    "let buf = Buffer.alloc(0);\n"
    "function more() {\n"
    "  const b = Buffer.allocUnsafe(65536);\n"
    "  let n;\n"
    "  try { n = fs.readSync(0, b, 0, 65536, null); }\n"
    "  catch (e) { if (e.code === 'EAGAIN') return; process.exit(0); }\n"
    "  if (n <= 0) process.exit(0);\n"
    "  buf = Buffer.concat([buf, b.subarray(0, n)]);\n"
    "}\n"
    "function line() { for (;;) { const i = buf.indexOf(10); if (i >= 0) { const s = buf.subarray(0, i).toString(); buf = buf.subarray(i + 1); return s; } more(); } }\n"
    "function bytes(n) { while (buf.length < n) more(); const s = buf.subarray(0, n).toString(); buf = buf.subarray(n); return s; }\n"
    "for (;;) {\n"
    "  const h = line().split(' ');\n"
    "  const src = bytes(parseInt(h[0], 10));\n"
    "  let out;\n"
    "  try { out = String(new Function(stripTypeScriptTypes(src) + '\\nreturn String(main(' + h[1] + '));')()); }\n"
    "  catch (e) { out = 'ERR ' + String(e && e.message).replace(/\\n/g, ' '); }\n"
    "  fs.writeSync(1, out + '\\n');\n"
    "}\n";

static int oracle_in = -1;   /* parent writes programs here */
static int oracle_out = -1;  /* parent reads answers here */
static pid_t oracle_pid = -1;
static int oracle_broken = 0;

static int oracle_start(void) {
    int to_child[2], from_child[2];
    posix_spawn_file_actions_t acts;
    char *argv[4];

    if (pipe(to_child) != 0) return -1;
    if (pipe(from_child) != 0) { close(to_child[0]); close(to_child[1]); return -1; }

    /* A node that exits (or is killed) must not take this process down with it; the read below
     * reports the failure instead. */
    signal(SIGPIPE, SIG_IGN);

    if (posix_spawn_file_actions_init(&acts) != 0) goto fail;
    posix_spawn_file_actions_adddup2(&acts, to_child[0], 0);
    posix_spawn_file_actions_adddup2(&acts, from_child[1], 1);
    posix_spawn_file_actions_addclose(&acts, to_child[1]);
    posix_spawn_file_actions_addclose(&acts, from_child[0]);

    argv[0] = (char *)"node";
    argv[1] = (char *)"-e";
    argv[2] = (char *)ORACLE_JS;
    argv[3] = NULL;

    /* posix_spawnp so PATH is searched, and argv passed directly -- there is no shell here, so the
     * script needs no quoting and a program containing quotes cannot escape anything. */
    if (posix_spawnp(&oracle_pid, "node", &acts, NULL, argv, environ) != 0) {
        posix_spawn_file_actions_destroy(&acts);
        goto fail;
    }
    posix_spawn_file_actions_destroy(&acts);

    close(to_child[0]);
    close(from_child[1]);
    oracle_in = to_child[1];
    oracle_out = from_child[0];
    return 0;

fail:
    close(to_child[0]); close(to_child[1]);
    close(from_child[0]); close(from_child[1]);
    return -1;
}

static int write_all(int fd, const char *p, long n) {
    while (n > 0) {
        ssize_t k = write(fd, p, (size_t)n);
        if (k < 0) { if (errno == EINTR) continue; return -1; }
        p += k; n -= k;
    }
    return 0;
}

/* Read one newline-terminated answer. Returns the length written to `out` (NUL-terminated), or
 * -1 if the child died or the line did not fit. */
static long read_line(char *out, long cap) {
    long len = 0;
    for (;;) {
        char c;
        ssize_t k = read(oracle_out, &c, 1);
        if (k < 0) { if (errno == EINTR) continue; return -1; }
        if (k == 0) return -1;
        if (c == '\n') { out[len] = 0; return len; }
        if (len + 1 >= cap) return -1;
        out[len++] = c;
    }
}

/* Evaluate `main(arg)` in `src` and write the answer into `out`.
 * Returns 0 on success. A non-zero return means the ORACLE failed (node missing, node crashed,
 * answer too long) -- it never means the program disagreed, which is the caller's comparison to
 * make. A JavaScript exception comes back as a normal answer beginning "ERR ". */
int js_oracle_run(const char *src, long srclen, long arg, char *out, long outcap) {
    char header[64];
    int header_len;

    if (oracle_broken) return -1;
    if (oracle_pid < 0 && oracle_start() != 0) { oracle_broken = 1; return -1; }

    header_len = snprintf(header, sizeof header, "%ld %ld\n", srclen, arg);
    if (header_len < 0 || header_len >= (int)sizeof header) { oracle_broken = 1; return -1; }

    if (write_all(oracle_in, header, header_len) != 0 ||
        write_all(oracle_in, src, srclen) != 0) {
        oracle_broken = 1;
        return -1;
    }
    if (read_line(out, outcap) < 0) { oracle_broken = 1; return -1; }
    return 0;
}

/* Let go of the child. Safe to call when it was never started. */
void js_oracle_shutdown(void) {
    if (oracle_in >= 0) { close(oracle_in); oracle_in = -1; }
    if (oracle_out >= 0) { close(oracle_out); oracle_out = -1; }
    if (oracle_pid > 0) {
        int status;
        waitpid(oracle_pid, &status, 0);
        oracle_pid = -1;
    }
}
