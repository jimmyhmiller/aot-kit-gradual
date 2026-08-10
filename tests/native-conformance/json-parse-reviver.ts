function revive(this: any, key: string, value: any): any {
  if (key === "n") return this.n === 2 ? 6 : 60;
  if (key === "a") {
    this.late = 7;
    return value.n === 6 ? value : null;
  }
  if (key === "drop") return undefined;
  if (key === "0" && Array.isArray(this)) return undefined;
  if (key === "late") return 999;
  if (key === "") {
    return {data: value, rootThis: this[""] === value};
  }
  return value;
}

export function main(): number {
  const value = JSON.parse('{"a":{"n":2},"drop":1,"arr":[1,2]}', revive);
  const data = value.data;
  let result = 0;
  if (data.a.n === 6) result |= 1;
  if (!("drop" in data)) result |= 2;
  if (data.arr.length === 2 && Object.keys(data.arr).length === 1 &&
      data.arr[0] === undefined && data.arr[1] === 2) result |= 4;
  if (value.rootThis === true) result |= 8;
  if (data.late === 7) result |= 16;
  if (value.data === data) result |= 32;
  return result | 0;
}
