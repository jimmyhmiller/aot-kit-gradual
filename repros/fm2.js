function Field(dens, u, v) {
  this.setDensity = function(x, d) { dens[x + 1] = d; };
  this.getDensity = function(x) { return dens[x + 1]; };
}
var last = null;
var uiCallback = function(d, u, v) {};
function setCb(cb) { uiCallback = cb; }
function addP(f) {
  for (var i = 1; i <= 20; i++) f.setDensity(i, 5);
}
function query(d, u, v) {
  for (var i = 0; i < 10; i++) u[i] = v[i] = d[i] = 0.0;
  uiCallback(new Field(d, u, v));
}
function main() {
  var d = new Array(10), u = new Array(10), v = new Array(10);
  setCb(function(f) { addP(f); last = f; });
  query(d, u, v);
  var sum = 0;
  for (var x = 0; x < 8; x += 2) sum = sum + last.getDensity(x);
  return sum | 0;
}
