export function main(): number {
  const values: number[] = [];
  const result = void values.push(41);
  return (values[0] + (result === undefined ? 1 : 100)) | 0;
}
