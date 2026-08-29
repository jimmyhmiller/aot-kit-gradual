function main(n) {
  const empty = new ArrayBuffer();
  if (empty.byteLength !== 0) return 101;
  if (empty.maxByteLength !== 0) return 102;
  if (empty.resizable !== false) return 103;
  if (empty.detached !== false) return 104;

  const buffer = new ArrayBuffer(n);
  if (buffer.byteLength !== n) return 105;
  if (buffer.maxByteLength !== n) return 106;
  if (buffer.resizable !== false) return 107;
  if (buffer.detached !== false) return 108;
  return n | 0;
}
