function main(n) {
  const object = Object();
  const prototype = Object();
  if (Object.setPrototypeOf(object, prototype) !== object) return 101;
  return (Object.getPrototypeOf(object) === prototype ? n : 102) | 0;
}
