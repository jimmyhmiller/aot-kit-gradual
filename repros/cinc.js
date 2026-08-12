function main() {
  var u = new Array(6);
  for (var i = 0; i < 6; i++) u[i] = 100;
  var p = 0;
  for (var i = 1; i <= 2; i++) {
    u[++p] -= 7;
  }
  return (u[0] + u[1] * 10 + u[2] * 100 + p * 10000) | 0;
}
