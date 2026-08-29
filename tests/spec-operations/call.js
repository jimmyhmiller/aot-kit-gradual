function main(n) {
  function count(a, b) {
    return (arguments.length * 100 + a * 10 + b) | 0;
  }
  if (count(2, 3) !== 223) return 101;

  function strictAdd(a, b) { "use strict"; return (this + a + b) | 0; }
  if (strictAdd.call(7, 1, 2) !== 10) return 102;

  function sloppyReceiverKind() { return typeof this; }
  if (sloppyReceiverKind.call(7) !== "object") return 103;

  var receiver = { integer: 41, floating: 1.5 };
  function readInteger() { return receiver.integer; }
  function readFloating() { return receiver.floating; }
  if (readInteger.call(undefined) !== 41) return 104;
  if (readFloating.call(undefined) !== 1.5) return 105;

  var mapped = [3, 4].map(function () { return 9; });
  if (mapped[0] !== 9 || mapped[1] !== 9) return 106;

  return n | 0;
}
