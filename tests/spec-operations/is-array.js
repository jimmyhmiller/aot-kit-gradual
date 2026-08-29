function main(n) {
  if (Array.isArray(undefined)) return 101;
  if (Array.isArray(null)) return 102;
  if (Array.isArray(true)) return 103;
  if (Array.isArray(n)) return 104;
  if (Array.isArray("array")) return 105;
  if (Array.isArray({ 0: n, length: 1 })) return 106;
  if (!Array.isArray([])) return 107;
  if (!Array.isArray([n])) return 108;
  if (!Array.isArray(Array.prototype)) return 109;
  if (Array.isArray(Object.create([]))) return 110;
  return n | 0;
}
