function main(n) {
  let reads = 0;
  const arrayLike = {
    0: "skip",
    1: n,
    get length() {
      reads = (reads + 1) | 0;
      return "2.9";
    }
  };

  const found = Array.prototype.indexOf.call(arrayLike, n);
  if (found !== 1 || reads !== 1) return 101;

  let touched = false;
  const negative = {
    get length() { return -3; },
    get 0() { touched = true; return n; }
  };
  if (Array.prototype.indexOf.call(negative, n) !== -1 || touched) return 102;

  return n | 0;
}
