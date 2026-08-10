export function main(): number {
  const value = `a\nb`;
  return (value.length * 100 + value.charCodeAt(1)) | 0;
}
