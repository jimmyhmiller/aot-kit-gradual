function main() {
  var x = new Array(8);
  var x0 = new Array(8);
  for (var i = 0; i < 8; i++) { x[i] = i; x0[i] = 10 * i; }
  var cur = 2;
  var lastX = x[cur];
  lastX = x[cur] = (x0[cur] + 100 * (lastX + x[++cur])) * 2;
  return (x[2] * 1000 + x[3] + cur) | 0;
}
