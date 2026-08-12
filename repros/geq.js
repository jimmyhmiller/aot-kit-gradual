var counter = 2;
function step() {
  if (counter == 0) { counter = 2; return 1; }
  counter = counter - 1;
  return 0;
}
function main() {
  var hits = 0;
  for (var i = 0; i < 9; i++) hits = hits + step();
  return hits | 0;
}
