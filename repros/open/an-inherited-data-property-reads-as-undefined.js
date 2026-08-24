// OPEN. `Box.prototype.tag = 1` followed by `new Box().tag` reads `undefined`. So does reading the
// property straight back off the prototype -- `Box.prototype.tag === 1` is false. An inherited
// METHOD works: `Box.prototype.bump = f; new Box().bump(2)` calls it, and
// tests/native-execution-test.coil pins that. It is DATA on a prototype that is lost.
//
// THE RUNTIME WALK IS NOT WHAT IS MISSING. `OrdinaryGet` in lib/object/ordinary.jsl walks
// [[Prototype]] to null over the property table and the exotic elements, and the same test file
// pins that it terminates correctly on a key that is nowhere. The property never arrives in
// anything the walk can see: at top level `X.prototype.m = ...` is handled by the frontend's own
// prototype bookkeeping (`fng-prototype-parent`, the `prototypes` table in FngContext), which
// models a METHOD being attached to a known constructor and has no case for a data property.
//
// This predates the DSL walk -- verified by running this program against the commit before
// docs/OBJECT-MODEL.md strike O3, which answers identically. What the walk changed is that there
// is now a test that says so.
//
// The same bookkeeping is why `Derived.prototype = new Base()` reads every inherited property as
// undefined, which is the two-level chain and the shape `class B extends A` desugars to. One fix.
//
// node says 132 for main(7).
function Box() { }
Box.prototype.tag = 1;
Box.prototype.deep = 2;
function main(n) {
  let d = new Box();
  return (n + d.tag * 100 + d.deep * 10 + (Box.prototype.tag === 1 ? 5 : 0)) | 0;
}
