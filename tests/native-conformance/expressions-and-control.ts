export function main(): number {
  let calls = 0;
  let shortCircuit = (false && ++calls) || (++calls + 6);
  let comma = (calls++, 2);
  let total = shortCircuit + comma;
  outer: for (let i = 0; i < 6; i++) {
    if (i === 1) continue outer;
    switch (i) {
      case 3: total += 30; break;
      case 4: total += 40; break outer;
      default: total += i;
    }
  }
  let j = 0;
  do { j++; if (j === 1) continue; total += j; } while (j < 3);
  while (j < 5) total += ++j;
  total += total > 80 ? 5 : 9;
  return (total * 10 + calls) | 0;
}
