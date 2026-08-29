function main(n) {
  if (new ArrayBuffer().byteLength !== 0) return 101;
  if (new ArrayBuffer(undefined).byteLength !== 0) return 102;
  if (new ArrayBuffer(3.9).byteLength !== 3) return 103;
  if (new ArrayBuffer("4.8").byteLength !== 4) return 104;

  let calls = 0;
  const length = {
    valueOf: function () {
      calls = (calls + 1) | 0;
      return 5.9;
    }
  };
  if (new ArrayBuffer(length).byteLength !== 5 || calls !== 1) return 105;

  function rejects(value) {
    let rejected = false;
    try {
      new ArrayBuffer(value);
    } catch (error) {
      rejected = error instanceof RangeError;
    }
    return rejected;
  }
  if (!rejects(-1)) return 106;
  if (!rejects(-Infinity)) return 107;
  if (!rejects(Infinity)) return 108;
  if (!rejects(9007199254740992)) return 109;

  return n | 0;
}
