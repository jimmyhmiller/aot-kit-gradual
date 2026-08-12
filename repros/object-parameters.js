function readX(p) { return p.x; }
function sum(p) { return p.x + p.y; }
function nested(w) { return w.inner.x * w.scale; }
function make(x, y) { return { x: x, y: y }; }
function main() {
    let total = 0;
    // The literal written AT the call site — the shape both defects hid behind.
    total = total + readX({ x: 4, y: 9 });
    total = total + sum({ x: 4, y: 9 }) * 10;
    // Through a typed local, which is the path that already worked.
    let p = { x: 2, y: 3 };
    total = total + readX(p) * 1000;
    total = total + sum(p) * 10000;
    // Through a function's return value, so the object is neither a literal at the call site nor a
    // local's initialiser.
    total = total + sum(make(1, 6)) * 1000000;
    // A literal holding another literal, so the nested one is contextually typed too.
    total = total + nested({ inner: { x: 3, y: 0 }, scale: 5 }) * 100000000;
    return total | 0;
}
