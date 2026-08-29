function main(n) {
  const buffer = new ArrayBuffer(n + 5);
  const view = new DataView(buffer, 2, n);
  if (view.buffer !== buffer) return 101;
  if (view.byteOffset !== 2) return 102;
  if (view.byteLength !== n) return 103;
  if (!ArrayBuffer.isView(view)) return 104;
  view.setUint16(0, 0x1234);
  if (view.getUint8(0) !== 0x12 || view.getUint8(1) !== 0x34) return 106;
  if (view.getUint16(0) !== 0x1234 || view.getUint16(0, true) !== 0x3412) return 107;
  view.setInt8(2, -1);
  if (view.getInt8(2) !== -1 || view.getUint8(2) !== 255) return 108;
  view.setInt32(3, -2, true);
  if (view.getInt32(3, true) !== -2) return 109;
  if (view.getUint32(3, true) !== 4294967294) return 110;
  try {
    new DataView(buffer, n + 6);
  } catch (error) {
    if (error instanceof RangeError) return n | 0;
  }
  return 105;
}
