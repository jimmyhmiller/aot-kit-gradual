function Box(value) { this.value = value; }
function bump(amount) { return this.value + amount; }
Box.prototype.bump = bump;

export function main(): number {
  let first = new Box(40);
  let second = new Box(10);
  second.value = 12;
  second.extra = 5;
  let missing = second.absent;
  return (first.bump(2) * 1000 + second.bump(3) * 10 + second.extra + (missing === undefined ? 1 : 0)) | 0;
}
