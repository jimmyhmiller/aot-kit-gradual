function main(n) {
  const object = { value: 0 };
  object.value = n;
  return object.value | 0;
}
