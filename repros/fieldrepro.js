function main() {
  function Outer() {
    var arr;
    var scale = 2;
    function Field(a) {
      this.set = function(i, v) { a[i] = v * scale; };
      this.get = function(i) { return a[i]; };
    }
    function use(cb) { cb(new Field(arr)); }
    var total = 0;
    this.go = function() {
      arr = new Array(10);
      for (var i = 0; i < 10; i++) arr[i] = 0;
      use(function(f) { f.set(3, 7); total = total + f.get(3); });
      return total + arr[3];
    };
  }
  var o = new Outer();
  return o.go() | 0;
}
