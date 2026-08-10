// Global/Number constants are sourced from JSL, and codePointAt combines surrogate pairs while
// preserving lone trailing surrogates and the out-of-range undefined result.
export function main(): number {
  let flags = (Infinity > Number.MAX_SAFE_INTEGER ? 1 : 0)
    + (Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2 ? 2 : 0)
    + ("A".codePointAt(3) === undefined ? 4 : 0);
  return (flags * 1000000 + "😀".codePointAt(0) * 2 + "😀".codePointAt(1)) | 0;
}
