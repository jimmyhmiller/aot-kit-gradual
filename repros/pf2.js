var hits = 0;
function cb() { hits = hits + 1; }
function Holder() {
  var f = function() {};
  this.setCallback = function(x) { f = x; };
  this.run = function() { f(); };
}
function main() {
  var h = new Holder();
  h.setCallback(cb);
  for (var i = 0; i < 3; i++) h.run();
  return hits | 0;
}
