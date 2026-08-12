function readX(p) { return p.x; }
function sum(p) { return p.x + p.y; }
function make(x, y) { return { x: x, y: y }; }
function main() {
  var total = 0;
  var p = { x: 2, y: 3 };
  total = total + readX({ x: 4, y: 9 });
  total = total + sum({ x: 4, y: 9 }) * 10;
  total = total + readX(p) * 1000;
  total = total + sum(p) * 10000;
  return total | 0;
}
