function Field(dens, u, v) {
  this.set = function(i, a, b) { u[i] = a; v[i] = b; };
  this.get = function(i) { return u[i] * 10 + v[i]; };
}
var last = null;
function query(cb) {
  var d = new Array(3), uu = new Array(3), vv = new Array(3);
  for (var i = 0; i < 3; i++) { d[i] = 0; uu[i] = 0; vv[i] = 0; }
  cb(new Field(d, uu, vv));
}
function main() {
  query(function(f) { last = f; });
  last.set(1, 7, 9);
  return last.get(1) | 0;
}
