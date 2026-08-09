// The pieces String.prototype.split produces, as opposed to how many of them there are.
//
// THIS FILE EXISTS BECAUSE THE COUNTS DO NOT CATCH ENOUGH. Two injected defects survived
// string-split.ts on their own: dropping `unit` from the end of the piece leaves
// `"abc".split("")` with three elements that are all the EMPTY string, and hard-coding the loop's
// step to 1 is invisible while every separator in the file is one character long. One row here
// reads a code unit out of an empty-separator split and another uses a two-character separator,
// and each of those defects moves a digit.
//
// The pieces are read through `String(...)`: an element of an array is a boxed string and
// `.length` on one answers 0, at f0e6f5a as much as here.
export function main(): number {
  let total = 0;

  const parts = "ab,cd,ef".split(",");
  total = total + String(parts[0]).charCodeAt(0);           // 'a' = 97
  total = total + String(parts[1]).charCodeAt(1) * 1000;    // 'd' = 100
  total = total + String(parts[2]).length * 1000000;        // 2

  // An empty separator must yield the CHARACTERS, not three empty strings.
  const units = "abc".split("");
  total = total + String(units[1]).charCodeAt(0) * 10000000;   // 'b' = 98

  // A two-character separator, so the loop's step has to be the separator's length.
  const wide = "a::b::c".split("::");
  total = total + String(wide[1]).charCodeAt(0) * 10;          // 'b' = 98
  total = total + String(wide[2]).length * 100;                // 1

  // A leading separator produces an empty first piece rather than being skipped.
  const lead = ",a".split(",");
  total = total + String(lead[0]).length * 100000;             // 0
  total = total + String(lead[1]).charCodeAt(0) * 10000;       // 'a' = 97

  return total | 0;
}
