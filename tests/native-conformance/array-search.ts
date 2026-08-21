// Array.prototype.indexOf, includes and lastIndexOf, computed by lib/array/read.jsl.
//
// These are the first HEAP-TOUCHING definitions the frontend emits. They are macros, expanded into
// the caller's graph, so they read the caller's memory — a called builtin would synthesise its own
// empty entry heap and answer -1 for an element that is there.
//
// The array is built here and searched here, and the elements are written before the search, which
// is exactly the case a broken memory seam gets wrong.
export function main(): number {
  let xs: number[] = [];
  xs.push(10);
  xs.push(20);
  xs.push(30);
  xs.push(20);
  const numericText: any = "2";
  const words = ["first", "second", "first"];
  return (xs.indexOf(20) + xs.indexOf(99) + xs.indexOf(10) + xs.indexOf(30)
    + xs.indexOf(20, 2) + xs.indexOf(10, 1)
    + xs.indexOf(20, numericText) + xs.indexOf(20, -2)
    + xs.lastIndexOf(20) + xs.lastIndexOf(10) + xs.lastIndexOf(99)
    + xs.lastIndexOf(20, 0) + xs.lastIndexOf(20, -2)
    + (xs.includes(30) ? 1000 : 0) + (xs.includes(99) ? 2000 : 0)
    + (xs.includes(10) ? 4000 : 0)
    + (xs.includes(10, 1) ? 8000 : 0) + (xs.includes(20, -1) ? 16000 : 0)
    + words.indexOf("first") * 32000 + words.lastIndexOf("first") * 64000
    + (words.includes("second") ? 256000 : 0)) | 0;
}
