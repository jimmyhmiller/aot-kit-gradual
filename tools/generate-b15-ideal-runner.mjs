#!/usr/bin/env node
import fs from "node:fs";

const [input, output, mode = "both", traceLimitText = "4096"] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: generate-b15-ideal-runner.mjs INPUT.js OUTPUT.coil [raw|optimized|both] [TRACE_LIMIT]");
  process.exit(2);
}
if (!["raw", "optimized", "both"].includes(mode)) throw new Error(`unknown ideal mode: ${mode}`);
const traceLimit = Number.parseInt(traceLimitText, 10);
if (!Number.isSafeInteger(traceLimit) || traceLimit < 0) throw new Error("TRACE_LIMIT must be a non-negative integer");
const source = fs.readFileSync(input, "utf8");
fs.writeFileSync(output, `(module b15idealrunner)
(import "frontendnative" :use *)
(import "frontendnativegraph" :use *)
(import "eval" :use *)
(import "gtext" :use *)
(import "node" :use *)
(import "shape" :use *)
(import "coil.io" :use *)
(import "coil.fmt" :use *)
(defn run [(optimize bool)] (-> i64)
  (let [(mut frontend) (fe-native-new-file ${JSON.stringify(source)} ${JSON.stringify(input)} 1)
        indexed (fe-native-index! (mut frontend))]
    (if (!= indexed FE-OK)
        (do (fmt (stderr) "index={d} code={d} node={d}\\n" indexed
                 (load (field frontend error-code)) (load (field frontend error-node)))
            (fe-native-free! (mut frontend)) 2)
        (do
          (frontend-native-build-mode! (mut frontend) 11500 optimize true)
          (ev-reset!)
          (ev-trace-enable! ${traceLimit})
          (ev-bind-args! 0)
          (let [status (ev-run-nobind 200000000) result (rt-payload (ev-result))]
            (fmt (stdout) "status={d} result={d} steps={d} at={d}\\n"
                 status result (ev-steps) (ev-at))
            (ev-trace-print-jsonl (stderr))
            (if (= status EV-CALL)
                (let [call (ev-at)
                      callee (n-in call 1)
                      fun (if (= (n-op callee) OP-CLOSURE) (n-in callee 0) callee)
                      (mut oi) 0]
                  (fmt (stderr) "call={d} callee={d}:{s} caux={d} fun={d} parms={d} outs={d}\\n"
                       call callee (op-name (n-op callee)) (n-aux callee) fun
                       (fun-parm-count fun) (n-nouts fun))
                  (loop (if (>= (load oi) (n-nouts fun))
                            (break)
                            (do
                              (let [out (n-out fun (load oi))]
                                (if (= (n-op out) OP-PARM)
                                    (do (fmt (stderr) " parm={d} index={d}\\n" out (n-aux out)) 0)
                                    0))
                              (store! oi (+ (load oi) 1))))))
                0)
            (if (and (= status EV-TYPE) (= (n-op (ev-at)) OP-PROPLOAD))
                (let [outer (ev-at) inner (n-in outer 2)]
                  (fmt (stderr) "property-type outer={s} inner-op={s} inner={s}\\n"
                       (shape-name-bytes (n-aux outer)) (op-name (n-op inner))
                       (if (= (n-op inner) OP-PROPLOAD)
                           (shape-name-bytes (n-aux inner)) "-"))
                  0)
                0)
            (if (and (= status EV-TYPE) (= (n-op (ev-at)) OP-ARRAYSTORE))
                (let [array-node (n-in (ev-at) 2)]
                  (fmt (stderr) "array-type object-op={s} property={s}\\n"
                       (op-name (n-op array-node))
                       (if (= (n-op array-node) OP-PROPLOAD)
                           (shape-name-bytes (n-aux array-node)) "-"))
                  0)
                0)
            (if (!= status EV-OK)
                (do
                  (ev-trace-print (stderr))
                  (fmt (stderr) "focused graph neighborhood:\n")
                  (g-print-flat-range (stderr) (- (ev-at) 12) (+ (ev-at) 13))
                  0)
                0)
            (fe-native-free! (mut frontend))
            (if (and (= status EV-OK) (= result 0)) 0 3))))))
(defn main [] (-> i64)
  ${mode === "raw" ? "(run false)" : mode === "optimized" ? "(run true)" : "(let [raw (run false) optimized (run true)] (if (and (= raw 0) (= optimized 0)) 0 4))"})
`);
