function main(n) {
  try {
    [1].reduce((previous, current) => { throw 9; }, 0);
    return 0;
  } catch (error) {
    return error | 0;
  }
}
