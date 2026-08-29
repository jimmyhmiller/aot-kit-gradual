function main(n) {
  const own = { present: undefined };
  if (!("present" in own)) return 101;
  if ("missing" in own) return 102;

  const prototype = { inherited: 9 };
  const object = Object.create(prototype);
  if (!("inherited" in object)) return 103;
  if (object.hasOwnProperty("inherited")) return 104;

  const array = [n, , 3];
  const zero = 0;
  if (!(zero in array)) return 105;
  if (1 in array) return 106;
  if (!("length" in array)) return 107;

  return n | 0;
}
