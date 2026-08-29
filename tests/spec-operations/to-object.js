function main(n) {
  const ordinary = { value: n };
  if (Object.assign(ordinary, { extra: 2 }) !== ordinary) return 101;
  if (ordinary.extra !== 2) return 102;

  const number = Object.assign(n, {});
  if (typeof number !== "object") return 103;
  if (Number(number) !== n) return 104;

  const boolean = Object.assign(true, {});
  if (typeof boolean !== "object") return 105;
  if (String(boolean) !== "true") return 106;

  const string = Object.assign("ab", {});
  if (typeof string !== "object") return 107;
  if (String(string) !== "ab") return 108;

  const symbolValue = Symbol("key");
  const symbol = Object.assign(symbolValue, {});
  if (typeof symbol !== "object") return 110;

  let nullThrew = false;
  try { Object.assign(null, {}); } catch (error) { nullThrew = error instanceof TypeError; }
  if (!nullThrew) return 112;

  let undefinedThrew = false;
  try { Object.assign(undefined, {}); } catch (error) { undefinedThrew = error instanceof TypeError; }
  if (!undefinedThrew) return 113;

  return n | 0;
}
