var c = 3;
function dec() { c = c - 1; return 0; }
function main() {
  for (var i = 0; i < 2; i++) dec();
  return c | 0;
}
