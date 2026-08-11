// The composition that broke NavierStokes, distilled: a constructor whose captured locals hold
// arrays, a nested constructor whose PARAMETERS are captured by instance methods, a callback
// dispatched as a value, and a dispatched call's result flowing into integer conversion. Four
// distinct compiler bugs hid in this shape (captured-parameter cells, tagged owners at the
// array side table, dynamically dispatched results fed raw to `| 0`, and the closure env ABI).
export function main(): number {
  function Outer(this: any) {
    let arr: any;
    let scale = 2;
    function Field(this: any, a: any) {
      this.set = function(i: number, v: number) { a[i] = v * scale; };
      this.get = function(i: number) { return a[i]; };
    }
    function use(cb: any) { cb(new Field(arr)); }
    let total = 0;
    this.go = function() {
      arr = new Array(10);
      for (let i = 0; i < 10; i++) arr[i] = 0;
      use(function(f: any) { f.set(3, 7); total = total + f.get(3); });
      return total + arr[3];
    };
  }
  const o: any = new Outer();
  return o.go() | 0;
}
