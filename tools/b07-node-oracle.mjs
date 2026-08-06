#!/usr/bin/env node

const eager = process.env.AOT_B07_EAGER_BRANCHES === "1";
const duplicateReceiver = process.env.AOT_B07_DUPLICATE_RECEIVER === "1";

function branch(flag) {
  let x = 1;
  const selected = flag ? x++ : ++x;
  const andValue = eager ? ((x += 10), flag && x) : flag && (x += 10);
  const orValue = eager ? ((x += 100), flag || x) : flag || (x += 100);
  return selected + x + andValue + orValue;
}

function property() {
  const box = { value: 3, count: 0 };
  let receivers = 0;
  const touch = () => { receivers += 1; box.count += 1; return box; };
  const target = touch();
  const old = target.value++;
  if (duplicateReceiver) touch();
  return { answer: old * 100 + box.value * 10 + box.count, receivers };
}

function element(flag) {
  const values = [7], state = { receivers: 0, calls: 0, andCalls: 0, orCalls: 0, commas: 0 };
  const receiver = () => { state.receivers += 1; return values; };
  const rhs = () => { state.calls += 1; return 5; };
  let i = 0;
  const target = receiver();
  const key = i++;
  target[key] += rhs();
  if (duplicateReceiver) receiver();
  const selected = flag ? i++ : ++i;
  const andValue = flag && (state.andCalls += 1);
  const orValue = flag || (state.orCalls += 1);
  const answer = (state.commas += 1,
    target[key] * 100000 + i * 10000 + selected * 1000 +
    state.receivers * 100 + state.calls * 10 + state.andCalls + state.orCalls);
  return { answer, value: values[0], ...state };
}

console.log(`branch-false|${branch(0)}`);
console.log(`branch-true|${branch(1)}`);
const p = property();
console.log(`property|${p.answer}|receivers=${p.receivers}`);
for (const flag of [0, 1]) {
  const row = element(flag);
  console.log(`element-${flag}|${row.answer}|value=${row.value}|receivers=${row.receivers}|calls=${row.calls}|and=${row.andCalls}|or=${row.orCalls}|commas=${row.commas}`);
}
