// The runtime has no Intl subsystem, so localeCompare's implementation-defined ordering is the
// same stable UTF-16 code-unit order used by the DSL's StringCompare operation. Observe signs,
// not a particular negative/positive magnitude, as required by the JavaScript API.
export function main(): number {
  let total = 0;
  total = total + ("apple".localeCompare("banana") < 0 ? 1 : 0);
  total = total + ("banana".localeCompare("apple") > 0 ? 2 : 0);
  total = total + ("same".localeCompare("same") === 0 ? 4 : 0);
  return total | 0;
}
