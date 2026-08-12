function main() {
  var x = new Array(5);
  var s = new Array(5);
  for (var i = 0; i < 5; i++) { x[i] = i; s[i] = 100; }
  var dt = 0.5;
  for (var i = 0; i < 5; i++) x[i] += dt * s[i];
  var sum = 0;
  for (var i = 0; i < 5; i++) sum = sum + x[i];
  return sum | 0;
}
