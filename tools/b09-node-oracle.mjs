const captureByValue = process.env.AOT_B09_CAPTURE_BY_VALUE === "1";

function witness(limit) {
  let x = 1;
  const shared = { get: () => x, set: value => { x = value; } };
  const environment = () => captureByValue
    ? (() => { let copy = shared.get(); return { get: () => copy, set: value => { copy = value; } }; })()
    : shared;
  const addEnvironment = environment();
  const multiplyEnvironment = environment();
  const add = function (amount) {
    addEnvironment.set(addEnvironment.get() + amount);
    return addEnvironment.get();
  };
  const multiply = function (amount) {
    multiplyEnvironment.set(multiplyEnvironment.get() * amount);
    return multiplyEnvironment.get();
  };
  const retained = 7;
  const keep = function () { return retained; };
  const factorial = function self(n) {
    if (n <= 1) return 1;
    return n * self(n - 1);
  };
  const a = add(limit);
  const b = multiply(3);
  return a * 100000 + b * 100 + factorial(5) + keep() - 7;
}

for (const limit of [2, 5]) console.log(`closures-${limit}|${witness(limit)}`);
