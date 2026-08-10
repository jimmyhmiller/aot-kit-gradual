export function main(): number {
  const decomposed = "é";
  const composed = "é";
  const ligature = "ﬁ";
  let total = 0;
  total = total + (decomposed.normalize() === composed ? 1 : 0);
  total = total + (composed.normalize("NFD").length === 2 ? 2 : 0);
  total = total + (ligature.normalize("NFC") === ligature ? 4 : 0);
  total = total + (ligature.normalize("NFKC") === "fi" ? 8 : 0);
  total = total + (decomposed.normalize("NFKD").length === 2 ? 16 : 0);
  return total | 0;
}
