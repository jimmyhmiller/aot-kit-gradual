export function main(): number {
  let target: any = { keep: 1, overwrite: 2 };
  let source: any = { overwrite: 7, added: 3 };
  let result: any = Object.assign(target, null, source, undefined, "xy");

  // @ts-ignore — intentionally exercise ToObject on a primitive target.
  let boxed: any = Object.assign(7, { marker: 9 });
  let order = 0;
  Object.assign(target,
                (order = order * 10 + 1, { first: 4 }),
                (order = order * 10 + 2, { second: 5 }));
  let checks = (result === target ? 100 : 0)
             + result.keep
             + result.overwrite
             + result.added
             + (result["0"] === "x" ? 20 : 0)
             + (result["1"] === "y" ? 40 : 0)
             + boxed.marker
             + (order === 12 ? 10 : 0)
             + result.first + result.second;
  return checks | 0;
}
