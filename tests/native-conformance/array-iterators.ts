export function main(): number {
  let array = [10, 20];

  let keys = array.keys();
  let key0 = keys.next();
  let key1 = keys.next();
  let keyDone = keys.next();

  let values = array.values();
  let value0 = values.next();
  array.push(30);
  let value1 = values.next();
  let value2 = values.next();
  let valueDone = values.next();
  array.push(40);
  let stillDone = values.next();

  let entries = array.entries();
  let entry0 = entries.next();
  let pair: any = entry0.value;

  return ((key0.value === 0 && key0.done === false ? 100 : 0)
          + (key1.value === 1 && key1.done === false ? 20 : 0)
          + (keyDone.done === true ? 4 : 0)
          + (value0.value === 10 ? 8 : 0)
          + (value1.value === 20 ? 16 : 0)
          + (value2.value === 30 ? 32 : 0)
          + (valueDone.done === true && stillDone.done === true ? 64 : 0)
          + (pair[0] === 0 && pair[1] === 10 ? 2 : 0)) | 0;
}
