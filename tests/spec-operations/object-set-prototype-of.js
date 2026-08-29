function main(n) {
  const prototype = { value: n };
  const object = Object();
  if (Object.setPrototypeOf(object, prototype) !== object) return 101;
  return (object.value === n ? n : 102) | 0;
}
