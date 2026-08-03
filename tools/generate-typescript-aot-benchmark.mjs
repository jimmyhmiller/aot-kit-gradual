#!/usr/bin/env node
import fs from "node:fs";
import { normalizeTypeScript } from "../src/frontend_ir.mjs";
import { generateCoilBuilder } from "../src/frontend_coil_codegen.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: generate-typescript-aot-benchmark.mjs INPUT.ts OUTPUT.coil");
  process.exit(2);
}

const program = normalizeTypeScript(fs.readFileSync(input, "utf8"), input);
let generated = generateCoilBuilder(program, { moduleName: "generatedtypescriptbenchmark" });
generated = generated.replace("(import \"coil.slice\" :use *)", `(import "coil.slice" :use *)
(import "backend" :use *)
(import "coil.io" :use *)
(import "coil.fmt" :use *)`);
generated += `
(extern write :cc c [i32 (ptr u8) i64] (-> i64))
(defn main [] (-> i64)
  (frontend-build! 7301 true)
  (if (!= (g-verify) 0) 2
    (if (not (be-select-machine-program!)) 3
      (do (be-use-runtime-allocation! true)
          (if (< (be-schedule-seeded! 0) 0) 4
            (if (< (be-color-seeded! 10 0) 0) 5
              (if (not (be-encode-checked!)) 6
                (if (not (be-macho-checked!)) 7
                  (if (= (write 1 (be-object-data) (be-object-len)) (be-object-len)) 0 8)))))))))
`;
fs.writeFileSync(output, generated);
