export function main(): number {
  let sparse = [10,,30,,];
  let cut = sparse.slice(-3, -1);
  let properties = [];
  properties[-1] = 5;
  properties[1.5] = 6;
  properties['x'] = 7;
  let values = [1];
  let pushed = values.push(2, 3);
  let popped = values.pop();
  return (sparse[0] + sparse[2] + sparse.length + cut.length + cut[1]
    + properties[-1] + properties[1.5] + properties['x'] + properties.length
    + pushed * 100 + popped * 10 + values.length + values[0] + values[1]) | 0;
}
