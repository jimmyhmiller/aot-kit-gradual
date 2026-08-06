export async function resolve(specifier, context, nextResolve) {
  if (specifier === "typescript") throw new Error("npm TypeScript parser disabled by B02 product-path test");
  return nextResolve(specifier, context);
}
