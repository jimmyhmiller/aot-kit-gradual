function F() {
  var height = 16;
  this.setH = function(h) { height = h; };
  this.t = function() {
    var c = 0;
    for (var i = 17; i <= height; i++) c = c + 1;
    return c;
  };
}
function main() {
  var f = new F();
  f.setH(16);
  return f.t() | 0;
}
