function F() {
  var width = 2;
  this.f = function(b, x) {
    if (b === 1) {
      for (var i = 1; i <= width; i++) x[i] = x[i] + 1;
      for (var j = 1; i <= width; i++) x[j] = x[j] + 100;
    } else if (b === 2) {
      for (var i = 1; i <= width; i++) x[i] = x[i] + 10;
      for (var j = 1; j <= width; j++) x[j] = x[j] + 1000;
    } else {
      for (var i = 1; i <= width; i++) x[i] = x[i] + 100000;
    }
  };
}
function main() {
  var f = new F();
  var x = new Array(4);
  for (var k = 0; k < 4; k++) x[k] = 0;
  f.f(1, x); f.f(2, x); f.f(0, x);
  return (x[1] + x[2]) | 0;
}
