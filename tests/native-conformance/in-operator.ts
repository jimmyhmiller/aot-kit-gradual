export function main(): number {
  let object: any = { present: undefined, value: 3 };
  const present = "present" in object;
  const value = "value" in object;
  const missing = "missing" in object;
  return ((present ? 100 : 0) + (value ? 10 : 0) + (missing ? 1 : 0)) | 0;
}
