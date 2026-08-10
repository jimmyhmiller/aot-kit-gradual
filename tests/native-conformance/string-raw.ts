export function main(): number {
  let template: any = { raw: ["a", "b", "c"] };
  let order = 0;
  let complete = String.raw(template,
                            (order = order * 10 + 1, 7),
                            (order = order * 10 + 2, false));
  let missing = String.raw(template, 7);
  let extra = String.raw({ raw: ["x"] }, (order = order * 10 + 3, 99));
  let empty = String.raw({ raw: [] }, 1);
  return ((complete === "a7bfalsec" ? 100 : 0)
          + (missing === "a7bc" ? 20 : 0)
          + (extra === "x" ? 4 : 0)
          + (empty === "" ? 2 : 0)
          + (order === 123 ? 1 : 0)) | 0;
}
