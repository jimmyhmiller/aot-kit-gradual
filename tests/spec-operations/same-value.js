function main(n) {
  var object = {};
  if (!Object.is(NaN, NaN)) return 101;
  if (Object.is(0, -0)) return 102;
  if (!Object.is(n, 7)) return 103;
  if (!Object.is("x", "x")) return 104;
  var dynamic = { string: "x", number: n, object: object };
  if (!Object.is(dynamic.string, "x")) return 115;
  if (Object.is(dynamic.string, n)) return 116;
  if (!Object.is(dynamic.number, n)) return 117;
  if (!Object.is(dynamic.object, object)) return 118;
  if (!Object.is(object, object)) return 105;
  if (Object.is(object, {})) return 106;
  if (!Object.is(true, true)) return 107;
  if (Object.is(true, false)) return 108;
  if (!Object.is(null, null)) return 109;
  if (!Object.is(undefined, undefined)) return 110;
  if (Object.is(null, undefined)) return 111;
  var array = [];
  if (!Object.is(array, array)) return 112;
  if (Object.is(array, [])) return 113;
  function identity() { return 1; }
  if (!Object.is(identity, identity)) return 114;
  return n | 0;
}
