export function main(): number {
  const value = JSON.parse(
    " { \"answer\" : 42, \"items\" : [true, null, -1.25e2], \"text\" : \"A\\n\\u00e9\" } ",
  );
  let result = 0;
  if (value.answer === 42) result += 1;
  if (value.items[0] === true) result += 2;
  if (value.items[1] === null) result += 4;
  if (value.items[2] === -125) result += 8;
  if (value.text === "A\né") result += 16;
  if (JSON.parse("[[],{\"x\":1}]")[1].x === 1) result += 32;
  return result;
}
