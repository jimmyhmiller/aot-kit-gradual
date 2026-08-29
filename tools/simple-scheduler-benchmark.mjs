import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const simple = path.join(root, "reference", "Simple-pinned");
const chapter = path.join(simple, "chapter23");
const git = path.join(simple, ".git");
if (!fs.existsSync(git)) {
  throw new Error("reference/Simple-pinned is not a real git checkout; clone the pinned reference first");
}

const revision = execFileSync("git", ["-C", simple, "rev-parse", "HEAD"], {encoding: "utf8"}).trim();
execFileSync("mvn", ["-q", "-f", path.join(chapter, "pom.xml"), "test-compile"], {stdio: "inherit"});
const classpath = [path.join(chapter, "target", "classes"), path.join(chapter, "target", "test-classes")]
  .join(path.delimiter);
const sizes = process.argv.slice(2).map(Number);
if (sizes.length === 0) sizes.push(250, 500, 1000, 2000, 4000);
if (sizes.some(size => !Number.isSafeInteger(size) || size <= 0)) throw new Error("sizes must be positive integers");

function sourceFor(width) {
  const declarations = [];
  const values = [];
  for (let index = 0; index < width; index++) {
    const name = `v${index}`;
    declarations.push(`int ${name} = arg * ${index + 3};`);
    values.push(name);
  }
  return `${declarations.join("\n")}\nreturn ${values.join(" + ")};\n`;
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aotk-simple-scheduler-"));
try {
  const benchmarkClasses = path.join(temporary, "classes");
  fs.mkdirSync(benchmarkClasses);
  execFileSync("javac", ["-cp", classpath, "-d", benchmarkClasses,
    path.join(root, "tools", "simple-reference", "SchedulerBench.java")], {stdio: "inherit"});
  const benchmarkClasspath = [benchmarkClasses, classpath].join(path.delimiter);
  const rows = [];
  for (const width of sizes) {
    const input = path.join(temporary, `wide-${width}.smp`);
    fs.writeFileSync(input, sourceFor(width));
    const started = process.hrtime.bigint();
    const output = execFileSync("java", ["-ea", "-cp", benchmarkClasspath,
      "SchedulerBench", input, String(width)],
      {cwd: chapter, encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
    const wallMs = Number(process.hrtime.bigint() - started) / 1e6;
    rows.push({...JSON.parse(output), wallMs: Number(wallMs.toFixed(3))});
  }
  process.stdout.write(`${JSON.stringify({revision, shape: "one wide block of independent multiplies feeding one reduction", rows}, null, 2)}\n`);
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
