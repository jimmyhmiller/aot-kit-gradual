// Node answers 7 for main(7). Reading Number.EPSILON publishes the correct value, but asking the
// ordinary Object.getOwnPropertyDescriptor path for that generated data property throws instead
// of returning its non-writable, non-enumerable, non-configurable descriptor.
function main(n) {
  const value = Number.EPSILON;
  const descriptor = Object.getOwnPropertyDescriptor(Number, 'EPSILON');
  if (descriptor.value !== value) return 101;
  if (descriptor.writable || descriptor.enumerable || descriptor.configurable) return 102;
  return n | 0;
}
