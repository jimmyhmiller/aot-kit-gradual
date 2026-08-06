#!/usr/bin/env node

const numericAdd = process.env.AOT_B13_NUMERIC_ADD === "1";
const charCodeZero = process.env.AOT_B13_CHARCODE_ZERO === "1";
const show = value => Number.isNaN(value) ? "NaN" : Object.is(value, -0) ? "-0" : String(value);
const code = (text, index) => {
  const value = text.charCodeAt(index);
  return charCodeZero && Number.isNaN(value) ? 0 : value;
};
const add = (left, right) => numericAdd ? Number(left) + Number(right) : left + right;

console.log(["literal", "", "coil", "A😀Z".length, code("A😀Z", 1), code("A😀Z", 2)].map(show).join("|"));
console.log(["equality-add", "coil" === "co" + "il", "a" !== "b", add("x", 7), add(7, "8")].map(show).join("|"));
console.log(["chars", "abc".charAt(-1), "abc".charAt(3), code("abc", -1), code("abc", 3), "abc".charAt(1)].map(show).join("|"));
console.log(["ranges", "abcdef".substring(4, 1), "abcdef".substring(-2, 2), "abcdef".substr(-2, 1), "abcdef".slice(-4, -1)].map(show).join("|"));
console.log(["split", "5,5".split(",").join("/"), "a--b--".split("--").join("/"), "abc".split("").join("/"), "".split(",").length, "abc".split().join("/")].map(show).join("|"));
console.log(["convert", String(undefined), String(null), String(true), String(-0), String(NaN), String.fromCharCode(65, 0x263a)].map(show).join("|"));
console.log(["parse", parseInt("  -1fZ", 16), parseInt("010", 10), parseInt("101", 2), parseInt("xyz", 36), parseInt("+", 10)].map(show).join("|"));
console.log(["isnan", isNaN(""), isNaN("12"), isNaN("x"), isNaN(undefined), isNaN(null)].map(show).join("|"));
console.log(["case-search", "AbC".toLowerCase(), "AbC".toUpperCase(), "abcabc".indexOf("bc", 2), "abc".indexOf("z")].map(show).join("|"));
console.log(["string-order", "abc" < "abd", "abc" <= "abc", "abd" > "abc", "abd" >= "abd"].map(show).join("|"));
