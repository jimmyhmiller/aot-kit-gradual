#!/usr/bin/env node
import fs from "node:fs";

const [input, output, seedText = "0", registersText = "10", optimizeText = "1"] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: generate-typescript-aot-benchmark.mjs INPUT.js|--resident OUTPUT.coil [SEED] [REGISTERS] [OPTIMIZE]");
  process.exit(2);
}
// --resident: the emitter reads its JavaScript source from argv at RUNTIME instead of baking it
// in. One compiler build then serves every source file — the iteration loop for source-side
// debugging drops from a full compiler rebuild to seconds. Resident argv: SOURCE.js [SEED] [REGS].
const resident = input === "--resident";

const seed = Number.parseInt(seedText, 10);
const registers = Number.parseInt(registersText, 10);
const optimize = optimizeText !== "0";
if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(registers) || registers < 1) {
  throw new Error("seed and registers must be valid integers, with registers positive");
}

const source = resident ? "" : fs.readFileSync(input, "utf8");
const scriptKind = !resident && input.endsWith(".ts") ? "TS-SCRIPT-TS" : "TS-SCRIPT-JS";
const frontendSeed = seed === 0 ? 7301 : seed;
const residentHelper = String.raw`
(defn resident-source [(argc i32) (argv (ptr (ptr i8)))] (-> (slice u8))
  (if (< argc 2)
      (do (fmt (stderr) "usage: emitter SOURCE.js|ts [SCHED-SEED] [REGISTERS] [js|ts] [emit|eval] [FRONTEND-SEED] [OPTIMIZE]\n") (os/_exit 2) "")
      (match (read-file (malloc-allocator) (cstr->str (load (index argv 1))))
        (Ok [src] src)
        (Err [e]
          (do (fmt (stderr) "cannot read source {s}\n" (cstr->str (load (index argv 1))))
              (os/_exit 2)
              "")))))
`;

const generated = `(module generatedtypescriptbenchmark)
(import "frontendnative" :use *)
(import "frontendnativegraph" :use *)
(import "typescriptnative" :use *)
(import "node" :use *)
(import "shape" :use *)
(import "text" :use *)
(import "verify" :use *)
(import "backend_core" :use *)
(import "backend_cfg" :use *)
(import "backend_select" :use *)
(import "backend_liveness" :use *)
(import "backend_schedule" :use *)
(import "backend_allocate" :use *)
(import "backend_aarch64" :use *)
(import "backend_macho" :use *)
(import "eval" :use *)
(import "ty" :use *)
(import "coil.io" :use *)
(import "coil.fmt" :use *)
(import "coil.fs" :use *)
(import "coil.str" :use *)
(import "coil.alloc" :use *)
(import "coil.os" :as os)

(extern write :cc c [i32 (ptr u8) i64] (-> i64))
(extern atoi :cc c [(ptr i8)] (-> i32))
(extern mach_absolute_time :cc c [] (-> u64))
(defstruct MachTimebase [(numer u32) (denom u32)])
(extern mach_timebase_info :cc c [(ptr MachTimebase)] (-> i32))

;; Per-pass wall time on stderr. bt-phase! prints the milliseconds since its previous call, so
;; dropping a call between two pipeline stages names exactly what that stage cost. The first
;; call only arms the clock.
(defn bt-ticks-to-ms [(dt i64)] (-> i64)
  (let [tb (stack MachTimebase)]
    (mach_timebase_info tb)
    (/ (* dt (cast i64 (load (field tb numer))))
       (* (cast i64 (load (field tb denom))) 1000000))))
(defn bt-phase-mark [] (-> (ptr i64))
  (static i64))
(defn bt-phase! [(name (slice u8))] (-> i64)
  (let [cell (bt-phase-mark)
        now (cast i64 (mach_absolute_time))
        prev (load cell)]
    (store! cell now)
    (if (= prev 0)
        0
        (do (fmt (stderr) "phase-ms {s}={d}\\n" name (bt-ticks-to-ms (- now prev))) 0))))

(defn print-parm-sources [(parm i64)] (-> i64)
  (let [fun (n-in parm 0) fidx (n-aux fun) idx (n-aux parm) (mut call) 0]
    (loop (if (>= (load call) (n-count))
              (break)
              (do
                (if (and (= (n-op (load call)) OP-CALL)
                         (!= (& (infer-call-targets (load call)) (<< 1 fidx)) 0))
                    (let [source (infer-parm-source (load call) fun idx)]
                      (if (= source NO-NODE)
                          0
                          (do
                            (fmt (stderr) " parm-source call={d} source={d}:{s} ty={d} kind={d}"
                                 (load call) source (op-name (n-op source)) (n-ty source)
                                 (ml-kind-for-source-representation source))
                            (if (= (n-op source) OP-BOX)
                                (let [inner (n-in source 1)]
                                  (do
                                    (fmt (stderr) " inner={d}:{s} inner-ty={d} inner-kind={d}"
                                         inner (op-name (n-op inner)) (n-ty inner)
                                         (ml-kind-for-node inner))
                                    0))
                                0)
                            (if (= (n-op source) OP-PHI)
                                (let [(mut pi) 1]
                                  (loop (if (>= (load pi) (n-nins source))
                                            (break)
                                            (do
                                              (let [pv (n-in source (load pi))]
                                                (fmt (stderr) " phi{d}={d}:{s}:ty{d}:kind{d}"
                                                     (load pi) pv (op-name (n-op pv)) (n-ty pv)
                                                     (ml-kind-for-node pv))
                                                (if (= (n-op pv) OP-BOX)
                                                    (let [pvi (n-in pv 1)]
                                                      (do
                                                        (fmt (stderr) ":inner={d}:{s}:ty{d}:kind{d}:tagged{d}"
                                                             pvi (op-name (n-op pvi)) (n-ty pvi)
                                                             (ml-kind-for-node pvi)
                                                             (if (be-box-input-already-tagged? pvi) 1 0))
                                                        0))
                                                    0))
                                              (store! pi (+ (load pi) 1))
                                              0))))
                                0)
                            0)))
                    0)
                (store! call (+ (load call) 1))
                0)))
    0))

(defn print-property-boxing-map [] (-> i64)
  (let [(mut node) 0]
    (loop (if (>= (load node) (n-count))
              (break)
              (do
                (let [op (n-op (load node))]
                  (if (and (not (n-dead? (load node)))
                           (or (= op OP-PROPLOAD) (= op OP-PROPSTORE)))
                      (do
                        (fmt (stderr) "property-map ideal={d} op={s} name={d}:{s} owner={d}:{s}"
                             (load node) (op-name op) (n-aux (load node))
                             (shape-name-bytes (n-aux (load node)))
                             (n-in (load node) 2) (op-name (n-op (n-in (load node) 2))))
                        (if (= op OP-PROPSTORE)
                            (let [value (n-in (load node) 3)]
                              (fmt (stderr) " value={d}:{s} ty={d}"
                                   value (op-name (n-op value)) (n-ty value))
                              (if (= (n-op value) OP-BOX)
                                  (let [input (n-in value 1)]
                                    (do
                                      (fmt (stderr) " box-input={d}:{s} input-ty={d} parm-index={d} rep={d} tagged={d} tag={d}"
                                           input (op-name (n-op input)) (n-ty input)
                                           (if (= (n-op input) OP-PARM) (n-aux input) -1)
                                           (if (= (n-op input) OP-PARM)
                                               (ml-kind-for-parm-representation input) -1)
                                           (if (be-box-input-already-tagged? input) 1 0)
                                           (be-js-tag-for-value input))
                                      (if (= (n-op input) OP-PARM) (print-parm-sources input) 0)
                                      0))
                                  0))
                            0)
                        (fmt (stderr) "\n")
                        0)
                      0))
                (store! node (+ (load node) 1))
                0)))
    (store! node 0)
    (loop (if (>= (load node) (n-count))
              (break)
              (do
                (if (and (not (n-dead? (load node)))
                         (and (= (n-op (load node)) OP-BOX)
                              (= (n-op (n-in (load node) 1)) OP-PARM)))
                    (let [input (n-in (load node) 1)]
                      (do
                        (fmt (stderr) "parm-box ideal={d} input={d} index={d} rep={d} tagged={d}"
                             (load node) input (n-aux input)
                             (ml-kind-for-parm-representation input)
                             (if (be-box-input-already-tagged? input) 1 0))
                        (print-parm-sources input)
                        (fmt (stderr) "\n")
                        0))
                    0)
                (store! node (+ (load node) 1))
                0)))
    (let [(mut at) 0]
      (loop (if (>= (load at) (be-inst-count))
                (break)
                (do
                  (let [ideal (ms-inst-node (load at))]
                    (if (and (>= ideal 0)
                             (or (= (n-op ideal) OP-PROPLOAD)
                                 (= (n-op ideal) OP-PROPSTORE)))
                        (do
                          (fmt (stderr) "property-machine ideal={d} inst={d} owner={d} block={d} op={d}\n"
                               ideal (load at) (ms-inst-owner (load at))
                               (ms-inst-block (load at)) (ms-inst-op (load at)))
                          0)
                        0))
                  (store! at (+ (load at) 1))
                  0))))
    0))

;; MODE argv "eval": run the built graph through the IR evaluator instead of emitting machine
;; code. The result prints in the same result= form the native harness uses, so a driver can
;; three-way a program: Node (semantic oracle) vs evaluator (is the FRONTEND lowering right?) vs
;; native (is the BACKEND right?). A budget exhaustion or trap is a loud nonzero evstatus.
(defn run-eval! [] (-> i64)
  (ev-reset!)
  (if (= (os/getenv c"AOT_EV_TRACE") (cast (ptr i8) 0))
      0
      (do (ev-trace-enable! 100000) 0))
  (ev-bind-args! 0)
  (let [status (ev-run-nobind 2000000000)]
    (fmt (stdout) "evstatus={d} steps={d} at={d}:{s}\n"
         status (ev-steps) (ev-at)
         (if (= (ev-at) NO-NODE) "none" (op-name (n-op (ev-at)))))
    ;; A float result prints as its numeric value, not its bit pattern: the driver compares
    ;; against Node's decimal output. Integral floats print as integers so 10.0 matches 10.
    (let [result (ev-result)]
      (if (= (rt-tag result) RT-FLT)
          (let [value (bits-f64 (rt-payload result))]
            (if (= (f64-bits (cast f64 (cast i64 value))) (rt-payload result))
                (fmt (stdout) "result={d}\n" (cast i64 value))
                (fmt (stdout) "result-float={f}\n" value)))
          (fmt (stdout) "result={d}\n" (rt-payload result))))
    (if (= (os/getenv c"AOT_EV_TRACE") (cast (ptr i8) 0))
        0
        (do (ev-trace-print-jsonl (stderr)) 0))
    (if (= status EV-OK) 0 3)))

${resident ? residentHelper : ""}
(defn main [(argc i32) (argv (ptr (ptr i8)))] (-> i64)
  (let [${resident ? `schedule-seed (if (> argc 2) (cast i64 (atoi (load (index argv 2)))) 0)
        register-count (if (> argc 3) (cast i64 (atoi (load (index argv 3)))) 10)
        source (resident-source argc argv)
        filename (if (< argc 2) "" (cstr->str (load (index argv 1))))
        script-kind (if (and (> argc 4) (str-eq (cstr->str (load (index argv 4))) "ts"))
                        TS-SCRIPT-TS
                        TS-SCRIPT-JS)
        run-mode (if (> argc 5) (cstr->str (load (index argv 5))) "")
        frontend-seed (if (> argc 6) (cast i64 (atoi (load (index argv 6)))) ${frontendSeed})
        optimize-build (if (> argc 7)
                           (!= (cast i64 (atoi (load (index argv 7)))) 0)
                           ${optimize ? "true" : "false"})` : `run-mode ""
        schedule-seed (if (> argc 1) (cast i64 (atoi (load (index argv 1)))) ${seed})
        register-count (if (> argc 2) (cast i64 (atoi (load (index argv 2)))) ${registers})
        source ${JSON.stringify(source)}
        filename ${JSON.stringify(input)}`}
        (mut frontend) (fe-native-new-file source filename ${resident ? "script-kind" : scriptKind})]
    (fmt (stderr) "phase=frontend-index-begin\\n")
    (bt-phase! "arm")
    (if (!= (fe-native-index! (mut frontend)) FE-OK)
        (do
          (fmt (stderr) "frontend-status={d} code={d} node={d} role={d}\\n"
               (load (field frontend status)) (load (field frontend error-code))
               (load (field frontend error-node)) (load (field frontend error-role)))
          (fe-native-free! (mut frontend))
          2)
        (let [entry (frontend-native-build! (mut frontend) ${resident ? "frontend-seed" : frontendSeed} ${resident ? "optimize-build" : (optimize ? "true" : "false")})]
          (bt-phase! "frontend")
          (fmt (stderr) "phase=frontend-build-end entry={d} nodes={d}\\n" entry (n-count))
${resident ? `          (let [rep-count (g-rep-report (stderr))]
            (if (> rep-count 0) (do (fmt (stderr) "rep-violations={d}\\n" rep-count) 0) 0))
          (if (= (os/getenv c"AOT_DUMP_GRAPH") (cast (ptr i8) 0))
              0
              (do (g-print-flat (stderr)) 0))` : ""}
          (fe-native-free! (mut frontend))
          (if (!= (g-verify) 0)
                  (do
                    (fmt (stderr) "verify={d} node={d}\\n" (g-verify-code) (g-verify-node))
                    (g-print-flat (stderr))
                    4)
                  (if (str-eq run-mode "eval")
                  (run-eval!)
                  (do
                  (fmt (stderr) "phase=machine-select-begin\\n")
                  (if (not (be-select-machine-program!))
                      (do
                        (fmt (stderr) "select={d} node={d} machine={d} item={d}\\n"
                             (be-result) (be-result-node) (ms-result) (ms-result-item))
                        (fmt (stderr) "schedule={d} schedule-item={d}\\n"
                             (ms-schedule-result) (ms-schedule-item))
                        (if (and (>= (ms-result-item) 0) (< (ms-result-item) (n-count)))
                            (do
                              (fmt (stderr) " selection-item-node={d}:{s} aux={d} ty={d} nins={d}\\n"
                                   (ms-result-item) (op-name (n-op (ms-result-item)))
                                   (n-aux (ms-result-item)) (n-ty (ms-result-item))
                                   (n-nins (ms-result-item)))
                              (if (and (= (n-op (ms-result-item)) OP-BOX)
                                       (> (n-nins (ms-result-item)) 1))
                                  (let [input (n-in (ms-result-item) 1)]
                                    (do
                                      (fmt (stderr) " box-failure input={d}:{s} ty={d} parm-rep={d} tagged={d} tag={d} call-kind={d} call-tag={d} targets={d}\\n"
                                           input (op-name (n-op input)) (n-ty input)
                                           (if (= (n-op input) OP-PARM)
                                               (ml-kind-for-parm-representation input) -1)
                                           (if (be-box-input-already-tagged? input) 1 0)
                                           (be-js-tag-for-value input)
                                           (if (= (n-op input) OP-CALL) (be-call-return-kind input) -2)
                                           (if (= (n-op input) OP-CALL) (be-call-return-tag input) -2)
                                           (if (= (n-op input) OP-CALL) (infer-call-targets input) 0))
                                      (if (= (n-op input) OP-PARM) (print-parm-sources input) 0)
                                      (if (= (n-op input) OP-CALL)
                                          (let [callee (mu-direct-callee input)
                                                target (mu-find-function callee)
                                                targets (infer-call-targets input)
                                                (mut fi) 0]
                                            (do
                                              (fmt (stderr) " call-callee={d}:{s} machine-owner={d} returns={d} direct-kind={d} direct-tag={d}\\n"
                                                   callee (if (= callee NO-NODE) "none" (op-name (n-op callee)))
                                                   target
                                                   (if (< target 0) -1 (mu-function-return-count target))
                                                   (if (< target 0) -1 (be-function-return-kind target))
                                                   (if (< target 0) -1 (be-function-return-tag target)))
                                              (loop (if (>= (load fi) (mu-function-count))
                                                        (break)
                                                        (let [ideal (mu-function-ideal (load fi))]
                                                          (if (and (!= ideal NO-NODE)
                                                                   (and (= (n-op ideal) OP-FUN)
                                                                        (!= (& targets (<< 1 (n-aux ideal))) 0)))
                                                              (do
                                                                (fmt (stderr) " matching-owner={d} ideal={d} fidx={d} kind={d} tag={d}\\n"
                                                                     (load fi) ideal (n-aux ideal)
                                                                     (be-function-return-kind (load fi))
                                                                     (be-function-return-tag (load fi)))
                                                                (let [(mut ri) 0]
                                                                  (loop (if (>= (load ri) (mu-function-return-count (load fi)))
                                                                            (break)
                                                                            (let [rb (mu-function-return-block (load fi) (load ri))
                                                                                  rt (mu-block-terminator rb)
                                                                                  rv (if (and (!= rt NO-NODE) (= (n-op rt) OP-RETURN))
                                                                                         (n-in rt 1)
                                                                                         NO-NODE)]
                                                                              (fmt (stderr) "  return={d}:{s} ty={d} source-kind={d} value-tag={d} call-kind={d} call-tag={d}\\n"
                                                                                   rv (if (= rv NO-NODE) "none" (op-name (n-op rv)))
                                                                                   (if (= rv NO-NODE) -1 (n-ty rv))
                                                                                   (if (= rv NO-NODE) -1 (ml-kind-for-source-representation rv))
                                                                                   (if (= rv NO-NODE) -1 (be-js-tag-for-value rv))
                                                                                   (if (and (!= rv NO-NODE) (= (n-op rv) OP-CALL)) (be-call-return-kind rv) -2)
                                                                                   (if (and (!= rv NO-NODE) (= (n-op rv) OP-CALL)) (be-call-return-tag rv) -2))
                                                                              (store! ri (+ (load ri) 1))))))
                                                                0)
                                                              0)
                                                          (store! fi (+ (load fi) 1)))))
                                              0))
                                          0)
                                      (fmt (stderr) "\\n")
                                      (g-print-flat-range (stderr)
                                                          (- (ms-result-item) 12)
                                                          (+ (ms-result-item) 13))
                                      0))
                                  0)
                              0)
                            0)
                        (if (and (>= (ms-result-item) 0) (< (ms-result-item) (be-inst-count)))
                            (let [mi (ms-result-item)]
                              (fmt (stderr) " inst={d} owner={d} block={d} op={d} ideal={d}\\n"
                                   mi (ms-inst-owner mi) (ms-inst-block mi)
                                   (ms-inst-op mi) (ms-inst-node mi))
                              (fmt (stderr) " a={d} defa={d} b={d} defb={d} earliest={d}\\n"
                                   (ms-inst-a mi) (ms-def-inst (ms-inst-a mi))
                                   (load (field (be-inst mi) b))
                                   (ms-def-inst (load (field (be-inst mi) b)))
                                   (ms-inst-earliest mi))
                              (fmt (stderr) " deps={d} memory={d} args={d}\\n"
                                   (if (ms-inst-dependencies-valid? mi) 1 0)
                                   (if (ms-memory-dependencies-valid? mi) 1 0)
                                   (ms-inst-arg-count mi))
                              (if (> (ms-inst-memory-dep-count mi) 0)
                                  (let [memory-node (ms-inst-memory-dep-node mi 0)]
                                    (do
                                      (fmt (stderr) " memory-node={d}:{d} before={d} inst={d} block={d} actual-block={d} member={d} edge={d}\\n"
                                           memory-node (n-op memory-node)
                                           (if (ms-memory-node-before?
                                                 (ms-inst-owner mi) memory-node mi) 1 0)
                                           (ms-node-inst-before
                                             (ms-inst-owner mi) memory-node (be-inst-count))
                                           (ms-memory-block (ms-inst-owner mi) memory-node)
                                           (ms-inst-block
                                             (ms-node-inst-before
                                               (ms-inst-owner mi) memory-node (be-inst-count)))
                                           (ms-inst-membership-count
                                             (ms-node-inst-before
                                               (ms-inst-owner mi) memory-node (be-inst-count)))
                                           (ms-schedule-dependency-kind
                                             (ms-node-inst-before
                                               (ms-inst-owner mi) memory-node (be-inst-count))
                                             mi))
                                      0))
                                  0)
                              (let [ideal (ms-inst-node mi)
                                    owner (ms-inst-owner mi)]
                                (if (and (>= ideal 0) (< ideal (n-count)))
                                    (let [(mut input-index) 0]
                                      (fmt (stderr) " ideal-op={s} aux={d} ty={d} nins={d}"
                                           (op-name (n-op ideal)) (n-aux ideal) (n-ty ideal) (n-nins ideal))
                                      (loop (if (>= (load input-index) (n-nins ideal))
                                                (break)
                                                (let [input (n-in ideal (load input-index))]
                                                  (fmt (stderr) " input{d}=({d}:{s}:v{d})"
                                                       (load input-index) input
                                                       (if (= input NO-NODE) "none" (op-name (n-op input)))
                                                       (if (= input NO-NODE) -1 (ms-vget owner input)))
                                                  (store! input-index (+ (load input-index) 1)))))
                                      (fmt (stderr) "\\n")
                                      0)
                                    0))
                              (let [retry-ideal (ms-inst-node mi)
                                    retry-owner (ms-inst-owner mi)
                                    retry-repair (ms-repair-late-memory-deps!)
                                    retry-schedule (ms-local-schedule! 0)
                                    retry-verify (if retry-schedule (ms-verify!) false)]
                                (if (and (>= retry-ideal 0) (> (n-nins retry-ideal) 1))
                                    (do
                                      (fmt (stderr)
                                           " retry-repair={d} retry-schedule={d} retry-verify={d} retry-machine={d} retry-item={d} producer={d} consumer={d}\\n"
                                           (if retry-repair 1 0) (if retry-schedule 1 0) (if retry-verify 1 0)
                                           (ms-result) (ms-result-item)
                                           (ms-node-inst-before retry-owner (n-in retry-ideal 1) (be-inst-count))
                                           (ms-node-inst-before retry-owner retry-ideal (be-inst-count)))
                                      0)
                                    0))
                              0)
                            0)
                        5)
                      (do
                        (if (= schedule-seed -998)
                            (do (print-property-boxing-map)
                                (fmt (stderr) "phi-debug n3134 aux={d} ty={d} n3435-aux={d} n3435-ty={d}\n"
                                     (n-aux 3134) (n-ty 3134) (n-aux 3435) (n-ty 3435))
                                0)
                            0)
                        (if (= schedule-seed -999)
                            (do (let [(mut name) 0]
                                  (loop (if (>= (load name) (shape-name-count))
                                            (break)
                                            (do (fmt (stderr) "shape-name {d}={s}\\n"
                                                     (load name) (shape-name-bytes (load name)))
                                                (store! name (+ (load name) 1))))))
                                (g-print-flat (stderr)) (mu-dump (stderr)) (ms-dump-verbose (stderr)) 0)
                            0)
                        (be-use-runtime-allocation! true)
                        (bt-phase! "select")
                        (let [sched-rc (if (= schedule-seed -777)
                                           (be-schedule!)
                                           (be-schedule-seeded! schedule-seed))]
                          (bt-phase! "schedule")
                          (if (< sched-rc 0)
                            (do
                              (fmt (stderr)
                                   "schedule={d} item={d} machine={d} machine-item={d} live={d} live-item={d}\\n"
                                   (ms-schedule-result) (ms-schedule-item)
                                   (ms-result) (ms-result-item)
                                   (ml-result) (ml-result-item))
                              (if (= (ml-result) MLIVE-CLASS)
                                  (ml-dump-register-classes (stderr))
                                  0)
                              6)
                            (let [color-rc (if (= schedule-seed -777)
                                               (be-color! register-count)
                                               (be-color-seeded! register-count schedule-seed))]
                              (bt-phase! "color")
                              (if (< color-rc 0)
                                7
                                (let [encode-ok (be-encode-checked!)]
                                  (bt-phase! "encode")
                                  (if (not encode-ok)
                                    8
                                    (let [macho-ok (be-macho-checked!)]
                                      (bt-phase! "macho")
                                      (if (not macho-ok)
                                        9
                                        (if (= (write 1 (be-object-data) (be-object-len))
                                               (be-object-len))
                                            0
                                            10))))))))))))))))))
`;

fs.writeFileSync(output, generated);
