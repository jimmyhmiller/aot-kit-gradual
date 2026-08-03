#!/usr/bin/env node
import fs from "node:fs";
import { normalizeTypeScript } from "../src/frontend_ir.mjs";
import { generateCoilBuilder } from "../src/frontend_coil_codegen.mjs";

const [mode, output, maximumDepthText = "10"] = process.argv.slice(2);
const maximumDepth = Number(maximumDepthText);
if (!output || !["--emitter", "--interpreter-test", "--profile-emitter"].includes(mode)) {
  console.error("usage: generate-typescript-binarytrees.mjs [--emitter|--interpreter-test|--profile-emitter] OUTPUT.coil [MAX_DEPTH]");
  process.exit(2);
}
if (!Number.isInteger(maximumDepth) || maximumDepth < 4 || maximumDepth > 10 || maximumDepth % 2)
  throw new Error("MAX_DEPTH must be an even integer from 4 through 10");
const input = "tests/typescript/binarytrees.ts";
const program = normalizeTypeScript(fs.readFileSync(input, "utf8"), input);
let generated = generateCoilBuilder(program, { moduleName: "generatedtypescriptbinarytrees" });
generated = generated.replace(
  "(defn frontend-build! [(seed i64) (optimize bool)] (-> i64)",
  "(defn frontend-build-mode! [(seed i64) (optimize bool) (analyze bool)] (-> i64)",
).replace("    (g-analyze!)\n", "    (if analyze (g-analyze!) 0)\n");
generated += `
(defn frontend-build! [(seed i64) (optimize bool)] (-> i64)
  (frontend-build-mode! seed optimize true))
`;

if (mode === "--emitter") {
  generated = generated.replace("(import \"coil.slice\" :use *)",
    `(import "coil.slice" :use *)
(import "backend" :use *)
(import "coil.io" :use *)
(import "coil.fmt" :use *)`);
  generated += `
(extern write :cc c [i32 (ptr u8) i64] (-> i64))
(extern atoi :cc c [(ptr i8)] (-> i32))
(defn main [(argc i32) (argv (ptr (ptr i8)))] (-> i64)
  (let [seed (if (> argc 1) (cast i64 (atoi (load (index argv 1)))) 0)
        registers (if (> argc 2) (cast i64 (atoi (load (index argv 2)))) 10)]
    (frontend-build! (+ 4301 seed) true)
    (if (!= (g-verify) 0)
        (do (fmt (stderr) "TypeScript graph verification failed {d}:{d}\\n" (g-verify-code) (g-verify-node)) 2)
      (if (not (be-select-machine-program!))
          (do (fmt (stderr) "TypeScript selection failed be={d} node={d} verify={d} cfg={d}:{d} ms={d}:{d}\\n"
                   (be-result) (be-result-node) (be-verify-code)
                   (mu-verify-result) (mu-verify-item) (ms-result) (ms-result-item)) 3)
        (do (be-use-runtime-allocation! true)
            (if (< (be-schedule-seeded! seed) 0)
                (do (fmt (stderr) "TypeScript schedule failed ms={d}:{d} sched={d}:{d} live={d}:{d}\\n"
                         (ms-result) (ms-result-item) (ms-schedule-result) (ms-schedule-item)
                         (ml-result) (ml-result-item))
                    (ms-dump (stderr)) 4)
              (if (< (be-color-seeded! registers seed) 0) 5
                (if (not (be-encode-checked!)) 6
                  (if (not (be-macho-checked!)) 7
                    (if (= (write 1 (be-object-data) (be-object-len)) (be-object-len)) 0 8))))))))))
`;
} else if (mode === "--interpreter-test") {
  generated = generated.replace("(import \"coil.slice\" :use *)",
    `(import "coil.slice" :use *)
(import "eval" :use *)
(import "coil.assert" :use *)
(import "coil.io" :use *)
(import "coil.fmt" :use *)`);
  generated += `
(defn ts-result-field [(slot i64)] (-> i64)
  (let [obj (rt-payload (ev-result)) shape (ev-obj-shape obj)
        alias (shape-field-alias shape slot) ver (hv-find (ev-result-mem) obj alias)]
    (assert (>= ver 0)) (rt-payload (hve-val (hv-ent ver)))))
(defn ts-pow2 [(n i64)] (-> i64)
  (let [(mut value) 1 (mut i) 0]
    (loop (if (>= (load i) n) (break) (do (store! value (* (load value) 2)) (store! i (+ (load i) 1)) 0)))
    (load value)))
(defn ts-check [(depth i64)] (-> i64) (- (ts-pow2 (+ depth 1)) 1))
(defn ts-run-depth! [(depth i64) (optimize bool)] (-> i64)
  (let [arg (frontend-build! (+ 4400 depth) optimize)]
    (if (= (g-verify) 0) 0
      (do (fmt (stderr) "TypeScript graph verify={d} node={d}\\n" (g-verify-code) (g-verify-node))
          (g-print-flat (stderr)) 0))
    (assert (= (g-verify) 0)) (ev-reset!) (ev-bind! arg (RInt depth))
    (let [status (ev-run-nobind 100000000)]
      (if (= status EV-OK) 0
        (do (fmt (stderr) "TypeScript ideal depth={d} opt={d} status={d} at={d} steps={d}\\n"
                 depth (if optimize 1 0) status (ev-at) (ev-steps))
            (if (>= (ev-current-mem) 0)
                (do (fmt (stderr) "current heap version={d} mask={d}\\n"
                         (ev-current-mem) (hv-mask (ev-current-mem))) 0) 0)
            (g-print-flat (stderr)) 0))
      (assert (= status EV-OK)))
    (assert (= (ts-result-field 0) (+ depth 1)))
    (assert (= (ts-result-field 1) (ts-check (+ depth 1))))
    (let [(mut slot) 0]
      (loop (if (>= (load slot) 9) (break)
        (do (let [work-depth (+ 4 (* (load slot) 2)) base (+ 2 (* (load slot) 3))]
              (assert (= (ts-result-field base) work-depth))
              (if (<= work-depth depth)
                (let [iterations (ts-pow2 (+ (- depth work-depth) 4))]
                  (assert (= (ts-result-field (+ base 1)) iterations))
                  (assert (= (ts-result-field (+ base 2)) (* iterations (ts-check work-depth)))))
                (do (assert (= (ts-result-field (+ base 1)) 0)) (assert (= (ts-result-field (+ base 2)) 0)) 0)))
            (store! slot (+ (load slot) 1)) 0))))
    (assert (= (ts-result-field 29) depth)) (assert (= (ts-result-field 30) (ts-check depth))) 0))
(deftest typescript_binarytrees_lowers_to_coil_ideal
  (let [(mut depth) 4]
    (loop (if (> (load depth) ${maximumDepth}) (break)
      (do (ts-run-depth! (load depth) false) (ts-run-depth! (load depth) true)
          (store! depth (+ (load depth) 2)) 0)))))
`;
} else {
  generated = generated.replace("(import \"coil.slice\" :use *)",
    `(import "coil.slice" :use *)
(import "backend" :use *)
(import "coil.io" :use *)
(import "coil.fmt" :use *)`);
  generated += `
(extern write :cc c [i32 (ptr u8) i64] (-> i64))
(extern atoi :cc c [(ptr i8)] (-> i32))
(extern mach_absolute_time :cc c [] (-> u64))
(defstruct MachTimebase [(numer u32) (denom u32)])
(extern mach_timebase_info :cc c [(ptr MachTimebase)] (-> i32))
(defn main [(argc i32) (argv (ptr (ptr i8)))] (-> i64)
  (let [seed (if (> argc 1) (cast i64 (atoi (load (index argv 1)))) 0)
        registers (if (> argc 2) (cast i64 (atoi (load (index argv 2)))) 10)
        timebase (stack MachTimebase) t0 (cast i64 (mach_absolute_time))]
    (frontend-build-mode! (+ 5401 seed) true false)
    (let [t1 (cast i64 (mach_absolute_time))]
      (g-analyze!)
      (let [t2 (cast i64 (mach_absolute_time))]
        (if (!= (g-verify) 0) 2
          (if (not (mu-build-program!)) 3
            (if (not (ms-select-built-core!)) 4
              (let [t3 (cast i64 (mach_absolute_time))]
                (if (not (and (ms-place-selected!) (ms-lower-encodable!))) 5
                  (let [t4 (cast i64 (mach_absolute_time))]
                    (if (< (be-schedule-seeded! seed) 0) 6
                      (let [t5 (cast i64 (mach_absolute_time))]
                        (if (< (be-color-seeded! registers seed) 0) 7
                          (let [t6 (cast i64 (mach_absolute_time))]
                            (be-use-runtime-allocation! true)
                            (if (not (be-encode-checked!)) 8
                              (let [t7 (cast i64 (mach_absolute_time))]
                                (if (not (be-macho-checked!)) 9
                                  (let [t8 (cast i64 (mach_absolute_time))]
                                    (mach_timebase_info timebase)
                                    (fmt (stderr)
                                      "PHASE numer={d} denom={d} graph={d} optimization={d} selection={d} gcm={d} scheduling={d} allocation={d} encoding={d} object={d} code_size={d} object_size={d}\n"
                                      (cast i64 (load (field timebase numer)))
                                      (cast i64 (load (field timebase denom)))
                                      (- t1 t0) (- t2 t1) (- t3 t2) (- t4 t3)
                                      (- t5 t4) (- t6 t5) (- t7 t6) (- t8 t7)
                                      (be-code-len) (be-object-len))
                                    (if (= (write 1 (be-object-data) (be-object-len))
                                           (be-object-len)) 0 10)))))))))))))))))))
`;
}

fs.writeFileSync(output, generated);
