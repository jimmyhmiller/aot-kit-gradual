function f0(x: number): number { return x + 0; }
function f1(x: number): number { return x + 1; }
function f2(x: number): number { return x + 2; }
function f3(x: number): number { return x + 3; }
function f4(x: number): number { return x + 4; }
function f5(x: number): number { return x + 5; }
function f6(x: number): number { return x + 6; }
function f7(x: number): number { return x + 7; }
function f8(x: number): number { return x + 8; }
function f9(x: number): number { return x + 9; }
function f10(x: number): number { return x + 10; }
function f11(x: number): number { return x + 11; }

export function main(): number {
  return f11(JSON.parse("1")) | 0;
}
