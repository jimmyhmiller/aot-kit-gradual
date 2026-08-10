export function main(): number {
  let value = Math.sqrt(81) + Math.pow(2, 5) + Math.abs(-7);
  value += Math.floor(3.9) + Math.ceil(3.1) + Math.round(3.6);
  value += Math.min(8, 2) + Math.max(8, 2);
  value += Math.exp(0) + Math.log(1) + Math.sin(0) + Math.cos(0) + Math.tan(0);
  value += Math.asin(0) + Math.acos(1) + Math.atan(0);
  value += (Math.random() >= 0 && Math.random() < 1) ? 10 : 1000;
  return value | 0;
}
