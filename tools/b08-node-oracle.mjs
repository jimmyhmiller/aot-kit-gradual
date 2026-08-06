const redirect = process.env.AOT_B08_REDIRECT_INNER_EXIT === "1";

function targeted(limit) {
  let i = 0, out = 0;
  outer: do {
    i++;
    switch (i) {
      default: out = out * 10 + 8;
      case 3:
        out = out * 10 + 3;
        if (redirect) break outer;
        break;
      case 1: out = out * 10 + 1; continue outer;
      case 2: out = out * 10 + 2;
    }
    out = out * 10 + 9;
    if (i >= limit) break outer;
  } while (i < 5);
  return out * 10 + i;
}

function loops(limit) {
  let out = 0;
  outer: for (let j = 0; j < limit; j++) {
    if (j === 1) continue outer;
    out = out * 10 + j;
    if (j === 3) break outer;
  }
  let i = 0;
  while (i < 2) { i++; if (i === 1) continue; out = out * 10 + i; }
  return out;
}

function memory() {
  const box = { value: 0, count: 0 };
  outer: do {
    box.value += 1;
    if (box.value === 1) { box.count += 10; continue outer; }
    box.count += box.value;
    if (box.value >= 3) break outer;
  } while (box.value < 5);
  return box.value * 100 + box.count;
}

console.log(`switch-2|${targeted(2)}`);
console.log(`switch-3|${targeted(3)}`);
console.log(`loops-6|${loops(6)}`);
console.log(`memory|${memory()}`);
