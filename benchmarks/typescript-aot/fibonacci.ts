function fibonacci(n: number): number {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

export function main(n: number): number {
  return fibonacci(n);
}
