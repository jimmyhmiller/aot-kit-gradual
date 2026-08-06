let receiverEvaluations = 0;
const object = {
  value: 40,
  add(amount) { "use strict"; return this.value + amount; },
};
function receiver() {
  receiverEvaluations++;
  return object;
}

let selectedReceiver = receiver();
if (process.env.AOT_B10_DUPLICATE_RECEIVER) selectedReceiver = receiver();
let method = -1;
try {
  method = process.env.AOT_B10_OMIT_RECEIVER
    ? selectedReceiver.add.call(undefined, 2)
    : selectedReceiver.add(2);
} catch (error) {
  method = error instanceof TypeError ? -2 : -3;
}
const detached = object.add;
let detachedThrew = false;
try {
  detached(2);
} catch (error) {
  detachedThrew = error instanceof TypeError;
}

function PrimitiveReturn(value) {
  this.value = value;
  return 99;
}
function ObjectReturn(value) {
  this.value = -1;
  return { value };
}

console.log(`receiver|${method}|${receiverEvaluations}`);
console.log(`detached|${detachedThrew ? 1 : 0}`);
console.log(`constructor-primitive|${new PrimitiveReturn(7).value}`);
console.log(`constructor-object|${new ObjectReturn(11).value}`);
