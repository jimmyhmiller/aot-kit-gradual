function main(n) {
  const byteLength = Object.getOwnPropertyDescriptor(
    ArrayBuffer.prototype,
    "byteLength"
  ).get;

  if (byteLength.call(new ArrayBuffer(n)) !== n) return 101;

  let rejectedOrdinary = false;
  try {
    const impostor = Object.create(ArrayBuffer.prototype);
    impostor.byteLength;
  } catch (error) {
    rejectedOrdinary = error instanceof TypeError;
  }
  if (!rejectedOrdinary) return 102;

  return n | 0;
}
