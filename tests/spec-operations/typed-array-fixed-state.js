function main(n) {
  const unsigned = new Uint8Array(4);
  const signed = new Int8Array(unsigned.buffer);

  if (signed.length !== 4) return 101;
  if (signed.byteLength !== 4) return 102;
  if (signed.byteOffset !== 0) return 103;
  if (signed[0] !== 0) return 104;

  if (unsigned.length !== 4) return 105;
  if (unsigned.byteLength !== 4) return 106;
  if (unsigned.byteOffset !== 0) return 107;
  if (unsigned[0] !== 0) return 108;
  if (signed.buffer !== unsigned.buffer) return 109;

  return n | 0;
}
