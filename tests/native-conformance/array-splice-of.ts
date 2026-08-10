// Variadic Array.of and splice are split only at syntax boundaries. Allocation, bounds, deletion,
// insertion, copying, and resizing all come from lib/array/build.jsl.
export function main(): number {
  let values = Array.of(1, 2, 3, 4, 5);
  let removed = values.splice(1, 2, 8, 9, 6);
  let tail = values.splice(-2);
  let untouched = values.splice();
  let result = values.length;
  result = result * 10 + values[0];
  result = result * 10 + values[1];
  result = result * 10 + values[2];
  result = result * 10 + values[3];
  result = result * 10 + removed.length;
  result = result * 10 + removed[0];
  result = result * 10 + removed[1];
  result = result * 10 + tail.length;
  result = result * 10 + tail[0];
  result = result * 10 + tail[1];
  result = result * 10 + untouched.length;
  return result | 0;
}
