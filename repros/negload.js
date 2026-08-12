// Unary minus on a dyn array element. `-x[5]` lowered to Sub(0, ArrayLoad) with NO ToNumber
// guard on the operand, so selection emitted a raw integer SUB on the tagged word. When the
// element is float-REPRESENTED (main's ((i*3)%7)-3 is selected through FMOD, so v[i] is stored
// as raw IEEE bits), low32(0 - bits) is 0 and the int re-box zeroed the cell: native x[1] = 0
// where Node has 2. This was the NavierStokes set_bnd corruption; every earlier "shape-dependent"
// observation was just checksums that never read the corrupted cell. The checksum here reads
// EVERY cell so the wrong write cannot hide.
function set_bnd(x)
{
    x[1] = -x[5];
}
function main() {
  var v = new Array(16);
  for (var i = 0; i < 16; i++) { v[i] = ((i * 3) % 7) - 3; }
  set_bnd(v);
  var sum = 0;
  for (var i = 0; i < 16; i += 1) sum = sum + v[i] * 100;
  return sum | 0;
}
