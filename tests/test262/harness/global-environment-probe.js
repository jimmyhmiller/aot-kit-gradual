assert.throws(ReferenceError, function () {
  laterObject;
});

function readLaterLexical() {
  return laterLexical;
}
