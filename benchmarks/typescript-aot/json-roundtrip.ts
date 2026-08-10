export function main(n: number): number {
  let text = '{"name":"kit","values":[1,2,3,4],"active":true}';
  let value = JSON.parse(text);
  value.values[2] = value.values[2] + (n & 1);
  let encoded = JSON.stringify(value);
  return (encoded.length + value.values[2]) | 0;
}
