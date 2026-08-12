function readX(p) { return p.x; }
function main() {
  var p = { x: 2, y: 3 };
  return readX(p) * 1000 + readX({ x: 4, y: 9 });
}
