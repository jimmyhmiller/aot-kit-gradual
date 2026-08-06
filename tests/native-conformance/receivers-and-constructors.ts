interface Box { value: number; }
function Primitive(this: Box, value: number): number { this.value = value; return 99; }
function ObjectResult(this: Box, value: number): Box { this.value = -1; return {value: value}; }
function add(this: Box, amount: number): number { return this.value + amount; }

export function main(): number {
  let count = 0;
  let box: Box = new Primitive(7);
  let replacement: Box = new ObjectResult(11);
  box.add = add;
  let get = function(): Box { count++; return box; };
  return (get().add(2) * 1000 + replacement.value * 10 + count) | 0;
}
