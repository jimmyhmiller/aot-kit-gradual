export function main(): number {
  let object: any = { alpha: 40 };
  let key = "alpha";
  let read = object[key];
  object[key] = read + 2;
  let present = key in object;
  let staticAfterDynamicStore = object.alpha;
  let removed = delete object[key];
  let absent = !(key in object);

  let unicode = "λ";
  object[unicode] = 5;
  let unicodeStaticRead = object.λ;

  let array = [3];
  let zero: any = 0;
  let arrayRead = array[zero];
  array[zero] = 7;
  let arrayPresent = zero in array;
  let arrayRemoved = delete array[zero];
  let arrayAbsent = !(zero in array);

  let beta = "beta";
  let made = {["alpha"]: 2, [beta]: 3};
  let computedNamesWork = made.alpha * 10 + made.beta === 23;

  return ((computedNamesWork ? 100000000 : 0) +
          staticAfterDynamicStore * 1000000 +
          unicodeStaticRead * 100000 +
          arrayRead * 10000 +
          (present ? 1000 : 0) +
          (removed ? 100 : 0) +
          (absent ? 10 : 0) +
          (arrayPresent && arrayRemoved && arrayAbsent ? 1 : 0)) | 0;
}
