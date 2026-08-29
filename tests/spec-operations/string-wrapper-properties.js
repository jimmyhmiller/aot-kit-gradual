function main(n) {
  const wrapper = Object("abc");
  if (wrapper[1] === undefined) return 101;
  if (wrapper.length !== 3) return 102;
  const descriptor = Object.getOwnPropertyDescriptor(wrapper, "1");
  if (descriptor.value !== "b") return 103;
  if (descriptor.writable !== false) return 104;
  if (descriptor.enumerable !== true) return 105;
  if (descriptor.configurable !== false) return 106;
  if (!wrapper.hasOwnProperty("1")) return 107;
  if (!wrapper.propertyIsEnumerable("1")) return 108;
  if (wrapper.hasOwnProperty("3")) return 109;
  if (wrapper["01"] !== undefined) return 110;
  if (wrapper["1.0"] !== undefined) return 111;
  if (wrapper["+1"] !== undefined) return 112;
  if (wrapper["-0"] !== undefined) return 113;
  if (wrapper["NaN"] !== undefined) return 114;
  if (wrapper["Infinity"] !== undefined) return 115;
  return n | 0;
}
