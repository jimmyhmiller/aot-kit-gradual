// The search predicates, lastIndexOf and the three trims — six of the twelve String.prototype
// methods that had definitions in lib/string/ and no way to be called.
//
// Every one was written, spec-annotated and verified against Node by the JSL gates while
// `fng-string-builtin?` listed nine method names and none of these were among them. A definition
// no program can name passes every gate it has; only this file's gate notices.
//
// EACH ROW USES A WEIGHT NOBODY ELSE OWNS so a wrong answer moves a digit of its own, and each row
// is chosen for the defect its method actually has rather than for looking like a test.
// `endsWith` is asked a needle LONGER than the receiver, which is the case that answered true
// before lib/string/ends-with.jsl grew its negative guard; `lastIndexOf` searches a string with two
// hits, so returning the first is a different number; `includes` is given a start past its only
// occurrence, which is the argument a definition that ignored it would get away with dropping.
export function main(): number {
  const s = "Hello World";
  let total = 0;

  total = total + (s.startsWith("Hello") ? 1 : 0);
  total = total + (s.startsWith("World") ? 2 : 0);
  total = total + (s.endsWith("World") ? 4 : 0);
  total = total + (s.endsWith("Hello World is long") ? 8 : 0);
  total = total + (s.includes("lo Wo") ? 16 : 0);
  total = total + (s.includes("zzz") ? 32 : 0);
  total = total + (s.includes("Hello", 3) ? 64 : 0);
  total = total + (s.startsWith("") ? 128 : 0);
  total = total + (s.startsWith("World", 6) ? 256 : 0);
  total = total + (s.endsWith("Hello", 5) ? 512 : 0);
  total = total + (s.endsWith("World", 5) ? 1024 : 0);
  total = total + (s.includes("World", -5) ? 2048 : 0);

  // "o" is at 4 and at 7. A miss is -1, offset by 2 here so it stays inside its own column.
  total = total + s.lastIndexOf("o") * 1000;
  total = total + s.lastIndexOf("o", 6) * 10000;
  total = total + s.lastIndexOf("o", undefined) * 100000;
  total = total + (s.lastIndexOf("zzz") + 2) * 1000000;
  // The empty needle is the row that made StringLastIndexOf terminate: it matches at every index
  // through the converted limit, and the definition's `from > limit` guard stops the loop.
  total = total + s.lastIndexOf("") * 10000000;

  // Each trim reads a length, so removing the wrong end is a different answer than removing both.
  total = total + "  ab  ".trim().length * 1000000000;
  total = total + "  ab  ".trimStart().length * 100000000000;
  total = total + "  ab  ".trimEnd().length * 10000000000000;

  return total;
}
