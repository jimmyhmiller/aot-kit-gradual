function F() {
  var width = 4, height = 4, rowSize = 6;
  this.grad = function(u, v, p) {
    var wScale = 0.5 * width;
    var hScale = 0.5 * height;
    for (var j = 1; j <= height; j++) {
      var prevPos = j * rowSize - 1;
      var currentPos = j * rowSize;
      var nextPos = j * rowSize + 1;
      var prevRow = (j - 1) * rowSize;
      var currentRow = j * rowSize;
      var nextRow = (j + 1) * rowSize;
      for (var i = 1; i <= width; i++) {
        u[++currentPos] -= wScale * (p[++nextPos] - p[++prevPos]);
        v[currentPos] -= hScale * (p[++nextRow] - p[++prevRow]);
      }
    }
  };
}
function main() {
  var f = new F();
  var u = new Array(36), v = new Array(36), p = new Array(36);
  for (var i = 0; i < 36; i++) { u[i] = 1; v[i] = 2; p[i] = ((i * 7) % 5) - 2; }
  f.grad(u, v, p);
  var sum = 0;
  for (var i = 0; i < 36; i += 2) sum = sum + (u[i] + v[i] * 3) * 100;
  return sum | 0;
}
